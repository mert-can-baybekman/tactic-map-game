import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { EventScriptingEngine, SAMPLE_HISTORICAL_EVENTS } from '../src/events/index.ts';
import { StrategicAIDecisionMatrix, type AIDecisionContext } from '../src/ai/index.ts';
import { SaveLoadEngine } from '../src/core/serialization/index.ts';

describe('Event-Driven Scripting & Trigger Engine', () => {
  test('Evaluates multi-variable boolean triggers and fires conditional events', () => {
    const engine = new EventScriptingEngine();
    engine.registerEvents(SAMPLE_HISTORICAL_EVENTS);

    // Mock world state where Calais Control > 0.50
    const mockState = {
      calendar: { year: 1350, month: 1, day: 1 },
      crownTreasury: 2588.0,
      locations: [
        { id: 1, name: 'London', control: 1.0, devastation: 0.0 },
        { id: 2, name: 'Dover', control: 0.93, devastation: 0.05 },
        { id: 3, name: 'Calais', control: 0.96, devastation: 0.10 }
      ],
      estates: [
        { type: 'Nobility', loyalty: 65.0 },
        { type: 'Burghers', loyalty: 56.0 }
      ]
    };

    const fired = engine.evaluateTickTriggers(mockState, '1350-01-01');
    assert.ok(fired.length > 0, 'Burgher petition should fire when Calais control > 0.50');
    assert.strictEqual(fired[0].event.id, 'event_burgher_guild_petition');

    // Verify trigger fails when control is low
    mockState.locations[2].control = 0.30;
    const firedLow = engine.evaluateTickTriggers(mockState, '1350-01-02');
    assert.strictEqual(firedLow.length, 0, 'Event must not fire when condition fails');
  });

  test('Resolving event option applies atomic state mutations across locations and estates', () => {
    const engine = new EventScriptingEngine();
    engine.registerEvents(SAMPLE_HISTORICAL_EVENTS);

    const mockState: any = {
      crownTreasury: 1000.0,
      locations: [{ id: 3, name: 'Calais', control: 0.96, devastation: 0.0 }],
      estates: [{ type: 'Burghers', loyalty: 50.0 }],
      charters: { woolExportMonopoly: { active: false } }
    };

    engine.evaluateTickTriggers(mockState, '1350-01-01');
    assert.strictEqual(engine.activeEventQueue.length, 1);

    // Choose Option A: Grant Staple Charter (+25 Gold, +10 Burgher Loyalty, -15% Calais Control)
    const success = engine.resolveEvent('event_burgher_guild_petition', 'option_grant_wool_monopoly', mockState);
    assert.strictEqual(success, true);
    assert.strictEqual(engine.activeEventQueue.length, 0);

    assert.strictEqual(mockState.crownTreasury, 1025.0);
    assert.strictEqual(mockState.estates[0].loyalty, 60.0);
    assert.strictEqual(Number(mockState.locations[0].control.toFixed(2)), 0.81);
    assert.strictEqual(mockState.charters.woolExportMonopoly.active, true);
  });
});

describe('Strategic AI Decision Matrix & Utility Core', () => {
  test('Economic AI detects weapon deficit with treasury > 500 gold and schedules foundry', () => {
    const ai = new StrategicAIDecisionMatrix();

    const mockContext: AIDecisionContext = {
      countryTag: 'ENG',
      treasuryGold: 1200.0,
      monthlyIncome: 140.0,
      manpowerCurrent: 18000,
      manpowerMax: 35000,
      rulerTraits: ['valiant_warrior'],
      rulerMartial: 85,
      rulerStewardship: 70,
      estateLoyalties: { Nobility: 60.0, Burghers: 55.0 },
      marketPrices: {
        weapons: { price: 24.0, supply: 15, demand: 45 } // Low supply deficit
      },
      adjacentLocations: []
    };

    const decisions = ai.evaluateEconomicDecisions(mockContext);
    assert.strictEqual(decisions.length, 1);
    assert.strictEqual(decisions[0].id, 'action_construct_foundry');
    assert.ok(decisions[0].desirabilityScore > 0.5, 'Desirability score must be high for urgent weapon foundry');
  });

  test('Military AI detects vulnerable adjacent enclave (Control < 30%) and registers Conquest_War_Goal', () => {
    const ai = new StrategicAIDecisionMatrix();

    const mockContext: AIDecisionContext = {
      countryTag: 'ENG',
      treasuryGold: 800.0,
      monthlyIncome: 90.0,
      manpowerCurrent: 12000,
      manpowerMax: 30000,
      rulerTraits: ['valiant_warrior'],
      rulerMartial: 85,
      rulerStewardship: 60,
      estateLoyalties: { Nobility: 65.0, Burghers: 50.0 },
      marketPrices: {},
      adjacentLocations: [
        { id: 4, name: 'Rouen', country: 'FRA', control: 0.22, devastation: 0.35, isEnclave: true } // Weak enclave
      ]
    };

    const warGoals = ai.evaluateDiplomaticMilitaryDecisions(mockContext);
    assert.strictEqual(warGoals.length, 1);
    assert.strictEqual(warGoals[0].type, 'CONQUEST_ENCLAVE');
    assert.strictEqual(warGoals[0].targetLocationId, 4);
    assert.ok(warGoals[0].desirabilityScore > 0.6);
    assert.deepStrictEqual(warGoals[0].pathfindingRoute, [1, 2, 4]);
  });

  test('AI evaluates Burgher Guild Petition event choices using utility functions', () => {
    const ai = new StrategicAIDecisionMatrix();
    const event = SAMPLE_HISTORICAL_EVENTS[0]; // Burgher Guild Petition

    // Case 1: Feudal Sovereign ruler prioritizes retaining Crown Control -> prefers rejecting demands
    const contextFeudal: AIDecisionContext = {
      countryTag: 'ENG',
      treasuryGold: 2000.0,
      monthlyIncome: 150.0,
      manpowerCurrent: 20000,
      manpowerMax: 35000,
      rulerTraits: ['feudal_sovereign', 'valiant_warrior'],
      rulerMartial: 85,
      rulerStewardship: 50,
      estateLoyalties: { Nobility: 70.0, Burghers: 65.0 },
      marketPrices: {},
      adjacentLocations: []
    };

    const choiceFeudal = ai.evaluateEventChoice(event, contextFeudal);
    assert.strictEqual(choiceFeudal.selectedOption.id, 'option_reject_burgher_demands');

    // Case 2: Bankrupt ruler with desperate need for gold and low burgher loyalty (< 35%) -> grants monopoly
    const contextBankrupt: AIDecisionContext = {
      countryTag: 'ENG',
      treasuryGold: 15.0, // Bankrupt
      monthlyIncome: 10.0,
      manpowerCurrent: 5000,
      manpowerMax: 35000,
      rulerTraits: ['stewardship'],
      rulerMartial: 50,
      rulerStewardship: 80,
      estateLoyalties: { Nobility: 50.0, Burghers: 28.0 }, // Critically low burghers loyalty
      marketPrices: {},
      adjacentLocations: []
    };

    const choiceBankrupt = ai.evaluateEventChoice(event, contextBankrupt);
    assert.strictEqual(choiceBankrupt.selectedOption.id, 'option_grant_wool_monopoly');
    assert.ok(choiceBankrupt.desirabilityScore > 0.5);
  });
});

describe('High-Performance State Persistence & Serialization', () => {
  test('Flushes deep world state into flat-file JSON with valid checksum and restores state', () => {
    const liveWorld = {
      calendar: { year: 1350, month: 4, day: 7 },
      crownTreasury: 3450.5,
      monthlyTaxIncome: 245.0,
      monthlyMaintenance: 110.0,
      manpower: 28900,
      maxManpower: 35000,
      crownPower: 0.68,
      channelBlockaded: false,
      charters: {
        feudalTitheExemption: { id: 'feudal_tithe_exemption', name: 'Feudal Tithe Exemption', active: true },
        woolExportMonopoly: { id: 'wool_export_monopoly', name: 'Wool Export Monopoly', active: true }
      },
      ruler: {
        id: 1,
        firstName: 'Edward III',
        dynasty: 'Plantagenet',
        age: 38,
        sex: 'Male',
        attributes: { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 },
        traits: [{ id: 'valiant_warrior', name: 'Valiant Warrior' }]
      },
      heir: { id: 2, firstName: 'Edward (Black Prince)', dynasty: 'Plantagenet', age: 20, claim: 100 },
      estates: [
        { type: 'Nobility', wealth: 528.0, loyalty: 65.3, power: 45.0 },
        { type: 'Burghers', wealth: 512.0, loyalty: 56.7, power: 20.0 }
      ],
      locations: [
        {
          id: 1,
          name: 'London',
          country: 'ENG',
          terrain: 'Farmland',
          control: 1.0,
          devastation: 0.0,
          infrastructure: 35.0,
          tax_base: 120.0,
          nobleDominated: true,
          buildings: ['Royal Mint'],
          pops: [
            { estate: 'Nobility', subCulture: 'Anglo-Norman', size: 3500, wealth: 450.0, unrest: 0.05 },
            { estate: 'Commoners', subCulture: 'English', size: 22000, wealth: 18.0, unrest: 0.12 }
          ]
        }
      ],
      outliner: {
        normandyIntegration: 44.5,
        calaisBastion: 69.8,
        alerts: [],
        armies: [{ id: 'vanguard', name: 'Royal Vanguard', size: 8500, commander: 'King Edward III', location: 'Calais', morale: 95 }]
      }
    };

    // 1. Serialize
    const jsonSave = SaveLoadEngine.serializeToJson(liveWorld, true);
    assert.ok(jsonSave.includes('"saveEngineVersion": "1.0.0-PROD"'));
    assert.ok(jsonSave.includes('"checksum"'));
    assert.ok(jsonSave.includes('"normandyIntegration": 44.5'));

    // 2. Deserialize & Validate
    const loadResult = SaveLoadEngine.deserializeFromJson(jsonSave);
    assert.strictEqual(loadResult.success, true);
    assert.ok(loadResult.state);
    assert.strictEqual(loadResult.state.crownTreasury, 3450.5);
    assert.strictEqual(loadResult.state.locations[0].pops[0].size, 3500);

    // 3. Test Checksum Tamper Rejection
    const tamperedJson = jsonSave.replace('"crownTreasury": 3450.5', '"crownTreasury": 999999.0');
    const tamperedResult = SaveLoadEngine.deserializeFromJson(tamperedJson);
    assert.strictEqual(tamperedResult.success, false, 'Tampered save file must fail checksum validation');
    assert.ok(tamperedResult.error?.includes('checksum'));
  });
});
