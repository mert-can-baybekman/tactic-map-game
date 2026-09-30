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

  test('UI Map Nodes & Lower HUD Telemetry conditional switch parity for London and Bursa', () => {
    const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');
    
    // Verify Viewport was scaled from local 900x550 to multi-regional 1600x900 or expanded 2000x1100
    assert.ok(htmlContent.includes('viewBox="0 0 1600 900"') || htmlContent.includes('viewBox="0 0 2000 1100"'), 'Viewport must scale to 1600x900 or 2000x1100');

    // Verify all nodes are instantiated in SVG DOM
    assert.ok(htmlContent.includes('id="node-1"'), 'Node 1 (London) must exist');
    assert.ok(htmlContent.includes('id="node-20"'), 'Node 20 (Venice) must exist');
    assert.ok(htmlContent.includes('id="node-23"'), 'Node 23 (Rome) must exist');
    assert.ok(htmlContent.includes('id="node-110"'), 'Node 110 (Adrianople) must exist');
    assert.ok(htmlContent.includes('id="node-104"'), 'Node 104 (Constantinople) must exist');
    assert.ok(htmlContent.includes('id="node-102"'), 'Node 102 (Bursa) must exist');
    assert.ok(htmlContent.includes('id="node-101"'), 'Node 101 (Söğüt) must exist');

    // Verify Visual Lines: Bosphorus, Rumelia Corridor, Gibraltar Loop
    assert.ok(htmlContent.includes('id="bosphorus-strait-line"'), 'Bosphorus line must exist');
    assert.ok(htmlContent.includes('class="line-bosphorus-strait"'), 'Bosphorus line must have proper class');
    assert.ok(htmlContent.includes('class="line-land-route line-rumelia-corridor"'), 'Rumelia corridor must exist');
    assert.ok(htmlContent.includes('id="gibraltar-maritime-loop"'), 'Gibraltar loop must exist');

    // Verify app.js footer formatting logic
    const appJsContent = fs.readFileSync(path.resolve('app.js'), 'utf8');
    assert.ok(appJsContent.includes('Bursa (Hills)'), 'Must format Bursa (Hills)');
    assert.ok(appJsContent.includes('Control: 95.0% • Devastation: 0.0% • Pops: 24,000 • Dominance: Nobility/Sipahis'), 'Must format exact Bursa stats');
    assert.ok(appJsContent.includes('London (Farmland)'), 'Must format London (Farmland)');
  });
});

