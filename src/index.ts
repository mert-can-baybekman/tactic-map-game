import * as fs from 'fs';
import * as path from 'path';
import { GrandStrategyEngine } from './core/engine.ts';
import { TerrainType, ClimateType, EstateType, UnitType } from './core/types.ts';

console.log('================================================================');
console.log('   GRAND STRATEGY SIMULATION ENGINE (CLAUSEWITZ / DOD)          ');
console.log('================================================================\n');

const engine = new GrandStrategyEngine(1);

// Load Vanilla Mod Data
const goodsData = JSON.parse(fs.readFileSync('./data/mods/vanilla/goods.json', 'utf8'));
const buildingsData = JSON.parse(fs.readFileSync('./data/mods/vanilla/buildings.json', 'utf8'));

for (const good of Object.values(goodsData)) {
  engine.markets.registerGood(good as any);
}
for (const bld of Object.values(buildingsData)) {
  engine.production.registerBuildingDefinition(bld as any);
}

console.log(`✓ Loaded ${Object.keys(goodsData).length} Trade Goods & ${Object.keys(buildingsData).length} Structural Value Chain Buildings.`);

// Setup Map Locations: London (1), Dover (2), Calais (3), Rouen (4), Paris (5)
engine.locations.register({
  id: 1,
  name: 'London',
  province_id: 101,
  country_id: 1,
  terrain: TerrainType.Farmland,
  climate: ClimateType.Temperate,
  infrastructure_capacity: 50.0,
  current_infrastructure: 35.0,
  devastation: 0.0,
  base_material_potentials: { grain: 1.2, wool: 0.8 },
  neighbors: [2],
  is_port: true,
  sea_connections: [3],
  market_hub_id: 10,
  control: 1.0,
  has_fort: true,
  fort_level: 2,
  zoc_radius: 1,
  buildings: ['grain_farm'],
  plague_infected: false,
  plague_intensity: 0.0,
  tax_base: 120.0
});

engine.locations.register({
  id: 2,
  name: 'Dover',
  province_id: 101,
  country_id: 1,
  terrain: TerrainType.Coast,
  climate: ClimateType.Temperate,
  infrastructure_capacity: 30.0,
  current_infrastructure: 20.0,
  devastation: 0.05,
  base_material_potentials: { iron: 0.5, timber: 0.7 },
  neighbors: [1],
  is_port: true,
  sea_connections: [3],
  market_hub_id: 10,
  control: 0.88,
  has_fort: true,
  fort_level: 2,
  zoc_radius: 1,
  buildings: ['iron_mine', 'timber_mill'],
  plague_infected: false,
  plague_intensity: 0.0,
  tax_base: 65.0
});

engine.locations.register({
  id: 3,
  name: 'Calais',
  province_id: 201,
  country_id: 1,
  terrain: TerrainType.Marsh,
  climate: ClimateType.Temperate,
  infrastructure_capacity: 25.0,
  current_infrastructure: 15.0,
  devastation: 0.10,
  base_material_potentials: { wool: 0.4 },
  neighbors: [4],
  is_port: true,
  sea_connections: [1, 2],
  market_hub_id: 20,
  control: 0.65,
  has_fort: true,
  fort_level: 3,
  zoc_radius: 1,
  buildings: ['weaver_guild'],
  plague_infected: false,
  plague_intensity: 0.0,
  tax_base: 80.0
});

engine.locations.register({
  id: 4,
  name: 'Rouen',
  province_id: 202,
  country_id: 1,
  terrain: TerrainType.Farmland,
  climate: ClimateType.Temperate,
  infrastructure_capacity: 40.0,
  current_infrastructure: 25.0,
  devastation: 0.15,
  base_material_potentials: { timber: 0.9, grain: 0.8 },
  neighbors: [3, 5],
  is_port: true,
  sea_connections: [],
  market_hub_id: 20,
  control: 0.55,
  has_fort: false,
  fort_level: 0,
  zoc_radius: 0,
  buildings: ['armory'],
  plague_infected: false,
  plague_intensity: 0.0,
  tax_base: 75.0
});

engine.locations.register({
  id: 5,
  name: 'Paris',
  province_id: 203,
  country_id: 2,
  terrain: TerrainType.Farmland,
  climate: ClimateType.Temperate,
  infrastructure_capacity: 60.0,
  current_infrastructure: 40.0,
  devastation: 0.0,
  base_material_potentials: { grain: 1.5 },
  neighbors: [4],
  is_port: false,
  sea_connections: [],
  market_hub_id: 20,
  control: 0.95,
  has_fort: true,
  fort_level: 3,
  zoc_radius: 1,
  buildings: ['weaver_guild'],
  plague_infected: false,
  plague_intensity: 0.0,
  tax_base: 150.0
});

// Setup Market Hubs: London Hub (10) and Flanders/Paris Hub (20)
engine.markets.registerHub({
  id: 10,
  name: 'London Market Hub',
  location_ids: [1, 2],
  inventory: new Map(),
  supply: new Map(),
  demand: new Map(),
  prices: new Map()
});

engine.markets.registerHub({
  id: 20,
  name: 'Low Countries / Channel Hub',
  location_ids: [3, 4, 5],
  inventory: new Map(),
  supply: new Map(),
  demand: new Map(),
  prices: new Map()
});

// Directed Trade Route Edge across English Channel
engine.markets.addTradeRoute({
  id: 'route_channel_crossing',
  sourceHubId: 10,
  targetHubId: 20,
  capacity: 80.0,
  transport_cost_multiplier: 0.35,
  is_blockaded: false,
  is_embargoed: false,
  active_throughput: 0.0
});

// Construct Buildings
engine.production.constructBuilding('grain_farm', 1);
engine.production.constructBuilding('iron_mine', 2);
engine.production.constructBuilding('timber_mill', 2);
engine.production.constructBuilding('armory', 4);
engine.production.constructBuilding('weaver_guild', 3);

// Populate Micro-Pops
engine.demographics.createPop({
  location_id: 1,
  estate_type: EstateType.Nobility,
  culture_id: 'anglo_norman',
  religion_id: 'catholic',
  culture_distribution: { anglo_norman: 0.90, francien: 0.10 },
  religion_distribution: { catholic: 1.0 },
  size: 3500,
  wealth: 450.0,
  basic_needs_satisfaction: 1.0,
  luxury_needs_satisfaction: 0.85,
  militancy_unrest: 0.05
});

engine.demographics.createPop({
  location_id: 1,
  estate_type: EstateType.Commoners,
  culture_id: 'anglo_norman',
  religion_id: 'catholic',
  culture_distribution: { anglo_norman: 0.80, francien: 0.20 },
  religion_distribution: { catholic: 0.95, cathar: 0.05 },
  size: 28000,
  wealth: 18.0,
  basic_needs_satisfaction: 0.90,
  luxury_needs_satisfaction: 0.20,
  militancy_unrest: 0.12
});

engine.demographics.createPop({
  location_id: 2,
  estate_type: EstateType.Burghers,
  culture_id: 'anglo_norman',
  religion_id: 'catholic',
  culture_distribution: { anglo_norman: 0.85, flemish: 0.15 },
  religion_distribution: { catholic: 1.0 },
  size: 4200,
  wealth: 85.0,
  basic_needs_satisfaction: 0.95,
  luxury_needs_satisfaction: 0.50,
  militancy_unrest: 0.08
});

engine.demographics.createPop({
  location_id: 4,
  estate_type: EstateType.Commoners,
  culture_id: 'francien',
  religion_id: 'catholic',
  culture_distribution: { francien: 0.95, anglo_norman: 0.05 },
  religion_distribution: { catholic: 1.0 },
  size: 15000,
  wealth: 12.0,
  basic_needs_satisfaction: 0.80,
  luxury_needs_satisfaction: 0.10,
  militancy_unrest: 0.25
});

console.log(`✓ Initialized Map with ${engine.locations.getAll().length} Locations, Pop Total: ${engine.demographics.getTotalPopulation()}`);

// Run 3 Monthly Ticks
console.log('\n--- EXECUTING 90-DAY SIMULATION SEQUENCE ---');
for (let day = 1; day <= 90; day++) {
  engine.executeDayTick();
}

console.log(`✓ Completed 90 Simulation Ticks. Calendar Date: ${engine.calendar.year}-${engine.calendar.month}-${engine.calendar.day}`);
console.log(`✓ Crown Treasury: ${engine.playerRealm.treasuryGold.toFixed(2)} Ducats | Crown Power: ${(engine.playerRealm.crownPower * 100).toFixed(1)}%`);

// Print Control Decay Pathfinding Results
console.log('\n--- EXPONENTIAL STATE CONTROL OVER LOCATIONS ---');
for (const loc of engine.locations.getAll()) {
  console.log(`• [Location ${loc.id}] ${loc.name.padEnd(8)} | Control: ${(loc.control * 100).toFixed(1)}% | Devastation: ${(loc.devastation * 100).toFixed(1)}%`);
}

// Print Market Clearing Prices
console.log('\n--- DYNAMIC MARKET CLEARING PRICES (LONDON HUB) ---');
for (const [goodId] of Object.entries(goodsData)) {
  const price = engine.markets.getGoodPrice(10, goodId);
  console.log(`• ${goodId.padEnd(12)}: ${price.toFixed(2)} Ducats`);
}

// Print Estate Vault Balances (Proving Tax Skimming Routing)
console.log('\n--- INSTITUTIONAL ESTATE WEALTH & LOYALTY ---');
for (const estate of engine.estates.getAllEstates()) {
  console.log(`• Estate [${estate.type.padEnd(9)}]: Institutional Wealth = ${estate.institutional_wealth.toFixed(1)} Ducats | Loyalty = ${estate.loyalty.toFixed(1)}% | Power = ${(estate.raw_power * 100).toFixed(1)}%`);
}

// Demonstrate Feudal Levy Extraction & Demographic Feedback
console.log('\n--- FEUDAL LEVY MOBILIZATION & DEMOGRAPHIC CASUALTY TEST ---');
const popBefore = engine.demographics.getPopsInLocation(1).find(p => p.estate_type === EstateType.Nobility)!;
console.log(`Pre-Mobilization Nobility Pop Count: ${popBefore.size}`);
const raised = engine.levies.raiseLeviesFromLocation(1, engine.demographics);
console.log(`Raised ${raised.length} Regiments:`);
for (const reg of raised) {
  console.log(`  -> ${reg.unit_type} (${reg.current_manpower} knights) raised from Pop ID ${reg.origin_pop_id}`);
}
console.log(`Post-Mobilization Nobility Pop Count (Civilians): ${popBefore.size}`);

// Suffer casualties in battle
const reg = raised[0];
console.log(`\nSimulating bloody battle casualties: 80 knights killed.`);
engine.levies.applyRegimentCasualties(reg.id, 80, engine.demographics);
console.log(`Regiment surviving manpower: ${reg.current_manpower}`);

// Demobilize surviving knights back into origin location
engine.levies.demobilizeRegiment(reg.id, engine.demographics);
console.log(`Post-Demobilization Nobility Pop Count: ${popBefore.size} (Permanently lost 80 nobles!)`);
