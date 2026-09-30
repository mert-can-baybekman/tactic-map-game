import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  TagRegistryManager, 
  GovernmentForm 
} from '../src/politics/tags/tag_registry.ts';
import { 
  EntityECSManager 
} from '../src/core/optimization/entity_ecs.ts';

test('Ultra-Dense Multi-Regional Country Tag Registry', async (t) => {
  const registry = new TagRegistryManager();

  await t.test('Populates historical Anatolian Beyliks, Byzantine, and Trebizond entities', () => {
    const ott = registry.getTag('OTT');
    assert.ok(ott !== undefined);
    assert.strictEqual(ott?.name, 'Ottoman Beylik');
    assert.strictEqual(ott?.government, GovernmentForm.Anatolian_Beylik);
    assert.strictEqual(ott?.primaryCulture, 'Turkish');

    const krm = registry.getTag('KRM');
    assert.ok(krm !== undefined);
    assert.strictEqual(krm?.name, 'Karamanid Beylik');

    const cnd = registry.getTag('CND');
    assert.strictEqual(cnd?.name, 'Candaroğulları Beylik');

    const byz = registry.getTag('BYZ');
    assert.strictEqual(byz?.capitalLocationId, 104); // Constantinople
    assert.strictEqual(byz?.primaryCulture, 'Greek');

    const tre = registry.getTag('TRE');
    assert.strictEqual(tre?.name, 'Empire of Trebizond');

    const anatolianTags = registry.getClusterTags('Anatolia');
    assert.ok(anatolianTags.length >= 8);
  });

  await t.test('Populates HRE fractured micro-states and Balkan conflict clusters', () => {
    // HRE
    const hab = registry.getTag('HAB');
    assert.strictEqual(hab?.name, 'Duchy of Austria');
    assert.strictEqual(hab?.isHREMember, true);

    const ham = registry.getTag('HAM');
    assert.strictEqual(ham?.government, GovernmentForm.Free_Imperial_City);

    // Balkans
    const ser = registry.getTag('SER');
    assert.ok(ser?.name.includes('Stefan Dušan'));
    assert.strictEqual(ser?.government, GovernmentForm.Balkan_Tsardom);

    const tar = registry.getTag('TAR');
    const vid = registry.getTag('VID');
    assert.strictEqual(tar?.name, 'Bulgarian Tsardom of Tarnovo');
    assert.strictEqual(vid?.name, 'Bulgarian Tsardom of Vidin');
  });

  await t.test('Scales seamlessly to 1,500+ country tag entities with O(1) lookup', () => {
    const initialCount = registry.getTotalTagCount();
    registry.bulkRegisterProceduralTags(1500);

    assert.strictEqual(registry.getTotalTagCount(), initialCount + 1500);
    const lookupTest = registry.getTag('T0100');
    assert.ok(lookupTest !== undefined);
    assert.strictEqual(lookupTest?.isHREMember, true);
  });
});

test('Hyper-Granular Location Database: Near East Dense Setup', async (t) => {
  const filePath = path.join(process.cwd(), 'data', 'mods', 'vanilla', 'map', 'provinces', 'near_east_dense.json');
  assert.ok(fs.existsSync(filePath), 'near_east_dense.json must exist on disk');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  assert.strictEqual(data.dataset, 'near_east_dense_micro_provinces');
  assert.ok(Array.isArray(data.locations));

  const locMap = new Map(data.locations.map((l: any) => [l.location_id, l]));

  await t.test('Validates Söğüt parameters', () => {
    const sogut = locMap.get(101);
    assert.ok(sogut !== undefined);
    assert.strictEqual(sogut.name, 'Söğüt');
    assert.strictEqual(sogut.historical_owner_tag, 'OTT');
    assert.strictEqual(sogut.total_population, 8500);
    assert.strictEqual(sogut.tax_autonomy, 0.10);
    assert.strictEqual(sogut.primary_rgo, 'livestock');
  });

  await t.test('Validates Bursa parameters', () => {
    const bursa = locMap.get(102);
    assert.ok(bursa !== undefined);
    assert.strictEqual(bursa.name, 'Bursa (Prusa)');
    assert.strictEqual(bursa.historical_owner_tag, 'OTT');
    assert.strictEqual(bursa.is_market_hub, true);
    assert.strictEqual(bursa.primary_rgo, 'silk');
    assert.strictEqual(bursa.total_population, 35000);
    assert.strictEqual(bursa.pop_breakdown.burghers, 12000);
  });

  await t.test('Validates Constantinople parameters', () => {
    const constan = locMap.get(104);
    assert.ok(constan !== undefined);
    assert.strictEqual(constan.name, 'Constantinople');
    assert.strictEqual(constan.historical_owner_tag, 'BYZ');
    assert.strictEqual(constan.total_population, 75000);
    assert.strictEqual(constan.fort_level, 4);
    assert.strictEqual(constan.tax_autonomy, 0.15);
  });

  await t.test('Validates Adrianople parameters', () => {
    const edirne = locMap.get(105);
    assert.ok(edirne !== undefined);
    assert.strictEqual(edirne.name, 'Adrianople (Edirne)');
    assert.strictEqual(edirne.historical_owner_tag, 'BYZ');
    assert.strictEqual(edirne.primary_rgo, 'grain');
    assert.strictEqual(edirne.total_population, 22000);
  });
});

test('Hardware-Accelerated Entity Array Optimization (ECS)', async (t) => {
  const ecs = new EntityECSManager(100);

  // Populate 100 entities: 80 micro-baronies with 1 location & 0 threat, 20 regional powers
  for (let i = 1; i <= 80; i++) {
    ecs.insertEntity(i, 1, 0.0, 0.10, 500); // Culled candidate
  }
  for (let i = 81; i <= 100; i++) {
    ecs.insertEntity(i, 5, 0.65, 0.20, 15000); // Active candidate
  }

  assert.strictEqual(ecs.getEntityCount(), 100);

  await t.test('Active Query Culling isolates 80% idle single-province micro-states', () => {
    const cullingResult = ecs.executeActiveQueryCulling();
    assert.strictEqual(cullingResult.culledCount, 80);
    assert.strictEqual(cullingResult.activeCount, 20);
    assert.strictEqual(cullingResult.cullingRatio, 0.80); // 80% culled!

    assert.strictEqual(ecs.isEntityCulled(0), true);
    assert.strictEqual(ecs.isEntityCulled(85), false);
  });

  await t.test('Optimized simulation pass loops strictly through active non-culled entities', () => {
    let processedEntities = 0;
    let totalArmyProcessed = 0;

    const activeCount = ecs.executeOptimizedSimulationPass((id, army, _tax) => {
      processedEntities++;
      totalArmyProcessed += army;
      assert.ok(id >= 81);
    });

    assert.strictEqual(activeCount, 20);
    assert.strictEqual(processedEntities, 20);
    assert.strictEqual(totalArmyProcessed, 20 * 15000);
  });
});
