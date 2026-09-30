import test from 'node:test';
import assert from 'node:assert';
import { DynamicBorderPipeline } from '../src/graphics/map_render/border_shader.ts';
import { ClimateEngine } from '../src/map/climate.ts';
import { FogOfWarEngine, VisionState } from '../src/graphics/map_render/fow_engine.ts';
import { GlobalSpatialMapEngine } from '../src/map/spatial.ts';

test('Micro-Province Dynamic Boundary Shader & Tessellation Pipeline', async (t) => {
  const pipeline = new DynamicBorderPipeline();

  await t.test('Initializes granular micro-provinces across Anatolia, Thrace and Alps', () => {
    const provinces = pipeline.getAllProvinces();
    assert.ok(provinces.length >= 8, 'Must initialize multiple micro-provinces');

    const sogut = pipeline.getProvince(101);
    assert.ok(sogut, 'Söğüt micro-province must exist');
    assert.strictEqual(sogut?.sovereignTag, 'TUR');
    assert.strictEqual(sogut?.centroid[0], 1243);
    assert.strictEqual(sogut?.centroid[1], 674);

    const bursa = pipeline.getProvince(102);
    assert.ok(bursa, 'Bursa micro-province must exist');
    assert.strictEqual(bursa?.sovereignTag, 'TUR');

    const constantinople = pipeline.getProvince(104);
    assert.ok(constantinople, 'Constantinople micro-province must exist');
    assert.strictEqual(constantinople?.sovereignTag, 'BYZ');
  });

  await t.test('Performs O(1) runtime border re-rendering upon sovereignty transfer', () => {
    // Initially Söğüt and Bursa are both TUR (internal county divider, not international frontier)
    // Constantinople (BYZ) and İznik (TUR) have international border
    const initialInternational = pipeline.getInternationalBorders();
    assert.ok(initialInternational.length > 0);

    // Dynamic mutation: Constantinople falls to TUR in peace treaty
    const modified = pipeline.updateProvinceSovereignty(104, 'TUR');
    assert.ok(modified.length > 0, 'Must return modified incident border edges');

    const constantinople = pipeline.getProvince(104);
    assert.strictEqual(constantinople?.sovereignTag, 'TUR');

    // SVG path string generation
    const svgPaths = pipeline.compileSvgBorderPaths();
    assert.ok(svgPaths.includes('M '), 'Must compile valid SVG vector path strings');
  });
});

test('Seasonal Climate Vectors, Winter Attrition & Impassable Wastelands', async (t) => {
  const climate = new ClimateEngine();

  await t.test('Evaluates Mild climate in Spring/Autumn', () => {
    climate.evaluateSeasonTick(4, 15); // April 15
    const bursa = climate.getZone(102);
    assert.ok(bursa);
    assert.strictEqual(bursa?.activeWeather, 'Mild');
    assert.strictEqual(bursa?.logisticsMultiplier, 1.0);
    assert.strictEqual(bursa?.monthlyAttritionRate, 0.0);
  });

  await t.test('Triggers Severe_Winter status effect during winter months on mountainous/high-latitude nodes', () => {
    climate.evaluateSeasonTick(1, 15); // January 15 (Winter)

    // Bursa (Uludağ Foothills, Mountainous)
    const bursa = climate.getZone(102);
    assert.strictEqual(bursa?.activeWeather, 'Severe_Winter');
    assert.strictEqual(bursa?.logisticsMultiplier, 3.0, '3x Logistical Maintenance Cost');
    assert.strictEqual(bursa?.monthlyAttritionRate, 0.025, '+2.5% Monthly Attrition');

    // Alpine Pass (Elevation 1370m)
    const brenner = climate.getZone(120);
    assert.strictEqual(brenner?.activeWeather, 'Severe_Winter');
    assert.strictEqual(brenner?.logisticsMultiplier, 3.0);

    // Calculate Daily Attrition for 10,000 strong army
    // 10,000 * (0.025 / 30) = 8.333 -> 8 casualties/day
    const casualties = climate.calculateDailyArmyAttrition(10000, 102);
    assert.strictEqual(casualties, 8, 'Daily attrition must equal ~8 casualties per 10k men');
  });

  await t.test('Recognizes Impassable Mountain Wastelands and enforces path bypass', () => {
    const wastelands = climate.getAllWastelands();
    assert.ok(wastelands.length >= 3, 'Must define Swiss Alps, Rhodopes, and Salt Desert wastelands');

    // Point in center of High Alps Massif
    const inAlps = climate.isPointInWasteland(655, 430);
    assert.strictEqual(inAlps, true, 'High Alps center must be identified as impassable wasteland');

    const inVenice = climate.isPointInWasteland(704, 471);
    assert.strictEqual(inVenice, false, 'Venice lagoon must be passable');

    // Spatial Manager Pathfinding with Wasteland avoidance
    const spatial = new GlobalSpatialMapEngine({ minX: 0, minY: 0, maxX: 1600, maxY: 900 });
    spatial.registerRendererNode({
      locationId: 10,
      x: 600,
      y: 430,
      countryTag: 'SWI',
      politicalColorRgb: [200, 50, 50],
      isCoastal: false,
      borderSegments: [],
      isEnclave: false
    });
    spatial.registerRendererNode({
      locationId: 999, // Impassable Wasteland node
      x: 655,
      y: 430,
      countryTag: 'WST',
      politicalColorRgb: [60, 60, 60],
      isCoastal: false,
      borderSegments: [],
      isEnclave: false
    });
    spatial.registerRendererNode({
      locationId: 11, // Valley Chokepoint bypass
      x: 655,
      y: 480,
      countryTag: 'SWI',
      politicalColorRgb: [200, 50, 50],
      isCoastal: false,
      borderSegments: [],
      isEnclave: false
    });
    spatial.registerRendererNode({
      locationId: 12,
      x: 710,
      y: 430,
      countryTag: 'SWI',
      politicalColorRgb: [200, 50, 50],
      isCoastal: false,
      borderSegments: [],
      isEnclave: false
    });

    const neighbors = (id: number) => {
      if (id === 10) return [999, 11];
      if (id === 999) return [10, 12];
      if (id === 11) return [10, 12];
      if (id === 12) return [999, 11];
      return [];
    };

    // A* Path with isPassable constraint bypassing Wasteland 999
    const path = spatial.findHierarchicalPath(
      10, 
      12, 
      neighbors, 
      (id) => climate.isLocationPassable(id)
    );

    assert.deepStrictEqual(path, [10, 11, 12], 'A* must route through valley bypass 11, skipping wasteland 999');
  });
});

test('GPU-Accelerated Fog of War (FoW) Vision Engine', async (t) => {
  const fow = new FogOfWarEngine('TUR'); // Player playing as Ottomans

  await t.test('Casts dynamic vision circle around active army with scouting bonus', () => {
    fow.registerVisionEntity({
      id: 'gazi_vanguard',
      name: 'Gazi Vanguard Army',
      type: 'Army',
      ownerTag: 'TUR',
      screenPos: [1209, 668], // Bursa
      geoPos: [29.0610, 40.1885],
      baseRadius: 60,
      scoutingTraitBonus: 15 // Leader has +15 Scouting Trait
    });

    // Point right in Bursa (within 75px radius) -> ActiveVision
    const stateBursa = fow.queryVisionState(1209, 668, 102);
    assert.strictEqual(stateBursa, VisionState.ActiveVision);

    // Point 50px away -> ActiveVision
    const stateNear = fow.queryVisionState(1240, 668, 101);
    assert.strictEqual(stateNear, VisionState.ActiveVision);

    // Explored point far away (London: 328, 243) -> ShroudOfWar
    const stateLondon = fow.queryVisionState(328, 243, 1);
    assert.strictEqual(stateLondon, VisionState.ShroudOfWar);

    // Unexplored point -> TerraIncognita
    const stateUnexplored = fow.queryVisionState(100, 100, 8888);
    assert.strictEqual(stateUnexplored, VisionState.TerraIncognita);
  });

  await t.test('Culls foreign military unit stacks inside Shroud of War and un-culls in Active Vision', () => {
    // Byzantine army inside Adrianople (1134, 612) - far from Bursa vision circle (dist = 93.6 > 75)
    const shouldCullFar = fow.shouldCullForeignEntity('BYZ', 1134, 612, 110);
    assert.strictEqual(shouldCullFar, true, 'Byzantine army in Shroud of War must be culled/hidden');

    // Byzantine army marches towards Bursa, enters vision circle at (1220, 668)
    const shouldCullClose = fow.shouldCullForeignEntity('BYZ', 1220, 668, 102);
    assert.strictEqual(shouldCullClose, false, 'Byzantine army in Active Vision must NOT be culled (visible in real-time)');

    // Friendly Ottoman army is never culled
    const shouldCullFriendly = fow.shouldCullForeignEntity('TUR', 328, 243, 1);
    assert.strictEqual(shouldCullFriendly, false, 'Friendly units must never be culled');
  });

  await t.test('Generates valid SVG vision mask for GPU/Canvas compositing', () => {
    const mask = fow.generateSvgVisionMask(1600, 900);
    assert.ok(mask.includes('<mask id="fow-shroud-mask">'));
    assert.ok(mask.includes('circle cx="1209" cy="668" r="75"'));
  });
});
