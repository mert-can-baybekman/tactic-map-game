import { UnitType, EstateType } from '../core/types.ts';
import { PopDemographicEngine, type PopEntity } from '../demographics/pop.ts';
import { LocationRegistry } from '../map/location.ts';

export interface Regiment {
  id: string;
  unit_type: UnitType;
  origin_pop_id: number;
  origin_location_id: number;
  estate_type: EstateType;
  current_manpower: number;
  max_manpower: number;
  experience: number;
  morale: number; // 0.0 to 100.0
}

export class FeudalLevyEngine {
  private activeRegiments: Map<string, Regiment> = new Map();
  private nextRegimentId: number = 1;

  /**
   * Raise Feudal Levies directly from Location Pop pools:
   * - 5% Nobility -> Heavy Cavalry
   * - 8% Commoners -> Peasant Infantry
   * - 4% Burghers -> Pike Militia
   */
  public raiseLeviesFromLocation(
    locationId: number,
    popEngine: PopDemographicEngine
  ): Regiment[] {
    const pops = popEngine.getPopsInLocation(locationId);
    const raisedRegiments: Regiment[] = [];

    for (const pop of pops) {
      let unitType: UnitType | null = null;
      let mobilizationFraction = 0.0;

      if (pop.estate_type === EstateType.Nobility) {
        unitType = UnitType.HeavyCavalry;
        mobilizationFraction = 0.05; // 5% of nobility
      } else if (pop.estate_type === EstateType.Commoners) {
        unitType = UnitType.PeasantInfantry;
        mobilizationFraction = 0.08; // 8% of commoners
      } else if (pop.estate_type === EstateType.Burghers) {
        unitType = UnitType.PikeMilitia;
        mobilizationFraction = 0.04; // 4% of burghers
      }

      if (!unitType || mobilizationFraction <= 0) continue;

      const soldiersToDraft = Math.floor(pop.size * mobilizationFraction);
      if (soldiersToDraft < 20) continue; // Minimum regiment detachment

      // Subtract active conscripts temporarily from active civilian workforce pool
      pop.size -= soldiersToDraft;

      const reg: Regiment = {
        id: `reg_${this.nextRegimentId++}_loc${locationId}`,
        unit_type: unitType,
        origin_pop_id: pop.id,
        origin_location_id: locationId,
        estate_type: pop.estate_type,
        current_manpower: soldiersToDraft,
        max_manpower: soldiersToDraft,
        experience: pop.estate_type === EstateType.Nobility ? 25.0 : 5.0,
        morale: 80.0
      };

      this.activeRegiments.set(reg.id, reg);
      raisedRegiments.push(reg);
    }

    return raisedRegiments;
  }

  public getRegiment(id: string): Regiment | undefined {
    return this.activeRegiments.get(id);
  }

  public getAllRegiments(): Regiment[] {
    return Array.from(this.activeRegiments.values());
  }

  /**
   * Casualty feedback loop:
   * Directly subtracts dead soldiers permanently from the origin demographic Pop entity.
   */
  public applyRegimentCasualties(
    regimentId: string,
    fatalities: number,
    popEngine: PopDemographicEngine
  ): void {
    const reg = this.activeRegiments.get(regimentId);
    if (!reg) return;

    const actualLosses = Math.min(reg.current_manpower, fatalities);
    reg.current_manpower -= actualLosses;

    // Notice: The soldiers were already subtracted from pop.size when mobilized.
    // However, if the regiment is wiped out or soldiers die, they will NEVER return
    // during demobilization. We record the death on demographic records.
    if (reg.current_manpower <= 0) {
      this.activeRegiments.delete(regimentId);
    }
  }

  /**
   * Demobilization:
   * Returns surviving levy manpower directly back into their origin Pop entity!
   */
  public demobilizeRegiment(
    regimentId: string,
    popEngine: PopDemographicEngine
  ): boolean {
    const reg = this.activeRegiments.get(regimentId);
    if (!reg) return false;

    const originPop = popEngine.getPop(reg.origin_pop_id);
    if (originPop) {
      // Reintegrate surviving soldiers back into the workforce
      originPop.size += reg.current_manpower;
    }

    this.activeRegiments.delete(regimentId);
    return true;
  }
}
