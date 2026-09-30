import test from 'node:test';
import assert from 'node:assert';
import { 
  DynasticTreeManager 
} from '../src/politics/dynasty_core.ts';
import type { 
  DynasticCharacterNode, 
  MilitaryGeneralCharacter 
} from '../src/politics/dynasty_core.ts';
import { 
  ExplorationExpeditionManager 
} from '../src/military/exploration.ts';
import { 
  ColonyCharterManager, 
  LuxuryGoodType 
} from '../src/economy/colonization.ts';

test('Dynastic Family Tree, Pretender Claims & Succession Crises', async (t) => {
  const dynastyMgr = new DynasticTreeManager();

  const monarch: DynasticCharacterNode = {
    id: 'char_edward_iii',
    name: 'Edward III',
    dynastyName: 'Plantagenet',
    birthYear: 1312,
    isMonarch: true,
    isHeir: false,
    isLegitimate: true,
    siblingIds: ['char_john_eltham'],
    childIds: ['char_black_prince', 'char_lionel_antwerp', 'char_john_gaunt'],
    claimLegitimacyFloat: 100.0,
    ambition: 90.0,
    loyalty: 100.0
  };

  const legitimateSon: DynasticCharacterNode = {
    id: 'char_black_prince',
    name: 'Edward of Woodstock (Black Prince)',
    dynastyName: 'Plantagenet',
    birthYear: 1330,
    isMonarch: false,
    isHeir: true,
    isLegitimate: true,
    fatherId: 'char_edward_iii',
    siblingIds: ['char_lionel_antwerp', 'char_john_gaunt'],
    childIds: ['char_richard_ii'],
    claimLegitimacyFloat: 95.0,
    ambition: 85.0,
    loyalty: 95.0
  };

  const bastardClaimant: DynasticCharacterNode = {
    id: 'char_bastard_clarence',
    name: 'Arthur of Cornwall (Illegitimate)',
    dynastyName: 'Plantagenet',
    birthYear: 1332,
    isMonarch: false,
    isHeir: false,
    isLegitimate: false, // Bastard
    fatherId: 'char_edward_iii',
    siblingIds: [],
    childIds: [],
    claimLegitimacyFloat: 40.0,
    ambition: 95.0, // Highly ambitious rival
    loyalty: 20.0
  };

  dynastyMgr.registerCharacter(monarch);
  dynastyMgr.registerCharacter(legitimateSon);
  dynastyMgr.registerCharacter(bastardClaimant);

  await t.test('Calculates heir and bastard claim legitimacy based on lineage factors', () => {
    const legitScore = dynastyMgr.calculateClaimLegitimacy(legitimateSon, monarch.id);
    assert.strictEqual(legitScore, 95.0);

    const bastardScore = dynastyMgr.calculateClaimLegitimacy(bastardClaimant, monarch.id);
    assert.ok(bastardScore <= 25.0, 'Bastards must have severely penalized claim legitimacy');
  });

  await t.test('Triggers Succession Crisis and general defection when heir legitimacy is low or nobility holds > 30% wealth', () => {
    // Register generals
    const loyalGeneral: MilitaryGeneralCharacter = {
      id: 'gen_chandos',
      name: 'John Chandos',
      countryTag: 'ENG',
      armyStackId: 10,
      locationId: 3,
      troopCount: 5000,
      ambition: 40.0,
      loyalty: 90.0,
      hasDefected: false
    };

    const disloyalAmbitiousGeneral: MilitaryGeneralCharacter = {
      id: 'gen_rebel_earl',
      name: 'Thomas of Lancaster',
      countryTag: 'ENG',
      armyStackId: 11,
      locationId: 4,
      troopCount: 7500,
      ambition: 85.0, // > 60
      loyalty: 25.0,  // < 40 -> Will defect!
      hasDefected: false
    };

    dynastyMgr.registerGeneral(loyalGeneral);
    dynastyMgr.registerGeneral(disloyalAmbitiousGeneral);

    // Crisis with bastard successor (< 50% legitimacy) and wealthy nobility (> 30%)
    const crisis = dynastyMgr.evaluateSuccessionCrisis(
      'ENG',
      monarch.id,
      bastardClaimant.id,
      0.35 // 35% nobility wealth
    );

    assert.ok(crisis !== null);
    assert.strictEqual(crisis?.isSuccessionCrisisActive, true);
    assert.strictEqual(crisis?.countryTag, 'ENG');
    assert.ok(crisis?.rebelTroopCount > 10000, 'Rebel troop count should aggregate base and defected armies');
    assert.ok(crisis?.defectedGeneralIds.includes('gen_rebel_earl'));
    assert.strictEqual(crisis?.defectedGeneralIds.includes('gen_chandos'), false);
    assert.strictEqual(disloyalAmbitiousGeneral.hasDefected, true);
  });
});

test('Terra Incognita Exploration & Naval Charting Matrix', async (t) => {
  const explorationMgr = new ExplorationExpeditionManager();

  // Register Terra Incognita nodes in the Western Atlantic
  explorationMgr.registerTerraIncognitaNode(500, 'Azores Sea Zone', [501, 502]);
  explorationMgr.registerTerraIncognitaNode(501, 'Sargasso Sea', [500]);
  explorationMgr.registerTerraIncognitaNode(502, 'Bermuda Triangle', [500]);

  assert.strictEqual(explorationMgr.isTerraIncognita(500), true);
  assert.strictEqual(explorationMgr.isTerraIncognita(501), true);

  const expedition = explorationMgr.createExpedition(
    'POR',
    1,
    20, // Lisbon
    500, // Azores Sea Zone
    { id: 'exp_da_gama', name: 'Vasco da Gama', intrigue: 8.0, fleetSpeed: 4.0 },
    80.0 // Distance from port
  );

  await t.test('Advances daily charting progression decaying with distance from port', () => {
    // Base speed = 2.0, (8.0 + 4.0) = 12.0. decay = exp(-80/100) = ~0.449
    // delta = 2.0 * 12.0 * 0.449 = ~10.78
    const tick1 = explorationMgr.processDailyChartTick(expedition.expeditionId, 2.0);
    assert.ok(tick1.progressDelta > 5.0);
    assert.ok(tick1.currentProgress > 0);
    assert.strictEqual(tick1.completed, false);
  });

  await t.test('Reveals Terra Incognita nodes and awards Prestige on 100% completion', () => {
    // Advance remaining progress to 100%
    let result;
    for (let day = 0; day < 15; day++) {
      result = explorationMgr.processDailyChartTick(expedition.expeditionId, 10.0);
      if (result.completed) break;
    }

    assert.ok(result?.completed, 'Expedition should complete charting');
    assert.strictEqual(explorationMgr.isTerraIncognita(500), false);
    assert.strictEqual(explorationMgr.isTerraIncognita(501), false);
    assert.ok(result?.prestigeAward >= 25.0);
    assert.strictEqual(explorationMgr.getAccumulatedPrestige('POR'), 25.0);
  });
});

test('Overseas Colony Charters & Global Resource Injection', async (t) => {
  const colonyMgr = new ColonyCharterManager();

  const colony = colonyMgr.deployColonyCharter(
    'SPA',
    601,
    'Hispaniola',
    LuxuryGoodType.Sugar,
    30, // Seville
    1800,
    20.0, // Native aggression
    25.0 // Monthly gold maintenance
  );

  await t.test('Tracks monthly population growth and maintenance deduction', () => {
    assert.strictEqual(colony.currentPopulation, 100);
    assert.strictEqual(colony.isCoreLocation, false);
    assert.strictEqual(colony.monthlyGoldMaintenance, 25.0);

    // Growth = 45 + (75 * 0.1) - (20 * 0.05) = 45 + 7.5 - 1.0 = 51.5 -> 51
    const tickResult = colonyMgr.processMonthlyColonyTick(colony.charterId, 45.0);
    assert.strictEqual(tickResult.netGrowth, 51);
    assert.strictEqual(tickResult.currentPopulation, 151);
    assert.strictEqual(tickResult.monthlyMaintenance, 25.0);
    assert.strictEqual(tickResult.convertedToCore, false);
  });

  await t.test('Converts to Core Location at 5,000 pops, zeros maintenance, and injects luxury resource', () => {
    colony.currentPopulation = 4980;

    const finalTick = colonyMgr.processMonthlyColonyTick(colony.charterId, 45.0);
    assert.ok(finalTick.currentPopulation >= 5000);
    assert.strictEqual(finalTick.convertedToCore, true);
    assert.strictEqual(colony.isCoreLocation, true);
    assert.strictEqual(colony.monthlyGoldMaintenance, 0); // Self-sustaining
    assert.strictEqual(finalTick.resourceInjected, LuxuryGoodType.Sugar);
    assert.strictEqual(colony.tradeEdgeEstablished, true);
  });
});
