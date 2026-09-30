/**
 * Asynchronous Dynamic Anti-Hegemon AI Coalition Weaver
 * Subsystem: /src/ai/coalition_core.ts
 */

export interface AggressiveExpansionRecord {
  hegemonTag: string;
  observerTag: string;
  accumulatedAE: number; // Critical threshold > 50.0
  sameCultureGroup: boolean;
  sameReligion: boolean;
}

export interface CoalitionNetworkPact {
  networkId: string;
  hegemonTag: string;
  memberTags: string[];
  isActive: boolean;
  combinedLevySize: number;
  synchronizedDefenseGrid: boolean;
  formationMonthTick: number;
}

export class AICoalitionWeaver {
  // Key: `${hegemonTag}_vs_${observerTag}` -> AE float
  private aeRecords: Map<string, AggressiveExpansionRecord> = new Map();
  private activeNetworks: Map<string, CoalitionNetworkPact> = new Map();
  private criticalAEThreshold: number = 50.0;

  constructor(threshold: number = 50.0) {
    this.criticalAEThreshold = threshold;
  }

  /**
   * Generates Aggressive Expansion (AE) from conquests or dependency integrations.
   * Multipliers: Same culture group: 1.50x, same religion: 1.25x.
   */
  public addAggressiveExpansion(
    hegemonTag: string,
    observerTag: string,
    baseAE: number,
    sameCulture: boolean = false,
    sameReligion: boolean = false
  ): number {
    const key = `${hegemonTag}_vs_${observerTag}`;
    let record = this.aeRecords.get(key);

    const cultureMult = sameCulture ? 1.50 : 1.0;
    const religionMult = sameReligion ? 1.25 : 0.75;
    const finalDelta = baseAE * cultureMult * religionMult;

    if (!record) {
      record = {
        hegemonTag,
        observerTag,
        accumulatedAE: 0.0,
        sameCultureGroup: sameCulture,
        sameReligion
      };
      this.aeRecords.set(key, record);
    }

    record.accumulatedAE = Number((record.accumulatedAE + finalDelta).toFixed(2));
    return record.accumulatedAE;
  }

  public getAggressiveExpansion(hegemonTag: string, observerTag: string): number {
    const record = this.aeRecords.get(`${hegemonTag}_vs_${observerTag}`);
    return record ? record.accumulatedAE : 0.0;
  }

  /**
   * Monthly natural decay of AE (default -0.20 per month)
   */
  public processMonthlyAEDecay(decayRate: number = 0.20): void {
    for (const record of this.aeRecords.values()) {
      if (record.accumulatedAE > 0.0) {
        record.accumulatedAE = Math.max(0.0, Number((record.accumulatedAE - decayRate).toFixed(2)));
      }
    }
  }

  /**
   * Automated Coalition Matrix Pass:
   * Month-end evaluation pass. If accumulated AE > 50.0 against a cluster of neighbor tags:
   * - Bypasses standard bilateral opinion constraints to form an exclusive Coalition_Network_Pact.
   * - Locks members into a mutual defense grid.
   */
  public evaluateMonthEndCoalitionSequencer(
    hegemonTag: string,
    candidateNeighbors: string[],
    armyLookup: (tag: string) => number,
    currentMonthTick: number = 0
  ): CoalitionNetworkPact | null {
    const coalitionMembers: string[] = [];
    let combinedLevies = 0;

    for (const neighbor of candidateNeighbors) {
      if (neighbor === hegemonTag) continue;

      const ae = this.getAggressiveExpansion(hegemonTag, neighbor);
      if (ae >= this.criticalAEThreshold) {
        coalitionMembers.push(neighbor);
        combinedLevies += armyLookup(neighbor);
      }
    }

    // Coalition network forms if at least 2 threatened sovereigns unite
    if (coalitionMembers.length >= 2) {
      const networkId = `coalition_network_${hegemonTag}`;
      const pact: CoalitionNetworkPact = {
        networkId,
        hegemonTag,
        memberTags: coalitionMembers,
        isActive: true,
        combinedLevySize: combinedLevies,
        synchronizedDefenseGrid: true,
        formationMonthTick: currentMonthTick
      };

      this.activeNetworks.set(networkId, pact);
      return pact;
    }

    return null;
  }

  /**
   * Synchronized Defense Grid:
   * If hegemon declares war on ANY member, the entire network triggers an instantaneous,
   * synchronized war defense call.
   */
  public triggerSynchronizedCoalitionDefense(
    hegemonTag: string,
    attackedMemberTag: string
  ): {
    defenseTriggered: boolean;
    deployingMembers: string[];
    totalCombinedLevy: number;
  } {
    const networkId = `coalition_network_${hegemonTag}`;
    const pact = this.activeNetworks.get(networkId);

    if (pact && pact.isActive && pact.memberTags.includes(attackedMemberTag)) {
      return {
        defenseTriggered: true,
        deployingMembers: [...pact.memberTags],
        totalCombinedLevy: pact.combinedLevySize
      };
    }

    return {
      defenseTriggered: false,
      deployingMembers: [],
      totalCombinedLevy: 0
    };
  }

  public getActiveNetwork(hegemonTag: string): CoalitionNetworkPact | undefined {
    return this.activeNetworks.get(`coalition_network_${hegemonTag}`);
  }
}
