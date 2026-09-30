import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { DynamicConversionEngine, type LocationConversionContext } from '../src/demographics/conversion.ts';
import { PopDemographicEngine, type PopEntity } from '../src/demographics/pop.ts';
import { InternalRebellionEngine, type UnrestLocationSnapshot } from '../src/politics/rebellion.ts';
import { MissionTreeEngine } from '../src/politics/missions.ts';
import { EstateType } from '../src/core/types.ts';

describe('Dynamic Cultural Assimilation & Religious Conversion Engine', () => {
  test('Religious Conversion shifts minority faith toward state religion driven by Clergy Power and Holy Sites', () => {
    const conversionEngine = new DynamicConversionEngine();

    const mockPop: PopEntity = {
      id: 1,
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'english',
      religion_id: 'cathar',
      culture_distribution: { english: 1.0 },
      religion_distribution: { cathar: 0.80, catholic: 0.20 },
      size: 10000,
      wealth: 100.0,
      basic_needs_satisfaction: 0.8,
      luxury_needs_satisfaction: 0.5,
      militancy_unrest: 0.1
    };

    const locContext: LocationConversionContext = {
      id: 1,
      name: 'Canterbury',
      crown_control: 0.90,
      trade_connectivity: 0.80,
      is_holy_site: true, // +80% conversion boost
      state_religion: 'catholic',
      state_culture: 'english'
    };

    const result = conversionEngine.executeReligiousConversionTick(mockPop, locContext, 0.40); // 40% Clergy Power

    assert.ok(result.convertedPops > 0, 'Conversion must convert minority pops');
    assert.ok(mockPop.religion_distribution.catholic > 0.20, 'Catholic share must increase');
    assert.ok(mockPop.religion_distribution.cathar < 0.80, 'Cathar share must decrease');
  });

  test('Cultural Assimilation stops and sub-cultures drift away from state culture when Crown Control < 50%', () => {
    const conversionEngine = new DynamicConversionEngine();

    // Case 1: Low Crown Control (< 50%) -> Assimilation stops, sub-cultures drift away
    const rebelliousPop: PopEntity = {
      id: 2,
      location_id: 4,
      estate_type: EstateType.Commoners,
      culture_id: 'anglo_norman',
      religion_id: 'catholic',
      culture_distribution: { anglo_norman: 0.70, norman_regional: 0.30 },
      religion_distribution: { catholic: 1.0 },
      size: 8000,
      wealth: 50.0,
      basic_needs_satisfaction: 0.4,
      luxury_needs_satisfaction: 0.1,
      militancy_unrest: 0.5
    };

    const lowControlLoc: LocationConversionContext = {
      id: 4,
      name: 'Rouen Enclave',
      crown_control: 0.25, // < 50%
      trade_connectivity: 0.30,
      is_holy_site: false,
      state_religion: 'catholic',
      state_culture: 'anglo_norman'
    };

    const driftResult = conversionEngine.executeCulturalAssimilationTick(rebelliousPop, lowControlLoc);
    assert.strictEqual(driftResult.assimilatedCount, 0, 'No assimilation should happen when Control < 50%');
    assert.ok(driftResult.driftedCount > 0, 'Sub-cultures must drift away when control is fractured');
    assert.ok(rebelliousPop.culture_distribution.anglo_norman < 0.70);
    assert.ok(rebelliousPop.culture_distribution.norman_regional > 0.30);

    // Case 2: High Crown Control (>= 50%) -> Assimilation succeeds
    const loyalPop: PopEntity = {
      id: 3,
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'norman_regional',
      religion_id: 'catholic',
      culture_distribution: { anglo_norman: 0.40, norman_regional: 0.60 },
      religion_distribution: { catholic: 1.0 },
      size: 12000,
      wealth: 150.0,
      basic_needs_satisfaction: 0.9,
      luxury_needs_satisfaction: 0.6,
      militancy_unrest: 0.05
    };

    const highControlLoc: LocationConversionContext = {
      id: 1,
      name: 'London',
      crown_control: 0.95, // >= 50%
      trade_connectivity: 0.85,
      is_holy_site: false,
      state_religion: 'catholic',
      state_culture: 'anglo_norman'
    };

    const assimilationResult = conversionEngine.executeCulturalAssimilationTick(loyalPop, highControlLoc);
    assert.ok(assimilationResult.assimilatedCount > 0, 'Assimilation must succeed under high control');
    assert.strictEqual(assimilationResult.driftedCount, 0);
    assert.ok(loyalPop.culture_distribution.anglo_norman > 0.40);
  });
});

describe('Micro-Unrest, Rebel Factions & Civil War Simulator', () => {
  test('Pop unrest aggregates from basic needs deficits and taxation under weak control', () => {
    const rebellionEngine = new InternalRebellionEngine();

    const starvedPop: PopEntity = {
      id: 10,
      location_id: 5,
      estate_type: EstateType.Commoners,
      culture_id: 'english',
      religion_id: 'catholic',
      culture_distribution: { english: 1.0 },
      religion_distribution: { catholic: 1.0 },
      size: 5000,
      wealth: 10.0,
      basic_needs_satisfaction: 0.20, // Severely starved
      luxury_needs_satisfaction: 0.0,
      militancy_unrest: 0.30
    };

    const locationsMap = new Map<number, UnrestLocationSnapshot>([
      [5, { id: 5, name: 'Famine Vertex', country: 'ENG', control: 0.20, devastation: 0.45 }]
    ]);

    // High tax rate (25%) + low control (20%) + starved basic needs
    rebellionEngine.updatePopUnrest([starvedPop], locationsMap, 0.25);
    assert.ok(starvedPop.militancy_unrest > 0.30, 'Starved, over-taxed pop militancy must increase');
  });

  test('Spawns Rebel Faction when aggregate unrest exceeds 70% and triggers Civil War when manpower > 40%', () => {
    const rebellionEngine = new InternalRebellionEngine();

    // Create a group of highly radicalized commoners (militancy 0.85)
    const radicalPops: PopEntity[] = [
      {
        id: 21,
        location_id: 3,
        estate_type: EstateType.Commoners,
        culture_id: 'english',
        religion_id: 'catholic',
        culture_distribution: { english: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 50000,
        wealth: 5.0,
        basic_needs_satisfaction: 0.1,
        luxury_needs_satisfaction: 0.0,
        militancy_unrest: 0.85
      },
      {
        id: 22,
        location_id: 4,
        estate_type: EstateType.Commoners,
        culture_id: 'english',
        religion_id: 'catholic',
        culture_distribution: { english: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 40000,
        wealth: 8.0,
        basic_needs_satisfaction: 0.15,
        luxury_needs_satisfaction: 0.0,
        militancy_unrest: 0.80
      }
    ];

    const totalStateMilitaryForce = 8000; // Small standing army

    // 1. Evaluate faction mobilization
    const { spawnedFactions, civilWarTriggered } = rebellionEngine.evaluateRebelFactionProgress(
      radicalPops,
      totalStateMilitaryForce
    );

    assert.strictEqual(spawnedFactions.length, 1);
    assert.strictEqual(spawnedFactions[0].type, 'PeasantRevolt');
    assert.ok(spawnedFactions[0].aggregateUnrest >= 0.70);
    assert.ok(spawnedFactions[0].totalManpowerPool > 0);

    // 5% of 90,000 = 4,500 rebels. 4,500 / 8,000 = 56.25% > 40% -> Civil War Triggered!
    assert.strictEqual(civilWarTriggered, true, 'Civil war must trigger when rebel manpower > 40% of military force');

    // 2. Trigger Civil War Protocol
    const liveLocations = [
      { id: 1, name: 'London', country: 'ENG', control: 0.95 },
      { id: 2, name: 'Dover', country: 'ENG', control: 0.80 },
      { id: 3, name: 'Calais', country: 'ENG', control: 0.35 } // < 40% Control -> will secede
    ];

    const liveArmies = [
      { id: 'army_royal', name: 'Royal Host', size: 6000, location: 'London' },
      { id: 'army_border', name: 'Border Watch', size: 2000, location: 'Calais' }
    ];

    const crisis = rebellionEngine.triggerCivilWarProtocol(
      spawnedFactions[0],
      liveLocations,
      liveArmies,
      30.0, // Low Nobility loyalty (< 35%) -> 50% military defection
      totalStateMilitaryForce
    );

    assert.strictEqual(crisis.isCivilWarActive, true);
    assert.strictEqual(crisis.rebelTag, 'REB_ENG');
    assert.strictEqual(crisis.outlinerCrisisMode, true);
    assert.ok(crisis.secededLocationIds.includes(3), 'Calais must secede due to low control');
    assert.strictEqual(liveLocations[2].country, 'REB_ENG');
    assert.strictEqual(crisis.defectedArmyManpower, 4000); // 50% of 8000
    assert.strictEqual(crisis.retainedCrownManpower, 4000);
  });
});

describe('Dynamic Scripted Mission & Narrative Tree Engine', () => {
  test('Evaluates prerequisite locking, requirements checking, and applies immediate rewards', () => {
    const missionEngine = new MissionTreeEngine();

    const mockWorldState: any = {
      crownTreasury: 400,
      manpower: 10000,
      crownPower: 0.60,
      locations: [
        { id: 1, name: 'London', country: 'ENG', control: 1.0 },
        { id: 2, name: 'Dover', country: 'ENG', control: 0.85 },
        { id: 3, name: 'Calais', country: 'ENG', control: 0.70 }
      ],
      estates: [
        { type: 'Nobility', loyalty: 60.0 },
        { type: 'Burghers', loyalty: 50.0 }
      ],
      outliner: {
        normandyIntegration: 42.0
      },
      permanentClaims: []
    };

    // 1. Check initial state: Node 1 (Fortify Channel) should be AVAILABLE, Node 2 (Calais) should be LOCKED
    const tick1 = missionEngine.evaluateMonthlyMissionTick(mockWorldState);
    const tree = missionEngine.getTree('tree_hundred_years_war')!;
    const node1 = tree.nodes.get('mission_fortify_channel')!;
    const node2 = tree.nodes.get('mission_calais_staple_port')!;

    assert.strictEqual(node1.status, 'AVAILABLE');
    assert.strictEqual(node2.status, 'LOCKED');
    assert.ok(tick1.eligibleForClaim.includes('mission_fortify_channel'));

    // 2. Complete Node 1
    const success1 = missionEngine.completeMissionNode('tree_hundred_years_war', 'mission_fortify_channel', mockWorldState);
    assert.strictEqual(success1, true);
    assert.strictEqual(node1.status, 'COMPLETED');

    // Verify rewards applied: +15 Burgher loyalty, +1000 manpower, -200 treasury
    assert.strictEqual(mockWorldState.crownTreasury, 200);
    assert.strictEqual(mockWorldState.manpower, 11000);
    assert.strictEqual(mockWorldState.estates[1].loyalty, 65.0);

    // 3. Tick again: Node 2 should now unlock from LOCKED to AVAILABLE
    mockWorldState.locations[2].control = 0.80; // Raise Calais control to meet Node 2 requirement
    const tick2 = missionEngine.evaluateMonthlyMissionTick(mockWorldState);
    assert.strictEqual(node2.status, 'AVAILABLE');
    assert.ok(tick2.eligibleForClaim.includes('mission_calais_staple_port'));

    // 4. Complete Node 2 and verify permanent claim on Flanders & crown power boost
    const success2 = missionEngine.completeMissionNode('tree_hundred_years_war', 'mission_calais_staple_port', mockWorldState);
    assert.strictEqual(success2, true);
    assert.strictEqual(node2.status, 'COMPLETED');
    assert.ok(mockWorldState.permanentClaims.includes('FLA_Flanders'));
    assert.strictEqual(Number(mockWorldState.crownPower.toFixed(2)), 0.65);
  });
});
