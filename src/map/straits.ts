/**
 * Strait Interdiction Blockade Engine & The Bosphorus Barrier
 * Manages physical strait choke-points, naval interdiction fleet detection,
 * law-based passage embargoes, and 300% toll extortion / logistical starvation loops.
 */

export interface LandPairConnection {
  fromNodeId: number;
  toNodeId: number;
  label: string;
}

export interface MaritimeStraitDefinition {
  straitId: string;
  name: string;
  controllingFortLocationId: number;
  blockadeStatusFloat: number; // 0.0 (open) to 1.0 (impenetrable blockade)
  blockadingFleetTag: string | null;
  fleetStrength: number;
  connectedLandPairs: LandPairConnection[];
  tollRate: number; // 0.0 to 3.0 (3.0 = 300% gold toll)
  passageBlockedByLaw: boolean;
  controllingNationTag: string;
}

export interface StraitPassageResult {
  straitId: string;
  isTraversable: boolean;
  requiresToll: boolean;
  tollAmountGold: number;
  tollRatePercent: number; // e.g. 300.0
  logisticalReinforcementEfficiency: number; // 1.0 (normal) to 0.0 (starved)
  reason: 'OPEN_PASSAGE' | 'BLOCKADED_BY_FLEET' | 'EMBARGOED_BY_LAW' | 'TOLL_PAID' | 'TOLL_REFUSED_OR_UNPAYABLE';
}

export class MaritimeStrait {
  public straitId: string;
  public name: string;
  public controllingFortLocationId: number;
  public blockadeStatusFloat: number;
  public blockadingFleetTag: string | null;
  public fleetStrength: number;
  public connectedLandPairs: LandPairConnection[];
  public tollRate: number;
  public passageBlockedByLaw: boolean;
  public controllingNationTag: string;

  constructor(def: MaritimeStraitDefinition) {
    this.straitId = def.straitId;
    this.name = def.name;
    this.controllingFortLocationId = def.controllingFortLocationId;
    this.blockadeStatusFloat = Math.max(0.0, Math.min(1.0, def.blockadeStatusFloat));
    this.blockadingFleetTag = def.blockadingFleetTag;
    this.fleetStrength = def.fleetStrength;
    this.connectedLandPairs = [...def.connectedLandPairs];
    this.tollRate = def.tollRate;
    this.passageBlockedByLaw = def.passageBlockedByLaw;
    this.controllingNationTag = def.controllingNationTag;
  }

  public setBlockade(status: number, fleetTag: string | null = null, fleetStrength: number = 0): void {
    this.blockadeStatusFloat = Math.max(0.0, Math.min(1.0, status));
    this.blockadingFleetTag = fleetTag;
    this.fleetStrength = fleetStrength;
  }

  public setLawPassageEmbargo(blocked: boolean): void {
    this.passageBlockedByLaw = blocked;
  }

  public setTollRate(rate: number): void {
    this.tollRate = Math.max(0.0, rate);
  }
}

export class StraitInterdictionEngine {
  private straits: Map<string, MaritimeStrait> = new Map();

  constructor() {
    this.initializeDefaultStraits();
  }

  private initializeDefaultStraits(): void {
    // 1. The Bosphorus Strait & Dardanelles Barrier
    // Choke between Adrianople (110) & Constantinople (104) and Bursa (102)
    this.registerStrait(new MaritimeStrait({
      straitId: 'bosphorus_strait',
      name: 'The Bosphorus & Dardanelles Barrier',
      controllingFortLocationId: 104, // Constantinople Theodosian Choke
      blockadeStatusFloat: 0.0,
      blockadingFleetTag: null,
      fleetStrength: 0,
      connectedLandPairs: [
        { fromNodeId: 110, toNodeId: 102, label: 'Adrianople (Edirne) <-> Bursa' },
        { fromNodeId: 104, toNodeId: 102, label: 'Constantinople <-> Bursa' }
      ],
      tollRate: 0.0,
      passageBlockedByLaw: false,
      controllingNationTag: 'BYZ'
    }));

    // 2. The Strait of Gibraltar
    this.registerStrait(new MaritimeStrait({
      straitId: 'gibraltar_strait',
      name: 'The Strait of Gibraltar',
      controllingFortLocationId: 34,
      blockadeStatusFloat: 0.0,
      blockadingFleetTag: null,
      fleetStrength: 0,
      connectedLandPairs: [
        { fromNodeId: 34, toNodeId: 35, label: 'Gibraltar <-> Ceuta' }
      ],
      tollRate: 0.0,
      passageBlockedByLaw: false,
      controllingNationTag: 'CAS'
    }));
  }

  public registerStrait(strait: MaritimeStrait): void {
    this.straits.set(strait.straitId, strait);
  }

  public getStrait(straitId: string): MaritimeStrait | undefined {
    return this.straits.get(straitId);
  }

  /**
   * Interception Pass Algorithm:
   * Evaluates army or trade transit across a physical strait.
   * If a foreign naval fleet stack is deployed to the strait lane or the controlling nation
   * blocks passage via state laws, execute pathfinding block:
   * Any army attempting to traverse the land-bridge from Adrianople (Edirne) to Bursa suffers
   * a complete path block, or must pay a 300% gold toll to pass, starving the Ottoman army's
   * logistical reinforcement lines in the Balkans.
   */
  public evaluateStraitPassage(
    straitId: string,
    transitingArmyTag: string,
    armySize: number,
    armyTreasuryGold: number,
    optToPayTollIfRequired: boolean = true
  ): StraitPassageResult {
    const strait = this.straits.get(straitId);
    if (!strait) {
      throw new Error(`Strait ${straitId} does not exist in spatial engine.`);
    }

    // Free passage if controlling nation itself or friendly alliance
    if (strait.controllingNationTag === transitingArmyTag && strait.blockadeStatusFloat < 0.10) {
      return {
        straitId,
        isTraversable: true,
        requiresToll: false,
        tollAmountGold: 0.0,
        tollRatePercent: 0.0,
        logisticalReinforcementEfficiency: 1.0,
        reason: 'OPEN_PASSAGE'
      };
    }

    const isBlockadedByForeignFleet = strait.blockadeStatusFloat >= 0.50 && strait.blockadingFleetTag !== transitingArmyTag;
    const isRestrictedByLaw = strait.passageBlockedByLaw && strait.controllingNationTag !== transitingArmyTag;

    // Check if barrier is active
    if (isBlockadedByForeignFleet || isRestrictedByLaw) {
      // 300% toll requirement (3.0x base crossing tariff = 0.05 gold per soldier * 3.0 = 0.15 gold / soldier)
      const baseCostPerMan = 0.05;
      const tollRateMultiplier = 3.0; // 300% toll
      const totalTollRequired = Number((armySize * baseCostPerMan * tollRateMultiplier).toFixed(1));

      if (optToPayTollIfRequired && armyTreasuryGold >= totalTollRequired) {
        // Toll paid: passage allowed but logistical efficiency severely degraded (reinforcement starved)
        return {
          straitId,
          isTraversable: true,
          requiresToll: true,
          tollAmountGold: totalTollRequired,
          tollRatePercent: 300.0,
          logisticalReinforcementEfficiency: 0.15, // Severe 85% logistical degradation
          reason: 'TOLL_PAID'
        };
      } else {
        // Complete path block: army cannot traverse, reinforcement efficiency drops to 0.0
        return {
          straitId,
          isTraversable: false,
          requiresToll: true,
          tollAmountGold: totalTollRequired,
          tollRatePercent: 300.0,
          logisticalReinforcementEfficiency: 0.0, // Starved
          reason: isBlockadedByForeignFleet ? 'BLOCKADED_BY_FLEET' : 'EMBARGOED_BY_LAW'
        };
      }
    }

    // Normal uninhibited passage
    return {
      straitId,
      isTraversable: true,
      requiresToll: false,
      tollAmountGold: 0.0,
      tollRatePercent: 0.0,
      logisticalReinforcementEfficiency: 1.0,
      reason: 'OPEN_PASSAGE'
    };
  }
}
