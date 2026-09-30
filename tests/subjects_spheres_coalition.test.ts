import test from 'node:test';
import assert from 'node:assert';
import { 
  SubjectLedgerManager, 
  SubjectType 
} from '../src/politics/diplomacy/subjects.ts';
import { 
  SphereOfInfluenceManager 
} from '../src/politics/diplomacy/spheres.ts';
import { 
  AICoalitionWeaver 
} from '../src/ai/coalition_core.ts';

test('Multi-Tier Subject State & Vassalage Management Ledger', async (t) => {
  const ledger = new SubjectLedgerManager();

  await t.test('Initializes decoupled subject classes with distinct economic & military parameters', () => {
    // 1. Feudal Vassal: 15% tax skimming
    const vassal = ledger.registerSubject('WAL', 'ENG', SubjectType.Feudal_Vassal, 4000, 20000, 60.0);
    assert.strictEqual(vassal.taxSkimmingRate, 0.15);
    assert.strictEqual(vassal.armyMoraleBonus, 0.0);

    // 2. March: 0% tax, +25% morale, +15% fort defense
    const march = ledger.registerSubject('SCO_BORDER', 'ENG', SubjectType.March, 6000, 20000, 60.0);
    assert.strictEqual(march.taxSkimmingRate, 0.0);
    assert.strictEqual(march.armyMoraleBonus, 0.25);
    assert.strictEqual(march.fortDefenseBonus, 0.15);

    // 3. Thalassocracy Client: 50% trade volume share
    const client = ledger.registerSubject('RAG', 'VEN', SubjectType.Thalassocracy_Client, 2000, 15000, 50.0);
    assert.strictEqual(client.tradeVolumeShare, 0.50);
  });

  await t.test('Evaluates Liberty Desire and triggers disobedience thresholds (>50% and >80%)', () => {
    // Liege has 10,000 troops, prestige 20. Subject has 12,000 troops, unrest 25.
    // Military ratio = (12000 / 10000) * 50 = 60.0
    // Prestige factor = 20 * 0.25 = 5.0
    // Liberty Desire = 60 + 25 - 5 = 80.0
    const subject = ledger.registerSubject('BUR', 'FRA', SubjectType.Feudal_Vassal, 12000, 10000, 20.0);
    subject.unrestMilitancy = 25.0;
    ledger.recalculateLibertyDesire(subject);

    assert.strictEqual(subject.libertyDesire, 80.0);
    assert.strictEqual(subject.refusesOffensiveWars, true);
    assert.strictEqual(subject.hasIndependenceCB, false); // exactly 80.0

    // Escalate unrest: breaks 80% -> unlocks War of Independence CB
    subject.unrestMilitancy = 30.0; // Desire becomes 85.0
    ledger.recalculateLibertyDesire(subject);
    assert.strictEqual(subject.libertyDesire, 85.0);
    assert.strictEqual(subject.refusesOffensiveWars, true);
    assert.strictEqual(subject.hasIndependenceCB, true);
  });
});

test('Great Power Spheres of Influence & Soft Power Enforcement', async (t) => {
  const sphereMgr = new SphereOfInfluenceManager();

  await t.test('Tracks Great Power rankings via location, income, and standing army scores', () => {
    const nations = [
      { countryTag: 'FRA', totalLocations: 45, netIncome: 120.0, standingManpower: 60000 },
      { countryTag: 'TUR', totalLocations: 50, netIncome: 150.0, standingManpower: 75000 },
      { countryTag: 'ENG', totalLocations: 35, netIncome: 90.0, standingManpower: 40000 },
      { countryTag: 'CAS', totalLocations: 30, netIncome: 80.0, standingManpower: 35000 },
      { countryTag: 'VEN', totalLocations: 15, netIncome: 140.0, standingManpower: 25000 }
    ];

    const ranked = sphereMgr.updateGreatPowerRankings(nations);
    assert.strictEqual(ranked.length, 5);
    assert.strictEqual(ranked[0].countryTag, 'TUR'); // Highest score
    assert.strictEqual(ranked[0].rank, 1);
    assert.strictEqual(sphereMgr.isGreatPower('TUR'), true);
    assert.strictEqual(sphereMgr.getGreatPowerRank('VEN'), 3);
    assert.strictEqual(sphereMgr.getGreatPowerRank('ENG'), 4);
  });

  await t.test('Builds soft power influence to 100%, locking sphere and enabling Enforce Peace & 3x claim penalty', () => {
    // Advance influence
    sphereMgr.deployDiplomaticInfluence('ENG', 'FLA', 10.0); // +25%
    let rel = sphereMgr.getRelationship('ENG', 'FLA');
    assert.strictEqual(rel?.influenceFloat, 25.0);
    assert.strictEqual(rel?.isLockedInSphere, false);

    // Push to 100%
    sphereMgr.deployDiplomaticInfluence('ENG', 'FLA', 35.0); // +87.5% -> Clamps to 100.0
    rel = sphereMgr.getRelationship('ENG', 'FLA');
    assert.strictEqual(rel?.influenceFloat, 100.0);
    assert.strictEqual(rel?.isLockedInSphere, true);
    assert.strictEqual(rel?.claimFabricationPenaltyFactor, 3.0); // 3x spy claim penalty
    assert.strictEqual(sphereMgr.canEnforcePeace('ENG', 'FLA'), true);
  });
});

test('Asynchronous Dynamic Anti-Hegemon AI Coalition Weaver', async (t) => {
  const weaver = new AICoalitionWeaver(50.0);

  await t.test('Generates Aggressive Expansion scaled by cultural and religious proximity', () => {
    // Base AE 20, same culture (1.5x) and same religion (1.25x) = 20 * 1.5 * 1.25 = 37.5
    const ae1 = weaver.addAggressiveExpansion('TUR', 'SER', 20.0, true, true);
    assert.strictEqual(ae1, 37.5);

    // Conquering another province: adds 20 more -> 37.5 + 37.5 = 75.0 (crosses 50 threshold)
    const ae2 = weaver.addAggressiveExpansion('TUR', 'SER', 20.0, true, true);
    assert.strictEqual(ae2, 75.0);

    // Distant foreign religion observer: 20 * 1.0 * 0.75 = 15.0
    const aeDistant = weaver.addAggressiveExpansion('TUR', 'ENG', 20.0, false, false);
    assert.strictEqual(aeDistant, 15.0);
  });

  await t.test('Triggers month-end coalition sequencer into synchronized defense network', () => {
    // Add AE to another neighbor
    weaver.addAggressiveExpansion('TUR', 'BUL', 30.0, true, true); // 30 * 1.875 = 56.25 > 50

    const armies: Record<string, number> = {
      SER: 10000,
      BUL: 12000,
      ENG: 25000
    };

    const pact = weaver.evaluateMonthEndCoalitionSequencer('TUR', ['SER', 'BUL', 'ENG'], tag => armies[tag] || 0, 100);
    assert.ok(pact !== null);
    assert.strictEqual(pact?.hegemonTag, 'TUR');
    assert.strictEqual(pact?.memberTags.length, 2);
    assert.ok(pact?.memberTags.includes('SER'));
    assert.ok(pact?.memberTags.includes('BUL'));
    assert.strictEqual(pact?.combinedLevySize, 22000); // 10000 + 12000

    // Trigger synchronized defense grid if hegemon attacks SER
    const defense = weaver.triggerSynchronizedCoalitionDefense('TUR', 'SER');
    assert.strictEqual(defense.defenseTriggered, true);
    assert.strictEqual(defense.deployingMembers.length, 2);
    assert.strictEqual(defense.totalCombinedLevy, 22000);
  });
});
