/**
 * Dynastic Personal Union (PU) & Succession Crisis Simulator
 * Evaluates royal lineages, claim trees, peaceful unions, and succession wars upon ruler mortality
 */

export const SuccessionOutcome = {
  Smooth_Heir_Ascension: 'Smooth_Heir_Ascension',
  Peaceful_Personal_Union: 'Peaceful_Personal_Union',
  Succession_War_Conflict: 'Succession_War_Conflict',
  Local_Nobility_Regency: 'Local_Nobility_Regency'
} as const;

export type SuccessionOutcome = typeof SuccessionOutcome[keyof typeof SuccessionOutcome];

export interface RoyalMarriage {
  id: string;
  seniorTag: string;
  juniorTag: string;
  claimStrength: number;  // 0.0 to 100.0
  seniorPrestige: number; // 0.0 to 100.0
  seniorMilitaryPower: number;
  dateEstablished: string;
}

export interface PersonalUnion {
  id: string;
  seniorTag: string;
  juniorTag: string;
  libertyDesire: number;       // 0.0 to 100.0%
  integrationProgress: number; // 0.0 to 100.0%
  foreignPolicyLocked: boolean;
  jointLeviesMobilized: boolean;
  startDate: string;
}

export interface SuccessionEvaluation {
  outcome: SuccessionOutcome;
  deceasedTag: string;
  seniorClaimantTag?: string;
  rivalClaimantTag?: string;
  casusBelliId?: string;
  createdPersonalUnion?: PersonalUnion;
  description: string;
}

export class DynasticPersonalUnionSimulator {
  private marriages: Map<string, RoyalMarriage> = new Map();
  private personalUnions: Map<string, PersonalUnion> = new Map();

  /**
   * Registers a bilateral Royal Marriage link between two sovereign realms
   */
  public registerRoyalMarriage(params: {
    seniorTag: string;
    juniorTag: string;
    claimStrength: number;
    seniorPrestige: number;
    seniorMilitaryPower?: number;
    dateEstablished?: string;
  }): RoyalMarriage {
    const id = `marriage_${params.seniorTag}_${params.juniorTag}`;
    const marriage: RoyalMarriage = {
      id,
      seniorTag: params.seniorTag,
      juniorTag: params.juniorTag,
      claimStrength: Math.max(0, Math.min(100, params.claimStrength)),
      seniorPrestige: Math.max(0, Math.min(100, params.seniorPrestige)),
      seniorMilitaryPower: params.seniorMilitaryPower ?? 50.0,
      dateEstablished: params.dateEstablished ?? '1350-01-01'
    };
    this.marriages.set(id, marriage);
    return marriage;
  }

  public breakRoyalMarriage(seniorTag: string, juniorTag: string): boolean {
    const id = `marriage_${seniorTag}_${juniorTag}`;
    return this.marriages.delete(id);
  }

  public getMarriagesForTag(countryTag: string): RoyalMarriage[] {
    return Array.from(this.marriages.values()).filter(
      m => m.seniorTag === countryTag || m.juniorTag === countryTag
    );
  }

  /**
   * Evaluates succession protocol upon monarch death during daily calendar tick
   */
  public evaluateRulerDeath(params: {
    deceasedCountryTag: string;
    hasLivingHeir: boolean;
    deceasedPrestige?: number;
    currentDate?: string;
  }): SuccessionEvaluation {
    const { deceasedCountryTag, hasLivingHeir, currentDate } = params;

    // 1. Direct line heir ascension
    if (hasLivingHeir) {
      return {
        outcome: SuccessionOutcome.Smooth_Heir_Ascension,
        deceasedTag: deceasedCountryTag,
        description: `Direct legitimate heir smoothly ascends the throne of ${deceasedCountryTag}.`
      };
    }

    // 2. Identify external royal marriage links claiming this vacant throne
    const validClaimants = Array.from(this.marriages.values())
      .filter(m => m.juniorTag === deceasedCountryTag && m.claimStrength >= 40.0)
      .sort((a, b) => (b.claimStrength + b.seniorPrestige) - (a.claimStrength + a.seniorPrestige));

    // 3. Succession War Trigger: two or more strong claimants contest the throne
    if (validClaimants.length >= 2) {
      const seniorClaimant = validClaimants[0];
      const rivalClaimant = validClaimants[1];

      return {
        outcome: SuccessionOutcome.Succession_War_Conflict,
        deceasedTag: deceasedCountryTag,
        seniorClaimantTag: seniorClaimant.seniorTag,
        rivalClaimantTag: rivalClaimant.seniorTag,
        casusBelliId: 'cb_succession_war',
        description: `Dynastic Crisis in ${deceasedCountryTag}! Rival claimants ${seniorClaimant.seniorTag} and ${rivalClaimant.seniorTag} clash in a mandatory Succession War!`
      };
    }

    // 4. Peaceful Personal Union Protocol
    if (validClaimants.length === 1) {
      const seniorClaimant = validClaimants[0];
      const puId = `pu_${seniorClaimant.seniorTag}_${deceasedCountryTag}`;

      const newPU: PersonalUnion = {
        id: puId,
        seniorTag: seniorClaimant.seniorTag,
        juniorTag: deceasedCountryTag,
        libertyDesire: 15.0,
        integrationProgress: 0.0,
        foreignPolicyLocked: true,
        jointLeviesMobilized: true,
        startDate: currentDate ?? '1350-01-01'
      };

      this.personalUnions.set(puId, newPU);

      return {
        outcome: SuccessionOutcome.Peaceful_Personal_Union,
        deceasedTag: deceasedCountryTag,
        seniorClaimantTag: seniorClaimant.seniorTag,
        createdPersonalUnion: newPU,
        description: `King of ${seniorClaimant.seniorTag} inherits ${deceasedCountryTag} in a peaceful Personal Union! Foreign policy locked, levy armies combined.`
      };
    }

    // 5. Domestic Regency / Noble Council election fallback
    return {
      outcome: SuccessionOutcome.Local_Nobility_Regency,
      deceasedTag: deceasedCountryTag,
      description: `No foreign dynasty held legitimate claims over ${deceasedCountryTag}. Local Estates elevate a domestic noble sovereign.`
    };
  }

  /**
   * Returns all active Personal Unions where a tag acts as the senior partner
   */
  public getJuniorPartners(seniorTag: string): PersonalUnion[] {
    return Array.from(this.personalUnions.values()).filter(
      pu => pu.seniorTag === seniorTag
    );
  }

  /**
   * Returns all allied levy tags that mobilize alongside the senior partner
   */
  public getMobilizableLevyTags(seniorTag: string): string[] {
    const juniorTags = this.getJuniorPartners(seniorTag)
      .filter(pu => pu.jointLeviesMobilized && pu.libertyDesire < 50.0) // Disloyal unions refuse mobilization
      .map(pu => pu.juniorTag);

    return [seniorTag, ...juniorTags];
  }

  /**
   * Advances monthly integration progress for senior partner
   */
  public processMonthlyIntegrationTick(seniorTag: string, integrationSpeedPct: number = 0.25): {
    integratedTags: string[];
  } {
    const integratedTags: string[] = [];

    for (const [id, pu] of this.personalUnions.entries()) {
      if (pu.seniorTag !== seniorTag) continue;

      if (pu.libertyDesire < 50.0) {
        pu.integrationProgress = Math.min(100.0, pu.integrationProgress + integrationSpeedPct);

        if (pu.integrationProgress >= 100.0) {
          integratedTags.push(pu.juniorTag);
          this.personalUnions.delete(id);
        }
      }
    }

    return { integratedTags };
  }

  public getAllPersonalUnions(): PersonalUnion[] {
    return Array.from(this.personalUnions.values());
  }
}
