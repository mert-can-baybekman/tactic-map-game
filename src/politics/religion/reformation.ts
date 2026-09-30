/**
 * Dynamic Religious Reformation, Heresy & Holy War Core Engine
 * Tracks religious zeal, heretic factions, reformation waves, and Holy War Casus Belli
 */

export interface ReligiousFaction {
  id: string;
  name: string;
  faithTag: string; // e.g. 'Catholic', 'Protestant', 'Hussite', 'Orthodox', 'Sunni'
  zealFloat: number; // 0.0 to 100.0
  discontentIndex: number; // 0.0 to 100.0
  isHeretical: boolean;
  spawnedLocations: number[];
}

export interface HolyWarCasusBelli {
  cbId: string;
  attackerTag: string;
  defenderTag: string;
  targetHolyCityLocationId: number;
  warScoreWeightBonus: number; // e.g. 0.50 (+50% WS for holy hubs)
  requiresClaimJustification: boolean; // false
  dateUnlocked: string;
}

export interface ReformationLocationContext {
  id: number;
  name: string;
  countryTag: string;
  primaryFaith: string;
  burgherWealth: number;
  printingPressPresence: number; // 0.0 to 100.0%
  connectedTradeEdgeIds: number[];
  isHolyHub: boolean;
}

export class ReformationEngine {
  private globalReligiousZeal: number = 65.0; // Global baseline
  private papalAuthority: number = 50.0;
  private hereticFactions: Map<string, ReligiousFaction> = new Map();
  private activeHolyWars: Map<string, HolyWarCasusBelli> = new Map();
  private isReformationTriggered: boolean = false;

  constructor() {
    this.initializeDefaultFactions();
  }

  private initializeDefaultFactions(): void {
    this.hereticFactions.set('hussite_heresy', {
      id: 'hussite_heresy',
      name: 'Bohemian Hussite Brethren',
      faithTag: 'Hussite',
      zealFloat: 80.0,
      discontentIndex: 45.0,
      isHeretical: true,
      spawnedLocations: []
    });
  }

  public getGlobalZeal(): number {
    return this.globalReligiousZeal;
  }

  public setPapalAuthority(val: number): void {
    this.papalAuthority = Math.max(0.0, Math.min(100.0, val));
  }

  public getPapalAuthority(): number {
    return this.papalAuthority;
  }

  public isReformationActive(): boolean {
    return this.isReformationTriggered;
  }

  /**
   * Monthly Religious Discontent & Heresy Tick:
   * Low national stability (< 20) or excessive Clergy Estate privileges (> 2)
   * triggers heretic faction uprisings in disaffected pop arrays.
   */
  public evaluateHeresyTick(
    countryTag: string,
    stabilityIndex: number,
    clergyPrivilegeCount: number,
    locationIds: number[]
  ): { spawnedHeresy: boolean; factionName?: string; affectedLocationId?: number } {
    if (stabilityIndex < 20.0 || clergyPrivilegeCount >= 3) {
      const faction = this.hereticFactions.get('hussite_heresy');
      if (faction && locationIds.length > 0) {
        const targetLocId = locationIds[0];
        if (!faction.spawnedLocations.includes(targetLocId)) {
          faction.spawnedLocations.push(targetLocId);
          faction.discontentIndex = Math.min(100.0, faction.discontentIndex + 15.0);
          return {
            spawnedHeresy: true,
            factionName: faction.name,
            affectedLocationId: targetLocId
          };
        }
      }
    }
    return { spawnedHeresy: false };
  }

  /**
   * Evaluates the Reformation Trigger Matrix:
   * Requires: Printing Press Presence >= 40.0%, Burgher Wealth >= 600.0 D, Papal Authority <= 35.0
   */
  public evaluateReformationTrigger(
    locations: ReformationLocationContext[],
    currentDateStr: string = '1350-01-01'
  ): {
    triggered: boolean;
    originLocationId?: number;
    convertedLocationIds: number[];
  } {
    if (this.isReformationTriggered) {
      return { triggered: false, convertedLocationIds: [] };
    }

    for (const loc of locations) {
      if (
        loc.printingPressPresence >= 40.0 &&
        loc.burgherWealth >= 600.0 &&
        this.papalAuthority <= 35.0
      ) {
        // Breakthrough occurs!
        this.isReformationTriggered = true;
        this.globalReligiousZeal = 95.0; // Spikes religious fervor
        loc.primaryFaith = 'Protestant';

        // Wave propagation along trade edges
        const convertedLocationIds: number[] = [loc.id];
        for (const edgeId of loc.connectedTradeEdgeIds) {
          convertedLocationIds.push(edgeId);
        }

        return {
          triggered: true,
          originLocationId: loc.id,
          convertedLocationIds
        };
      }
    }

    return { triggered: false, convertedLocationIds: [] };
  }

  /**
   * Unlocks zero-claim Holy War Casus Belli against adjacent different-faith sovereign
   */
  public unlockHolyWarCasusBelli(
    attackerTag: string,
    defenderTag: string,
    targetHolyCityLocationId: number,
    currentDateStr: string = '1350-01-01'
  ): HolyWarCasusBelli {
    const cbId = `cb_holy_war_${attackerTag}_vs_${defenderTag}`;
    const cb: HolyWarCasusBelli = {
      cbId,
      attackerTag,
      defenderTag,
      targetHolyCityLocationId,
      warScoreWeightBonus: 0.50, // +50% War Score weight for holy hubs
      requiresClaimJustification: false, // Bypasses standard claim timers
      dateUnlocked: currentDateStr
    };

    this.activeHolyWars.set(cbId, cb);
    return cb;
  }

  public getActiveHolyWars(): HolyWarCasusBelli[] {
    return Array.from(this.activeHolyWars.values());
  }
}
