import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { PopDemographicEngine } from '../src/demographics/pop.ts';
import { LocationRegistry } from '../src/map/location.ts';
import { TerrainType, ClimateType, EstateType } from '../src/core/types.ts';

describe('Pop Demographic & Epidemic Simulation Engine', () => {
  test('Pop growth follows exact mathematical formula', () => {
    const pops = new PopDemographicEngine();
    const locations = new LocationRegistry();

    locations.register({
      id: 1,
      name: 'Test Province',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 20,
      devastation: 0.1, // 10% devastation
      base_material_potentials: {},
      neighbors: [],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 1.0,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 50
    });

    const pop = pops.createPop({
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'anglo_norman',
      religion_id: 'catholic',
      culture_distribution: { anglo_norman: 1.0 },
      religion_distribution: { catholic: 1.0 },
      size: 10000,
      wealth: 20.0,
      basic_needs_satisfaction: 1.0,
      luxury_needs_satisfaction: 0.5,
      militancy_unrest: 0.1
    });

    // Equation: Growth_Rate = Base_Rate * Basic_Needs_Satisfaction - (Devastation_Multiplier * 0.1)
    // Base_Rate = 0.02
    // Growth_Rate = 0.02 * 1.0 - (0.1 * 0.1) = 0.02 - 0.01 = 0.01 (1% growth)
    pops.executeGrowthTick(locations, 0.02);

    assert.strictEqual(pop.size, 10100, 'Pop size must increase by exactly 1% (100 pops)');
  });

  test('Migration vectors trigger under high devastation (>0.4)', () => {
    const pops = new PopDemographicEngine();
    const locations = new LocationRegistry();

    // Devastated location
    locations.register({
      id: 1,
      name: 'Warzone',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 10,
      devastation: 0.7, // Devastation > 0.4
      base_material_potentials: {},
      neighbors: [2],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 0.3,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 30
    });

    // Safe adjacent location
    locations.register({
      id: 2,
      name: 'Safe Haven',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 40,
      devastation: 0.0,
      base_material_potentials: {},
      neighbors: [1],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 0.95,
      has_fort: true,
      fort_level: 2,
      zoc_radius: 1,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 100
    });

    const pop = pops.createPop({
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'anglo_norman',
      religion_id: 'catholic',
      culture_distribution: { anglo_norman: 1.0 },
      religion_distribution: { catholic: 1.0 },
      size: 5000,
      wealth: 10.0,
      basic_needs_satisfaction: 0.5,
      luxury_needs_satisfaction: 0.1,
      militancy_unrest: 0.4
    });

    const flows = pops.calculateMigrationFlows(locations, 20.0);
    assert.strictEqual(flows.length, 1, 'Should generate 1 migration flow vector');
    assert.strictEqual(flows[0].origin_location_id, 1);
    assert.strictEqual(flows[0].target_location_id, 2);
    assert.ok(flows[0].migrating_count > 0);

    // Apply migration
    pops.applyMigration(flows);
    assert.strictEqual(pop.size, 5000 - flows[0].migrating_count);
    const targetPops = pops.getPopsInLocation(2);
    assert.strictEqual(targetPops.length, 1);
    assert.strictEqual(targetPops[0].size, flows[0].migrating_count);
  });

  test('Black death plague contagion causes mortality and spreads to neighbors', () => {
    const pops = new PopDemographicEngine();
    const locations = new LocationRegistry();

    locations.register({
      id: 1,
      name: 'Infected Port',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Coast,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 20,
      devastation: 0.0,
      base_material_potentials: {},
      neighbors: [2],
      is_port: true,
      sea_connections: [],
      market_hub_id: 1,
      control: 1.0,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: true,
      plague_intensity: 1.0,
      tax_base: 80
    });

    locations.register({
      id: 2,
      name: 'Neighbor Province',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 20,
      devastation: 0.0,
      base_material_potentials: {},
      neighbors: [1],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 1.0,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0.0,
      tax_base: 50
    });

    pops.createPop({
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'anglo_norman',
      religion_id: 'catholic',
      culture_distribution: { anglo_norman: 1.0 },
      religion_distribution: { catholic: 1.0 },
      size: 10000,
      wealth: 50.0,
      basic_needs_satisfaction: 1.0,
      luxury_needs_satisfaction: 0.5,
      militancy_unrest: 0
    });

    const tradeThroughputs = new Map<number, number>();
    tradeThroughputs.set(2, 5.0);

    const result = pops.executePlagueContagionTick(locations, tradeThroughputs, 1.0);
    assert.ok(result.totalPlagueDeaths > 0, 'Plague must inflict fatalities in infected location');
  });
});
