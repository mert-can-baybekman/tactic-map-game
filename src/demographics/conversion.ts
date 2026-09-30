/**
 * Granular Pop Conversion, Religious Strive & Cultural Drift Engine
 * Implements exact Project Caesar mathematical equations for faith conversion,
 * heretic underground networks, Crown Control cultural assimilation, and 48-tick Cultural Drift.
 */

import type { PopEntity } from './pop.ts';

export interface LocationConversionContext {
  id: number;
  name: string;
  crown_control: number; // 0.0 to 1.0
  local_autonomy: number; // 0.0 to 1.0
  trade_connectivity: number; // 0.0 to 1.0
  devastation: number; // 0.0 to 1.0
  is_holy_site: boolean;
  state_religion: string;
  state_culture: string;
  regional_drift_culture?: string; // Hostile sub-culture variant
  local_clergy_power: number; // e.g. 0.25
  total_estate_power: number; // e.g. 1.0
}

export interface RealmConversionGlobals {
  state_religious_unity: number; // 0.0 to 1.0
  advisor_learning_modifier: number; // e.g. 1.15 (+15% for High Learning Archbishop)
}

export interface GranularConversionParams {
  base_religious_conversion: number; // e.g. 0.008
  base_cultural_assimilation: number; // e.g. 0.007
  cultural_drift_threshold_ticks: number; // 48 consecutive monthly ticks
  heretic_growth_rate: number; // 0.005 when militancy > 0.6
}

export const DEFAULT_GRANULAR_CONVERSION_PARAMS: GranularConversionParams = {
  base_religious_conversion: 0.008,
  base_cultural_assimilation: 0.007,
  cultural_drift_threshold_ticks: 48,
  heretic_growth_rate: 0.005
};

export class GranularConversionEngine {
  private params: GranularConversionParams;
  // Tracks consecutive monthly ticks where Crown Control < 30% per location ID
  private locationLowControlTicks: Map<number, number> = new Map();

  constructor(params: GranularConversionParams = DEFAULT_GRANULAR_CONVERSION_PARAMS) {
    this.params = { ...params };
  }

  public getLowControlTicks(locationId: number): number {
    return this.locationLowControlTicks.get(locationId) || 0;
  }

  public setLowControlTicks(locationId: number, ticks: number): void {
    this.locationLowControlTicks.set(locationId, ticks);
  }

  /**
   * Religious Conversion Calculation Loop:
   * Equation:
   * Conversion_Rate = Base_Constant * (Local_Clergy_Power / Total_Estate_Power) * (State_Religious_Unity) * (1.0 - Local_Devastation) * Advisor_Learning_Modifier
   *
   * CRITICAL RULE:
   * If Pop Militancy_Unrest > 0.60:
   * Conversion_Rate drops to ABSOLUTE ZERO, and a counter-force activates,
   * spawning subterranean religious heretic networks.
   */
  public executeReligiousConversionTick(
    pop: PopEntity,
    loc: LocationConversionContext,
    globals: RealmConversionGlobals
  ): { convertedCount: number; hereticSpawnedCount: number; dominantReligion: string } {
    if (!pop.religion_distribution) {
      pop.religion_distribution = { [pop.religion_id]: 1.0 };
    }

    const stateReligion = loc.state_religion;
    let convertedCount = 0;
    let hereticSpawnedCount = 0;

    // Militancy threshold check
    if (pop.militancy_unrest > 0.60) {
      // Conversion rate drops to absolute zero!
      // Counter-force activates: subterranean religious heretic network spawns/expands
      const hereticFaith = 'religious_heretics';
      const hereticGrowth = this.params.heretic_growth_rate * (pop.militancy_unrest - 0.50);

      // Drain from state religion into subterranean heretic faith
      const stateRelShare = pop.religion_distribution[stateReligion] || 0;
      if (stateRelShare > 0) {
        const delta = Math.min(stateRelShare, hereticGrowth);
        pop.religion_distribution[stateReligion] -= delta;
        pop.religion_distribution[hereticFaith] = (pop.religion_distribution[hereticFaith] || 0) + delta;
        hereticSpawnedCount = Math.round(delta * pop.size);
      }
    } else {
      // Normal conversion equation
      const clergyRatio = loc.total_estate_power > 0
        ? Math.min(1.0, Math.max(0.05, loc.local_clergy_power / loc.total_estate_power))
        : 0.25;

      const unity = Math.min(1.0, Math.max(0.1, globals.state_religious_unity));
      const devastationFactor = Math.max(0.0, 1.0 - loc.devastation);
      const learningMod = Math.max(0.5, globals.advisor_learning_modifier);

      const conversionRate = this.params.base_religious_conversion *
        clergyRatio *
        unity *
        devastationFactor *
        learningMod;

      // Convert minority faiths towards state religion
      for (const rel of Object.keys(pop.religion_distribution)) {
        if (rel !== stateReligion) {
          const currentShare = pop.religion_distribution[rel];
          if (currentShare > 0) {
            const shift = Math.min(currentShare, conversionRate);
            pop.religion_distribution[rel] -= shift;
            pop.religion_distribution[stateReligion] = (pop.religion_distribution[stateReligion] || 0) + shift;
            convertedCount += Math.round(shift * pop.size);
          }
        }
      }
    }

    // Update dominant religion
    let maxShare = -1;
    let dominant = pop.religion_id;
    for (const [r, share] of Object.entries(pop.religion_distribution)) {
      if (share > maxShare) {
        maxShare = share;
        dominant = r;
      }
    }
    pop.religion_id = dominant;

    return { convertedCount, hereticSpawnedCount, dominantReligion: dominant };
  }

  /**
   * Cultural Assimilation & Cultural Drift Protocol:
   * Equation:
   * Assimilation_Rate = Base_Constant * (Local_Crown_Control_Percentage) * (1.0 - Local_Autonomy)
   *
   * CULTURAL DRIFT PROTOCOL:
   * If a Location's Crown Control falls below 30.0% (0.30) for more than 48 consecutive monthly ticks,
   * initiate a Cultural Drift Protocol where the pop's primary culture tags decay,
   * mutating into a dynamic, hostile regional sub-culture group.
   */
  public executeCulturalAssimilationTick(
    pop: PopEntity,
    loc: LocationConversionContext
  ): { assimilatedCount: number; driftedCount: number; culturalDriftActive: boolean; dominantCulture: string } {
    if (!pop.culture_distribution) {
      pop.culture_distribution = { [pop.culture_id]: 1.0 };
    }

    const stateCulture = loc.state_culture;
    const regionalSubculture = loc.regional_drift_culture || `${loc.name.toLowerCase().replace(/\s+/g, '_')}_regional`;
    let assimilatedCount = 0;
    let driftedCount = 0;
    let culturalDriftActive = false;

    // Track consecutive low-control ticks
    let consecutiveLowTicks = this.locationLowControlTicks.get(loc.id) || 0;
    if (loc.crown_control < 0.30) {
      consecutiveLowTicks += 1;
    } else {
      consecutiveLowTicks = 0; // Reset upon restoring Crown authority
    }
    this.locationLowControlTicks.set(loc.id, consecutiveLowTicks);

    if (consecutiveLowTicks >= this.params.cultural_drift_threshold_ticks) {
      // 48+ ticks of shattered control: CULTURAL DRIFT PROTOCOL ACTIVE
      culturalDriftActive = true;
      const driftRate = 0.015 * (1.0 + (consecutiveLowTicks - 48) * 0.05);

      const stateShare = pop.culture_distribution[stateCulture] || 0;
      if (stateShare > 0) {
        const driftAmount = Math.min(stateShare, driftRate);
        pop.culture_distribution[stateCulture] -= driftAmount;
        pop.culture_distribution[regionalSubculture] = (pop.culture_distribution[regionalSubculture] || 0) + driftAmount;
        driftedCount = Math.round(driftAmount * pop.size);
      }
    } else if (loc.crown_control < 0.50) {
      // Passive pause / mild fracturing between 30% and 50%
      const mildFracture = 0.003;
      const stateShare = pop.culture_distribution[stateCulture] || 0;
      if (stateShare > 0) {
        const driftAmount = Math.min(stateShare, mildFracture);
        pop.culture_distribution[stateCulture] -= driftAmount;
        pop.culture_distribution[regionalSubculture] = (pop.culture_distribution[regionalSubculture] || 0) + driftAmount;
        driftedCount = Math.round(driftAmount * pop.size);
      }
    } else {
      // Active Assimilation into State Culture
      // Assimilation_Rate = Base_Constant * (Local_Crown_Control_Percentage) * (1.0 - Local_Autonomy)
      const crownControl = Math.max(0.0, Math.min(1.0, loc.crown_control));
      const autonomy = Math.max(0.0, Math.min(1.0, loc.local_autonomy));

      const assimilationRate = this.params.base_cultural_assimilation *
        crownControl *
        (1.0 - autonomy);

      for (const cult of Object.keys(pop.culture_distribution)) {
        if (cult !== stateCulture) {
          const currentShare = pop.culture_distribution[cult];
          if (currentShare > 0) {
            const shift = Math.min(currentShare, assimilationRate);
            pop.culture_distribution[cult] -= shift;
            pop.culture_distribution[stateCulture] = (pop.culture_distribution[stateCulture] || 0) + shift;
            assimilatedCount += Math.round(shift * pop.size);
          }
        }
      }
    }

    // Determine new dominant culture
    let maxShare = -1;
    let dominant = pop.culture_id;
    for (const [c, share] of Object.entries(pop.culture_distribution)) {
      if (share > maxShare) {
        maxShare = share;
        dominant = c;
      }
    }
    pop.culture_id = dominant;

    return {
      assimilatedCount,
      driftedCount,
      culturalDriftActive,
      dominantCulture: dominant
    };
  }

  /**
   * Monthly Batch Processing Loop across all location entities
   */
  public processConversionAndAssimilationTick(
    pops: PopEntity[],
    locationsMap: Map<number, LocationConversionContext>,
    globals: RealmConversionGlobals
  ): { totalConverted: number; totalHeretics: number; totalAssimilated: number; totalDrifted: number } {
    let totalConverted = 0;
    let totalHeretics = 0;
    let totalAssimilated = 0;
    let totalDrifted = 0;

    for (const pop of pops) {
      const loc = locationsMap.get(pop.location_id);
      if (!loc) continue;

      const relRes = this.executeReligiousConversionTick(pop, loc, globals);
      totalConverted += relRes.convertedCount;
      totalHeretics += relRes.hereticSpawnedCount;

      const cultRes = this.executeCulturalAssimilationTick(pop, loc);
      totalAssimilated += cultRes.assimilatedCount;
      totalDrifted += cultRes.driftedCount;
    }

    return { totalConverted, totalHeretics, totalAssimilated, totalDrifted };
  }
}
