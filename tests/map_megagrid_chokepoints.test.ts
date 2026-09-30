import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MapGraphRouter, type StraitChokePoint } from '../src/map/chokepoints.ts';

describe('Ottoman, Balkan & European Megagrid Data Schema', () => {
  test('Ingests near_east.json and validates core parameters for Constantinople, Bursa, and Söğüt', () => {
    const nearEastPath = path.resolve('data/mods/vanilla/map/near_east.json');
    assert.ok(fs.existsSync(nearEastPath), 'near_east.json must exist');

    const content = JSON.parse(fs.readFileSync(nearEastPath, 'utf8'));
    assert.strictEqual(content.region_id, 'near_east');
    assert.ok(content.locations.length >= 15);

    // 1. Söğüt (ID 101)
    const sogut = content.locations.find((l: any) => l.id === 101);
    assert.ok(sogut);
    assert.strictEqual(sogut.name, 'Söğüt');
    assert.strictEqual(sogut.country, 'TUR');
    assert.strictEqual(sogut.primary_culture, 'turkish');
    assert.strictEqual(sogut.primary_religion, 'sunni');
    assert.strictEqual(sogut.control, 1.0);

    // 2. Bursa (ID 102)
    const bursa = content.locations.find((l: any) => l.id === 102);
    assert.ok(bursa);
    assert.strictEqual(bursa.name, 'Bursa');
    assert.strictEqual(bursa.country, 'TUR');
    assert.strictEqual(bursa.control, 0.95);
    assert.ok(bursa.is_port);

    // 3. Constantinople (ID 104)
    const constantinople = content.locations.find((l: any) => l.id === 104);
    assert.ok(constantinople);
    assert.strictEqual(constantinople.name, 'Constantinople');
    assert.strictEqual(constantinople.country, 'BYZ');
    assert.strictEqual(constantinople.primary_culture, 'greek');
    assert.strictEqual(constantinople.primary_religion, 'orthodox');
    assert.strictEqual(constantinople.control, 0.85);
    assert.strictEqual(constantinople.has_fort, true);
    assert.strictEqual(constantinople.fort_level, 3);
    assert.strictEqual(constantinople.strait_chokepoint_ref, 'bosphorus_strait');
  });

  test('Ingests europe.json and validates Venice, Genoa, Rome, and Gibraltar', () => {
    const europePath = path.resolve('data/mods/vanilla/map/europe.json');
    assert.ok(fs.existsSync(europePath), 'europe.json must exist');

    const content = JSON.parse(fs.readFileSync(europePath, 'utf8'));
    assert.strictEqual(content.region_id, 'europe');
    assert.ok(content.locations.length >= 20);

    const venice = content.locations.find((l: any) => l.id === 20);
    assert.ok(venice);
    assert.strictEqual(venice.name, 'Venice');
    assert.strictEqual(venice.country, 'VEN');
    assert.strictEqual(venice.is_market_hub, true);

    const gibraltar = content.locations.find((l: any) => l.id === 34);
    assert.ok(gibraltar);
    assert.strictEqual(gibraltar.strait_chokepoint_ref, 'gibraltar_strait');
  });
});

describe('Geopolitical Choke-Points & Strait Navigation Engine', () => {
  test('Bosphorus blockade drops cross-strait connectivity to 0% and diverts military path to land detour', () => {
    const router = new MapGraphRouter();

    // 1. Unblockaded state: Direct passage across the strait
    const routeOpen = router.findMilitaryRoute(104, 101); // Constantinople to Söğüt
    assert.strictEqual(routeOpen.isContinuous, true);
    assert.strictEqual(routeOpen.blockadeDetourTriggered, false);

    // 2. Hostile fleet blockades Bosphorus
    router.setStraitBlockade('bosphorus_strait', true, 'GEN');
    const bosphorus = router.getChokepoint('bosphorus_strait');
    assert.strictEqual(bosphorus?.isBlockaded, true);
    assert.strictEqual(bosphorus?.blockadeManpowerConnectivityFactor, 0.0);

    // 3. Army path re-evaluated: Detour is triggered (+120 days around Black Sea)
    const routeBlockaded = router.findMilitaryRoute(104, 101);
    assert.strictEqual(routeBlockaded.blockadeDetourTriggered, true);
    assert.ok(routeBlockaded.totalTravelDays > 100);
    assert.ok(routeBlockaded.chokepointsEncountered.includes('bosphorus_strait'));
  });

  test('Global Map Routing traces continental corridor from London (1) via Gibraltar (34) to Söğüt (101)', () => {
    const router = new MapGraphRouter();

    // Route from London (1) to Söğüt (101)
    const macroRoute = router.findMilitaryRoute(1, 101);
    assert.strictEqual(macroRoute.isContinuous, true);
    assert.strictEqual(macroRoute.sourceId, 1);
    assert.strictEqual(macroRoute.targetId, 101);

    // Validates route steps pass through Dover (2), Gibraltar (34), Venice (20), and Constantinople (104)
    assert.ok(macroRoute.pathNodes.includes(1));
    assert.ok(macroRoute.pathNodes.includes(2));
    assert.ok(macroRoute.pathNodes.includes(34));
    assert.ok(macroRoute.pathNodes.includes(20));
    assert.ok(macroRoute.pathNodes.includes(104));
    assert.ok(macroRoute.pathNodes.includes(101));
  });
});
