import test from 'node:test';
import assert from 'node:assert';
import { 
  InstitutionPropagationEngine 
} from '../src/economy/institutions.ts';
import type { InstitutionLocationContext } from '../src/economy/institutions.ts';
import { 
  IdeaNetworkEngine, 
  IdeaCategory 
} from '../src/politics/ideas.ts';
import { 
  TerritorialIntegrationManager 
} from '../src/politics/integration.ts';
import { 
  MarketClearingEngine 
} from '../src/economy/market_clearing.ts';

test('Dynamic Institution Diffusion & Global Technology Eras', async (t) => {
  const engine = new InstitutionPropagationEngine();

  await t.test('Organically spawns Renaissance upon fulfilling structural parameters', () => {
    const locations: InstitutionLocationContext[] = [
      {
        id: 20,
        name: 'Venice',
        country: 'VEN',
        isMarketHub: true,
        totalPopulation: 38000,
        burgherPopulation: 18000, // > 10%
        totalWealth: 850.0,        // > 500.0
        devastation: 0.0,
        infrastructureCapacity: 1.5,
        connectedTradeThroughput: 2.0,
        adjacentLocationIds: [23, 104],
        institutionPresence: {}
      },
      {
        id: 1,
        name: 'London',
        country: 'ENG',
        isMarketHub: true,
        totalPopulation: 31500,
        burgherPopulation: 4000,
        totalWealth: 450.0, // Below 500 threshold
        devastation: 0.0,
        infrastructureCapacity: 1.0,
        connectedTradeThroughput: 1.0,
        adjacentLocationIds: [2],
        institutionPresence: {}
      }
    ];

    // Ruler with high learning (78)
    const spawned = engine.evaluateSpawningPass(locations, 78, '1350-01-01');
    assert.strictEqual(spawned.length, 1);
    assert.strictEqual(spawned[0].institutionId, 'renaissance');
    assert.strictEqual(spawned[0].originLocationId, 20); // Venice spawns Renaissance!
    assert.strictEqual(locations[0].institutionPresence['renaissance'], 100.0);
  });

  await t.test('Diffuses institution tile-by-tile along graph edges and scales outliner penalties', () => {
    const locMap: Map<number, InstitutionLocationContext> = new Map([
      [20, {
        id: 20,
        name: 'Venice',
        country: 'VEN',
        isMarketHub: true,
        totalPopulation: 38000,
        burgherPopulation: 18000,
        totalWealth: 850.0,
        devastation: 0.0,
        infrastructureCapacity: 1.5,
        connectedTradeThroughput: 2.0,
        adjacentLocationIds: [23],
        institutionPresence: { renaissance: 100.0 }
      }],
      [23, {
        id: 23,
        name: 'Rome',
        country: 'PAP',
        isMarketHub: true,
        totalPopulation: 30000,
        burgherPopulation: 5000,
        totalWealth: 400.0,
        devastation: 0.0,
        infrastructureCapacity: 1.2,
        connectedTradeThroughput: 1.5,
        adjacentLocationIds: [20],
        institutionPresence: { renaissance: 0.0 }
      }]
    ]);

    // Advance 5 monthly diffusion ticks
    for (let i = 0; i < 5; i++) {
      engine.processInstitutionMonthlyDiffusion(locMap);
    }

    const rome = locMap.get(23);
    assert.ok(rome);
    assert.ok((rome.institutionPresence['renaissance'] || 0) > 0.0, 'Renaissance must diffuse into Rome');

    // Calculate realm penalties
    const modifiers = engine.calculateRealmInstitutionModifiers([rome], 'renaissance');
    assert.ok(modifiers.outlinerConstructionTimeMultiplier > 1.0, 'Unembraced location scales outliner project times');
  });
});

test('Multi-Tier Idea Group Customization Network', async (t) => {
  const ideaEngine = new IdeaNetworkEngine();

  await t.test('Adopts idea groups upon meeting prestige and crown power thresholds', () => {
    // Insufficient prestige
    const failAdopt = ideaEngine.adoptIdeaGroup('administrative', 10.0, 0.20);
    assert.strictEqual(failAdopt, false);

    // Sufficient prestige (25.0) and crown power (0.35)
    const successAdopt = ideaEngine.adoptIdeaGroup('administrative', 25.0, 0.35);
    assert.strictEqual(successAdopt, true);

    const group = ideaEngine.getGroup('administrative');
    assert.strictEqual(group?.isAdopted, true);
  });

  await t.test('Unlocks idea nodes and injects permanent modifiers into engine subsystems', () => {
    // Unlock Centralized Tax (Admin 3)
    const unlockRes1 = ideaEngine.unlockIdeaNode('administrative', 'admin_1_fiscal_clerks', 30.0, 0.50);
    assert.strictEqual(unlockRes1.success, true);

    const unlockRes3 = ideaEngine.unlockIdeaNode('administrative', 'admin_3_centralized_tax', 30.0, 0.50);
    assert.strictEqual(unlockRes3.success, true);

    // Adopt and unlock Quantity 1 (Levy Mobilization)
    ideaEngine.adoptIdeaGroup('quantity', 25.0, 0.35);
    const unlockQty = ideaEngine.unlockIdeaNode('quantity', 'quantity_1_levy_mobilization', 20.0, 0.20);
    assert.strictEqual(unlockQty.success, true);

    const activeMods = ideaEngine.getActiveModifiers();
    assert.strictEqual(activeMods.controlDecayReduction, 0.25, '-25% Control Decay modifier active');
    assert.strictEqual(activeMods.levyMobilizationBonus, 0.10, '+10% Levy Extraction modifier active');
    assert.strictEqual(activeMods.taxSkimmingEfficiencyBonus, 0.10);
  });
});

test('Local Autonomy, Core Justification & Integration Loop', async (t) => {
  const integrationManager = new TerritorialIntegrationManager();

  await t.test('Filters tax extraction and routes wealth to local estates based on autonomy', () => {
    // Location 3 (Calais): 35% Autonomy
    const grossTax = 100.0;
    const split = integrationManager.computeAutonomyTaxSplits(3, grossTax);

    assert.strictEqual(split.stateExtractedTax, 65.0, '65% of tax extracted by crown');
    assert.strictEqual(split.estateDivertedTax, 35.0, '35% of tax diverted to local estates');

    // Manpower extraction test
    const men = integrationManager.computeAutonomyManpowerExtraction(3, 1000);
    assert.strictEqual(men, 650, 'Manpower extraction scaled by 65%');
  });

  await t.test('Advances core integration task and completes at 100%', () => {
    let completedLoc = 0;

    // Start integrating newly acquired non-core territory (Normandy / Rouen - ID: 4)
    integrationManager.registerLocation({
      locationId: 4,
      locationName: 'Rouen (Normandy)',
      countryTag: 'ENG',
      isCore: false,
      localAutonomy: 40.0,
      autonomyFloor: 20.0
    });

    const task = integrationManager.startIntegrationTask({
      locationId: 4,
      territoryName: 'Normandy',
      countryTag: 'ENG'
    });

    assert.strictEqual(task.progressPct, 0.0);

    // Advance integration with high ruler stewardship (80) + idea bonus (0.20)
    for (let i = 0; i < 50; i++) {
      integrationManager.advanceMonthlyIntegrationPass(80, 0.20, (locId) => {
        completedLoc = locId;
      });
    }

    assert.strictEqual(task.isCompleted, true);
    assert.strictEqual(task.progressPct, 100.0);
    assert.strictEqual(completedLoc, 4);

    const loc = integrationManager.getLocation(4);
    assert.strictEqual(loc?.isCore, true, 'Territory becomes fully core at 100% integration');
    assert.strictEqual(loc?.autonomyFloor, 0.0);
  });
});

test('Dynamic Market Clearing Supply-Demand Engine', async (t) => {
  const marketEngine = new MarketClearingEngine();

  await t.test('Calculates localized dynamic clearing price based on supply and demand', () => {
    // Base price = 2.5, Demand = 100, Supply = 100 -> Price = 2.5
    const priceEquilibrium = marketEngine.calculateClearingPrice(2.5, 100, 100, 0.50);
    assert.strictEqual(priceEquilibrium, 2.5);

    // High demand (160) vs low supply (40) -> Ratio = 4 -> Price = 2.5 * 4^0.5 = 2.5 * 2 = 5.0
    const priceHighDemand = marketEngine.calculateClearingPrice(2.5, 160, 40, 0.50);
    assert.strictEqual(priceHighDemand, 5.0);
  });

  await t.test('Blockade starvation feedback loop spikes strategic goods by 400% and halts weapons', () => {
    // Blockade English Channel / London Market (Hub 10)
    const result = marketEngine.applyBlockadeStarvation(10, true);

    assert.strictEqual(result.hubId, 10);
    assert.strictEqual(result.weaponsManufacturingHalted, true, 'Weapons manufacturing halts due to iron/timber starvation');
    assert.ok(result.hudTreasuryImpactDelta < 0, 'Higher maintenance spikes drain crown treasury');

    const hub = marketEngine.getHub(10);
    const iron = hub?.goods.get('iron');
    assert.strictEqual(iron?.isStarved, true);
    // Iron base = 6.0, spiked price = 6.0 * 5.0 = 30.0 (+400%)
    assert.strictEqual(iron?.currentPrice, 30.0, 'Strategic goods price spikes by 400% upon blockade');
  });
});
