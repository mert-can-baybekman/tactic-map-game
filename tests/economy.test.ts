import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { MarketEconomyEngine } from '../src/economy/market.ts';
import { ProductionEngine } from '../src/economy/production.ts';
import { LocationRegistry } from '../src/map/location.ts';
import { PopDemographicEngine } from '../src/demographics/pop.ts';
import { TerrainType, ClimateType, EstateType } from '../src/core/types.ts';

describe('Economic Clearing & Value Chain Engine', () => {
  test('Market clearing price dynamically responds to supply and demand', () => {
    const market = new MarketEconomyEngine();
    market.registerGood({
      id: 'grain',
      name: 'Grain',
      category: 'raw',
      base_price: 2.0,
      weight_logistics: 1.0,
      elasticity_factor: 1.0,
      needs_category: 'basic',
      caloric_density: 1.0
    });

    market.registerHub({
      id: 1,
      name: 'Hub 1',
      location_ids: [1],
      inventory: new Map(),
      supply: new Map(),
      demand: new Map(),
      prices: new Map()
    });

    // 1. Equal supply and demand -> price equals base price
    market.recordSupply(1, 'grain', 100);
    market.recordDemand(1, 'grain', 100);
    market.executeMarketClearingTick();
    assert.strictEqual(market.getGoodPrice(1, 'grain'), 2.0);

    // 2. High demand, low supply -> price increases
    market.resetTickSupplyDemand();
    market.recordSupply(1, 'grain', 50);
    market.recordDemand(1, 'grain', 100);
    market.executeMarketClearingTick();
    assert.strictEqual(market.getGoodPrice(1, 'grain'), 4.0); // 2.0 * (100 / 50)^1.0 = 4.0

    // 3. Excess supply glut -> price decreases
    market.resetTickSupplyDemand();
    market.recordSupply(1, 'grain', 200);
    market.recordDemand(1, 'grain', 100);
    market.executeMarketClearingTick();
    assert.strictEqual(market.getGoodPrice(1, 'grain'), 1.0); // 2.0 * (100 / 200)^1.0 = 1.0
  });

  test('Trade corridor blockade halts throughput and collapses downstream workshop inputs', () => {
    const market = new MarketEconomyEngine();
    const production = new ProductionEngine();
    const locations = new LocationRegistry();
    const pops = new PopDemographicEngine();

    market.registerGood({
      id: 'iron',
      name: 'Iron',
      category: 'raw',
      base_price: 6.0,
      weight_logistics: 2.0,
      elasticity_factor: 0.8,
      needs_category: 'industrial',
      caloric_density: 0
    });

    market.registerGood({
      id: 'weapons',
      name: 'Weapons',
      category: 'manufactured',
      base_price: 20.0,
      weight_logistics: 1.5,
      elasticity_factor: 0.5,
      needs_category: 'military',
      caloric_density: 0
    });

    production.registerBuildingDefinition({
      id: 'armory',
      name: 'Armory',
      type: 'manufacturing',
      inputs: { iron: 10.0 },
      outputs: { weapons: 5.0 },
      labor_estate: EstateType.Burghers,
      labor_quantity: 100,
      build_cost_gold: 100,
      maintenance_gold: 2
    });

    locations.register({
      id: 1,
      name: 'Mining Province',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Hills,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 30,
      devastation: 0,
      base_material_potentials: { iron: 2.0 },
      neighbors: [2],
      is_port: false,
      sea_connections: [],
      market_hub_id: 10,
      control: 1.0,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 50
    });

    locations.register({
      id: 2,
      name: 'Manufacturing Port',
      province_id: 2,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 30,
      devastation: 0,
      base_material_potentials: {},
      neighbors: [1],
      is_port: true,
      sea_connections: [],
      market_hub_id: 20,
      control: 1.0,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: ['armory'],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 80
    });

    market.registerHub({
      id: 10,
      name: 'Mining Hub',
      location_ids: [1],
      inventory: new Map(),
      supply: new Map(),
      demand: new Map(),
      prices: new Map()
    });

    market.registerHub({
      id: 20,
      name: 'Manufacturing Hub',
      location_ids: [2],
      inventory: new Map(),
      supply: new Map(),
      demand: new Map(),
      prices: new Map()
    });

    market.addTradeRoute({
      id: 'iron_trade_corridor',
      sourceHubId: 10,
      targetHubId: 20,
      capacity: 50,
      transport_cost_multiplier: 0.1,
      is_blockaded: false,
      is_embargoed: false,
      active_throughput: 0
    });

    pops.createPop({
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'default',
      religion_id: 'default',
      culture_distribution: { default: 1.0 },
      religion_distribution: { default: 1.0 },
      size: 5000,
      wealth: 10,
      basic_needs_satisfaction: 1.0,
      luxury_needs_satisfaction: 0.5,
      militancy_unrest: 0
    });

    pops.createPop({
      location_id: 2,
      estate_type: EstateType.Burghers,
      culture_id: 'default',
      religion_id: 'default',
      culture_distribution: { default: 1.0 },
      religion_distribution: { default: 1.0 },
      size: 1000,
      wealth: 50,
      basic_needs_satisfaction: 1.0,
      luxury_needs_satisfaction: 0.8,
      militancy_unrest: 0
    });

    const armory = production.constructBuilding('armory', 2);

    // Initial cycle:
    // 1. Raw extraction supplies iron to Mining Hub 10 & Armory posts demand in Hub 20
    // 2. Market clearing executes arbitrage trade from Hub 10 -> Hub 20
    // 3. Armory consumes imported iron to produce weapons
    production.executeProductionTick(locations, pops, market);
    market.executeMarketClearingTick();
    production.executeProductionTick(locations, pops, market);

    assert.ok(armory.operationalEfficiency > 0, 'Armory must operate when trade route is open');

    // Blockade trade route
    market.setRouteBlockade('iron_trade_corridor', true);
    market.resetTickSupplyDemand();
    production.executeProductionTick(locations, pops, market);
    market.executeMarketClearingTick();
    production.executeProductionTick(locations, pops, market);

    // In Hub 20, iron supply is now 0 because the route is blocked
    const hub20Iron = market.getHub(20)?.supply.get('iron') || 0;
    assert.strictEqual(hub20Iron, 0, 'Iron supply must drop to 0 in isolated hub');
    assert.strictEqual(armory.operationalEfficiency, 0, 'Manufacturing efficiency must drop to 0% without inputs');
  });
});
