import test from 'node:test';
import assert from 'node:assert';
import { 
  PopDemographicsAccelerator 
} from '../src/demographics/accelerator.ts';
import type { 
  DemographicNodeState 
} from '../src/demographics/accelerator.ts';
import { 
  AICoalitionManager, 
  CoalitionStance 
} from '../src/ai/coalition_engine.ts';
import { 
  ErasManager, 
  HistoricalEra 
} from '../src/core/eras_manager.ts';

test('Multi-Threaded Pop Migration & Assimilation Accelerator', async (t) => {
  const accelerator = new PopDemographicsAccelerator();

  await t.test('Partitions nodes into spatial zones with thread affinities', () => {
    const nodes: DemographicNodeState[] = [];
    for (let i = 1; i <= 60; i++) {
      nodes.push({
        locationId: i,
        zoneId: 0,
        countryTag: 'FRA',
        commonerPops: 10000,
        burgherPops: 2000,
        clergyPops: 1000,
        noblePops: 500,
        devastation: 0.0,
        hasEpidemics: false,
        hasFamine: false,
        needsSatisfaction: 0.90,
        connectedEdgeIds: [i + 1],
        isFarmland: true,
        dominantCulture: 'French',
        assimilatedPercentage: 80.0
      });
    }

    const zones = accelerator.partitionNodesIntoZones(nodes, 20);
    assert.strictEqual(zones.length, 3);
    assert.strictEqual(zones[0].locationIds.length, 20);
    assert.strictEqual(zones[1].locationIds.length, 20);
    assert.strictEqual(zones[2].locationIds.length, 20);
  });

  await t.test('Accelerates demographics tick and executes O(1) 12% migration shift on devastation or epidemics', async () => {
    const loc1: DemographicNodeState = {
      locationId: 101,
      zoneId: 1,
      countryTag: 'TUR',
      commonerPops: 10000,
      burgherPops: 2000,
      clergyPops: 1000,
      noblePops: 500,
      devastation: 0.75, // > 0.70 triggers war refugee shift
      hasEpidemics: false,
      hasFamine: false,
      needsSatisfaction: 0.80,
      connectedEdgeIds: [102],
      isFarmland: false,
      dominantCulture: 'Turkish',
      assimilatedPercentage: 70.0
    };

    const loc2: DemographicNodeState = {
      locationId: 102,
      zoneId: 1,
      countryTag: 'TUR',
      commonerPops: 5000,
      burgherPops: 1000,
      clergyPops: 500,
      noblePops: 200,
      devastation: 0.05,
      hasEpidemics: false,
      hasFamine: false,
      needsSatisfaction: 0.95,
      connectedEdgeIds: [101],
      isFarmland: true, // Optimal destination
      dominantCulture: 'Turkish',
      assimilatedPercentage: 85.0
    };

    accelerator.registerNode(loc1);
    accelerator.registerNode(loc2);

    const result = await accelerator.accelerateDemographicsTick([loc1, loc2]);
    assert.strictEqual(result.processedNodesCount, 2);
    assert.strictEqual(result.migrationPayloads.length, 1);
    
    // 12% of 10000 = 1200
    assert.strictEqual(result.migrationPayloads[0].migratingCommoners, 1200);
    assert.strictEqual(result.migrationPayloads[0].sourceLocationId, 101);
    assert.strictEqual(result.migrationPayloads[0].targetLocationId, 102);
    assert.ok(loc2.commonerPops >= 6200, 'Destination node should receive the 1200 displaced refugees');
  });
});

test('Dynamic AI Coalition & Balance of Power Matrix', async (t) => {
  const coalitionMgr = new AICoalitionManager(0.75);

  coalitionMgr.registerSovereign('TUR', 'Oghuz_Turkic', 45000, 0.30);
  coalitionMgr.registerSovereign('BYZ', 'Greek', 12000, 0.15);
  coalitionMgr.registerSovereign('SER', 'South_Slavic', 8000, 0.15);
  coalitionMgr.registerSovereign('BUL', 'South_Slavic', 9000, 0.15);

  await t.test('Threat Hub Aggregator scales threat index exponentially when acquisitions exceed 15 nodes', () => {
    // Acquire 10 nodes (<= 15 threshold)
    coalitionMgr.recordTerritoryAcquisition('TUR', 10);
    let record = coalitionMgr.getThreatRecord('TUR');
    assert.ok(record && record.globalThreatIndex < 0.75);

    // Acquire 8 more nodes (total 18 nodes, excess = 3)
    // Multiplier = 1.15^3 = ~1.52
    coalitionMgr.recordTerritoryAcquisition('TUR', 8);
    record = coalitionMgr.getThreatRecord('TUR');
    assert.ok(record && record.globalThreatIndex >= 0.75, 'Excess conquests should push threat index past 0.75');
    assert.strictEqual(record?.isHegemon, true);
  });

  await t.test('Containment Coalition Protocol forms Defensive Coalition Pact against hegemon', () => {
    const pact = coalitionMgr.evaluateCoalitionFormation('TUR', ['BYZ', 'SER', 'BUL'], 1400);
    assert.ok(pact !== null);
    assert.strictEqual(pact?.targetHegemonTag, 'TUR');
    assert.ok(pact?.memberTags.includes('BYZ'));
    assert.ok(pact?.memberTags.includes('SER'));
    assert.ok(pact?.memberTags.includes('BUL'));
    assert.strictEqual(pact?.collectiveArmySize, 29000); // 12000 + 8000 + 9000

    // Check stance switch
    const byzStance = coalitionMgr.getCoalitionStance('BYZ', 'TUR');
    assert.strictEqual(byzStance, CoalitionStance.Contain_Hegemon_Aggression);
  });
});

test('Global Golden Age & Historical Eras State Machine', async (t) => {
  const erasMgr = new ErasManager();

  await t.test('Transitions globally from Age of Feudalism to Age of Renaissance upon 3 completed hubs', () => {
    assert.strictEqual(erasMgr.getCurrentEra(), HistoricalEra.Age_Of_Feudalism);
    assert.strictEqual(erasMgr.getEraDisplayName(), 'AGE OF FEUDALISM');

    // 2 hubs completed -> No transition
    const step1 = erasMgr.evaluateEraProgression(2);
    assert.strictEqual(step1.eraChanged, false);
    assert.strictEqual(erasMgr.getCurrentEra(), HistoricalEra.Age_Of_Feudalism);

    // 3 hubs completed (Venice, Rome, Paris) -> Transitions to Renaissance
    const step2 = erasMgr.evaluateEraProgression(3);
    assert.strictEqual(step2.eraChanged, true);
    assert.strictEqual(step2.newEra, HistoricalEra.Age_Of_Renaissance);
    assert.strictEqual(erasMgr.getEraDisplayName(), 'AGE OF RENAISSANCE');
  });

  await t.test('Activates once-per-campaign Sovereign Golden Age with required state modifiers', () => {
    // Ineligible nation: low prestige
    assert.strictEqual(erasMgr.canActivateGoldenAge('ENG', 60.0, 95.0), false);

    // Ineligible nation: low legitimacy
    assert.strictEqual(erasMgr.canActivateGoldenAge('ENG', 85.0, 80.0), false);

    // Eligible nation: Prestige > 80 and Legitimacy > 90
    assert.strictEqual(erasMgr.canActivateGoldenAge('ENG', 85.0, 95.0), true);

    const payload = erasMgr.activateGoldenAge('ENG', 85.0, 95.0);
    assert.ok(payload !== null);
    assert.strictEqual(payload?.isActive, true);
    assert.strictEqual(payload?.remainingDailyTicks, 3650); // exactly 10 years
    assert.strictEqual(payload?.controlDecayModifier, 0.75); // -25% control decay
    assert.strictEqual(payload?.burgherWealthModifier, 1.30); // +30% burgher wealth
    assert.strictEqual(payload?.siegeSupplyCostModifier, 0.85); // -15% siege supply maintenance

    // Cannot activate a second time in same campaign
    assert.strictEqual(erasMgr.canActivateGoldenAge('ENG', 100.0, 100.0), false);
    assert.strictEqual(erasMgr.activateGoldenAge('ENG', 100.0, 100.0), null);

    // Process daily tick
    erasMgr.processDailyTick('ENG');
    const updated = erasMgr.getGoldenAgeStatus('ENG');
    assert.strictEqual(updated?.remainingDailyTicks, 3649);
  });
});
