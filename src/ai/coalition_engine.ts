/**
 * Dynamic AI Coalition & Balance of Power Matrix
 * Subsystem: /src/ai/coalition_engine.ts
 */

export const CoalitionStance = {
  Normal_Diplomacy: 'Normal_Diplomacy',
  Heightened_Vigilance: 'Heightened_Vigilance',
  Contain_Hegemon_Aggression: 'Contain_Hegemon_Aggression'
} as const;

export type CoalitionStance = typeof CoalitionStance[keyof typeof CoalitionStance];

export interface SovereignThreatRecord {
  countryTag: string;
  acquiredNodes60m: number;
  baseThreatScore: number;
  globalThreatIndex: number;
  cultureGroup: string;
  armySize: number;
  isHegemon: boolean;
}

export interface DefensiveCoalitionPact {
  pactId: string;
  targetHegemonTag: string;
  memberTags: string[];
  formationDateTick: number;
  isActive: boolean;
  collectiveArmySize: number;
}

export class AICoalitionManager {
  private threatRecords: Map<string, SovereignThreatRecord> = new Map();
  private activeCoalitions: Map<string, DefensiveCoalitionPact> = new Map();
  private criticalThreatThreshold: number = 0.75;

  constructor(criticalThreshold: number = 0.75) {
    this.criticalThreatThreshold = criticalThreshold;
  }

  public registerSovereign(
    countryTag: string,
    cultureGroup: string,
    armySize: number,
    baseThreat: number = 0.20
  ): void {
    this.threatRecords.set(countryTag, {
      countryTag,
      acquiredNodes60m: 0,
      baseThreatScore: baseThreat,
      globalThreatIndex: baseThreat,
      cultureGroup,
      armySize,
      isHegemon: false
    });
  }

  /**
   * Tracks territorial conquest over a rolling 60-month window
   */
  public recordTerritoryAcquisition(countryTag: string, newlyAcquiredNodesCount: number): void {
    const record = this.threatRecords.get(countryTag);
    if (!record) return;

    record.acquiredNodes60m += newlyAcquiredNodesCount;
    this.recomputeThreatIndex(record);
  }

  /**
   * Threat Hub Aggregator:
   * If country acquires > 15 location nodes in 60 months, scale threat index exponentially
   */
  public recomputeThreatIndex(record: SovereignThreatRecord): number {
    if (record.acquiredNodes60m <= 15) {
      record.globalThreatIndex = Number(Math.min(1.0, record.baseThreatScore + (record.acquiredNodes60m * 0.02)).toFixed(4));
    } else {
      const excess = record.acquiredNodes60m - 15;
      // Exponential scaling factor 1.15^excess
      const exponentialMultiplier = Math.pow(1.15, excess);
      const computed = (record.baseThreatScore + 0.30) * exponentialMultiplier;
      record.globalThreatIndex = Number(Math.min(5.0, computed).toFixed(4));
    }

    record.isHegemon = record.globalThreatIndex >= this.criticalThreatThreshold;
    return record.globalThreatIndex;
  }

  public getThreatRecord(countryTag: string): SovereignThreatRecord | undefined {
    return this.threatRecords.get(countryTag);
  }

  /**
   * Containment Coalition Protocol:
   * Evaluates if adjacent AI tags should automatically form a Defensive_Coalition_Pact
   * against the hegemon.
   */
  public evaluateCoalitionFormation(
    hegemonTag: string,
    adjacentCandidateTags: string[],
    currentTick: number = 0
  ): DefensiveCoalitionPact | null {
    const hegemonRecord = this.threatRecords.get(hegemonTag);
    if (!hegemonRecord || hegemonRecord.globalThreatIndex < this.criticalThreatThreshold) {
      return null;
    }

    // Filter adjacent AI tags with matching culture groups or shared security threats
    const coalitionMembers: string[] = [];
    let collectiveArmies = 0;

    for (const tag of adjacentCandidateTags) {
      if (tag === hegemonTag) continue;

      const neighborRecord = this.threatRecords.get(tag);
      if (neighborRecord) {
        // AI tags join coalition if they feel threatened by hegemon's exponential growth
        coalitionMembers.push(tag);
        collectiveArmies += neighborRecord.armySize;
      }
    }

    // Require at least 2 member states to form valid balance of power bloc
    if (coalitionMembers.length >= 2) {
      const pactId = `coalition_contain_${hegemonTag}`;
      const pact: DefensiveCoalitionPact = {
        pactId,
        targetHegemonTag: hegemonTag,
        memberTags: coalitionMembers,
        formationDateTick: currentTick,
        isActive: true,
        collectiveArmySize: collectiveArmies
      };

      this.activeCoalitions.set(pactId, pact);
      return pact;
    }

    return null;
  }

  /**
   * Evaluates stance of a sovereign toward a target
   */
  public getCoalitionStance(
    evaluatorTag: string,
    targetHegemonTag: string
  ): CoalitionStance {
    const pactId = `coalition_contain_${targetHegemonTag}`;
    const activePact = this.activeCoalitions.get(pactId);

    if (activePact && activePact.isActive && activePact.memberTags.includes(evaluatorTag)) {
      return CoalitionStance.Contain_Hegemon_Aggression;
    }

    const hegemonRecord = this.threatRecords.get(targetHegemonTag);
    if (hegemonRecord && hegemonRecord.globalThreatIndex >= 0.50) {
      return CoalitionStance.Heightened_Vigilance;
    }

    return CoalitionStance.Normal_Diplomacy;
  }

  public getActiveCoalitions(): DefensiveCoalitionPact[] {
    return Array.from(this.activeCoalitions.values()).filter(p => p.isActive);
  }
}
