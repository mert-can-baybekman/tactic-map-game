import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

import { IntercontinentalTradeEngine, ChokepointTier } from '../src/economy/chokepoints.ts';
import { MapViewportProjector, LevelOfDetail } from '../src/graphics/viewport_projection.ts';

test('Grand Eurasian & North African World Grid Expansion Suite', async (t) => {

  await t.test('1. Validates Pontic Steppe, Caucasus & Eastern European Grid Ingestion', () => {
    const filePath = path.join(process.cwd(), 'src/map/regions/pontic_east_europe.json');
    assert.ok(fs.existsSync(filePath), 'pontic_east_europe.json must exist');

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(data.dataset, 'pontic_caucasus_east_europe_grid');
    assert.ok(Array.isArray(data.locations));
    assert.ok(data.locations.length >= 15);

    // Validate Caffa (Genoese Black Sea Headquarters)
    const caffa = data.locations.find((l: any) => l.location_id === 501);
    assert.ok(caffa, 'Caffa must be indexed with ID 501');
    assert.strictEqual(caffa.historical_owner_tag, 'GEN');
    assert.strictEqual(caffa.culture, 'Ligurian');
    assert.strictEqual(caffa.is_market_hub, true);
    assert.strictEqual(caffa.primary_rgo, 'silk');

    // Validate Tbilisi & Caucasus mountain shield
    const tbilisi = data.locations.find((l: any) => l.location_id === 510);
    assert.ok(tbilisi, 'Tbilisi must be indexed with ID 510');
    assert.strictEqual(tbilisi.historical_owner_tag, 'GEO');
    assert.strictEqual(tbilisi.terrain, 'Mountain_Valley');

    // Validate Novgorod & Moscow
    const novgorod = data.locations.find((l: any) => l.location_id === 524);
    const moscow = data.locations.find((l: any) => l.location_id === 523);
    assert.ok(novgorod && moscow, 'Novgorod and Moscow must be indexed');
    assert.strictEqual(novgorod.historical_owner_tag, 'NOV');
    assert.strictEqual(moscow.historical_owner_tag, 'MOS');
  });

  await t.test('2. Validates Iranian Plateau, Persian Gulf & Red Sea Grid Ingestion', () => {
    const filePath = path.join(process.cwd(), 'src/map/regions/persia_red_sea.json');
    assert.ok(fs.existsSync(filePath), 'persia_red_sea.json must exist');

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(data.dataset, 'persia_gulf_red_sea_grid');
    assert.ok(data.locations.length >= 13);

    // Validate Tabriz (Jalayirid Silk Metropolis)
    const tabriz = data.locations.find((l: any) => l.location_id === 601);
    assert.ok(tabriz, 'Tabriz must be indexed with ID 601');
    assert.strictEqual(tabriz.historical_owner_tag, 'JAL');
    assert.strictEqual(tabriz.primary_rgo, 'silk');
    assert.ok(tabriz.total_population >= 90000);

    // Validate Hormuz (The Persian Gulf Gate)
    const hormuz = data.locations.find((l: any) => l.location_id === 606);
    assert.ok(hormuz, 'Hormuz must be indexed with ID 606');
    assert.strictEqual(hormuz.historical_owner_tag, 'HOR');
    assert.strictEqual(hormuz.is_coastal, true);

    // Validate Mecca & Medina
    const mecca = data.locations.find((l: any) => l.location_id === 610);
    const medina = data.locations.find((l: any) => l.location_id === 611);
    assert.ok(mecca && medina, 'Mecca and Medina must be indexed');
    assert.strictEqual(mecca.historical_owner_tag, 'HJZ');
    assert.strictEqual(mecca.religion, 'Sunni');
    assert.strictEqual(mecca.primary_rgo, 'incense');

    // Validate Aden
    const aden = data.locations.find((l: any) => l.location_id === 614);
    assert.ok(aden, 'Aden must be indexed with ID 614');
    assert.strictEqual(aden.historical_owner_tag, 'ADE');
    assert.strictEqual(aden.primary_rgo, 'spices');
  });

  await t.test('3. Validates Southern Mediterranean, Nile Delta & North Africa Grid Ingestion', () => {
    const filePath = path.join(process.cwd(), 'src/map/regions/north_africa.json');
    assert.ok(fs.existsSync(filePath), 'north_africa.json must exist');

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(data.dataset, 'north_africa_maghreb_nile_grid');
    assert.ok(data.locations.length >= 14);

    // Validate Cairo & Alexandria
    const cairo = data.locations.find((l: any) => l.location_id === 702);
    const alexandria = data.locations.find((l: any) => l.location_id === 701);
    assert.ok(cairo && alexandria, 'Cairo and Alexandria must be indexed');
    assert.strictEqual(cairo.historical_owner_tag, 'MAM');
    assert.strictEqual(alexandria.historical_owner_tag, 'MAM');
    assert.ok(cairo.total_population >= 200000, 'Cairo is a late-medieval megacity');

    // Validate Maghreb hubs: Tunis, Algiers, Fez, Ceuta, Tangier
    const tunis = data.locations.find((l: any) => l.location_id === 711);
    const fez = data.locations.find((l: any) => l.location_id === 716);
    const ceuta = data.locations.find((l: any) => l.location_id === 715);
    assert.strictEqual(tunis.historical_owner_tag, 'HAF');
    assert.strictEqual(fez.historical_owner_tag, 'MAR');
    assert.strictEqual(ceuta.historical_owner_tag, 'MAR');
  });

  await t.test('4. Validates Core Deliverable: persia_egypt_core.json Anchors', () => {
    const filePath = path.join(process.cwd(), 'data/mods/vanilla/map/provinces/persia_egypt_core.json');
    assert.ok(fs.existsSync(filePath), 'persia_egypt_core.json must exist');

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const anchors = data.anchor_locations;
    assert.strictEqual(anchors.length, 4);

    const names = anchors.map((a: any) => a.name);
    assert.ok(names.some((n: string) => n.includes('Tabriz')));
    assert.ok(names.some((n: string) => n.includes('Cairo')));
    assert.ok(names.some((n: string) => n.includes('Mecca')));
    assert.ok(names.some((n: string) => n.includes('Caffa')));

    for (const anchor of anchors) {
      assert.ok(anchor.location_id > 0);
      assert.ok(anchor.total_population > 0);
      assert.ok(anchor.pop_breakdown.nobles > 0);
      assert.ok(anchor.pop_breakdown.burghers > 0);
      assert.ok(anchor.culture.length > 0);
      assert.ok(anchor.religion.length > 0);
      assert.ok(anchor.historical_owner_tag.length === 3);
      assert.ok(anchor.annual_material_output > 0);
    }
  });

  await t.test('5. Intercontinental Trade Integration & Choke-Point Routing Pass', () => {
    const engine = new IntercontinentalTradeEngine();

    // Verify all 6 strategic bottlenecks exist
    const allChokepoints = engine.getAllChokepoints();
    assert.strictEqual(allChokepoints.length, 6);

    const hormuz = engine.getChokepoint('choke_hormuz');
    const bab = engine.getChokepoint('choke_babelmandeb');
    const kerch = engine.getChokepoint('choke_kerch');
    const bosphorus = engine.getChokepoint('choke_bosphorus');
    const gibraltar = engine.getChokepoint('choke_gibraltar');
    const channel = engine.getChokepoint('choke_channel');

    assert.ok(hormuz && bab && kerch && bosphorus && gibraltar && channel);
    assert.strictEqual(hormuz.tier, ChokepointTier.GLOBAL_MARITIME_GATE);
    assert.strictEqual(bab.controllingTag, 'ADE');

    // Test Continental Silk Caravan: Tabriz (601) -> Constantinople (104)
    const caravanResult = engine.routeContinentalSilkCaravan(100.0, 16.0);
    assert.strictEqual(caravanResult.success, true);
    assert.deepStrictEqual(caravanResult.pathLocationIds, [601, 108, 107, 102, 104]);
    assert.ok(caravanResult.finalDeliveredUnitCost > 16.0, 'Transit costs increment unit price');
    assert.ok(caravanResult.packet.transitDays >= 40, 'Caravan route requires overland transit days');

    // Test Intercontinental Route: Tabriz (601) -> London (1)
    const globalResult = engine.routeIntercontinentalTabrizToLondon(100.0, 18.0);
    assert.strictEqual(globalResult.success, true);
    assert.strictEqual(globalResult.pathLocationIds[0], 601, 'Origin is Tabriz');
    assert.strictEqual(globalResult.pathLocationIds[globalResult.pathLocationIds.length - 1], 1, 'Destination is London');
    assert.ok(globalResult.finalDeliveredUnitCost > globalResult.packet.baseUnitValue);
    assert.ok(globalResult.marketClearingPrice > globalResult.finalDeliveredUnitCost);
    assert.ok(globalResult.packet.chokepointsCrossed.includes('choke_bosphorus'));
    assert.ok(globalResult.packet.chokepointsCrossed.includes('choke_gibraltar'));
    assert.ok(globalResult.packet.chokepointsCrossed.includes('choke_channel'));

    // Test Blockade Detour: Blockade Gibraltar
    engine.setBlockadeState('choke_gibraltar', true, 0.95);
    const blockadedResult = engine.routeIntercontinentalTabrizToLondon(100.0, 18.0);
    assert.strictEqual(blockadedResult.packet.isDivertedOverland, true, 'Blockaded Gibraltar triggers overland detour');
    assert.ok(blockadedResult.finalDeliveredUnitCost > globalResult.finalDeliveredUnitCost, 'Detour compounds transport cost');

    // Test Red Sea Axis: Hormuz to Alexandria
    const spiceResult = engine.routeRedSeaSpicesToAlexandria(80.0, 24.0);
    assert.strictEqual(spiceResult.success, true);
    assert.strictEqual(spiceResult.pathLocationIds[0], 606); // Hormuz
    assert.strictEqual(spiceResult.pathLocationIds[spiceResult.pathLocationIds.length - 1], 701); // Alexandria
    assert.ok(spiceResult.packet.chokepointsCrossed.includes('choke_hormuz'));
    assert.ok(spiceResult.packet.chokepointsCrossed.includes('choke_babelmandeb'));
  });

  await t.test('6. Viewport Projection & Camera Bounding Box Scale Pass', () => {
    const projector = new MapViewportProjector(1600, 900);

    // Verify geographical limits encompass London to Tabriz and Baltic to Aden
    assert.strictEqual(projector.bounds.minLon, -12.0, 'Atlantic western boundary');
    assert.strictEqual(projector.bounds.maxLon, 62.0, 'Eastern Persian boundary');
    assert.strictEqual(projector.bounds.minLat, 10.0, 'Southern Horn of Africa / Aden boundary');
    assert.strictEqual(projector.bounds.maxLat, 62.0, 'Northern Baltic / Novgorod boundary');

    // Test London (lon: -0.12, lat: 51.50)
    const londonCanvas = projector.geoToCanvas({ longitude: -0.12, latitude: 51.50 });
    assert.ok(londonCanvas.x >= 0 && londonCanvas.x <= 1600, 'London fits within canvas width');
    assert.ok(londonCanvas.y >= 0 && londonCanvas.y <= 900, 'London fits within canvas height');

    // Test Tabriz (lon: 46.29, lat: 38.08)
    const tabrizCanvas = projector.geoToCanvas({ longitude: 46.29, latitude: 38.08 });
    assert.ok(tabrizCanvas.x >= 0 && tabrizCanvas.x <= 1600, 'Tabriz fits within canvas width');
    assert.ok(tabrizCanvas.y >= 0 && tabrizCanvas.y <= 900, 'Tabriz fits within canvas height');

    // Test Aden (lon: 45.03, lat: 12.78)
    const adenCanvas = projector.geoToCanvas({ longitude: 45.03, latitude: 12.78 });
    assert.ok(adenCanvas.x >= 0 && adenCanvas.x <= 1600, 'Aden fits within canvas width');
    assert.ok(adenCanvas.y >= 0 && adenCanvas.y <= 900, 'Aden fits within canvas height');

    // Validate reverse projection fidelity (roundtrip within 0.01 degree)
    const roundtrip = projector.canvasToGeo(tabrizCanvas);
    assert.ok(Math.abs(roundtrip.longitude - 46.29) < 0.05);
    assert.ok(Math.abs(roundtrip.latitude - 38.08) < 0.05);

    // Validate LOD Transitions
    projector.zoomLevel = 1.0;
    assert.strictEqual(projector.getActiveLod(), LevelOfDetail.MacroContinental);

    projector.zoomLevel = 2.5;
    assert.strictEqual(projector.getActiveLod(), LevelOfDetail.RegionalTheater);

    projector.zoomLevel = 5.0;
    assert.strictEqual(projector.getActiveLod(), LevelOfDetail.TacticalLocation);

    // Validate Camera Clamping
    projector.cameraCenter.longitude = 120.0; // Extreme out of bounds
    projector.zoomLevel = 15.0; // Extreme zoom
    projector.clampCamera();
    assert.strictEqual(projector.cameraCenter.longitude, 62.0, 'Clamped to max longitude');
    assert.strictEqual(projector.zoomLevel, 8.0, 'Clamped to max zoom');
  });

});
