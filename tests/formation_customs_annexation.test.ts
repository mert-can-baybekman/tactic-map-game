import test from 'node:test';
import assert from 'node:assert';
import { 
  NationFormationManager 
} from '../src/politics/formation.ts';
import { 
  CustomsUnionManager 
} from '../src/economy/customs_union.ts';
import { 
  DiplomaticAnnexationManager 
} from '../src/politics/diplomacy/annexation.ts';

test('Procedural Nation Formation & Tag Evolution Engine', async (t) => {
  const formationMgr = new NationFormationManager();

  await t.test('Prevents premature formation if locations or prestige requirements are unmet', () => {
    // Ottoman Beylik with low prestige
    const lowPrestige = formationMgr.checkFormationEligibility('OTT', 55.0, [101, 102, 110, 117, 128], 'TUR');
    assert.strictEqual(lowPrestige, false);

    // Ottoman Beylik with high prestige but missing Ankara (128)
    const missingNode = formationMgr.checkFormationEligibility('OTT', 75.0, [101, 102, 110, 117], 'TUR');
    assert.strictEqual(missingNode, false);

    // Foreign tag attempting to form TUR
    const wrongTag = formationMgr.checkFormationEligibility('FRA', 85.0, [101, 102, 110, 117, 128], 'TUR');
    assert.strictEqual(wrongTag, false);
  });

  await t.test('Executes Anatolian Empire Unification Protocol and mutates sovereign tag and claims', () => {
    // Karamanid Beylik conquers all required Anatolian nodes and achieves high prestige
    const isEligible = formationMgr.checkFormationEligibility('KRM', 78.0, [101, 102, 110, 117, 128], 'TUR');
    assert.strictEqual(isEligible, true);

    const payload = formationMgr.executeNationFormation('KRM', 78.0, [101, 102, 110, 117, 128], 'TUR');
    assert.ok(payload !== null);
    assert.strictEqual(payload?.previousTag, 'KRM');
    assert.strictEqual(payload?.newTag, 'TUR');
    assert.strictEqual(payload?.newCountryName, 'Ottoman Empire');
    assert.strictEqual(payload?.newGovernmentRank, 'Empire');
    assert.strictEqual(payload?.prestigeBonus, 25.0);
    assert.strictEqual(payload?.legitimacyBonus, 30.0);
    assert.deepStrictEqual(payload?.gainedCoreLocationIds, [101, 102, 110, 117, 128]);
  });

  await t.test('Supports Kingdom of France, Great Britain, and Italy formables', () => {
    // Great Britain formed by England
    const gbrEligible = formationMgr.checkFormationEligibility('ENG', 70.0, [1, 7, 8], 'GBR');
    assert.strictEqual(gbrEligible, true);

    const gbrPayload = formationMgr.executeNationFormation('ENG', 70.0, [1, 7, 8], 'GBR');
    assert.strictEqual(gbrPayload?.newTag, 'GBR');
    assert.strictEqual(gbrPayload?.newCountryName, 'Kingdom of Great Britain');
  });
});

test('Multi-State Customs Unions & Market Access Networks', async (t) => {
  const customsMgr = new CustomsUnionManager();

  // Create North Sea / Hanseatic Customs Union led by Hamburg (HAM)
  const union = customsMgr.createUnion('HAM', 208, ['LUB']);
  assert.strictEqual(union.leaderTag, 'HAM');
  assert.strictEqual(union.memberTags.length, 2);

  await t.test('Invites neighboring minor tags into shared customs union cartel', () => {
    const invited = customsMgr.inviteMember(union.unionId, 'COL'); // Cologne
    assert.strictEqual(invited, true);
    assert.strictEqual(customsMgr.isMemberOfUnion('COL', union.unionId), true);
  });

  await t.test('Eliminates internal transit tariff friction while applying external border friction', () => {
    // Internal members: zero tariff modifier (1.0x)
    const internalCost = customsMgr.calculateGoodsTransportCost(10.0, 'HAM', 'LUB');
    assert.strictEqual(internalCost, 10.0);

    // External trade: 2.5x border tariff friction
    const externalCost = customsMgr.calculateGoodsTransportCost(10.0, 'HAM', 'FRA');
    assert.strictEqual(externalCost, 25.0);
  });

  await t.test('Skims 10% transaction volume to union leader treasury and boosts member strategic workshops', () => {
    const memberVolumes = [
      { countryTag: 'HAM', commercialVolume: 400.0 },
      { countryTag: 'LUB', commercialVolume: 350.0 },
      { countryTag: 'COL', commercialVolume: 250.0 }
    ];

    // Total = 1000.0. 10% leader skim = 100.0
    const tickResult = customsMgr.processCustomsUnionTradeTicks(union.unionId, memberVolumes);
    assert.strictEqual(tickResult.totalVolume, 1000.0);
    assert.strictEqual(tickResult.leaderSkimRevenue, 100.0);
    assert.strictEqual(tickResult.memberSharedGoodsBonus, 0.15); // +15% workshop efficiency
  });
});

test('Minor Tag Diplomatic Absorption & Annexation Core', async (t) => {
  const annexMgr = new DiplomaticAnnexationManager();

  await t.test('Requires low liberty desire (<30%) and high relations (>=100) to begin annexation', () => {
    // Ineligible: rebellious dependency
    assert.strictEqual(annexMgr.canInitiateAnnexation(45.0, 150.0), false);

    // Ineligible: poor relations
    assert.strictEqual(annexMgr.canInitiateAnnexation(20.0, 60.0), false);

    // Eligible: docile subject with excellent relations
    assert.strictEqual(annexMgr.canInitiateAnnexation(15.0, 120.0), true);
  });

  await t.test('Advances monthly progress and halts if liberty desire spikes >= 50%', () => {
    const task = annexMgr.startAnnexation('OTT', 'CND', [108, 109], 15.0, 120.0);
    assert.ok(task !== null);
    assert.strictEqual(task?.subjectTag, 'CND');

    // Month 1: normal progression
    const step1 = annexMgr.processMonthlyAnnexationTick(task!.taskId, 2.0, 15.0);
    assert.ok(step1.progress > 0.0);
    assert.strictEqual(step1.completed, false);

    // Month 2: Subject becomes rebellious (> 50% liberty desire) -> progress freezes
    const step2 = annexMgr.processMonthlyAnnexationTick(task!.taskId, 2.0, 65.0);
    assert.strictEqual(step2.progress, step1.progress);
    assert.strictEqual(step2.completed, false);
  });

  await t.test('Completes annexation at 100%, reassigns location ownership, and enforces 60% autonomy floor', () => {
    const task = annexMgr.startAnnexation('OTT', 'SAR', [114], 10.0, 150.0);
    assert.ok(task !== null);

    // Fast-forward ticks to completion
    let finalStep;
    for (let i = 0; i < 40; i++) {
      finalStep = annexMgr.processMonthlyAnnexationTick(task!.taskId, 5.0, 10.0);
      if (finalStep.completed) break;
    }

    assert.strictEqual(finalStep?.completed, true);
    assert.strictEqual(finalStep?.progress, 100.0);
    assert.ok(finalStep?.payload !== undefined);
    assert.strictEqual(finalStep?.payload?.liegeTag, 'OTT');
    assert.strictEqual(finalStep?.payload?.annexedSubjectTag, 'SAR');
    assert.strictEqual(finalStep?.payload?.purgedFromActiveAI, true);
    assert.strictEqual(finalStep?.payload?.absorbedLocations.length, 1);
    assert.strictEqual(finalStep?.payload?.absorbedLocations[0].locationId, 114);
    assert.strictEqual(finalStep?.payload?.absorbedLocations[0].newOwnerTag, 'OTT');
    assert.strictEqual(finalStep?.payload?.absorbedLocations[0].localAutonomyFloor, 0.60); // 60% floor
  });
});
