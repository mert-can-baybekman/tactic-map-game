import test from 'node:test';
import assert from 'node:assert';
import { 
  ReformationEngine 
} from '../src/politics/religion/reformation.ts';
import type { 
  ReformationLocationContext 
} from '../src/politics/religion/reformation.ts';
import { 
  EconomicCrisisSimulator 
} from '../src/economy/crisis.ts';
import type { 
  FamineLocationNode 
} from '../src/economy/crisis.ts';
import { 
  AISecurityEvaluator, 
  AIStrategicStance 
} from '../src/ai/strategic_decision.ts';
import type { 
  NeighborThreatProfile, 
  StrategicLocationCandidate 
} from '../src/ai/strategic_decision.ts';

test('Dynamic Religious Reformation & Holy War Core', async (t) => {
  const engine = new ReformationEngine();

  await t.test('Tracks Global Religious Zeal and updates values', () => {
    assert.strictEqual(engine.getGlobalZeal(), 65.0);
    engine.setPapalAuthority(30.0);
    assert.strictEqual(engine.getPapalAuthority(), 30.0);
  });

  await t.test('Spawns Heretic Religious Factions under low stability or excessive clergy privileges', () => {
    // Normal nation: high stability (80), few privileges (1) -> No heresy
    const normal = engine.evaluateHeresyTick('FRA', 80.0, 1, [4]);
    assert.strictEqual(normal.spawnedHeresy, false);

    // Crisis nation: low stability (< 20.0) -> Spawns heretics
    const lowStab = engine.evaluateHeresyTick('BOH', 15.0, 1, [53]);
    assert.strictEqual(lowStab.spawnedHeresy, true);
    assert.strictEqual(lowStab.factionName, 'Bohemian Hussite Brethren');
    assert.strictEqual(lowStab.affectedLocationId, 53);

    // Corrupted state: clergy privileges >= 3 -> Spawns heretics in next location
    const highPrivilege = engine.evaluateHeresyTick('CAS', 60.0, 4, [60]);
    assert.strictEqual(highPrivilege.spawnedHeresy, true);
    assert.strictEqual(highPrivilege.affectedLocationId, 60);
  });

  await t.test('Executes Reformation Wave Protocol upon meeting historical trigger matrix', () => {
    const locations: ReformationLocationContext[] = [
      {
        id: 50,
        name: 'Wittenberg',
        countryTag: 'SAX',
        primaryFaith: 'Catholic',
        burgherWealth: 750.0, // > 600
        printingPressPresence: 45.0, // >= 40%
        connectedTradeEdgeIds: [51, 52],
        isHolyHub: false
      },
      {
        id: 51,
        name: 'Erfurt',
        countryTag: 'SAX',
        primaryFaith: 'Catholic',
        burgherWealth: 400.0,
        printingPressPresence: 20.0,
        connectedTradeEdgeIds: [50],
        isHolyHub: false
      }
    ];

    engine.setPapalAuthority(30.0); // <= 35.0

    const waveResult = engine.evaluateReformationTrigger(locations, '1517-10-31');
    assert.strictEqual(waveResult.triggered, true);
    assert.strictEqual(waveResult.originLocationId, 50);
    assert.ok(waveResult.convertedLocationIds.includes(50));
    assert.ok(waveResult.convertedLocationIds.includes(51));
    assert.strictEqual(engine.isReformationActive(), true);
    assert.strictEqual(engine.getGlobalZeal(), 95.0);
  });

  await t.test('Unlocks Religious_Cleansing_CB with zero claim timer and +50% holy hub warscore', () => {
    const holyWarCB = engine.unlockHolyWarCasusBelli('SAX', 'BOH', 53, '1518-01-01');
    assert.strictEqual(holyWarCB.cbId, 'cb_holy_war_SAX_vs_BOH');
    assert.strictEqual(holyWarCB.requiresClaimJustification, false); // Bypasses standard claim timers
    assert.strictEqual(holyWarCB.warScoreWeightBonus, 0.50); // flat +50% war score weight
    assert.strictEqual(holyWarCB.targetHolyCityLocationId, 53);
    assert.strictEqual(engine.getActiveHolyWars().length, 1);
  });
});

test('Trade War Embargo Networks & Famine/Inflation Simulator', async (t) => {
  const simulator = new EconomicCrisisSimulator();

  await t.test('Increments Devastation if army is stationed >= 3 consecutive days or in Severe_Winter', () => {
    const testLoc: FamineLocationNode = {
      locationId: 201,
      name: 'Picardy',
      countryTag: 'FRA',
      devastation: 0.10,
      armyOccupationDays: 0,
      isSevereWinter: false,
      isFamineActive: false,
      commonerPopSize: 10000,
      grainOutputCapacity: 1.0,
      woolOutputCapacity: 0.5
    };
    simulator.registerLocation(testLoc);

    // Station army for 4 days
    simulator.executeDailyDevastationTick([{ locationId: 201, daysStationed: 4 }]);
    const updatedLoc = simulator.getLocation(201);
    assert.ok(updatedLoc && updatedLoc.devastation > 0.10, 'Stationed army >= 3 days should increase devastation');

    // Severe winter increment
    if (updatedLoc) {
      updatedLoc.isSevereWinter = true;
      const prevDev = updatedLoc.devastation;
      simulator.executeDailyDevastationTick([]);
      assert.ok(updatedLoc.devastation > prevDev, 'Severe winter should increase devastation');
    }
  });

  await t.test('Triggers Famine Event when Devastation > 0.6: 5% monthly pop decay and 0 raw materials', () => {
    const starvedLoc: FamineLocationNode = {
      locationId: 202,
      name: 'FamineZone',
      countryTag: 'ENG',
      devastation: 0.65, // > 0.60
      armyOccupationDays: 10,
      isSevereWinter: false,
      isFamineActive: false,
      commonerPopSize: 10000,
      grainOutputCapacity: 1.0,
      woolOutputCapacity: 0.8
    };
    simulator.registerLocation(starvedLoc);

    const famineReport = simulator.executeMonthlyFaminePass();
    assert.ok(famineReport.famineLocationIds.includes(202));
    assert.strictEqual(famineReport.totalStarvationCasualties >= 500, true);

    const updated = simulator.getLocation(202);
    assert.strictEqual(updated?.isFamineActive, true);
    assert.strictEqual(updated?.grainOutputCapacity, 0.0);
    assert.strictEqual(updated?.woolOutputCapacity, 0.0);
    assert.strictEqual(updated?.commonerPopSize, 9500); // 10000 - 500
  });

  await t.test('Computes Monetary Inflation and scales Outliner items and recruitment maintenance', () => {
    // Treasury = 3000, Goods Supply = 1000 -> ratio = 3.0
    // multiplier = 1.0 + (3.0 - 1.0) * 0.40 = 1.80
    const inflation = simulator.calculateMonetaryInflation('SPA', 3000, 1000);
    assert.strictEqual(inflation.inflationMultiplier, 1.8);
    assert.strictEqual(inflation.outlinerConstructionCostScale, 1.8);
    assert.strictEqual(inflation.armyMaintenanceCostScale, 1.6);
  });
});

test('Macro-Strategic AI Aggression, Conquest & Defense Matrix', async (t) => {
  await t.test('Calculates multi-variable threat score using army ratios and bilateral opinion', () => {
    // Neighbor has 20,000 troops, I have 10,000 troops. Bilateral opinion is -0.5 (hostile)
    // Threat_Score = (20000 / 10000) * (1.0 - (-0.5)) = 2.0 * 1.5 = 3.0
    const threatScore = AISecurityEvaluator.calculateThreatScore(20000, 10000, -0.5);
    assert.strictEqual(threatScore, 3.0);

    // Friendly neighbor: opinion +1.0 -> Hostility = 0.0 -> Threat = 0.0
    const friendlyThreat = AISecurityEvaluator.calculateThreatScore(20000, 10000, 1.0);
    assert.strictEqual(friendlyThreat, 0.0);
  });

  await t.test('Opportunity Evaluator switches AI stance to Aggressive_Conquest if Crown Control < 40% or in Civil War', () => {
    const weakCrownProfile: NeighborThreatProfile = {
      neighbor_country_tag: 'BYZ',
      neighbor_army_size: 4000,
      my_army_size: 15000,
      bilateral_opinion: -0.8,
      has_casus_belli: true,
      target_crown_control: 0.28, // < 40%
      is_in_civil_war: false,
      threat_score: 0.48
    };

    const evalResult = AISecurityEvaluator.evaluateOpportunityStance(weakCrownProfile);
    assert.strictEqual(evalResult.stance, AIStrategicStance.Aggressive_Conquest);
    assert.strictEqual(evalResult.triggerAggression, true);

    const civilWarProfile: NeighborThreatProfile = {
      neighbor_country_tag: 'FRA',
      neighbor_army_size: 25000,
      my_army_size: 20000,
      bilateral_opinion: -0.2,
      has_casus_belli: true,
      target_crown_control: 0.65,
      is_in_civil_war: true, // In civil war
      threat_score: 1.5
    };

    const civilWarEval = AISecurityEvaluator.evaluateOpportunityStance(civilWarProfile);
    assert.strictEqual(civilWarEval.stance, AIStrategicStance.Aggressive_Conquest);
    assert.strictEqual(civilWarEval.triggerAggression, true);
  });

  await t.test('Army Distribution Pass routes invasion vectors bypassing ZoC forts to strike high-wealth market nodes or capital', () => {
    const neighborProfiles: NeighborThreatProfile[] = [
      {
        neighbor_country_tag: 'BYZ',
        neighbor_army_size: 5000,
        my_army_size: 20000,
        bilateral_opinion: -0.9,
        has_casus_belli: true,
        target_crown_control: 0.32, // < 0.40 -> Aggressive_Conquest
        is_in_civil_war: false,
        threat_score: 0.475
      }
    ];

    const locations: StrategicLocationCandidate[] = [
      {
        locationId: 301,
        countryTag: 'BYZ',
        isCapital: false,
        isMarketHub: false,
        burgherWealth: 100,
        zoneOfControlActive: true // Fort with Zone of Control
      },
      {
        locationId: 302,
        countryTag: 'BYZ',
        isCapital: true,
        isMarketHub: true,
        burgherWealth: 1200, // Constantinople: rich market hub & capital
        zoneOfControlActive: false
      }
    ];

    // Mock path router avoiding ZoC fort (node 301)
    const mockRouter = (start: number, target: number, _passable?: any, costMod?: any) => {
      // If costMod penalizes 301, bypass it directly to target
      if (costMod && costMod(start, 301) >= 500) {
        return [start, 300, target]; // Bypasses 301 through secondary pass
      }
      return [start, target];
    };

    const plan = AISecurityEvaluator.evaluateWarDeclarationOpportunity(
      'TUR',
      20000,
      neighborProfiles,
      locations,
      250, // Edirne
      mockRouter
    );

    assert.ok(plan !== null);
    assert.strictEqual(plan?.target_country_tag, 'BYZ');
    assert.strictEqual(plan?.target_location_id, 302); // Prioritized high-wealth capital hub
    assert.strictEqual(plan?.stance, AIStrategicStance.Aggressive_Conquest);
    assert.strictEqual(plan?.war_declaration_recommended, true);
    assert.strictEqual(plan?.prioritize_market_vertex, true);
    assert.deepStrictEqual(plan?.invasion_vector_path, [250, 300, 302]);
  });
});
