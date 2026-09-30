import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { GISProjectionPipeline } from '../src/graphics/map_render/gis_pipeline.ts';
import { SpatialCameraController } from '../src/graphics/map_render/camera.ts';
import { TerrainShaderPipeline } from '../src/graphics/map_render/terrain_shader.ts';
import { UIMapNavigationCore } from '../src/ui/navigation.ts';

describe('GIS Geography & Topography Projection Pipeline', () => {
  test('Projects historical coordinates and links physical terrain variables', () => {
    const gis = new GISProjectionPipeline();

    // 1. London Projection & Terrain
    const london = gis.getNode(1);
    assert.ok(london);
    assert.strictEqual(london.name, 'London');
    assert.strictEqual(london.countryTag, 'ENG');
    assert.strictEqual(london.terrain.biome, 'Farmland');
    assert.strictEqual(london.terrain.riverProximity, true);
    assert.strictEqual(london.terrain.adjacentRiverName, 'River Thames');
    assert.ok(london.screenPos[0] > 200 && london.screenPos[0] < 400);

    // 2. Bursa Projection & Terrain
    const bursa = gis.getNode(102);
    assert.ok(bursa);
    assert.strictEqual(bursa.name, 'Bursa');
    assert.strictEqual(bursa.countryTag, 'TUR');
    assert.strictEqual(bursa.terrain.biome, 'Hills');
    assert.strictEqual(bursa.terrain.riverProximity, true);
    assert.ok(bursa.screenPos[0] > 1200); // Eastern theater

    // 3. Constantinople Choke Node
    const constantinople = gis.getNode(104);
    assert.ok(constantinople);
    assert.strictEqual(constantinople.terrain.adjacentRiverName, 'Golden Horn / Bosphorus');

    // 4. Inverse unproject round-trip verification
    const roundTrip = gis.unproject(london.screenPos[0], london.screenPos[1]);
    assert.ok(Math.abs(roundTrip.longitude - london.geoCoord.longitude) < 0.2);
    assert.ok(Math.abs(roundTrip.latitude - london.geoCoord.latitude) < 0.2);
  });
});

describe('Spatial Viewport Navigation Core & LOD Culling', () => {
  test('Camera clamps zoom limits and updates LOD level transitions', () => {
    const camera = new SpatialCameraController(1600, 900);

    // Baseline LOD: MACRO (1.0x)
    assert.strictEqual(camera.getState().lodLevel, 'MACRO');
    assert.strictEqual(camera.shouldRenderGranularLabel(false), false); // Subtitles hidden
    assert.strictEqual(camera.shouldRenderGranularLabel(true), true);   // Capital titles always shown

    // Zoom in to Regional: 1.8x
    camera.setZoom(1.8);
    assert.strictEqual(camera.getState().lodLevel, 'REGIONAL');
    assert.strictEqual(camera.shouldRenderGranularLabel(false), true);
    assert.strictEqual(camera.shouldRenderMicroInfrastructure(), false);

    // Zoom in to Tactical: 3.0x
    camera.setZoom(3.0);
    assert.strictEqual(camera.getState().lodLevel, 'TACTICAL');
    assert.strictEqual(camera.shouldRenderMicroInfrastructure(), true);

    // Focus on Node centers target in viewport
    camera.focusOnNode(1320, 510, 2.5); // Focus Bursa
    assert.strictEqual(camera.getState().targetZoom, 2.5);
    // Center calculation: (1600/2) - 1320 * 2.5 = 800 - 3300 = -2500
    assert.strictEqual(camera.getState().targetOffsetX, -2500);
  });

  test('UI Navigation Core dispatches camera callbacks and processes gestures', () => {
    const nav = new UIMapNavigationCore(1600, 900);
    let capturedTransform = '';
    let capturedLod = '';

    nav.registerOnCameraChange((transform, lod) => {
      capturedTransform = transform;
      capturedLod = lod;
    });

    nav.zoomIn();
    assert.ok(capturedTransform.includes('scale'));
    assert.ok(capturedLod.length > 0);

    nav.resetView();
    assert.ok(capturedTransform.includes('scale(1.000)'));
  });

  test('Terrain Shader Pipeline manages uniforms and hillshade parameters', () => {
    const shader = new TerrainShaderPipeline();
    const uniforms = shader.getUniforms();
    assert.strictEqual(uniforms.u_political_alpha, 0.35);
    assert.ok(uniforms.u_sun_azimuth > 5.0); // ~315 deg in radians

    shader.updateUniforms({ u_zoom_level: 2.5, u_lod_factor: 1.0 });
    assert.strictEqual(shader.getUniforms().u_zoom_level, 2.5);
    assert.strictEqual(shader.getUniforms().u_lod_factor, 1.0);
  });
});
