import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EstateType } from '../src/core/types.ts';
import { EstateGovernanceEngine } from '../src/politics/estates.ts';
import { PopDemographicEngine } from '../src/demographics/pop.ts';
import { LocationRegistry } from '../src/map/location.ts';
import { DietAssemblyEngine, type ProposedBill } from '../src/politics/diet_assembly.ts';
import { SupplyRangeManager, type DynamicArmyStack, type SupplyDepotNode } from '../src/military/supply_range.ts';
import { AIDemographicsGovernor } from '../src/ai/demographics_governor.ts';

describe('Dynamic Parliamentary / Diet Assembly & Estate Demands Engine', () => {
  it('convenes assembly session and procedurally generates estate demands', () => {
    const estateEngine = new EstateGovernanceEngine();
    const assembly = new DietAssemblyEngine('ENG', 'English_Parliament');

    const demands = assembly.conveneAssemblySession(estateEngine);
    assert.ok(demands.length > 0, 'Assembly should generate at least one procedural demand');
    assert.ok(demands.some(d => d.originatingEstate === EstateType.Nobility || d.originatingEstate === EstateType.Burghers));
  });

  it('calculates legislative voting weights and fails contentious bill dropping stability', () => {
    const estateEngine = new EstateGovernanceEngine();
    const popEngine = new PopDemographicEngine();
    const assembly = new DietAssemblyEngine('TUR', 'Ottoman_Divan');

    // Create Burghers pop with low initial militancy
    const burgherPop = popEngine.createPop({
      location_id: 101,
      estate_type: EstateType.Burghers,
      culture_id: 'turkish',
      religion_id: 'sunni',
      culture_distribution: { turkish: 1.0 },
      religion_distribution: { sunni: 1.0 },
      size: 5000,
      wealth: 200,
      basic_needs_satisfaction: 0.8,
      luxury_needs_satisfaction: 0.5,
      militancy_unrest: 0.1
    });

    // Burghers have loyalty 40 (below 50), and bill targets their privileges
    const burgherEstate = estateEngine.getEstate(EstateType.Burghers);
    burgherEstate.loyalty = 35.0;
    burgherEstate.raw_power = 0.45;

    const nobilityEstate = estateEngine.getEstate(EstateType.Nobility);
    nobilityEstate.loyalty = 45.0;
    nobilityEstate.raw_power = 0.35;

    const contentiousBill: ProposedBill = {
      id: 'revoke_guild_monopoly',
      name: 'Revoke Guild Monopolies & Impose Peacetime Royal Tolls',
      category: 'Privilege_Revocation',
      displeasedEstate: EstateType.Burghers,
      expectedCrownPowerGain: 0.10,
      stabilityHitOnFailure: -1.0
    };

    // Ruler diplomacy = 40 (weak diplomat)
    const { result, updatedStability } = assembly.voteOnLegislativeBill(
      contentiousBill,
      estateEngine,
      40,
      popEngine,
      2.0
    );

    assert.strictEqual(result.passed, false, 'Contentious bill with disgruntled estates should fail');
    assert.strictEqual(updatedStability, 1.0, 'Stability should drop by -1.0 upon bill rejection');
    assert.ok(result.disgruntledEstates.includes(EstateType.Burghers));
    assert.ok(burgherPop.militancy_unrest > 0.1, 'Militancy of disgruntled estate pops must increase');
  });

  it('passes popular bill with high ruler diplomacy without stability loss', () => {
    const estateEngine = new EstateGovernanceEngine();
    const assembly = new DietAssemblyEngine('FRA', 'General_Estates');

    // Set high loyalty across estates
    for (const est of estateEngine.getAllEstates()) {
      est.loyalty = 75.0;
    }

    const popularBill: ProposedBill = {
      id: 'peacetime_infrastructure_levy',
      name: 'Crown Highway & Canal Act',
      category: 'Peacetime_Tax',
      expectedCrownPowerGain: 0.05,
      stabilityHitOnFailure: -1.0
    };

    // Ruler diplomacy = 85 (charismatic sovereign)
    const { result, updatedStability } = assembly.voteOnLegislativeBill(
      popularBill,
      estateEngine,
      85,
      undefined,
      2.0
    );

    assert.strictEqual(result.passed, true, 'Bill with high loyalty & diplomacy must pass');
    assert.strictEqual(updatedStability, 2.0, 'Stability must remain intact when law passes');
    assert.ok(result.netApprovalWeight > 0);
  });
});

describe('Multi-Node Logistical Supply Range & Depot Network', () => {
  it('decays supply efficiency exponentially with distance and maintains army supply', () => {
    const supplyManager = new SupplyRangeManager();
    const locRegistry = new LocationRegistry();

    // Register connected path: 101 -> 102 -> 103 -> 104
    locRegistry.register({ id: 101, name: 'Capital Hub', culture: 'turkish', religion: 'sunni', development: 20, neighbors: [102] });
    locRegistry.register({ id: 102, name: 'Anatolian Corridor', culture: 'turkish', religion: 'sunni', development: 10, neighbors: [101, 103] });
    locRegistry.register({ id: 103, name: 'Frontier Node', culture: 'turkish', religion: 'sunni', development: 8, neighbors: [102, 104] });
    locRegistry.register({ id: 104, name: 'Border Camp', culture: 'turkish', religion: 'sunni', development: 5, neighbors: [103] });

    supplyManager.registerDepot({
      id: 'depot_capital',
      locationId: 101,
      baseEfficiency: 1.0,
      decayRate: 0.08,
      availableGrain: 500,
      isOperational: true
    });

    const army: DynamicArmyStack = {
      id: 'royal_army',
      name: 'Royal Host',
      countryId: 1,
      currentLocationId: 104, // 3 hops away
      originLocationId: 101,
      manpower: 10000,
      morale: 80.0,
      daysStarving: 0,
      supplyEfficiency: 1.0,
      isStarving: false
    };

    const res = supplyManager.evaluateArmyLogistics(
      army,
      locRegistry,
      new Set(), // no naval blockades
      new Set()  // no hostile ZoC
    );

    assert.strictEqual(res.supplied, true);
    assert.strictEqual(res.logisticalDistance, 3);
    assert.ok(res.supplyEfficiency < 1.0 && res.supplyEfficiency > 0.70, 'Supply efficiency should decay exponentially');
    assert.strictEqual(army.isStarving, false);
  });

  it('cuts supply efficiency to 0% upon naval blockade or ZoC and subtracts dead pops from origin location', () => {
    const supplyManager = new SupplyRangeManager();
    const locRegistry = new LocationRegistry();
    const popEngine = new PopDemographicEngine();

    locRegistry.register({ id: 201, name: 'London Port', culture: 'english', religion: 'catholic', development: 25, neighbors: [202] });
    locRegistry.register({ id: 202, name: 'Dover Strait', culture: 'english', religion: 'catholic', development: 12, neighbors: [201, 203] });
    locRegistry.register({ id: 203, name: 'Calais Bridgehead', culture: 'anglo_norman', religion: 'catholic', development: 15, neighbors: [202] });

    supplyManager.registerDepot({
      id: 'depot_london',
      locationId: 201,
      baseEfficiency: 1.0,
      decayRate: 0.08,
      availableGrain: 500,
      isOperational: true
    });

    // Create origin home pop in London that provided the levies
    const londonPop = popEngine.createPop({
      location_id: 201,
      estate_type: EstateType.Commoners,
      culture_id: 'english',
      religion_id: 'catholic',
      culture_distribution: { english: 1.0 },
      religion_distribution: { catholic: 1.0 },
      size: 20000,
      wealth: 500,
      basic_needs_satisfaction: 1.0,
      luxury_needs_satisfaction: 0.5,
      militancy_unrest: 0.05
    });

    const expArmy: DynamicArmyStack = {
      id: 'calais_expedition',
      name: 'Calais Garrison Stack',
      countryId: 2,
      currentLocationId: 203,
      originLocationId: 201, // Levied from London
      manpower: 10000,
      morale: 70.0,
      daysStarving: 0,
      supplyEfficiency: 1.0,
      isStarving: false
    };

    // Enemy fleet blockades Dover Strait (location 202)
    const blockedNodes = new Set<number>([202]);

    const res = supplyManager.evaluateArmyLogistics(
      expArmy,
      locRegistry,
      blockedNodes,
      new Set(),
      popEngine
    );

    assert.strictEqual(res.supplied, false);
    assert.strictEqual(res.supplyEfficiency, 0.0, 'Supply efficiency must be 0% when line is cut');
    assert.strictEqual(expArmy.isStarving, true);
    assert.strictEqual(expArmy.daysStarving, 1);
    assert.ok(res.dailyCasualties > 0, 'Army must suffer starvation casualties');
    assert.strictEqual(expArmy.manpower, 10000 - res.dailyCasualties);

    // Assert that origin population in London was permanently decremented!
    assert.strictEqual(londonPop.size, 20000 - res.dailyCasualties, 'Origin pop count must permanently subtract dead soldiers');
    assert.ok(londonPop.militancy_unrest > 0.05, 'Casualties in home pop must increase unrest');
  });
});

describe('Domestic AI Demographics Control & Assimilation Policy', () => {
  it('triggers emergency budget or tax exemptions when Crown Control < 40% and Militancy > 0.6', () => {
    const aiGovernor = new AIDemographicsGovernor('OTT', 'sunni', 'turkish');
    const locRegistry = new LocationRegistry();
    const popEngine = new PopDemographicEngine();

    locRegistry.register({ id: 301, name: 'Captured Balkan Node', culture: 'greek', religion: 'orthodox', development: 14, neighbors: [] });

    const localPop = popEngine.createPop({
      location_id: 301,
      estate_type: EstateType.Commoners,
      culture_id: 'greek',
      religion_id: 'orthodox',
      culture_distribution: { greek: 1.0 },
      religion_distribution: { orthodox: 1.0 },
      size: 15000,
      wealth: 100,
      basic_needs_satisfaction: 0.4,
      luxury_needs_satisfaction: 0.1,
      militancy_unrest: 0.75 // Extreme unrest
    });

    aiGovernor.registerTerritory({
      locationId: 301,
      countryTag: 'OTT',
      isCore: false,
      isPrimaryCulture: false,
      isStateReligion: false,
      crownControl: 0.28, // Below 40%
      popMilitancy: 0.75, // Above 0.60
      conversionDelta: 0.005,
      taxExemptionActive: false
    });

    const rulerAttributes = { martial: 50, diplomacy: 50, stewardship: 60, learning: 40, intrigue: 50 };

    // With treasury >= 50: Emergency State Budget Grant
    const decision = aiGovernor.evaluateLocationPolicy(
      301,
      rulerAttributes,
      120.0, // Plenty of ducats
      locRegistry,
      popEngine
    );

    assert.strictEqual(decision.action, 'Emergency_State_Budget_Grant');
    assert.strictEqual(decision.treasuryCostDucats, 50.0);
    assert.strictEqual(localPop.militancy_unrest, 0.50, 'Militancy should be reduced by 0.25');
  });

  it('accelerates religious conversion when ruler has high Learning attribute', () => {
    const aiGovernor = new AIDemographicsGovernor('OTT', 'sunni', 'turkish');
    const locRegistry = new LocationRegistry();
    const popEngine = new PopDemographicEngine();

    locRegistry.register({ id: 302, name: 'Anatolian Frontier', culture: 'armenian', religion: 'miaphysite', development: 10, neighbors: [] });

    const frontierPop = popEngine.createPop({
      location_id: 302,
      estate_type: EstateType.Commoners,
      culture_id: 'armenian',
      religion_id: 'miaphysite',
      culture_distribution: { armenian: 1.0 },
      religion_distribution: { miaphysite: 0.9, sunni: 0.1 },
      size: 8000,
      wealth: 150,
      basic_needs_satisfaction: 0.7,
      luxury_needs_satisfaction: 0.4,
      militancy_unrest: 0.2 // Stable militancy
    });

    aiGovernor.registerTerritory({
      locationId: 302,
      countryTag: 'OTT',
      isCore: true,
      isPrimaryCulture: false,
      isStateReligion: false,
      crownControl: 0.65, // Good crown control
      popMilitancy: 0.20,
      conversionDelta: 0.005,
      taxExemptionActive: false
    });

    // High learning ruler (learning = 78 >= 60)
    const learnedRuler = { martial: 40, diplomacy: 55, stewardship: 65, learning: 78, intrigue: 50 };

    const decision = aiGovernor.evaluateLocationPolicy(
      302,
      learnedRuler,
      200.0,
      locRegistry,
      popEngine
    );

    assert.strictEqual(decision.action, 'Deploy_Missionary_Clergy');
    assert.strictEqual(decision.conversionRateDelta, 0.04);
    assert.ok(frontierPop.religion_distribution['sunni'] >= 0.14, 'Sunni religious share should increase with conversion delta');
  });
});
