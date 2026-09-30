import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { Scenario1350Initializer } from '../src/scenario/setup_1350.ts';
import { CasusBelliEngine } from '../src/politics/diplomacy/cb.ts';
import { FortSubsystem, type FortBuilding } from '../src/military/forts.ts';

describe('1350 Historical Scenario Initializer ("Project Caesar" Parity)', () => {
  test('Initializes historical world state in April 1350 with Orhan Gazi, Hundred Years War, and Plague Vectors', () => {
    const scenario = Scenario1350Initializer.create1350CampaignState();

    // 1. Calendar
    assert.strictEqual(scenario.calendar.dateString, '1350-04-01');

    // 2. Ottoman-Byzantine Frontier
    const ott = scenario.countries.OTT;
    assert.ok(ott);
    assert.strictEqual(ott.ruler.name, 'Orhan Gazi');
    assert.strictEqual(ott.ruler.dynasty, 'Osmanoglu');
    assert.strictEqual(ott.ruler.traits.includes('ghazi_conqueror'), true);
    assert.strictEqual(ott.capitalLocationId, 101); // Söğüt
    assert.ok(ott.ownedLocationIds.includes(102)); // Bursa

    // Permanent claim on Constantinople (104)
    const constantinopleClaim = scenario.permanentClaims.find(
      c => c.claimantTag === 'OTT' && c.targetLocationId === 104
    );
    assert.ok(constantinopleClaim);
    assert.strictEqual(constantinopleClaim.claimType, 'PERMANENT');

    // 3. Hundred Years' War state machine
    const hyw = scenario.activeWars.find(w => w.warId === 'war_hundred_years');
    assert.ok(hyw);
    assert.strictEqual(hyw.attackers.includes('ENG'), true);
    assert.strictEqual(hyw.defenders.includes('FRA'), true);
    assert.strictEqual(hyw.tradeEmbargoActive, true);

    // 4. Black Death Deployment
    const genoaSeed = scenario.plagueSeedLocations.find(s => s.locationId === 21);
    const sicilySeed = scenario.plagueSeedLocations.find(s => s.locationId === 54);
    assert.ok(genoaSeed);
    assert.ok(sicilySeed);
    assert.ok(genoaSeed.initialVirulence >= 0.80);
  });
});

describe('Dynamic Claim Generation & Casus Belli Justification Engine', () => {
  test('Espionage claim fabrication loop progresses and unlocks trade-locking Casus Belli', () => {
    const engine = new CasusBelliEngine();

    // Start fabrication: London diplomat fabricating claim on Rouen (ID 4)
    const just = engine.startClaimFabrication(
      'ENG',
      'FRA',
      4,
      'Rouen',
      'agent_spymaster_walsingham',
      80, // High intrigue
      0.20, // 20% French counter-espionage
      25.0  // Fast test base speed
    );

    assert.strictEqual(just.isCompleted, false);

    // Process monthly ticks until 100%
    let unlocked: any[] = [];
    while (!just.isCompleted) {
      const cbs = engine.processMonthlyJustificationTick('1350-05-01');
      if (cbs.length > 0) unlocked = cbs;
    }

    assert.strictEqual(just.isCompleted, true);
    assert.strictEqual(unlocked.length, 1);
    assert.strictEqual(unlocked[0].type, 'Conquest');
    assert.strictEqual(unlocked[0].targetLocationId, 4);

    // Verify created territorial claim
    const claims = engine.getClaimsForCountry('ENG');
    assert.strictEqual(claims.length, 1);
    assert.strictEqual(claims[0].targetLocationName, 'Rouen');
    assert.strictEqual(claims[0].claimType, 'Fabricated');

    // Declare war using Conquest CB and verify bilateral trade lock
    const warResult = engine.declareWar(unlocked[0], '1350-05-01', [1, 5]); // London and Paris hubs
    assert.strictEqual(warResult.tradeActionsLocked, true);
    assert.strictEqual(warResult.attackerTag, 'ENG');
    assert.strictEqual(warResult.defenderTag, 'FRA');
    assert.deepStrictEqual(warResult.blockadedMarketHubs, [1, 5]);
  });
});

describe('Fort Zone of Control (ZoC) & Siege Interception Matrix', () => {
  test('Projects ZoC over adjacent nodes, blocks enemy bypass, and resolves monthly siege breach matrix', () => {
    const fortSubsystem = new FortSubsystem();

    // Register Theodosian Walls in Constantinople (ID 104)
    const constantinopleFort: FortBuilding = {
      id: 'fort_theodosian_walls',
      locationId: 104,
      locationName: 'Constantinople',
      countryTag: 'BYZ',
      fortLevel: 3,
      defensiveInfrastructureLevel: 3.0,
      garrisonSize: 3000,
      maxGarrisonSize: 3000,
      isOperational: true,
      isUnderSiege: false,
      zocProtectedLocationIds: []
    };
    fortSubsystem.registerFort(constantinopleFort);

    // Define adjacency topology: Constantinople (104) connects to Gallipoli (105) and Adrianople (110)
    const adjacencies = new Map<number, number[]>([
      [104, [105, 110]],
      [105, [104, 110]],
      [110, [104, 105]]
    ]);

    const ownership = new Map<number, string>([
      [104, 'BYZ'],
      [105, 'BYZ'],
      [110, 'BYZ']
    ]);

    // 1. Calculate Zone of Control
    fortSubsystem.calculateZoneOfControl(adjacencies, ownership);
    assert.ok(constantinopleFort.zocProtectedLocationIds.includes(104));
    assert.ok(constantinopleFort.zocProtectedLocationIds.includes(105));
    assert.ok(constantinopleFort.zocProtectedLocationIds.includes(110));

    // 2. ZoC Interception Check:
    // Ottoman army attempts to march from Gallipoli (105) directly to Adrianople (110), bypassing Constantinople!
    const movementCheck = fortSubsystem.isMovementBlockedByZoC(105, 110, 'OTT');
    assert.strictEqual(movementCheck.isBlocked, true, 'Army cannot bypass operational fort between two ZoC nodes');
    assert.strictEqual(movementCheck.blockingFortLocationId, 104);

    // Ottoman army moves INTO fort node to besiege it (permitted)
    const enterCheck = fortSubsystem.isMovementBlockedByZoC(105, 104, 'OTT');
    assert.strictEqual(enterCheck.isBlocked, false, 'Movement directly into fort node to besiege is allowed');

    // 3. Initiate Siege
    const siege = fortSubsystem.initiateSiege(104, 'army_ottoman_ghazis', 'OTT', 5, 2); // 5 Bombards, +2 Siege leader
    assert.strictEqual(siege.fortLocationId, 104);
    assert.strictEqual(constantinopleFort.isUnderSiege, true);

    const locationData = { id: 104, devastation: 0.10, country: 'BYZ' };

    // Run monthly siege ticks until fort surrenders
    let surrenderTick: any = null;
    for (let m = 0; m < 10; m++) {
      const res = fortSubsystem.executeMonthlySiegeTick(104, locationData);
      if (res.fortSurrendered) {
        surrenderTick = res;
        break;
      }
    }

    assert.ok(surrenderTick !== null, 'Fort should surrender after siege breaches');
    assert.strictEqual(surrenderTick.fortSurrendered, true);
    assert.strictEqual(surrenderTick.newControllerTag, 'OTT');
    assert.strictEqual(locationData.country, 'OTT');
    assert.ok(locationData.devastation >= 0.40, 'Breach generates massive devastation');
    assert.strictEqual(constantinopleFort.isOperational, false);
    assert.strictEqual(constantinopleFort.zocProtectedLocationIds.length, 0, 'ZoC projection collapses upon surrender');
  });
});
