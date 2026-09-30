/**
 * Holy Roman Empire (HRE) Vote & Reform Matrix
 * Manages Imperial Authority, Elector voting calculations, and global control decay reform adjustments.
 */

export interface HREElector {
  countryTag: string;
  electorName: string;
  opinionOfEmperor: number; // -100 to 100
  crownPrestige: number; // 0 to 100
  religiousParity: boolean; // Same confession as Emperor
  currentCandidateVote: string;
}

export interface ImperialReform {
  id: string;
  name: string;
  tier: number;
  authorityCost: number; // e.g. 50.0 Imperial Authority
  controlDecayReduction: number; // e.g. -0.004 reduction in monthly control decay across member nodes
  globalTaxEfficiencyBonus: number; // e.g. +0.05 (+5% tax income)
  enacted: boolean;
  enactedDate?: string;
}

export class HRESubsystem {
  public emperorTag: string;
  public imperialAuthority: number; // 0.0 to 100.0
  public electors: Map<string, HREElector> = new Map();
  public memberLocationIds: number[] = [];
  public reforms: ImperialReform[] = [];

  constructor(emperorTag: string = 'HAB', initialAuthority: number = 45.0) {
    this.emperorTag = emperorTag;
    this.imperialAuthority = initialAuthority;
    this.initializeDefaultElectors();
    this.initializeDefaultReforms();
  }

  public registerElector(elector: HREElector): void {
    this.electors.set(elector.countryTag, elector);
  }

  public getElector(countryTag: string): HREElector | undefined {
    return this.electors.get(countryTag);
  }

  public getAllElectors(): HREElector[] {
    return Array.from(this.electors.values());
  }

  /**
   * Calculates Elector voting score for a candidate:
   * Score = (Opinion / 2.0) + (Prestige * 0.4) + (Religious_Parity ? 30.0 : -30.0)
   */
  public calculateElectorVoteScore(electorTag: string, candidatePrestige: number, candidateParity: boolean): number {
    const elector = this.electors.get(electorTag);
    if (!elector) return 0;

    const opinionWeight = elector.opinionOfEmperor * 0.5;
    const prestigeWeight = candidatePrestige * 0.4;
    const parityWeight = candidateParity ? 30.0 : -30.0;

    return opinionWeight + prestigeWeight + parityWeight;
  }

  /**
   * Monthly Tick Imperial Authority Pass:
   * Authority grows when member states are peaceful and intact.
   */
  public processMonthlyAuthorityTick(memberPrincesAtPeace: boolean = true): void {
    const growth = memberPrincesAtPeace ? 0.15 : -0.20;
    this.imperialAuthority = Math.min(100.0, Math.max(0.0, this.imperialAuthority + growth));
  }

  /**
   * Enacts an Imperial Reform:
   * Deducts Imperial Authority and dynamically reduces Control Decay Rate across all member locations!
   */
  public enactReform(
    reformId: string,
    locationsMap: Map<number, { controlDecayRate?: number; control: number }>,
    currentDateStr: string = '1350-04-01'
  ): { success: boolean; reformName: string; controlDecayReduced: number } {
    const reform = this.reforms.find(r => r.id === reformId);
    if (!reform || reform.enacted) {
      return { success: false, reformName: '', controlDecayReduced: 0 };
    }

    if (this.imperialAuthority < reform.authorityCost) {
      return { success: false, reformName: reform.name, controlDecayReduced: 0 };
    }

    // Deduct cost
    this.imperialAuthority -= reform.authorityCost;
    reform.enacted = true;
    reform.enactedDate = currentDateStr;

    // Dynamically alter control decay coefficients across all member location nodes
    let modifiedNodesCount = 0;
    for (const locId of this.memberLocationIds) {
      const loc = locationsMap.get(locId);
      if (loc) {
        loc.controlDecayRate = Math.max(0.001, (loc.controlDecayRate || 0.008) - reform.controlDecayReduction);
        modifiedNodesCount++;
      }
    }

    return {
      success: true,
      reformName: reform.name,
      controlDecayReduced: reform.controlDecayReduction
    };
  }

  private initializeDefaultElectors(): void {
    const defaultElectors: HREElector[] = [
      { countryTag: 'KOL', electorName: 'Archbishopric of Cologne', opinionOfEmperor: 45, crownPrestige: 50, religiousParity: true, currentCandidateVote: 'HAB' },
      { countryTag: 'BOH', electorName: 'Kingdom of Bohemia', opinionOfEmperor: 20, crownPrestige: 75, religiousParity: true, currentCandidateVote: 'HAB' },
      { countryTag: 'SAX', electorName: 'Electorate of Saxony', opinionOfEmperor: 60, crownPrestige: 40, religiousParity: true, currentCandidateVote: 'HAB' },
      { countryTag: 'PAL', electorName: 'Electoral Palatinate', opinionOfEmperor: 30, crownPrestige: 45, religiousParity: true, currentCandidateVote: 'HAB' },
      { countryTag: 'BRA', electorName: 'Margraviate of Brandenburg', opinionOfEmperor: 55, crownPrestige: 50, religiousParity: true, currentCandidateVote: 'HAB' }
    ];

    for (const el of defaultElectors) {
      this.electors.set(el.countryTag, el);
    }
  }

  private initializeDefaultReforms(): void {
    this.reforms = [
      {
        id: 'reform_reichsreform',
        name: 'Imperial Reform (Reichsreform)',
        tier: 1,
        authorityCost: 50.0,
        controlDecayReduction: 0.003, // -0.3% slower control decay across all member locations
        globalTaxEfficiencyBonus: 0.05,
        enacted: false
      },
      {
        id: 'reform_gemeiner_pfennig',
        name: 'Imperial Common Penny (Gemeiner Pfennig)',
        tier: 2,
        authorityCost: 50.0,
        controlDecayReduction: 0.004,
        globalTaxEfficiencyBonus: 0.10,
        enacted: false
      },
      {
        id: 'reform_ewiger_landfriede',
        name: 'Perpetual Public Peace (Ewiger Landfriede)',
        tier: 3,
        authorityCost: 50.0,
        controlDecayReduction: 0.005,
        globalTaxEfficiencyBonus: 0.15,
        enacted: false
      }
    ];
  }
}
