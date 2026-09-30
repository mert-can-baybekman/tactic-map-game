import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { HRESubsystem } from '../src/politics/institutions/hre.ts';
import { PapacySubsystem } from '../src/politics/institutions/papacy.ts';
import { CaliphateSubsystem } from '../src/politics/institutions/caliphate.ts';
import { LandTenureEngine, type TimarEstate, type FeudalVassalContract } from '../src/government/land_tenure.ts';
import { MercenaryContractNetwork } from '../src/military/mercenaries.ts';
import { EstateType } from '../src/core/types.ts';
import type { PopEntity } from '../src/demographics/pop.ts';

describe('Imperial Hubs & Global Religious Authority Systems', () => {
  test('HRE Elector vote scoring and Imperial Reform reducing control decay across member nodes', () => {
    const hre = new HRESubsystem('HAB', 60.0);
    hre.memberLocationIds = [10, 11, 12, 13]; // Cologne, Frankfurt, Nuremberg, Vienna

    // 1. Elector vote calculation
    const voteScore = hre.calculateElectorVoteScore('KOL', 80, true);
    // Opinion 45 * 0.5 = 22.5, Prestige 80 * 0.4 = 32.0, Parity true = +30.0 -> Total = 84.5
    assert.strictEqual(voteScore, 84.5);

    // 2. Member locations map with base control decay rate 0.008
    const locationsMap = new Map<number, { controlDecayRate?: number; control: number }>([
      [10, { controlDecayRate: 0.008, control: 0.90 }],
      [11, { controlDecayRate: 0.008, control: 1.0 }],
      [12, { controlDecayRate: 0.008, control: 1.0 }],
      [13, { controlDecayRate: 0.008, control: 0.95 }]
    ]);

    // Enact Reichsreform (costs 50.0 Authority, reduces control decay by 0.003)
    const reformRes = hre.enactReform('reform_reichsreform', locationsMap);
    assert.strictEqual(reformRes.success, true);
    assert.strictEqual(hre.imperialAuthority, 10.0); // 60 - 50 = 10
    assert.strictEqual(Number(locationsMap.get(10)!.controlDecayRate!.toFixed(3)), 0.005); // 0.008 - 0.003 = 0.005
  });

  test('Papacy Curia Controller excommunicates monarch, dropping legitimacy to 0 and escalating Nobility unrest', () => {
    const papacy = new PapacySubsystem('FRA'); // France is Curia Controller

    const targetRealmState = { legitimacy: 85.0, crownPower: 0.70 };
    const englishPops: PopEntity[] = [
      {
        id: 1,
        location_id: 1,
        estate_type: EstateType.Nobility,
        culture_id: 'english',
        religion_id: 'catholic',
        culture_distribution: { english: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 5000,
        wealth: 600.0,
        basic_needs_satisfaction: 0.9,
        luxury_needs_satisfaction: 0.8,
        militancy_unrest: 0.10
      },
      {
        id: 2,
        location_id: 1,
        estate_type: EstateType.Commoners,
        culture_id: 'english',
        religion_id: 'catholic',
        culture_distribution: { english: 1.0 },
        religion_distribution: { catholic: 1.0 },
        size: 25000,
        wealth: 20.0,
        basic_needs_satisfaction: 0.8,
        luxury_needs_satisfaction: 0.3,
        militancy_unrest: 0.05
      }
    ];

    const res = papacy.excommunicateRuler('FRA', 'ENG', targetRealmState, englishPops);
    assert.strictEqual(res.success, true);
    assert.strictEqual(targetRealmState.legitimacy, 0.0);
    assert.strictEqual(targetRealmState.crownPower, 0.0);
    assert.strictEqual(Number(englishPops[0].militancy_unrest.toFixed(2)), 0.45); // 0.10 + 0.35 = 0.45
    assert.strictEqual(englishPops[1].militancy_unrest, 0.05); // Commoners unaffected
    assert.strictEqual(papacy.isExcommunicated('ENG'), true);
  });

  test('Islamic Caliphate Authority unlocks instant Jihad Casus Belli bypassing claim timers', () => {
    const caliphate = new CaliphateSubsystem('MAM');
    assert.ok(caliphate.getCaliphateAuthority() >= 70.0);

    const jihadCB = caliphate.declareJihadCasusBelli('MAM', 'KNI'); // Holy war against Knights of Rhodes
    assert.ok(jihadCB !== null);
    assert.strictEqual(jihadCB?.bypassedClaimTimers, true);
    assert.strictEqual(jihadCB?.holyWarPrestigeBonus, 35.0);
  });
});

describe('Feudal Vassalage & Ottoman Tımar Land Mobilization Engine', () => {
  test('Tımar system diverts local commoner wealth directly into Sipahi cavalry mobilization', () => {
    const engine = new LandTenureEngine();

    const timarSogut: TimarEstate = {
      id: 'timar_sogut_01',
      locationId: 101, // Söğüt
      locationName: 'Söğüt Bithynia',
      assignedSipahiOfficer: 'Gazi Evrenos',
      sipahiLoyalty: 90,
      landTaxAllocationRatio: 0.35, // 35% wealth diverted
      sipahiCavalryPool: 0,
      monthlyWealthSiphoned: 0,
      isActive: true
    };
    engine.registerTimar(timarSogut);

    const pops: PopEntity[] = [
      {
        id: 1011,
        location_id: 101,
        estate_type: EstateType.Commoners,
        culture_id: 'turkish',
        religion_id: 'sunni',
        culture_distribution: { turkish: 1.0 },
        religion_distribution: { sunni: 1.0 },
        size: 20000,
        wealth: 200.0,
        basic_needs_satisfaction: 0.8,
        luxury_needs_satisfaction: 0.4,
        militancy_unrest: 0.05
      }
    ];

    // Process monthly production pass
    const result = engine.processTimarMonthlyProduction(pops, 0.05);
    assert.ok(result.totalWealthDiverted > 0);
    assert.ok(timarSogut.sipahiCavalryPool > 0);
    assert.strictEqual(timarSogut.sipahiCavalryPool, 1330);
  });

  test('Feudal vassal summons forces faithful vassals to deploy or issues Treason Casus Belli on refusal', () => {
    const engine = new LandTenureEngine();

    const loyalVassal: FeudalVassalContract = {
      vassalTag: 'FLA',
      vassalName: 'County of Flanders',
      liegeTag: 'FRA',
      liegeFealty: 75, // Loyal
      scutageTaxFlow: 25.0,
      mobilizedLevySize: 3500,
      isDeployedToLiegeArmy: false,
      hasCommittedTreason: false
    };

    const disloyalVassal: FeudalVassalContract = {
      vassalTag: 'BRI',
      vassalName: 'Duchy of Brittany',
      liegeTag: 'FRA',
      liegeFealty: 30, // Disloyal (< 50)
      scutageTaxFlow: 20.0,
      mobilizedLevySize: 4000,
      isDeployedToLiegeArmy: false,
      hasCommittedTreason: false
    };

    engine.registerVassal(loyalVassal);
    engine.registerVassal(disloyalVassal);

    // Liege enters war
    const callToArms = engine.evaluateFeudalObligationTick('FRA', true);
    assert.ok(callToArms.deployedVassals.includes('FLA'));
    assert.strictEqual(loyalVassal.isDeployedToLiegeArmy, true);

    // Disloyal vassal commits treason
    assert.strictEqual(disloyalVassal.hasCommittedTreason, true);
    assert.strictEqual(callToArms.treasonCasusBelliList.length, 1);
    assert.strictEqual(callToArms.treasonCasusBelliList[0].vassalTag, 'BRI');
  });
});

describe('Mediterranean Condottieri & Corsair Privateer Contract Network', () => {
  test('Condottieri mutinies into hostile rebel faction upon 2 consecutive unpaid deficit months', () => {
    const network = new MercenaryContractNetwork();

    // Hire White Company for Venice (costs 45 ducats/month)
    const hired = network.hireCondottieri('white_company', 'VEN', 20);
    assert.strictEqual(hired, true);

    const company = network.getCompany('white_company')!;
    const veniceTreasury = { crownTreasury: 10.0 }; // Deficit! Cannot afford 45 ducats

    let mutinyOccurred = false;
    let rebelFactionGenerated: any = null;

    // Month 1 Unpaid
    network.processMonthlyRetainerTick('VEN', veniceTreasury, (f) => {
      mutinyOccurred = true;
      rebelFactionGenerated = f;
    });
    assert.strictEqual(company.consecutiveUnpaidMonths, 1);
    assert.strictEqual(company.isContractActive, true);
    assert.strictEqual(mutinyOccurred, false);

    // Month 2 Unpaid -> MUTINY!
    network.processMonthlyRetainerTick('VEN', veniceTreasury, (f) => {
      mutinyOccurred = true;
      rebelFactionGenerated = f;
    });
    assert.strictEqual(company.isContractActive, false);
    assert.strictEqual(mutinyOccurred, true);
    assert.ok(rebelFactionGenerated);
    assert.strictEqual(rebelFactionGenerated.factionId, 'rebel_condottieri_white_company');
    assert.strictEqual(rebelFactionGenerated.spawnedArmyStacks[0].size, 3500);
  });

  test('Corsair fleet raids trade edge under Letter of Marque, skims gold, and inflicts port devastation without war', () => {
    const network = new MercenaryContractNetwork();

    // Issue Letter of Marque to Barbary Corsairs targeting Gibraltar (ID 34)
    network.issueLetterOfMarque('barbary_corsairs', 'GRA', 34);

    const gibraltarPort = { id: 34, name: 'Gibraltar', devastation: 0.05 };
    const granadaTreasury = { crownTreasury: 100.0 };
    const tradeVolume = 50.0; // 50 ducats moving through strait

    const raids = network.executeCorsairPrivateeringTick(gibraltarPort, tradeVolume, granadaTreasury);
    assert.strictEqual(raids.length, 1);
    // Skims 40% of 50 = 20 gold
    assert.strictEqual(raids[0].goldSkimmed, 20.0);
    assert.strictEqual(granadaTreasury.crownTreasury, 120.0);
    // Inflicts +0.15 devastation on port
    assert.strictEqual(Number(gibraltarPort.devastation.toFixed(2)), 0.20);
  });
});
