import { LocationRegistry, type LocationData } from '../map/location.ts';
import type { Regiment } from './levy.ts';
import { PopDemographicEngine } from '../demographics/pop.ts';

export interface FieldArmy {
  id: string;
  name: string;
  country_id: number;
  location_id: number;
  regiments: Regiment[];
  is_starving: boolean;
  days_starving: number;
  supply_path: number[];
}

export interface SupplyDepot {
  id: string;
  location_id: number;
  capacity_units: number;
  available_grain: number;
}

export class MilitaryLogisticsEngine {
  private depots: Map<string, SupplyDepot> = new Map();
  private maxSupplyRangeHops: number = 5;

  public registerDepot(depot: SupplyDepot): void {
    this.depots.set(depot.id, depot);
  }

  /**
   * Path-Traced Supply Lines:
   * Traces continuous path array back to a fully supplied friendly Depot or Market Hub.
   * If an enemy Zone of Control (ZoC) or detachment cuts this path, connection breaks.
   */
  public verifySupplyLine(
    army: FieldArmy,
    locationRegistry: LocationRegistry,
    hostileZoCLocations: Set<number>,
    enemyOccupiedLocations: Set<number>
  ): { supplied: boolean; path: number[] } {
    const queue: { locationId: number; path: number[] }[] = [];
    const visited: Set<number> = new Set();

    queue.push({ locationId: army.location_id, path: [army.location_id] });
    visited.add(army.location_id);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check if current node hosts an active supply depot with food
      const depot = Array.from(this.depots.values()).find(
        d => d.location_id === current.locationId && d.available_grain > 5.0
      );

      if (depot) {
        return { supplied: true, path: current.path };
      }

      if (current.path.length >= this.maxSupplyRangeHops) continue;

      const loc = locationRegistry.get(current.locationId);
      if (!loc) continue;

      for (const neighborId of loc.neighbors) {
        // Blocked if enemy occupied or inside hostile Zone of Control
        if (enemyOccupiedLocations.has(neighborId) || hostileZoCLocations.has(neighborId)) {
          continue;
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            locationId: neighborId,
            path: [...current.path, neighborId]
          });
        }
      }
    }

    return { supplied: false, path: [] };
  }

  /**
   * Logistical Supply Line Tick:
   * If cut -> Supply_Starvation triggers:
   * Compounding exponential daily attrition: 0.05 * (1.15)^days_starving
   * Armies forage violently, driving local tile Devastation up to 1.0!
   */
  public executeLogisticsTick(
    armies: FieldArmy[],
    locationRegistry: LocationRegistry,
    popEngine: PopDemographicEngine,
    hostileZoCLocations: Set<number>,
    enemyOccupiedLocations: Set<number>
  ): void {
    for (const army of armies) {
      const result = this.verifySupplyLine(army, locationRegistry, hostileZoCLocations, enemyOccupiedLocations);

      if (result.supplied) {
        army.is_starving = false;
        army.days_starving = 0;
        army.supply_path = result.path;
      } else {
        army.is_starving = true;
        army.days_starving += 1;
        army.supply_path = [];

        // Compounding exponential attrition equation:
        const attritionRate = Math.min(0.60, 0.05 * Math.pow(1.15, army.days_starving));

        for (const reg of army.regiments) {
          const losses = Math.floor(reg.current_manpower * attritionRate);
          reg.current_manpower = Math.max(0, reg.current_manpower - losses);
          reg.morale = Math.max(5.0, reg.morale - 8.0);
        }

        // Violent foraging increases tile devastation
        const loc = locationRegistry.get(army.location_id);
        if (loc) {
          loc.devastation = Math.min(1.0, loc.devastation + 0.08);
        }
      }
    }
  }
}
