import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { EventChainManager, type EventChainStage } from '../src/events/chains.ts';
import { EspionageGridManager, type EspionageAgent } from '../src/politics/espionage.ts';
import { InstitutionPropagationEngine, type InstitutionLocationContext } from '../src/economy/institutions.ts';
import { EstateType } from '../src/core/types.ts';
import type { PopEntity } from '../src/demographics/pop.ts';
import type { GameEvent } from '../src/events/types.ts';

describe('Multi-Stage Branching Event Chains Engine', () => {
  test('Event chain persists memory variables across stages and dynamically branches', () => {
    const chainManager = new EventChainManager();

    const stage0Event: GameEvent = {
      id: 'event_hundred_years_crisis_stage_0',
      titleLocalizationKey: 'Dynastic Claim Dispute',
      descriptionLocalizationKey: 'King Edward III contemplates asserting claims over Gascony and the French Crown.',
      pictureAssetRef: 'gfx/events/dynasty_dispute.png',
      category: 'DIPLOMATIC',
      triggerConditions: [],
      options: [
        {
          id: 'opt_subsidize_burghers',
          textLocalizationKey: 'Grant Staple Monopolies to Burghers',
          tooltipText: 'Grants trade privileges to fund the war.',
          mutationPayload: { treasuryGoldDelta: 300 },
          aiWeightBase: 0.6
        },
        {
          id: 'opt_feudal_tithes',
          textLocalizationKey: 'Levy Feudal War Tithes',
          tooltipText: 'Demands noble contributions.',
          mutationPayload: { treasuryGoldDelta: 150 },
          aiWeightBase: 0.4
        }
      ]
    };

    const stage1EventBurghers: GameEvent = {
      id: 'event_hundred_years_crisis_stage_1_burghers',
      titleLocalizationKey: 'The London Merchant Guild Armada',
      descriptionLocalizationKey: 'Grateful for the subsidies, London burghers outfit a continental expedition.',
      pictureAssetRef: 'gfx/events/naval_fleet.png',
      category: 'MILITARY',
      triggerConditions: [],
      options: [
        {
          id: 'opt_launch_channel_fleet',
          textLocalizationKey: 'Launch the Channel Fleet',
          tooltipText: '+1500 Manpower',
          mutationPayload: { manpowerDelta: 1500 },
          aiWeightBase: 1.0
        }
      ]
    };

    const stage1EventFeudal: GameEvent = {
      id: 'event_hundred_years_crisis_stage_1_nobles',
      titleLocalizationKey: 'Baronial War Host Assembles',
      descriptionLocalizationKey: 'The knights assemble under Edward the Black Prince.',
      pictureAssetRef: 'gfx/events/knights_charge.png',
      category: 'MILITARY',
      triggerConditions: [],
      options: [
        {
          id: 'opt_knights_march',
          textLocalizationKey: 'Ride for Calais',
          tooltipText: '+800 Heavy Cavalry',
          mutationPayload: { manpowerDelta: 800 },
          aiWeightBase: 1.0
        }
      ]
    };

    const stages: EventChainStage[] = [
      {
        stageIndex: 0,
        stageId: 'stage_0_initial_claim',
        event: stage0Event,
        branchingEvaluator: (memory) => {
          if (memory.helped_burghers_in_1351) {
            return { nextStageId: 'stage_1_merchant_armada', nextStageIndex: 1 };
          } else {
            return { nextStageId: 'stage_1_baronial_host', nextStageIndex: 1 };
          }
        }
      },
      {
        stageIndex: 1,
        stageId: 'stage_1_merchant_armada',
        event: stage1EventBurghers,
        branchingEvaluator: () => ({ chainCompleted: true })
      },
      {
        stageIndex: 1,
        stageId: 'stage_1_baronial_host',
        event: stage1EventFeudal,
        branchingEvaluator: () => ({ chainCompleted: true })
      }
    ];

    const mockWorldState: any = {
      crownTreasury: 500,
      manpower: 5000,
      crownPower: 0.60
    };

    // 1. Start Chain
    const chain = chainManager.startChain({
      chainId: 'chain_hundred_years_war',
      titleKey: 'Hundred Years War Dynastic Crisis',
      descriptionKey: 'The struggle for continental supremacy.',
      initialStageId: 'stage_0_initial_claim',
      stages
    });

    assert.strictEqual(chain.currentStageIndex, 0);
    assert.strictEqual(chain.activeEvent?.id, 'event_hundred_years_crisis_stage_0');

    // 2. Choose Option A (Subsidize Burghers) -> Store memory variable
    const result1 = chainManager.selectOptionAndAdvance(
      'chain_hundred_years_war',
      'opt_subsidize_burghers',
      mockWorldState,
      'helped_burghers_in_1351',
      true
    );

    assert.strictEqual(result1.success, true);
    assert.strictEqual(mockWorldState.crownTreasury, 800);
    assert.strictEqual(chain.memoryVariables.helped_burghers_in_1351, true);

    // Verify dynamic branching: selected merchant armada branch
    assert.strictEqual(chain.currentStageId, 'stage_1_merchant_armada');
    assert.strictEqual(chain.activeEvent?.id, 'event_hundred_years_crisis_stage_1_burghers');

    // 3. Resolve stage 1 option -> Chain completes
    const result2 = chainManager.selectOptionAndAdvance(
      'chain_hundred_years_war',
      'opt_launch_channel_fleet',
      mockWorldState
    );

    assert.strictEqual(result2.chainCompleted, true);
    assert.strictEqual(mockWorldState.manpower, 6500);
    assert.strictEqual(chainManager.getActiveChain('chain_hundred_years_war'), undefined);
  });
});

describe('Graph-Based Espionage & Covert Action Grid', () => {
  test('Spy network builds according to intrigue formula and executes Sow Unrest & Infiltrate Administration', () => {
    const espionage = new EspionageGridManager();

    const agent: EspionageAgent = {
      id: 'agent_spymaster_walsingham',
      name: 'Master Walsingham',
      intrigueSkill: 80
    };

    // Register spy network: ENG -> FRA target location 4 (Rouen)
    const network = espionage.registerNetwork(
      'ENG',
      'FRA',
      4,
      agent,
      0.20, // 20% French counter-espionage
      0.90  // Close proximity across the Channel
    );

    // Initial size is 0
    assert.strictEqual(network.networkSize, 0);

    // 1. Monthly growth ticks:
    // Growth = 80 * 0.05 * (1 - 0.20) * 0.90 = 4.0 * 0.80 * 0.90 = 2.88 per tick
    for (let i = 0; i < 15; i++) {
      espionage.executeMonthlyEspionageTick();
    }
    assert.ok(network.networkSize >= 40.0, `Network size should be >= 40.0, was ${network.networkSize}`);

    // 2. Execute Sow Unrest (Costs 35 network)
    const targetPops: PopEntity[] = [
      {
        id: 101,
        location_id: 4, // Rouen
        estate_type: EstateType.Commoners,
        culture_id: 'norman',
        religion_id: 'catholic',
        culture_distribution: { norman: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 25000,
        wealth: 20.0,
        basic_needs_satisfaction: 0.6,
        luxury_needs_satisfaction: 0.1,
        militancy_unrest: 0.20
      },
      {
        id: 102,
        location_id: 1, // London (Different location)
        estate_type: EstateType.Commoners,
        culture_id: 'english',
        religion_id: 'catholic',
        culture_distribution: { english: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 30000,
        wealth: 50.0,
        basic_needs_satisfaction: 0.8,
        luxury_needs_satisfaction: 0.4,
        militancy_unrest: 0.05
      }
    ];

    const sowResult = espionage.executeSowUnrest('ENG', 'FRA', targetPops, { estate: EstateType.Commoners });
    assert.strictEqual(sowResult.success, true);
    assert.strictEqual(sowResult.costPaid, 35.0);
    // Pop in Rouen should receive +0.30 Unrest
    assert.strictEqual(Number(targetPops[0].militancy_unrest.toFixed(2)), 0.50);
    // Pop in London should be unaffected
    assert.strictEqual(targetPops[1].militancy_unrest, 0.05);

    // 3. Build network back up for Infiltrate Administration (50 cost)
    network.networkSize = 60.0;
    const targetLocations = [
      { id: 4, name: 'Rouen', control: 0.70, monthlyTaxBase: 40.0 }
    ];
    const frenchBarons = { institutional_wealth: 100.0 };

    const adminResult = espionage.executeInfiltrateAdministration('ENG', 'FRA', targetLocations, frenchBarons);
    assert.strictEqual(adminResult.success, true);
    assert.strictEqual(adminResult.costPaid, 50.0);
    assert.strictEqual(Number(targetLocations[0].control.toFixed(2)), 0.45); // 0.70 - 0.25 = 0.45
    assert.strictEqual(frenchBarons.institutional_wealth, 110.0); // 100 + 40 * 0.25 = 110
  });
});

describe('Institution Proximity & Technology Propagation Engine', () => {
  test('Renaissance spawns under strict criteria and diffuses along connected graph edges', () => {
    const engine = new InstitutionPropagationEngine();

    const locations: InstitutionLocationContext[] = [
      {
        id: 1,
        name: 'Florence Market Hub',
        country: 'TUS',
        isMarketHub: true,
        totalPopulation: 60000,
        burgherPopulation: 12000, // 20% burghers (> 10%)
        totalWealth: 850.0, // > 500
        devastation: 0.0,
        infrastructureCapacity: 1.5,
        connectedTradeThroughput: 2.0,
        adjacentLocationIds: [2],
        institutionPresence: {}
      },
      {
        id: 2,
        name: 'Bologna',
        country: 'PAP',
        isMarketHub: false,
        totalPopulation: 35000,
        burgherPopulation: 2000,
        totalWealth: 250.0,
        devastation: 0.0,
        infrastructureCapacity: 1.2,
        connectedTradeThroughput: 1.5,
        adjacentLocationIds: [1, 3],
        institutionPresence: {}
      },
      {
        id: 3,
        name: 'Venice Maritime Hub',
        country: 'VEN',
        isMarketHub: true,
        totalPopulation: 80000,
        burgherPopulation: 25000,
        totalWealth: 1200.0,
        devastation: 0.05,
        infrastructureCapacity: 1.8,
        connectedTradeThroughput: 2.5,
        adjacentLocationIds: [2],
        institutionPresence: {}
      }
    ];

    // 1. Spawning Check: Ruler Learning must be >= 70
    const failedSpawns = engine.evaluateSpawningPass(locations, 65); // Too low learning
    assert.strictEqual(failedSpawns.length, 0);

    const successfulSpawns = engine.evaluateSpawningPass(locations, 82); // High learning Renaissance patron
    assert.strictEqual(successfulSpawns.length, 1);
    assert.strictEqual(successfulSpawns[0].institutionId, 'renaissance');
    assert.strictEqual(successfulSpawns[0].originLocationId, 1);
    assert.strictEqual(locations[0].institutionPresence.renaissance, 100.0);

    // 2. Monthly Proximity Diffusion
    const locationsMap = new Map<number, InstitutionLocationContext>();
    for (const loc of locations) locationsMap.set(loc.id, loc);

    assert.strictEqual(locations[1].institutionPresence.renaissance || 0, 0);

    // Run 5 monthly diffusion ticks
    for (let m = 0; m < 5; m++) {
      engine.processInstitutionMonthlyDiffusion(locationsMap);
    }

    // Bologna (Location 2, adjacent to Florence) must have absorbed Renaissance presence
    const bolognaPresence = locations[1].institutionPresence.renaissance || 0;
    assert.ok(bolognaPresence > 0, `Bologna should have absorbed Renaissance presence, was ${bolognaPresence}`);

    // 3. Modifiers evaluation
    const florenceMods = engine.calculateRealmInstitutionModifiers([locations[0]], 'renaissance');
    assert.strictEqual(florenceMods.averagePresence, 100.0);
    assert.strictEqual(florenceMods.techCostModifier, -0.15); // -15% tech cost discount!
    assert.strictEqual(florenceMods.outlinerConstructionTimeMultiplier, 1.0); // No construction delay
  });
});
