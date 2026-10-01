import { LocationRegistry, type LocationData } from '../map/location.ts';
import { PopDemographicEngine, type PopEntity } from '../demographics/pop.ts';
import type { Regiment } from './levy.ts';

export interface SupplyDepotNode {
  id: string;
  locationId: number;
  baseEfficiency: number; // default 1.0 (100%)
  decayRate: number;      // e.g. 0.08
  availableGrain: number;
  isOperational: boolean;
}

export interface DynamicArmyStack {
  id: string;
  name: string;
  countryId: number;
  currentLocationId: number;
  originLocationId: number; // For permanent pop decrement on death
  manpower: number;
  morale: number;
  daysStarving: number;
  supplyEfficiency: number; // 0.0 to 1.0
  isStarving: boolean;
  regiments?: Regiment[];
}

export interface SupplyEvaluationResult {
  armyId: string;
  supplied: boolean;
  supplyEfficiency: number;
  nearestDepotId?: string;
  logisticalDistance: number;
  isInterdictedByBlockade: boolean;
  isInterdictedByZoC: boolean;
  dailyAttritionRate: number;
  dailyCasualties: number;
  originLocationId: number;
}

export class SupplyRangeManager {
  private depots: Map<string, SupplyDepotNode> = new Map();
  private baseDecayRate: number = 0.08;

  public registerDepot(depot: SupplyDepotNode): void {
    this.depots.set(depot.id, depot);
  }

  public getDepot(id: string): SupplyDepotNode | undefined {
    return this.depots.get(id);
  }

  public getAllDepots(): SupplyDepotNode[] {
    return Array.from(this.depots.values());
  }

  /**
   * Geographic Supply Range Decay Equation:
   * Supply_Efficiency = Base_Efficiency * e^(-Decay_Rate * Logistical_Distance)
   */
  public calculateEfficiency(
    baseEfficiency: number,
    decayRate: number,
    distance: number
  ): number {
    if (distance < 0) return 0.0;
    const eff = baseEfficiency * Math.exp(-decayRate * distance);
    return Math.max(0.0, Math.min(1.0, eff));
  }

  /**
   * Evaluates army logistics:
   * 1. If path is blocked by naval blockade (e.g. Dover-Calais or Bosphorus) or Fort ZoC,
   *    Supply_Efficiency drops to 0.0.
   * 2. At 0.0 efficiency, army suffers Supply_Starvation:
   *    - Exponential 5% daily attrition rate
   *    - Casualties are permanently subtracted from origin location pop arrays!
   */
  public evaluateArmyLogistics(
    army: DynamicArmyStack,
    locationRegistry: LocationRegistry,
    blockedChokepointLocations: Set<number>,
    hostileZoCLocations: Set<number>,
    popEngine?: PopDemographicEngine
  ): SupplyEvaluationResult {
    // Check if army currently sits or must pass through an interdicted node
    const isInterdictedByBlockade = blockedChokepointLocations.has(army.currentLocationId);
    const isInterdictedByZoC = hostileZoCLocations.has(army.currentLocationId);

    // Breadth-first search for nearest operational depot
    let foundDepot: SupplyDepotNode | undefined = undefined;
    let minDistance = 999;

    const queue: { locId: number; dist: number }[] = [{ locId: army.currentLocationId, dist: 0 }];
    const visited = new Set<number>([army.currentLocationId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check if this location has an active depot
      for (const d of this.depots.values()) {
        if (d.isOperational && d.locationId === current.locId && d.availableGrain > 0) {
          foundDepot = d;
          minDistance = current.dist;
          break;
        }
      }

      if (foundDepot) break;
      if (current.dist >= 8) continue; // Max search radius

      const loc = locationRegistry.get(current.locId);
      if (!loc) continue;

      for (const neighborId of loc.neighbors) {
        // Block path if neighbor is interdicted by naval blockade or hostile ZoC
        if (blockedChokepointLocations.has(neighborId) || hostileZoCLocations.has(neighborId)) {
          continue;
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ locId: neighborId, dist: current.dist + 1 });
        }
      }
    }

    const pathSevered = isInterdictedByBlockade || isInterdictedByZoC || !foundDepot;

    if (pathSevered) {
      army.isStarving = true;
      army.daysStarving += 1;
      army.supplyEfficiency = 0.0;

      // Exponential 5% compounding daily attrition rate
      const dailyAttritionRate = Math.min(0.50, 0.05 * Math.pow(1.05, army.daysStarving));
      const dailyCasualties = Math.floor(army.manpower * dailyAttritionRate);

      army.manpower = Math.max(0, army.manpower - dailyCasualties);
      army.morale = Math.max(0.0, army.morale - 10.0);

      // Permanently subtract dead soldiers from origin location pop arrays
      if (popEngine && dailyCasualties > 0) {
        const originPops = popEngine.getPopsInLocation(army.originLocationId);
        let remainingCasualtiesToDeduct = dailyCasualties;

        for (const pop of originPops) {
          if (remainingCasualtiesToDeduct <= 0) break;
          const deductible = Math.min(pop.size, remainingCasualtiesToDeduct);
          pop.size -= deductible;
          remainingCasualtiesToDeduct -= deductible;
          // Losses in families increase pop militancy
          pop.militancy_unrest = Math.min(1.0, pop.militancy_unrest + 0.05);
        }
      }

      return {
        armyId: army.id,
        supplied: false,
        supplyEfficiency: 0.0,
        nearestDepotId: undefined,
        logisticalDistance: minDistance === 999 ? 100 : minDistance,
        isInterdictedByBlockade,
        isInterdictedByZoC,
        dailyAttritionRate,
        dailyCasualties,
        originLocationId: army.originLocationId
      };
    }

    // Path is open and depot was found
    army.isStarving = false;
    army.daysStarving = 0;

    const baseEff = foundDepot.baseEfficiency || 1.0;
    const decay = foundDepot.decayRate || this.baseDecayRate;
    const eff = this.calculateEfficiency(baseEff, decay, minDistance);
    army.supplyEfficiency = eff;

    return {
      armyId: army.id,
      supplied: true,
      supplyEfficiency: eff,
      nearestDepotId: foundDepot.id,
      logisticalDistance: minDistance,
      isInterdictedByBlockade: false,
      isInterdictedByZoC: false,
      dailyAttritionRate: 0.0,
      dailyCasualties: 0,
      originLocationId: army.originLocationId
    };
  }
}
