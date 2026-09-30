/**
 * Multi-State Customs Unions & Market Access Networks
 * Subsystem: /src/economy/customs_union.ts
 */

export interface CustomsUnionPact {
  unionId: string;
  leaderTag: string;
  centralMarketHubId: number;
  memberTags: string[];
  sharedStrategicGoods: string[];
  tariffPenaltyModifier: number; // 1.0 (Zero Tariff)
  leaderTransactionSkimRate: number; // 0.10 (10% skim to leader treasury)
  aggregateMonthlyVolume: number;
}

export class CustomsUnionManager {
  private unions: Map<string, CustomsUnionPact> = new Map();
  private tagUnionLookup: Map<string, string> = new Map();

  public createUnion(
    leaderTag: string,
    centralMarketHubId: number,
    initialMembers: string[] = []
  ): CustomsUnionPact {
    const unionId = `customs_union_${leaderTag}`;
    const allMembers = [leaderTag, ...initialMembers.filter(m => m !== leaderTag)];

    const pact: CustomsUnionPact = {
      unionId,
      leaderTag,
      centralMarketHubId,
      memberTags: allMembers,
      sharedStrategicGoods: ['iron', 'timber', 'naval_supplies'],
      tariffPenaltyModifier: 1.0, // Zero tariff modifier
      leaderTransactionSkimRate: 0.10, // 10% transaction skim
      aggregateMonthlyVolume: 0.0
    };

    this.unions.set(unionId, pact);
    for (const tag of allMembers) {
      this.tagUnionLookup.set(tag, unionId);
    }

    return pact;
  }

  public inviteMember(unionId: string, candidateTag: string): boolean {
    const pact = this.unions.get(unionId);
    if (!pact || pact.memberTags.includes(candidateTag)) {
      return false;
    }

    pact.memberTags.push(candidateTag);
    this.tagUnionLookup.set(candidateTag, unionId);
    return true;
  }

  /**
   * Transport cost calculator with Customs Union tariff waiver:
   * Members transport goods across borders without the standard 2.5x tariff friction.
   */
  public calculateGoodsTransportCost(baseCost: number, tagA: string, tagB: string): number {
    const unionA = this.tagUnionLookup.get(tagA);
    const unionB = this.tagUnionLookup.get(tagB);

    if (unionA && unionB && unionA === unionB) {
      return Number((baseCost * 1.0).toFixed(2)); // Zero tariff modifier within union
    }

    return Number((baseCost * 2.5).toFixed(2)); // Standard border tariff friction
  }

  /**
   * Monthly Customs Union Trade Tick:
   * - Aggregates transaction throughput across members
   * - Skims 10% commercial revenue into union leader's treasury
   * - Distributes shared strategic good availability bonus (+15% workshop efficiency)
   */
  public processCustomsUnionTradeTicks(
    unionId: string,
    memberVolumes: { countryTag: string; commercialVolume: number }[]
  ): {
    totalVolume: number;
    leaderSkimRevenue: number;
    memberSharedGoodsBonus: number;
  } {
    const pact = this.unions.get(unionId);
    if (!pact) {
      return { totalVolume: 0, leaderSkimRevenue: 0, memberSharedGoodsBonus: 0 };
    }

    let totalVolume = 0;
    for (const mv of memberVolumes) {
      if (pact.memberTags.includes(mv.countryTag)) {
        totalVolume += mv.commercialVolume;
      }
    }

    pact.aggregateMonthlyVolume = totalVolume;
    const leaderSkim = Number((totalVolume * pact.leaderTransactionSkimRate).toFixed(2));
    const sharedGoodsBonus = 0.15; // +15% workshop efficiency for members

    return {
      totalVolume,
      leaderSkimRevenue: leaderSkim,
      memberSharedGoodsBonus: sharedGoodsBonus
    };
  }

  public isMemberOfUnion(tag: string, unionId?: string): boolean {
    const assignedUnion = this.tagUnionLookup.get(tag);
    if (!assignedUnion) return false;
    if (unionId) return assignedUnion === unionId;
    return true;
  }

  public getUnionForTag(tag: string): CustomsUnionPact | undefined {
    const unionId = this.tagUnionLookup.get(tag);
    return unionId ? this.unions.get(unionId) : undefined;
  }

  public getUnion(unionId: string): CustomsUnionPact | undefined {
    return this.unions.get(unionId);
  }
}
