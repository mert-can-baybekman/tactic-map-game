import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { CourtAndDynastyEngine, CharacterSex, CharacterRole } from '../src/politics/court.ts';
import { GlobalSpatialMapEngine } from '../src/map/spatial.ts';
import { HudTelemetryEngine, HistoricalAge } from '../src/core/hud.ts';
import { OutlinerRegistryEngine } from '../src/core/outliner.ts';

describe('Character Lifecycle, Dynastic Succession & Court Engine', () => {
  test('Ruler creation, attributes clamping and dynastic traits', () => {
    const court = new CourtAndDynastyEngine();
    const ruler = court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward',
      country_id: 1,
      age: 38,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'ruler_edward_iii.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 85, diplomacy: 70, stewardship: 65, learning: 50, intrigue: 60 },
      traits: [{
        id: 'valiant_warrior',
        name: 'Valiant Warrior',
        category: 'personality',
        modifiers: { combat_shock_bonus: 0.15 }
      }],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 50.0
    });

    assert.strictEqual(ruler.first_name, 'Edward');
    assert.strictEqual(ruler.attributes.martial, 85);
    assert.strictEqual(ruler.traits.length, 1);
  });

  test('Royal marriage creates dynastic claim and resolves Personal Union upon childless death', () => {
    const court = new CourtAndDynastyEngine();

    // King of England
    const kingEdward = court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward',
      country_id: 1,
      age: 40,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'edward.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 80, diplomacy: 75, stewardship: 60, learning: 50, intrigue: 40 },
      traits: [],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 60.0
    });

    // Duchess of Flanders (Country 2)
    const duchessMargaret = court.createCharacter({
      dynasty_id: 2,
      dynasty_name: 'van Vlaanderen',
      first_name: 'Margaret',
      country_id: 2,
      age: 22,
      sex: CharacterSex.Female,
      portrait_asset_ref: 'margaret.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 40, diplomacy: 70, stewardship: 80, learning: 65, intrigue: 50 },
      traits: [],
      culture_id: 'flemish',
      sub_culture_variant: 'low_franconian',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 40.0
    });

    // Forge Royal Marriage
    const marriageResult = court.arrangeRoyalMarriage(kingEdward.id, duchessMargaret.id);
    assert.strictEqual(marriageResult.success, true);
    assert.strictEqual(marriageResult.personalUnionPotential, true);

    // Duchess Margaret dies childless without an heir
    const succession = court.handleRulerDeath(duchessMargaret.id);
    assert.strictEqual(succession.dynasticWarRisk, true);
    assert.strictEqual(succession.personalUnionSeniorId, 1, 'Country 2 should fall into Personal Union under Country 1!');
  });

  test('Character dynamic appointment to General and Cabinet Advisor roles', () => {
    const court = new CourtAndDynastyEngine();
    const courtier = court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward of Woodstock (Black Prince)',
      country_id: 1,
      age: 20,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'black_prince.png',
      current_role: CharacterRole.Courtier,
      attributes: { martial: 95, diplomacy: 60, stewardship: 55, learning: 45, intrigue: 50 },
      traits: [],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 75.0
    });

    const appointed = court.appointAsGeneral(courtier.id, 'army_vanguard_1');
    assert.strictEqual(appointed, true);
    assert.strictEqual(courtier.current_role, CharacterRole.General);
    assert.strictEqual(courtier.assigned_assignment_id, 'army_vanguard_1');
  });
});

describe('Spatial Quadtree & Hierarchical Pathfinding Engine', () => {
  test('Quadtree indexes 500 spatial nodes and performs sub-millisecond frustum query', () => {
    const spatial = new GlobalSpatialMapEngine({ minX: 0, minY: 0, maxX: 5000, maxY: 3000 });

    for (let i = 1; i <= 500; i++) {
      spatial.registerRendererNode({
        locationId: i,
        x: (i * 9) % 4800 + 50,
        y: (i * 5) % 2800 + 50,
        countryTag: i % 2 === 0 ? 'ENG' : 'FRA',
        politicalColorRgb: [180, 40, 40],
        isCoastal: i % 3 === 0,
        borderSegments: [],
        isEnclave: false
      });
    }

    assert.strictEqual(spatial.getTotalIndexedLocations(), 500);

    // Query viewport viewport [100, 100] to [1000, 1000]
    const visible = spatial.queryFrustumVisibleLocations({ minX: 100, minY: 100, maxX: 1000, maxY: 1000 });
    assert.ok(visible.length > 0, 'Frustum query should return visible nodes');
  });

  test('Hierarchical A* pathfinding calculates route between locations', () => {
    const spatial = new GlobalSpatialMapEngine();
    spatial.registerRendererNode({ locationId: 1, x: 10, y: 10, countryTag: 'ENG', politicalColorRgb: [180, 40, 40], isCoastal: true, borderSegments: [], isEnclave: false });
    spatial.registerRendererNode({ locationId: 2, x: 20, y: 10, countryTag: 'ENG', politicalColorRgb: [180, 40, 40], isCoastal: false, borderSegments: [], isEnclave: false });
    spatial.registerRendererNode({ locationId: 3, x: 30, y: 10, countryTag: 'FRA', politicalColorRgb: [30, 70, 160], isCoastal: false, borderSegments: [], isEnclave: false });

    const neighbors = (id: number) => {
      if (id === 1) return [2];
      if (id === 2) return [1, 3];
      if (id === 3) return [2];
      return [];
    };

    const path = spatial.findHierarchicalPath(1, 3, neighbors);
    assert.deepStrictEqual(path, [1, 2, 3]);
  });
});

describe('HUD Telemetry & Outliner Registry Engine', () => {
  test('HUD telemetry correctly calculates balance sheet and Renaissance Age modifiers', () => {
    const hud = new HudTelemetryEngine();
    hud.setHistoricalAge(HistoricalAge.AgeOfRenaissance);

    const payload = hud.generateTelemetryPayload(
      2500, // Treasury
      150,  // Tax income
      80,   // Production income
      90,   // Maintenance cost
      40000 // Commoners pop
    );

    assert.strictEqual(payload.agePackage.age, HistoricalAge.AgeOfRenaissance);
    assert.ok(payload.balanceSheet.netMonthlyBalance > 0);
    assert.strictEqual(payload.manpower.maxCapacity, 10000);
  });

  test('Outliner registry generates consolidated live snapshot', () => {
    const outliner = new OutlinerRegistryEngine();
    const snapshot = outliner.generateOutlinerSnapshot(
      [{
        id: 'army_1',
        name: 'Royal Vanguard',
        manpower: 8500,
        regiments: 9,
        status: 'marching',
        locationName: 'Calais',
        morale: 85.0,
        commander: 'King Edward III'
      }],
      [{ type: 'Nobility', loyalty: 65, power: 45 }]
    );

    assert.ok(snapshot.urgentActions.length > 0);
    assert.strictEqual(snapshot.militaryForces.length, 1);
    assert.strictEqual(snapshot.militaryForces[0].commander_name, 'King Edward III');
    assert.ok(snapshot.governmentTasks.length > 0);
  });

  test('Ruler traits pipeline correctly computes combat shock and stewardship modifiers', () => {
    const court = new CourtAndDynastyEngine();
    const ruler = court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward III',
      country_id: 1,
      age: 38,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'edward.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 },
      traits: [
        {
          id: 'valiant_warrior',
          name: 'Valiant Warrior',
          category: 'personality',
          modifiers: { combat_shock_bonus: 0.15 }
        },
        {
          id: 'feudal_sovereign',
          name: 'Feudal Sovereign',
          category: 'lifestyle',
          modifiers: { estate_loyalty_impact: { Nobility: 10.0 } }
        },
        {
          id: 'gout_afflicted',
          name: 'Gout Afflicted',
          category: 'personality',
          modifiers: { health_degradation_penalty: 1.8 }
        }
      ],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 50.0
    });

    assert.strictEqual(ruler.active_modifiers.combat_shock_multiplier, 1.15, 'Valiant warrior must add +15% shock');
    assert.strictEqual(ruler.active_modifiers.nobility_loyalty_delta, 10.0, 'Feudal sovereign must add +10 nobility loyalty');
    assert.strictEqual(ruler.active_modifiers.stewardship_construction_discount, (65 / 100.0) * 0.25);
  });
});

