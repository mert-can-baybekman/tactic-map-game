import { LocationRegistry, type LocationData } from '../map/location.ts';
import { PopDemographicEngine, type PopEntity } from '../demographics/pop.ts';
import type { CharacterAttributes } from '../politics/court.ts';

export type StabilityInterventionType =
  | 'Emergency_State_Budget_Grant'
  | 'Autonomous_Tax_Exemption'
  | 'Deploy_Missionary_Clergy'
  | 'Build_Religious_Sanctuary'
  | 'Passive_Integration';

export interface CapturedTerritoryContext {
  locationId: number;
  countryTag: string;
  isCore: boolean;
  isPrimaryCulture: boolean;
  isStateReligion: boolean;
  crownControl: number; // 0.0 to 1.0
  popMilitancy: number; // 0.0 to 1.0
  conversionDelta: number; // e.g. monthly shift
  taxExemptionActive: boolean;
}

export interface GovernorActionDecision {
  locationId: number;
  action: StabilityInterventionType;
  treasuryCostDucats: number;
  militancyReduction: number;
  conversionRateDelta: number;
  rationale: string;
}

export class AIDemographicsGovernor {
  private countryTag: string;
  private stateReligion: string;
  private stateCulture: string;
  private managedLocations: Map<number, CapturedTerritoryContext> = new Map();

  constructor(countryTag: string, stateReligion: string = 'sunni', stateCulture: string = 'turkish') {
    this.countryTag = countryTag;
    this.stateReligion = stateReligion;
    this.stateCulture = stateCulture;
  }

  public registerTerritory(ctx: CapturedTerritoryContext): void {
    this.managedLocations.set(ctx.locationId, ctx);
  }

  public getTerritory(locationId: number): CapturedTerritoryContext | undefined {
    return this.managedLocations.get(locationId);
  }

  /**
   * Evaluates stability & assimilation pipeline across captured/conquered locations:
   * 1. If Crown Control < 40% and Pop_Militancy > 0.6:
   *    AI shifts budget to fund local stabilization (Emergency State Budget Grant)
   *    or grants temporary tax exemptions to pacify unrest.
   * 2. Systematic Conversion Stance:
   *    If AI ruler has high Learning (>= 60), automatically accelerates religious conversion
   *    via missionary agents or sanctuaries, increasing conversionDelta and safeguarding against Heretic Uprisings.
   */
  public evaluateLocationPolicy(
    locationId: number,
    rulerAttributes: CharacterAttributes,
    currentTreasuryDucats: number,
    locationRegistry: LocationRegistry,
    popEngine: PopDemographicEngine
  ): GovernorActionDecision {
    let ctx = this.managedLocations.get(locationId);

    // If context not pre-registered, build from live engines
    if (!ctx) {
      const loc = locationRegistry.get(locationId);
      const pops = popEngine.getPopsInLocation(locationId);

      const avgMilitancy = pops.length > 0
        ? pops.reduce((sum, p) => sum + p.militancy_unrest, 0) / pops.length
        : 0.1;

      const hasForeignReligion = pops.some(p => p.religion_id !== this.stateReligion);
      const hasForeignCulture = pops.some(p => p.culture_id !== this.stateCulture);

      ctx = {
        locationId,
        countryTag: this.countryTag,
        isCore: false,
        isPrimaryCulture: !hasForeignCulture,
        isStateReligion: !hasForeignReligion,
        crownControl: loc ? (loc as any).crown_control ?? 0.35 : 0.35,
        popMilitancy: avgMilitancy,
        conversionDelta: 0.005,
        taxExemptionActive: false
      };
      this.managedLocations.set(locationId, ctx);
    }

    // 1. Unrest Mitigation Check (Crown Control < 0.40 and Militancy > 0.60)
    if (ctx.crownControl < 0.40 && ctx.popMilitancy > 0.60) {
      const pops = popEngine.getPopsInLocation(locationId);

      if (currentTreasuryDucats >= 50.0) {
        // Shift budget to local magistrates and stabilization
        for (const pop of pops) {
          pop.militancy_unrest = Math.max(0.0, pop.militancy_unrest - 0.25);
        }
        ctx.popMilitancy = Math.max(0.0, ctx.popMilitancy - 0.25);

        return {
          locationId,
          action: 'Emergency_State_Budget_Grant',
          treasuryCostDucats: 50.0,
          militancyReduction: 0.25,
          conversionRateDelta: 0.0,
          rationale: 'Critical unrest under low crown control (<40%): State emergency budget granted to pacify region.'
        };
      } else {
        // Grant temporary tax exemption charter
        ctx.taxExemptionActive = true;
        for (const pop of pops) {
          pop.militancy_unrest = Math.max(0.0, pop.militancy_unrest - 0.20);
        }
        ctx.popMilitancy = Math.max(0.0, ctx.popMilitancy - 0.20);

        return {
          locationId,
          action: 'Autonomous_Tax_Exemption',
          treasuryCostDucats: 0.0,
          militancyReduction: 0.20,
          conversionRateDelta: 0.0,
          rationale: 'Low treasury: Granted local autonomous tax exemption charter to halt impending rebellion.'
        };
      }
    }

    // 2. Systematic Conversion Stance (High Ruler Learning >= 60)
    const isLearnedRuler = rulerAttributes.learning >= 60 || rulerAttributes.learning >= 6; // Supports 0-10 or 0-100 scale
    if (!ctx.isStateReligion && isLearnedRuler) {
      ctx.conversionDelta = 0.04;
      const pops = popEngine.getPopsInLocation(locationId);

      // Accelerate religious conversion in pop religion distributions
      for (const pop of pops) {
        if (!pop.religion_distribution[this.stateReligion]) {
          pop.religion_distribution[this.stateReligion] = 0.0;
        }
        pop.religion_distribution[this.stateReligion] = Math.min(
          1.0,
          pop.religion_distribution[this.stateReligion] + ctx.conversionDelta
        );

        // Once converted majority, switch primary religion
        if (pop.religion_distribution[this.stateReligion] >= 0.51) {
          pop.religion_id = this.stateReligion;
          ctx.isStateReligion = true;
        }
      }

      return {
        locationId,
        action: 'Deploy_Missionary_Clergy',
        treasuryCostDucats: 25.0,
        militancyReduction: 0.05,
        conversionRateDelta: 0.04,
        rationale: 'High Learning Ruler: Mobilized monastic clergy missionaries, accelerating religious conversion by +4% per tick.'
      };
    }

    // Standard passive integration
    return {
      locationId,
      action: 'Passive_Integration',
      treasuryCostDucats: 0.0,
      militancyReduction: 0.02,
      conversionRateDelta: 0.005,
      rationale: 'Standard administrative pacification in progress.'
    };
  }
}
