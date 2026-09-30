/**
 * Dynamic Cultural Assimilation & Religious Conversion Engine
 * Handles organic sub-pop shifts, conversion equations, and culture drift per monthly tick.
 */

import type { PopEntity } from './pop.ts';

export interface LocationConversionContext {
  id: number;
  name: string;
  crown_control: number; // 0.0 to 1.0
  trade_connectivity: number; // 0.0 to 1.0 (graph connectivity multiplier)
  is_holy_site: boolean;
  state_religion: string;
  state_culture: string;
}

export interface ConversionParameters {
  base_religious_conversion_rate: number; // e.g. 0.005 per month
  base_cultural_assimilation_rate: number; // e.g. 0.004 per month
  holy_site_multiplier: number; // e.g. 1.75
  tolerance_edict_multiplier: number; // e.g. 1.25
  cultural_drift_rate: number; // e.g. 0.003 when control < 50%
}

export const DEFAULT_CONVERSION_PARAMS: ConversionParameters = {
  base_religious_conversion_rate: 0.006,
  base_cultural_assimilation_rate: 0.005,
  holy_site_multiplier: 1.8,
  tolerance_edict_multiplier: 1.2,
  cultural_drift_rate: 0.004
};

export class DynamicConversionEngine {
  private params: ConversionParameters;

  constructor(params: ConversionParameters = DEFAULT_CONVERSION_PARAMS) {
    this.params = { ...params };
  }

  /**
   * Religious Conversion Equation:
   * Conversion_Delta = Base_Rate * (Clergy_Power_Ratio) * (1.0 - Pop_Militancy) * Holy_Site_Bonus
   * Converts minority faith shares towards the official State Religion.
   */
  public executeReligiousConversionTick(
    pop: PopEntity,
    locContext: LocationConversionContext,
    clergyPowerRatio: number
  ): { convertedPops: number; previousReligion: string; dominantReligion: string } {
    const stateReligion = locContext.state_religion;
    const holySiteBonus = locContext.is_holy_site ? this.params.holy_site_multiplier : 1.0;
    const clampedMilitancy = Math.min(0.95, Math.max(0.0, pop.militancy_unrest));
    const clampedClergy = Math.max(0.05, Math.min(1.0, clergyPowerRatio));

    // Exact specification formula
    const conversionRate = this.params.base_religious_conversion_rate *
      clampedClergy *
      (1.0 - clampedMilitancy) *
      holySiteBonus;

    // Ensure religion distribution map exists
    if (!pop.religion_distribution) {
      pop.religion_distribution = { [pop.religion_id]: 1.0 };
    }

    let convertedTotal = 0;
    const currentDominant = pop.religion_id;

    // Convert from non-state religions
    for (const religion of Object.keys(pop.religion_distribution)) {
      if (religion !== stateReligion) {
        const currentShare = pop.religion_distribution[religion];
        if (currentShare > 0) {
          const shiftShare = Math.min(currentShare, conversionRate);
          pop.religion_distribution[religion] -= shiftShare;
          pop.religion_distribution[stateReligion] = (pop.religion_distribution[stateReligion] || 0) + shiftShare;
          convertedTotal += Math.round(shiftShare * pop.size);
        }
      }
    }

    // Determine new dominant religion in pop
    let highestShare = -1;
    let newDominant = pop.religion_id;
    for (const [rel, share] of Object.entries(pop.religion_distribution)) {
      if (share > highestShare) {
        highestShare = share;
        newDominant = rel;
      }
    }

    pop.religion_id = newDominant;

    return {
      convertedPops: convertedTotal,
      previousReligion: currentDominant,
      dominantReligion: newDominant
    };
  }

  /**
   * Cultural Assimilation & Drift Equation:
   * Driven by Location Crown Control % and Trade Connectivity.
   *
   * RULE: If Crown Control < 50% (0.50), assimilation STOPS ENTIRELY,
   * and sub-cultures begin to fracture and drift away from the primary state culture!
   *
   * If Crown Control >= 50%:
   * Assimilation_Delta = Base_Rate * Crown_Control_Ratio * (1.0 + Trade_Connectivity) * (1.0 - Pop_Militancy)
   */
  public executeCulturalAssimilationTick(
    pop: PopEntity,
    locContext: LocationConversionContext
  ): { assimilatedCount: number; driftedCount: number; dominantCulture: string } {
    const stateCulture = locContext.state_culture;
    const crownControl = Math.max(0.0, Math.min(1.0, locContext.crown_control));
    const connectivity = Math.max(0.0, Math.min(1.0, locContext.trade_connectivity));
    const clampedMilitancy = Math.min(0.95, Math.max(0.0, pop.militancy_unrest));

    if (!pop.culture_distribution) {
      pop.culture_distribution = { [pop.culture_id]: 1.0 };
    }

    let assimilatedCount = 0;
    let driftedCount = 0;

    if (crownControl < 0.50) {
      // Assimilation stops; sub-cultures fracture and drift AWAY from state culture
      const driftDeficit = 0.50 - crownControl; // 0.0 to 0.50
      const driftRate = this.params.cultural_drift_rate * (1.0 + driftDeficit * 2.0);

      const stateCultureShare = pop.culture_distribution[stateCulture] || 0;
      if (stateCultureShare > 0) {
        const driftAmount = Math.min(stateCultureShare, driftRate);
        pop.culture_distribution[stateCulture] -= driftAmount;

        // Distribute drifted culture share to regional minority / native sub-culture
        const nonStateCultures = Object.keys(pop.culture_distribution).filter(c => c !== stateCulture);
        const targetCulture = nonStateCultures.length > 0 ? nonStateCultures[0] : 'native_regional';
        pop.culture_distribution[targetCulture] = (pop.culture_distribution[targetCulture] || 0) + driftAmount;
        driftedCount = Math.round(driftAmount * pop.size);
      }
    } else {
      // Crown Control >= 50%: Active assimilation into State Culture
      const assimilationRate = this.params.base_cultural_assimilation_rate *
        crownControl *
        (1.0 + connectivity) *
        (1.0 - clampedMilitancy);

      for (const culture of Object.keys(pop.culture_distribution)) {
        if (culture !== stateCulture) {
          const currentShare = pop.culture_distribution[culture];
          if (currentShare > 0) {
            const shiftShare = Math.min(currentShare, assimilationRate);
            pop.culture_distribution[culture] -= shiftShare;
            pop.culture_distribution[stateCulture] = (pop.culture_distribution[stateCulture] || 0) + shiftShare;
            assimilatedCount += Math.round(shiftShare * pop.size);
          }
        }
      }
    }

    // Determine new dominant culture
    let highestShare = -1;
    let newDominant = pop.culture_id;
    for (const [cult, share] of Object.entries(pop.culture_distribution)) {
      if (share > highestShare) {
        highestShare = share;
        newDominant = cult;
      }
    }

    pop.culture_id = newDominant;

    return {
      assimilatedCount,
      driftedCount,
      dominantCulture: newDominant
    };
  }

  /**
   * Monthly Batch Processing Loop for all Pops in a realm
   */
  public executeMonthlyConversionPass(
    pops: PopEntity[],
    locationsMap: Map<number, LocationConversionContext>,
    clergyPowerRatio: number
  ): { totalConverted: number; totalAssimilated: number; totalDrifted: number } {
    let totalConverted = 0;
    let totalAssimilated = 0;
    let totalDrifted = 0;

    for (const pop of pops) {
      const loc = locationsMap.get(pop.location_id);
      if (!loc) continue;

      const relResult = this.executeReligiousConversionTick(pop, loc, clergyPowerRatio);
      totalConverted += relResult.convertedPops;

      const cultResult = this.executeCulturalAssimilationTick(pop, loc);
      totalAssimilated += cultResult.assimilatedCount;
      totalDrifted += cultResult.driftedCount;
    }

    return { totalConverted, totalAssimilated, totalDrifted };
  }
}
