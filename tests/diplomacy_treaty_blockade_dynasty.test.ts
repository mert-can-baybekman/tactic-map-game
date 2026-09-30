import test from 'node:test';
import assert from 'node:assert';
import { 
  TransactionalPeaceEngine, 
  TreatyClauseType 
} from '../src/politics/diplomacy/peace_engine.ts';
import type { PeaceDealTransaction } from '../src/politics/diplomacy/peace_engine.ts';
import { TradeInterdictionManager } from '../src/economy/interdiction.ts';
import { 
  DynasticPersonalUnionSimulator, 
  SuccessionOutcome 
} from '../src/politics/dynasty.ts';

test('Multi-Variable Transactional Peace Treaty Engine', async (t) => {
  const peaceEngine = new TransactionalPeaceEngine();

  await t.test('Evaluates bidirectional barter war score budget', () => {
    const deal: PeaceDealTransaction = {
      id: 'treaty_calais_1350',
      initiatorTag: 'ENG',
      targetTag: 'FRA',
      accumulatedWarScore: 35.0,
      demandedClauses: [
        {
          type: TreatyClauseType.Cede_Location,
          warScoreCost: 30.0,
          giverTag: 'FRA',
          receiverTag: 'ENG',
          cedePayload: {
            locationId: 3, // Calais
            newSovereignTag: 'ENG',
            newControllerTag: 'ENG',
            crownControlFloor: 0.20
          }
        },
        {
          type: TreatyClauseType.War_Indemnities,
          warScoreCost: 15.0,
          giverTag: 'FRA',
          receiverTag: 'ENG',
          indemnitiesPayload: {
            payingCountryTag: 'FRA',
            receivingCountryTag: 'ENG',
            durationMonths: 60,
            monthlyTaxRate: 0.10
          }
        }
      ],
      concessionClauses: [
        {
          type: TreatyClauseType.Revoke_Privilege, // England concedes dropping a trade monopoly
          warScoreCost: 10.0,
          giverTag: 'ENG',
          receiverTag: 'FRA',
          revokePayload: {
            targetCountryTag: 'ENG',
            targetEstate: 'Burghers',
            privilegeId: 'wool_export_monopoly',
            loyaltyPenalty: -10.0,
            powerReduction: -5.0
          }
        }
      ]
    };

    // Gross demands = 30 + 15 = 45. Concessions = 10. Net = 35.
    const netCost = peaceEngine.calculateWarScoreBudget(deal);
    assert.strictEqual(netCost, 35.0, 'Net War Score budget must balance after barter concession offset');

    const validation = peaceEngine.validatePeaceDeal(deal);
    assert.strictEqual(validation.valid, true, 'Treaty must be valid when net cost equals accumulated war score');
  });

  await t.test('Safely executes treaty payloads (Cede Location, Revoke Privilege, Indemnities)', () => {
    let mutatedLocation = { id: 0, tag: '', control: 0 };
    let strippedPrivilege = { tag: '', estate: '', id: '', loyalty: 0, power: 0 };
    let mapRecolored = false;

    const deal: PeaceDealTransaction = {
      id: 'treaty_test',
      initiatorTag: 'ENG',
      targetTag: 'FRA',
      accumulatedWarScore: 50.0,
      demandedClauses: [
        {
          type: TreatyClauseType.Cede_Location,
          warScoreCost: 25.0,
          giverTag: 'FRA',
          receiverTag: 'ENG',
          cedePayload: {
            locationId: 4, // Rouen
            newSovereignTag: 'ENG',
            newControllerTag: 'ENG',
            crownControlFloor: 0.20
          }
        },
        {
          type: TreatyClauseType.Revoke_Privilege,
          warScoreCost: 10.0,
          giverTag: 'FRA',
          receiverTag: 'ENG',
          revokePayload: {
            targetCountryTag: 'FRA',
            targetEstate: 'Nobility',
            privilegeId: 'feudal_tithe_exemption',
            loyaltyPenalty: -15.0,
            powerReduction: -10.0
          }
        },
        {
          type: TreatyClauseType.War_Indemnities,
          warScoreCost: 15.0,
          giverTag: 'FRA',
          receiverTag: 'ENG',
          indemnitiesPayload: {
            payingCountryTag: 'FRA',
            receivingCountryTag: 'ENG',
            durationMonths: 24,
            monthlyTaxRate: 0.10
          }
        }
      ],
      concessionClauses: []
    };

    const result = peaceEngine.executePeaceTreaty(deal, {
      mutateLocationSovereignty: (locId, newTag, floor) => {
        mutatedLocation = { id: locId, tag: newTag, control: floor };
      },
      stripEstatePrivilege: (tag, estate, privId, loyaltyDelta, powerDelta) => {
        strippedPrivilege = { tag, estate, id: privId, loyalty: loyaltyDelta, power: powerDelta };
      },
      recolorMapCallback: () => {
        mapRecolored = true;
      }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(mutatedLocation.id, 4);
    assert.strictEqual(mutatedLocation.tag, 'ENG');
    assert.strictEqual(mutatedLocation.control, 0.20, 'Ceded location control drops to 20% base floor');
    assert.strictEqual(mapRecolored, true, 'Map recoloring callback must trigger');

    assert.strictEqual(strippedPrivilege.tag, 'FRA');
    assert.strictEqual(strippedPrivilege.id, 'feudal_tithe_exemption');

    assert.ok(result.scheduledIndemnity);
    assert.strictEqual(result.scheduledIndemnity?.payerTag, 'FRA');
    assert.strictEqual(result.scheduledIndemnity?.receiverTag, 'ENG');
    assert.strictEqual(result.scheduledIndemnity?.monthlyTaxRate, 0.10);

    // Test monthly indemnity transfer pass
    let transferredAmount = 0;
    const monthlyPass = peaceEngine.processMonthlyIndemnities(
      (tag) => (tag === 'FRA' ? 250.0 : 0.0), // France makes 250 D/month
      (from, to, amount) => {
        transferredAmount += amount;
      }
    );

    assert.strictEqual(transferredAmount, 25.0, 'Must transfer 10% of 250 D = 25 D per month');
    assert.strictEqual(monthlyPass.totalTransferred, 25.0);
  });
});

test('Dynamic Trade Embargos & Global Naval Blockade Manager', async (t) => {
  const interdiction = new TradeInterdictionManager();

  await t.test('Enforces graph-edge embargo with infinite transport cost penalty', () => {
    // Normal baseline transport cost
    const normalCost = interdiction.evaluateEdgeTransportCost('ENG', 'FRA', 1.0);
    assert.strictEqual(normalCost, 1.0);

    // Enact Embargo: England embargoes France
    interdiction.enactEmbargo('ENG', 'FRA');
    assert.strictEqual(interdiction.isEmbargoActive('ENG', 'FRA'), true);

    // Embargoed edge returns infinite cost penalty (999,999.0)
    const embargoedCost = interdiction.evaluateEdgeTransportCost('ENG', 'FRA', 1.0);
    assert.strictEqual(embargoedCost, 999999.0, 'Embargoed edge must apply infinite transport cost penalty');

    // Lift embargo restores baseline
    interdiction.liftEmbargo('ENG', 'FRA');
    assert.strictEqual(interdiction.evaluateEdgeTransportCost('ENG', 'FRA', 1.0), 1.0);
  });

  await t.test('Calculates naval blockade efficiency, burgher drain, and workshop starvation', () => {
    // Fleet power = 40.0, Port infra = 50.0 -> Efficiency = 40 / 50 = 0.80 (80%)
    const blockade = interdiction.registerNavalBlockade({
      blockadingTag: 'ENG',
      targetTag: 'FRA',
      maritimeNodeId: 35, // English Channel
      targetPortLocationId: 3, // Calais
      fleetNavalPower: 40.0,
      portInfrastructureLevel: 50.0
    });

    assert.strictEqual(blockade.blockadeEfficiency, 0.80, 'Blockade efficiency must equal 80%');

    let appliedDevastation = 0;
    let appliedBurgherPenalty = 0;
    let workshopStarved = false;

    interdiction.executeDailyBlockadeTick(
      (locId, delta) => {
        appliedDevastation += delta;
      },
      (locId, penalty) => {
        appliedBurgherPenalty = penalty;
      },
      (locId, isStarved) => {
        workshopStarved = isStarved;
      }
    );

    // Daily Devastation = 0.002 * 0.80 = 0.0016
    assert.ok(appliedDevastation > 0.0015);
    assert.strictEqual(appliedBurgherPenalty, 0.80, 'Burgher wealth generation drops by exact blockade efficiency (80%)');
    assert.strictEqual(workshopStarved, true, 'Downstream raw goods workshops starved at >=70% efficiency');
  });
});

test('Dynastic Personal Union (PU) & Succession Crisis Simulator', async (t) => {
  const dynasty = new DynasticPersonalUnionSimulator();

  await t.test('Resolves Smooth_Heir_Ascension when legitimate heir is living', () => {
    const result = dynasty.evaluateRulerDeath({
      deceasedCountryTag: 'ENG',
      hasLivingHeir: true
    });

    assert.strictEqual(result.outcome, SuccessionOutcome.Smooth_Heir_Ascension);
  });

  await t.test('Triggers Peaceful_Personal_Union when single dominant marriage link exists', () => {
    // England has established royal marriage with Flanders (claim: 85.0, prestige: 90.0)
    dynasty.registerRoyalMarriage({
      seniorTag: 'ENG',
      juniorTag: 'FLA',
      claimStrength: 85.0,
      seniorPrestige: 90.0,
      seniorMilitaryPower: 80.0
    });

    // Duchess of Flanders dies without issue
    const result = dynasty.evaluateRulerDeath({
      deceasedCountryTag: 'FLA',
      hasLivingHeir: false
    });

    assert.strictEqual(result.outcome, SuccessionOutcome.Peaceful_Personal_Union);
    assert.strictEqual(result.seniorClaimantTag, 'ENG');
    assert.ok(result.createdPersonalUnion);
    assert.strictEqual(result.createdPersonalUnion?.foreignPolicyLocked, true);
    assert.strictEqual(result.createdPersonalUnion?.jointLeviesMobilized, true);

    // Verify Flanders mobilizes alongside England
    const mobilizableTags = dynasty.getMobilizableLevyTags('ENG');
    assert.deepStrictEqual(mobilizableTags, ['ENG', 'FLA'], 'Flanders levies must mobilize alongside England');
  });

  await t.test('Triggers Succession_War_Conflict when multiple strong claimants contest vacant throne', () => {
    const contestSimulator = new DynasticPersonalUnionSimulator();

    // England has strong claim on Flanders
    contestSimulator.registerRoyalMarriage({
      seniorTag: 'ENG',
      juniorTag: 'FLA',
      claimStrength: 80.0,
      seniorPrestige: 75.0
    });

    // France also has strong claim on Flanders
    contestSimulator.registerRoyalMarriage({
      seniorTag: 'FRA',
      juniorTag: 'FLA',
      claimStrength: 85.0,
      seniorPrestige: 80.0
    });

    // Ruler of Flanders dies without issue
    const result = contestSimulator.evaluateRulerDeath({
      deceasedCountryTag: 'FLA',
      hasLivingHeir: false
    });

    assert.strictEqual(result.outcome, SuccessionOutcome.Succession_War_Conflict);
    assert.strictEqual(result.casusBelliId, 'cb_succession_war');
    assert.ok((result.seniorClaimantTag === 'FRA' && result.rivalClaimantTag === 'ENG') ||
              (result.seniorClaimantTag === 'ENG' && result.rivalClaimantTag === 'FRA'));
  });

  await t.test('Advances monthly integration progress for loyal Personal Union', () => {
    const integrationProgress = dynasty.processMonthlyIntegrationTick('ENG', 5.0);
    const flandersPU = dynasty.getJuniorPartners('ENG').find(p => p.juniorTag === 'FLA');
    assert.strictEqual(flandersPU?.integrationProgress, 5.0);
  });
});
