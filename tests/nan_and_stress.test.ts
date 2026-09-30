import * as assert from 'node:assert';
import { GrandStrategyEngine } from '../src/core/engine.ts';
import { TerrainType, ClimateType, EstateType } from '../src/core/types.ts';

console.log('--- STARTING HIGH-THROUGHPUT STRESS & NaN INVARIANT VERIFICATION ---');

const engine = new GrandStrategyEngine(1);

// Register Goods
const goods = ['grain', 'iron', 'timber', 'wool', 'weapons', 'cloth'];
for (const g of goods) {
  engine.markets.registerGood({
    id: g,
    name: g,
    category: g === 'weapons' || g === 'cloth' ? 'manufactured' : 'raw',
    base_price: 5.0,
    weight_logistics: 1.0,
    elasticity_factor: 0.75,
    needs_category: 'basic',
    caloric_density: 1.0
  });
}

// Create 20 interconnected locations
for (let i = 1; i <= 20; i++) {
  engine.locations.register({
    id: i,
    name: `Prov_${i}`,
    province_id: Math.ceil(i / 4),
    country_id: 1,
    terrain: i % 2 === 0 ? TerrainType.Farmland : TerrainType.Mountains,
    climate: ClimateType.Temperate,
    infrastructure_capacity: 50.0,
    current_infrastructure: 25.0,
    devastation: (i % 5) * 0.15,
    base_material_potentials: { grain: 1.0, iron: 0.5 },
    neighbors: [i > 1 ? i - 1 : 20, i < 20 ? i + 1 : 1],
    is_port: i % 4 === 0,
    sea_connections: i % 4 === 0 ? [(i + 4) % 20 + 1] : [],
    market_hub_id: Math.ceil(i / 5),
    control: 0.8,
    has_fort: i % 5 === 0,
    fort_level: 2,
    zoc_radius: 1,
    buildings: [],
    plague_infected: i === 3,
    plague_intensity: i === 3 ? 0.8 : 0.0,
    tax_base: 40.0
  });
}

// Create 4 Market Hubs
for (let h = 1; h <= 4; h++) {
  engine.markets.registerHub({
    id: h,
    name: `Market_Hub_${h}`,
    location_ids: [h * 5 - 4, h * 5 - 3, h * 5 - 2, h * 5 - 1, h * 5],
    inventory: new Map(),
    supply: new Map(),
    demand: new Map(),
    prices: new Map()
  });

  if (h > 1) {
    engine.markets.addTradeRoute({
      id: `trade_${h-1}_to_${h}`,
      sourceHubId: h - 1,
      targetHubId: h,
      capacity: 100.0,
      transport_cost_multiplier: 0.2,
      is_blockaded: false,
      is_embargoed: false,
      active_throughput: 0.0
    });
  }
}

// Spawn 1,000 distinct Micro-Pops across locations
const estateTypes = [EstateType.Nobility, EstateType.Clergy, EstateType.Burghers, EstateType.Commoners, EstateType.Tribes];
for (let p = 1; p <= 1000; p++) {
  const locId = (p % 20) + 1;
  const estate = estateTypes[p % estateTypes.length];
  engine.demographics.createPop({
    location_id: locId,
    estate_type: estate,
    culture_id: 'default_culture',
    religion_id: 'default_religion',
    culture_distribution: { default_culture: 1.0 },
    religion_distribution: { default_religion: 1.0 },
    size: 500 + (p * 10),
    wealth: (p % 50) + 5.0,
    basic_needs_satisfaction: ((p % 10) + 1) / 10.0,
    luxury_needs_satisfaction: ((p % 5) + 1) / 5.0,
    militancy_unrest: (p % 100) / 200.0
  });
}

console.log(`✓ Initialized stress environment: 20 Locations, 4 Market Hubs, 1000 Pops (~5.5M total pop count).`);

// Execute 120 Daily Ticks (4 Months of intensive simulation)
const startTime = Date.now();
for (let day = 1; day <= 120; day++) {
  engine.executeDayTick();

  // Invariant verification every day
  for (const pop of engine.demographics.getAllPops()) {
    if (Number.isNaN(pop.size) || !Number.isFinite(pop.size)) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Pop ${pop.id} size is NaN/Inf on day ${day}`);
    }
    if (Number.isNaN(pop.wealth) || !Number.isFinite(pop.wealth)) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Pop ${pop.id} wealth is NaN/Inf on day ${day}`);
    }
  }

  for (const loc of engine.locations.getAll()) {
    if (Number.isNaN(loc.control) || !Number.isFinite(loc.control)) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Location ${loc.id} control is NaN/Inf on day ${day}`);
    }
  }
}
const elapsedMs = Date.now() - startTime;

console.log(`✓ Completed 120 ticks in ${elapsedMs}ms without a single NaN or Infinity defect.`);
console.log(`✓ Total surviving population: ${engine.demographics.getTotalPopulation()}`);
console.log('✓ STRESS & NaN INVARIANT VERIFICATION PASSED PERFECTLY!\n');
