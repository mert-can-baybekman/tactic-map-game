/**
 * Dynastic Family Tree, Pretender Claims & Succession Crises Core
 * Subsystem: /src/politics/dynasty_core.ts
 */

export interface DynasticCharacterNode {
  id: string;
  name: string;
  dynastyName: string;
  birthYear: number;
  isMonarch: boolean;
  isHeir: boolean;
  isLegitimate: boolean;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  siblingIds: string[];
  childIds: string[];
  claimLegitimacyFloat: number; // 0.0 to 100.0
  ambition: number; // 0.0 to 100.0
  loyalty: number; // 0.0 to 100.0
}

export interface MilitaryGeneralCharacter {
  id: string;
  name: string;
  countryTag: string;
  armyStackId: number;
  locationId: number;
  troopCount: number;
  ambition: number; // 0.0 to 100.0
  loyalty: number; // 0.0 to 100.0
  hasDefected: boolean;
}

export interface PretenderRebelFaction {
  factionId: string;
  countryTag: string;
  pretenderCharacterId: string;
  pretenderName: string;
  rebelTroopCount: number;
  rebellionLocationIds: number[];
  isSuccessionCrisisActive: boolean;
  defectedGeneralIds: string[];
}

export class DynasticTreeManager {
  private characters: Map<string, DynasticCharacterNode> = new Map();
  private generals: Map<string, MilitaryGeneralCharacter> = new Map();
  private activeCrises: Map<string, PretenderRebelFaction> = new Map();

  public registerCharacter(char: DynasticCharacterNode): void {
    this.characters.set(char.id, char);
  }

  public registerGeneral(general: MilitaryGeneralCharacter): void {
    this.generals.set(general.id, general);
  }

  public getCharacter(id: string): DynasticCharacterNode | undefined {
    return this.characters.get(id);
  }

  /**
   * Calculates dynamic claim legitimacy based on lineage factors:
   * Legitimate direct issue born in wedlock receives 100%,
   * Siblings receive 65%, cousins/collaterals 40%, illegitimate bastards 15%.
   */
  public calculateClaimLegitimacy(char: DynasticCharacterNode, currentMonarchId?: string): number {
    if (!char.isLegitimate) {
      return Number(Math.min(25.0, char.claimLegitimacyFloat * 0.25).toFixed(1));
    }

    if (char.isMonarch) {
      return 100.0;
    }

    if (currentMonarchId) {
      const monarch = this.characters.get(currentMonarchId);
      if (monarch) {
        // Direct child of current monarch
        if (monarch.childIds.includes(char.id)) {
          return 95.0;
        }
        // Sibling of current monarch
        if (monarch.siblingIds.includes(char.id)) {
          return 70.0;
        }
      }
    }

    return char.claimLegitimacyFloat;
  }

  /**
   * Succession Crisis Protocol:
   * If monarch passes away and successor legitimacy < 50%, or Nobility Estate owns > 30% of state-wide wealth:
   * - Instantiates Pretender_Rebel_Faction backed by secondary dynastic pointer.
   * - Splinters military: any general with ambition > 60 and loyalty < 40 defects.
   */
  public evaluateSuccessionCrisis(
    countryTag: string,
    currentMonarchId: string,
    successorId: string,
    nobilityWealthShare: number
  ): PretenderRebelFaction | null {
    const successor = this.characters.get(successorId);
    if (!successor) return null;

    const legitimacy = this.calculateClaimLegitimacy(successor, currentMonarchId);
    const triggersCrisis = legitimacy < 50.0 || nobilityWealthShare > 0.30;

    if (!triggersCrisis) {
      return null;
    }

    // Find pretender claimant (highest ambition dynastic rival not the successor)
    let bestPretender: DynasticCharacterNode | undefined;
    for (const char of this.characters.values()) {
      if (char.id !== successorId && !char.isMonarch && char.dynastyName === successor.dynastyName) {
        if (!bestPretender || char.ambition > bestPretender.ambition) {
          bestPretender = char;
        }
      }
    }

    if (!bestPretender) {
      // Fallback claimant
      bestPretender = {
        id: `pretender_${countryTag}`,
        name: `Pretender of ${successor.dynastyName}`,
        dynastyName: successor.dynastyName,
        birthYear: successor.birthYear - 2,
        isMonarch: false,
        isHeir: false,
        isLegitimate: false,
        siblingIds: [],
        childIds: [],
        claimLegitimacyFloat: 35.0,
        ambition: 85.0,
        loyalty: 10.0
      };
      this.registerCharacter(bestPretender);
    }

    // Splinter military generals
    let rebelArmyFromGenerals = 0;
    const defectedGenerals: string[] = [];
    const affectedLocations: number[] = [];

    for (const general of this.generals.values()) {
      if (general.countryTag === countryTag && !general.hasDefected) {
        // High ambition and low loyalty causes defection
        if (general.ambition > 60.0 && general.loyalty < 40.0) {
          general.hasDefected = true;
          defectedGenerals.push(general.id);
          rebelArmyFromGenerals += general.troopCount;
          affectedLocations.push(general.locationId);
        }
      }
    }

    const basePretenderForces = 6000 + Math.floor(bestPretender.ambition * 50);
    const totalRebelTroops = basePretenderForces + rebelArmyFromGenerals;

    const factionId = `pretender_faction_${countryTag}_${bestPretender.id}`;
    const faction: PretenderRebelFaction = {
      factionId,
      countryTag,
      pretenderCharacterId: bestPretender.id,
      pretenderName: bestPretender.name,
      rebelTroopCount: totalRebelTroops,
      rebellionLocationIds: affectedLocations.length > 0 ? affectedLocations : [1],
      isSuccessionCrisisActive: true,
      defectedGeneralIds: defectedGenerals
    };

    this.activeCrises.set(countryTag, faction);
    return faction;
  }

  public getActiveCrisis(countryTag: string): PretenderRebelFaction | undefined {
    return this.activeCrises.get(countryTag);
  }
}
