import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  GranularConversionEngine,
  type LocationConversionContext,
  type RealmConversionGlobals
} from '../src/demographics/conversion.ts';
import {
  MacroUnrestEngine,
  type UnrestLocationData,
  type ArmyStackEntity,
  type GeneralCharacter
} from '../src/politics/rebellion.ts';
import { ProceduralMissionTreeEngine } from '../src/politics/missions.ts';
import { EstateType } from '../src/core/types.ts';
import type { PopEntity } from '../src/demographics/pop.ts';

describe('Granular Pop Conversion, Religious Strive & Cultural Drift Engine', () => {
  test('Religious Conversion calculates exact formula and drops to zero when Pop Militancy > 0.60, spawning subterranean heretics', () => {
    const engine = new GranularConversionEngine();

    const loyalPop: PopEntity = {
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
      militancy_unrest: 0.2 // Low unrest -> normal conversion
    };

    const loc: LocationConversionContext = {
      id: 1,
      name: 'Canterbury',
      crown_control: 0.90,
      local_autonomy: 0.10,
      trade_connectivity: 0.80,
      devastation: 0.05,
      is_holy_site: true,
      state_religion: 'catholic',
      state_culture: 'english',
      local_clergy_power: 0.35,
      total_estate_power: 1.0
    };

    const globals: RealmConversionGlobals = {
      state_religious_unity: 0.85,
      advisor_learning_modifier: 1.20 // Archbishop advisor with high learning
    };

    // 1. Normal conversion pass
    const loyalResult = engine.executeReligiousConversionTick(loyalPop, loc, globals);
    assert.ok(loyalResult.convertedCount > 0);
    assert.strictEqual(loyalResult.hereticSpawnedCount, 0);
    assert.ok(loyalPop.religion_distribution.catholic > 0.20);

    // 2. High unrest pop (militancy > 0.60): Conversion drops to 0, spawns subterranean heretic network!
    const rebelliousPop: PopEntity = {
      id: 2,
      location_id: 1,
      estate_type: EstateType.Commoners,
      culture_id: 'english',
      religion_id: 'catholic',
      culture_distribution: { english: 1.0 },
      religion_distribution: { catholic: 0.95 },
      size: 15000,
      wealth: 50.0,
      basic_needs_satisfaction: 0.3,
      luxury_needs_satisfaction: 0.0,
      militancy_unrest: 0.75 // > 0.60!
    };

    const rebelResult = engine.executeReligiousConversionTick(rebelliousPop, loc, globals);
    assert.strictEqual(rebelResult.convertedCount, 0, 'Conversion rate must drop to absolute zero when militancy > 0.6');
    assert.ok(rebelResult.hereticSpawnedCount > 0, 'Subterranean heretic network must spawn');
    assert.ok(rebelliousPop.religion_distribution.religious_heretics > 0);
  });

  test('Cultural Drift Protocol triggers when Location Crown Control < 30% for 48 consecutive ticks', () => {
    const engine = new GranularConversionEngine();

    const pop: PopEntity = {
      id: 3,
      location_id: 4,
      estate_type: EstateType.Commoners,
      culture_id: 'anglo_norman',
      religion_id: 'catholic',
      culture_distribution: { anglo_norman: 1.0 },
      religion_distribution: { catholic: 1.0 },
      size: 20000,
      wealth: 60.0,
      basic_needs_satisfaction: 0.5,
      luxury_needs_satisfaction: 0.2,
      militancy_unrest: 0.4
    };

    const loc: LocationConversionContext = {
      id: 4,
      name: 'Rouen Outskirts',
      crown_control: 0.25, // < 30%!
      local_autonomy: 0.60,
      trade_connectivity: 0.20,
      devastation: 0.30,
      is_holy_site: false,
      state_religion: 'catholic',
      state_culture: 'anglo_norman',
      regional_drift_culture: 'hostile_norman_insurgent',
      local_clergy_power: 0.20,
      total_estate_power: 1.0
    };

    // Fast-forward consecutive low control ticks to 47
    engine.setLowControlTicks(4, 47);

    // Tick 48: Initiates Cultural Drift Protocol!
    const result = engine.executeCulturalAssimilationTick(pop, loc);
    assert.strictEqual(result.culturalDriftActive, true, 'Cultural Drift Protocol must activate on tick 48');
    assert.ok(result.driftedCount > 0);
    assert.ok(pop.culture_distribution.hostile_norman_insurgent > 0);
    assert.ok(pop.culture_distribution.anglo_norman < 1.0);
  });
});

describe('Macro-Unrest Accumulation & Structural Civil War Fracture Engine', () => {
  test('Aggregates unrest, spawns physical Army Stack on map when radicalism reaches 1.0', () => {
    const engine = new MacroUnrestEngine();

    const oppressedPops: PopEntity[] = [
      {
        id: 11,
        location_id: 3,
        estate_type: EstateType.Commoners,
        culture_id: 'english',
        religion_id: 'catholic',
        culture_distribution: { english: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 30000,
        wealth: 4.0,
        basic_needs_satisfaction: 0.1, // Starved
        luxury_needs_satisfaction: 0.0,
        militancy_unrest: 0.95
      },
      {
        id: 12,
        location_id: 3,
        estate_type: EstateType.Commoners,
        culture_id: 'welsh', // Discriminated culture
        religion_id: 'catholic',
        culture_distribution: { welsh: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 20000,
        wealth: 2.0,
        basic_needs_satisfaction: 0.15,
        luxury_needs_satisfaction: 0.0,
        militancy_unrest: 0.90
      }
    ];

    const locationsMap = new Map<number, UnrestLocationData>([
      [3, { id: 3, name: 'Calais', country: 'ENG', control: 0.25, devastation: 0.4 }]
    ]);

    // 1. Aggregate Unrest & Radicalism Progression
    engine.aggregatePopUnrestPass(oppressedPops, locationsMap, 0.25, 'english');
    const factions = engine.evaluateFactionsProgression(oppressedPops);

    assert.strictEqual(factions.length, 1);
    assert.strictEqual(factions[0].factionType, 'Peasant_Revolt');
    assert.strictEqual(factions[0].totalEnlistedPopsCount, 50000);

    // Force radicalism to 1.0
    factions[0].accumulatedRadicalism = 1.0;

    // 2. Physical Rebellion Spawning on Location coordinates
    const spawnedArmies = engine.checkAndSpawnPhysicalRebellions(locationsMap);
    assert.strictEqual(spawnedArmies.length, 1);
    assert.strictEqual(spawnedArmies[0].countryTag, 'REB_ENG');
    assert.strictEqual(spawnedArmies[0].locationId, 3);
    // 50,000 enlisted * 0.08 conscription factor = 4,000 manpower army stack
    assert.strictEqual(spawnedArmies[0].size, 4000);
    assert.strictEqual(spawnedArmies[0].isRebelStack, true);
  });

  test('Total State Civil War Fracture Algorithm secedes low control nodes and defects disloyal generals', () => {
    const engine = new MacroUnrestEngine();

    const faction = {
      factionId: 'faction_peasant_revolt',
      name: 'Great Peasant Jacquerie',
      factionType: 'Peasant_Revolt' as const,
      totalEnlistedPopsCount: 60000, // 60,000 * 0.08 = 4,800 manpower
      accumulatedRadicalism: 1.0,
      financierEstatePointer: EstateType.Commoners,
      targetLocationIds: [3],
      spawnedArmyStacks: [],
      isActive: true
    };

    const locations: UnrestLocationData[] = [
      { id: 1, name: 'London', country: 'ENG', control: 1.0, devastation: 0.0 },
      { id: 2, name: 'Dover', country: 'ENG', control: 0.85, devastation: 0.05 },
      { id: 3, name: 'Calais', country: 'ENG', control: 0.35, devastation: 0.25 }, // < 50% Control -> Secedes!
      { id: 4, name: 'Cornwall', country: 'ENG', control: 0.65, devastation: 0.1, dominantEstate: EstateType.Commoners, dominantEstatePower: 0.45 } // Dominant estate > 35% -> Secedes!
    ];

    const generals: GeneralCharacter[] = [
      { id: 'gen_1', name: 'Loyal Earl of Warwick', loyalty: 85, assignedArmyId: 'army_royal' },
      { id: 'gen_2', name: 'Disaffected Baron Roger', loyalty: 30, assignedArmyId: 'army_border' } // Loyalty < 40 -> Defects!
    ];

    const standingArmies: ArmyStackEntity[] = [
      { id: 'army_royal', name: 'Royal Guard', countryTag: 'ENG', locationId: 1, locationName: 'London', size: 6000, isRebelStack: false, morale: 90 },
      { id: 'army_border', name: 'Southern Border Force', countryTag: 'ENG', locationId: 2, locationName: 'Dover', size: 3000, isRebelStack: false, morale: 70 }
    ];

    const crownTotalMilitaryForce = 9000;
    // 4,800 / 9,000 = 53.3% > 45% -> Total Fracture Protocol Initiated!

    const fracture = engine.evaluateTotalFractureProtocol(
      faction,
      locations,
      standingArmies,
      generals,
      crownTotalMilitaryForce
    );

    assert.ok(fracture !== null, 'Total Fracture must trigger');
    assert.strictEqual(fracture?.isCivilWarActive, true);
    assert.strictEqual(fracture?.rebelTag, 'REB_ENG');
    assert.strictEqual(fracture?.outlinerCrisisMode, true);

    // Locations 3 and 4 should secede
    assert.strictEqual(locations[2].country, 'REB_ENG');
    assert.strictEqual(locations[3].country, 'REB_ENG');

    // General 2 defects with entire army stack
    assert.strictEqual(fracture?.defectedArmies.length, 1);
    assert.strictEqual(fracture?.defectedArmies[0].id, 'army_border');
    assert.strictEqual(fracture?.defectedArmies[0].countryTag, 'REB_ENG');
    assert.strictEqual(fracture?.retainedCrownArmies.length, 1);
  });
});

describe('Procedural Branching Mission Tree Contract Engine', () => {
  test('Branching matrix dynamically hides/locks branches and enforces mutual exclusivity', () => {
    const engine = new ProceduralMissionTreeEngine();

    const worldState: any = {
      playerCountry: 'ENG',
      crownTreasury: 900,
      crownPower: 0.65,
      locations: [
        { id: 1, name: 'London', country: 'ENG', control: 1.0 },
        { id: 2, name: 'Dover', country: 'ENG', control: 0.90 },
        { id: 3, name: 'Calais', country: 'FRA', control: 0.40 } // Calais is NOT owned by ENG!
      ],
      estates: [
        { type: 'Nobility', loyalty: 60.0 },
        { type: 'Burghers', loyalty: 55.0 }
      ],
      permanentClaims: []
    };

    // 1. Initial Tick: Since Calais is lost, Claim French Crown branch should be HIDDEN
    const eval1 = engine.evaluateMonthlyMissionMatrix(worldState);
    const tree = engine.getTree('tree_edward_branching_dynasty')!;
    const nodeFrench = tree.nodes.get('mission_claim_french_crown')!;
    const nodeHome = tree.nodes.get('mission_fortify_home_ports')!;
    const nodeOrigin = tree.nodes.get('mission_channel_outpost')!;

    assert.strictEqual(nodeOrigin.status, 'AVAILABLE');
    assert.strictEqual(nodeFrench.status, 'HIDDEN', 'Continental branch must hide when Calais is lost');

    // Complete origin node
    const success0 = engine.completeMissionNode('tree_edward_branching_dynasty', 'mission_channel_outpost', worldState);
    assert.strictEqual(success0, true);

    // 2. Complete Defensive Path: Fortify Home Ports
    const eval2 = engine.evaluateMonthlyMissionMatrix(worldState);
    assert.strictEqual(nodeHome.status, 'AVAILABLE');

    const successHome = engine.completeMissionNode('tree_edward_branching_dynasty', 'mission_fortify_home_ports', worldState);
    assert.strictEqual(successHome, true);
    assert.strictEqual(nodeHome.status, 'COMPLETED');

    // 3. Mutual Exclusivity: Even if Calais is retaken later, French Crown is permanently locked!
    worldState.locations[2].country = 'ENG'; // Retook Calais
    const eval3 = engine.evaluateMonthlyMissionMatrix(worldState);
    assert.strictEqual(nodeFrench.status, 'MUTUALLY_EXCLUSIVE_LOCKED', 'Mutually exclusive path must be permanently locked');
  });
});
