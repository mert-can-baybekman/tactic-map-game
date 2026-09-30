import type { BuildingDefinition } from '../core/types.ts';
import { LocationRegistry, type LocationData } from '../map/location.ts';
import { PopDemographicEngine } from '../demographics/pop.ts';
import { MarketEconomyEngine } from './market.ts';

export interface ProductionBuildingInstance {
  id: string;
  buildingTypeId: string;
  locationId: number;
  operationalEfficiency: number; // 0.0 to 1.0
  lastTickOutput: Record<string, number>;
}

export class ProductionEngine {
  private buildingDefinitions: Map<string, BuildingDefinition> = new Map();
  private activeBuildings: ProductionBuildingInstance[] = [];

  public registerBuildingDefinition(def: BuildingDefinition): void {
    this.buildingDefinitions.set(def.id, def);
  }

  public constructBuilding(buildingTypeId: string, locationId: number): ProductionBuildingInstance {
    const instance: ProductionBuildingInstance = {
      id: `${buildingTypeId}_${locationId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      buildingTypeId,
      locationId,
      operationalEfficiency: 1.0,
      lastTickOutput: {}
    };
    this.activeBuildings.push(instance);
    return instance;
  }

  public getBuildingsInLocation(locationId: number): ProductionBuildingInstance[] {
    return this.activeBuildings.filter(b => b.locationId === locationId);
  }

  /**
   * Execute Production Value Chain Tick:
   * 1. Pops perform raw extraction (Grain, Iron, Timber, Wool, Copper).
   * 2. Manufacturing workshops consume inputs from Market Hub.
   * 3. If inputs are missing/blockaded, workshop output drops to 0%.
   */
  public executeProductionTick(
    locationRegistry: LocationRegistry,
    popEngine: PopDemographicEngine,
    marketEngine: MarketEconomyEngine
  ): void {
    const locations = locationRegistry.getAll();

    // Phase 1: Raw Extraction by Commoner/Labor Pops
    for (const loc of locations) {
      const pops = popEngine.getPopsInLocation(loc.id);
      const totalWorkforce = pops.reduce((sum, p) => sum + p.size, 0);
      const hubId = loc.market_hub_id;

      for (const [goodId, potential] of Object.entries(loc.base_material_potentials)) {
        // Extraction scaled by labor, potential, and devastation
        const devastationPenalty = Math.max(0.1, 1.0 - loc.devastation);
        const extractionVolume = potential * (totalWorkforce / 1000.0) * devastationPenalty * 15.0;

        marketEngine.recordSupply(hubId, goodId, extractionVolume);
      }
    }

    // Phase 2: Structural Manufacturing Value Chain
    for (const building of this.activeBuildings) {
      const def = this.buildingDefinitions.get(building.buildingTypeId);
      const loc = locationRegistry.get(building.locationId);
      if (!def || !loc) continue;

      const hub = marketEngine.getHub(loc.market_hub_id);
      if (!hub) continue;

      // Check required input resources available in the Market Hub
      let inputFulfillmentRatio = 1.0;

      for (const [inputGoodId, requiredAmount] of Object.entries(def.inputs)) {
        marketEngine.recordDemand(hub.id, inputGoodId, requiredAmount);

        const currentSupply = hub.supply.get(inputGoodId) || 0.0;
        if (currentSupply < requiredAmount) {
          const ratio = Math.max(0.0, currentSupply / Math.max(0.001, requiredAmount));
          inputFulfillmentRatio = Math.min(inputFulfillmentRatio, ratio);
        }
      }

      // Check labor availability in location
      const localPops = popEngine.getPopsInLocation(loc.id);
      const qualifiedPops = localPops.filter(p => p.estate_type === def.labor_estate);
      const totalLabor = qualifiedPops.reduce((sum, p) => sum + p.size, 0);

      const laborFulfillment = Math.min(1.0, totalLabor / Math.max(1, def.labor_quantity));

      // Effective operational efficiency
      building.operationalEfficiency = inputFulfillmentRatio * laborFulfillment * (1.0 - loc.devastation);
      building.lastTickOutput = {};

      // Generate output goods
      for (const [outputGoodId, baseOutput] of Object.entries(def.outputs)) {
        const actualOutput = baseOutput * building.operationalEfficiency;
        building.lastTickOutput[outputGoodId] = actualOutput;

        marketEngine.recordSupply(hub.id, outputGoodId, actualOutput);
      }
    }
  }
}
