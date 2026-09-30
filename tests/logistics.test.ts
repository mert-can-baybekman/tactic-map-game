import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { MilitaryLogisticsEngine, type FieldArmy } from '../src/military/logistics.ts';
import { LocationRegistry } from '../src/map/location.ts';
import { PopDemographicEngine } from '../src/demographics/pop.ts';
import { TerrainType, ClimateType, EstateType, UnitType } from '../src/core/types.ts';

describe('Military Logistics & Supply Line Path Tracing', () => {
  test('Army is supplied when clear path connects to depot', () => {
    const logistics = new MilitaryLogisticsEngine();
    const locations = new LocationRegistry();

    locations.register({
      id: 1,
      name: 'Friendly Depot Base',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 30,
      devastation: 0,
      base_material_potentials: {},
      neighbors: [2],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 1.0,
      has_fort: true,
      fort_level: 2,
      zoc_radius: 1,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 50
    });

    locations.register({
      id: 2,
      name: 'Frontline Province',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 20,
      devastation: 0,
      base_material_potentials: {},
      neighbors: [1],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 0.8,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 40
    });

    logistics.registerDepot({
      id: 'depot_1',
      location_id: 1,
      capacity_units: 100,
      available_grain: 50.0
    });

    const army: FieldArmy = {
      id: 'army_1',
      name: 'Royal Vanguard',
      country_id: 1,
      location_id: 2,
      regiments: [],
      is_starving: false,
      days_starving: 0,
      supply_path: []
    };

    const emptySet = new Set<number>();
    const res = logistics.verifySupplyLine(army, locations, emptySet, emptySet);
    assert.strictEqual(res.supplied, true);
    assert.deepStrictEqual(res.path, [2, 1]);
  });

  test('Hostile ZoC or enemy detachment cuts supply line causing compounding starvation', () => {
    const logistics = new MilitaryLogisticsEngine();
    const locations = new LocationRegistry();
    const pops = new PopDemographicEngine();

    locations.register({
      id: 1,
      name: 'Depot Base',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Farmland,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 30,
      devastation: 0,
      base_material_potentials: {},
      neighbors: [2],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 1.0,
      has_fort: true,
      fort_level: 2,
      zoc_radius: 1,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 50
    });

    locations.register({
      id: 2,
      name: 'Chokepoint Pass',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Mountains,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 10,
      devastation: 0,
      base_material_potentials: {},
      neighbors: [1, 3],
      is_port: false,
      sea_connections: [],
      market_hub_id: 1,
      control: 0.5,
      has_fort: false,
      fort_level: 0,
      zoc_radius: 0,
      buildings: [],
      plague_infected: false,
      plague_intensity: 0,
      tax_base: 20
    });

    locations.register({
      id: 3,
      name: 'Isolated Encampment',
      province_id: 1,
      country_id: 1,
      terrain: TerrainType.Marsh,
      climate: ClimateType.Temperate,
      infrastructure_capacity: 50,
      current_infrastructure: 10,
      devastation: 0,
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
      tax_base: 20
    });

    logistics.registerDepot({
      id: 'depot_base',
      location_id: 1,
      capacity_units: 100,
      available_grain: 100.0
    });

    const army: FieldArmy = {
      id: 'army_isolated',
      name: 'Besieged Legion',
      country_id: 1,
      location_id: 3,
      regiments: [{
        id: 'reg_1',
        unit_type: UnitType.PeasantInfantry,
        origin_pop_id: 1,
        origin_location_id: 1,
        estate_type: EstateType.Commoners,
        current_manpower: 1000,
        max_manpower: 1000,
        experience: 10,
        morale: 80
      }],
      is_starving: false,
      days_starving: 0,
      supply_path: []
    };

    // Enemy blocks Location 2 (Chokepoint Pass)
    const enemyOccupied = new Set<number>([2]);
    const hostileZoC = new Set<number>();

    // Tick 1: Cut off
    logistics.executeLogisticsTick([army], locations, pops, hostileZoC, enemyOccupied);
    assert.strictEqual(army.is_starving, true);
    assert.strictEqual(army.days_starving, 1);
    assert.ok(army.regiments[0].current_manpower < 1000, 'Must suffer attrition casualties');

    const day1Manpower = army.regiments[0].current_manpower;

    // Tick 2: Compounding starvation attrition
    logistics.executeLogisticsTick([army], locations, pops, hostileZoC, enemyOccupied);
    assert.strictEqual(army.days_starving, 2);
    assert.ok(army.regiments[0].current_manpower < day1Manpower);
    assert.ok(locations.get(3)!.devastation > 0, 'Foraging must drive up tile devastation');
  });
});
