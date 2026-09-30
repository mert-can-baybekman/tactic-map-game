import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { CourtAndDynastyEngine, CharacterSex, CharacterRole } from '../src/politics/court.ts';
import { RoyalCharterRegistry } from '../src/politics/charters.ts';
import { SimulationDataBindingEngine } from '../src/core/data_binding.ts';
import { CalendarProgressionEngine } from '../src/core/time.ts';
import { GrandStrategyEngine } from '../src/core/engine.ts';
import { EstateType } from '../src/core/types.ts';

describe('Royal Charters & Estate Leverage Management', () => {
  test('Feudal Tithe Exemption locks Nobility Loyalty floor to 15% and deducts 20% tax skimming', () => {
    const registry = new RoyalCharterRegistry();
    const titheCharter = registry.getCharter('feudal_tithe_exemption');
    assert.ok(titheCharter);
    assert.strictEqual(titheCharter.active, true);
    assert.strictEqual(titheCharter.loyalty_floor, 15.0);

    // Verify tax skimming deduction on noble-dominated land
    const taxModNoble = registry.computeCharterTaxModifier(true);
    assert.strictEqual(taxModNoble, 0.80, 'Must apply flat -20% deduction (0.80x)');

    const taxModCommon = registry.computeCharterTaxModifier(false);
    assert.strictEqual(taxModCommon, 1.0, 'Must not apply tax deduction on non-noble dominated land');

    // Verify loyalty floor
    const loyaltyMods = registry.getEstateLoyaltyModifiers(EstateType.Nobility);
    assert.strictEqual(loyaltyMods.floor, 15.0);
  });

  test('Wool Export Monopoly increments Burgher wealth rate by +25% and applies -10% control penalty on Dover-Calais', () => {
    const registry = new RoyalCharterRegistry();
    const woolCharter = registry.getCharter('wool_export_monopoly');
    assert.ok(woolCharter);
    assert.strictEqual(woolCharter.active, true);
    assert.strictEqual(woolCharter.wealth_accumulation_rate, 0.25);

    // Verify control penalty on Dover-Calais trade graph
    const controlPenaltyHub = registry.computeCharterControlPenalty(true);
    assert.strictEqual(controlPenaltyHub, 0.10, 'Must apply -10% Crown Control penalty on connected hubs');

    const controlPenaltyOther = registry.computeCharterControlPenalty(false);
    assert.strictEqual(controlPenaltyOther, 0.0);
  });
});

describe('Simulation Data Binding & Dynamic Action Buttons', () => {
  test('Stat blocks mapping to multipliers (Martial 85, Diplo 79, Steward 65, Learn 50, Intrigue 68)', () => {
    const dataBinding = new SimulationDataBindingEngine();
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
      traits: [],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 50.0
    });

    const multipliers = dataBinding.computeRulerStatMultipliers(ruler);
    assert.strictEqual(multipliers.levyMobilizationMultiplier, 1.0 + (85 / 100.0) * 0.5);
    assert.strictEqual(multipliers.diplomaticRelationMultiplier, 1.0 + (79 / 100.0) * 0.5);
    assert.strictEqual(multipliers.stewardshipTaxMultiplier, 1.0 + (65 / 100.0) * 0.2);
    assert.strictEqual(multipliers.constructionSpeedMultiplier, 1.0 + (65 / 100.0) * 0.25);
    assert.strictEqual(multipliers.intrigueDefenseMultiplier, 1.0 + (68 / 100.0) * 0.5);
  });

  test('Valiant Warrior trait applies 1.15 float modifier to combat shock ticks when ruler is active general', () => {
    const dataBinding = new SimulationDataBindingEngine();
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

    // Before appointment as general
    assert.strictEqual(dataBinding.getCombatShockModifier(ruler), 1.0);

    // Appoint as field general
    const generalAssigned = dataBinding.executeAppointFieldGeneral(ruler, court, 'army_vanguard_1');
    assert.strictEqual(generalAssigned, true);
    assert.strictEqual(ruler.current_role, CharacterRole.General);
    assert.strictEqual(dataBinding.getCombatShockModifier(ruler), 1.15, 'Valiant warrior active general must grant 1.15x shock');
  });

  test('Gout Afflicted annual health pass decrements health by 5 and triggers succession upon health <= 0', () => {
    const dataBinding = new SimulationDataBindingEngine();
    const court = new CourtAndDynastyEngine();
    const ruler = court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward III',
      country_id: 1,
      age: 65,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'edward.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 },
      traits: [{
        id: 'gout_afflicted',
        name: 'Gout Afflicted',
        category: 'personality',
        modifiers: { health_degradation_penalty: 5.0 }
      }],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 50.0
    });

    ruler.health = 8.0;

    // Year 1 pass: 8 - 5 = 3 health
    const res1 = dataBinding.processAnnualGoutPass(ruler, court);
    assert.strictEqual(res1.died, false);
    assert.strictEqual(ruler.health, 3.0);

    // Year 2 pass: 3 - 5 = -2 <= 0 -> Death & Succession!
    const res2 = dataBinding.processAnnualGoutPass(ruler, court);
    assert.strictEqual(res2.died, true);
    assert.strictEqual(ruler.is_alive, false);
  });

  test('Action buttons: Arrange Royal Marriage and Appoint Cabinet Advisor', () => {
    const dataBinding = new SimulationDataBindingEngine();
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
      traits: [],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 50.0
    });

    // Arrange Royal Marriage
    const marriage = dataBinding.executeArrangeRoyalMarriage(ruler, 'Flanders', 'Duchess Margaret of Flanders');
    assert.strictEqual(marriage.activeTreaty, true);
    assert.strictEqual(marriage.foreignSpouseName, 'Duchess Margaret of Flanders');

    // Appoint Cabinet Advisor (Lord High Chancellor)
    const advisor = dataBinding.executeAppointCabinetAdvisor(ruler, court, 'lord_high_chancellor');
    assert.strictEqual(advisor, true);
    assert.strictEqual(dataBinding.lordHighChancellorAppointed, true);
  });
});

describe('Asynchronous Tick Scheduler & Calendar Progression Engine', () => {
  test('Daily tick and Monthly loop tick advance outliner metrics and produce telemetry', () => {
    const engine = new GrandStrategyEngine();
    const calendarEngine = new CalendarProgressionEngine(engine);

    // Run Daily Tick
    calendarEngine.processDailyTick();
    assert.strictEqual(engine.calendar.day, 2);

    // Run Monthly Tick
    const telemetry = calendarEngine.processMonthlyTick();
    assert.ok(telemetry.calendarDateString);
    assert.strictEqual(telemetry.manpowerCurrent, 28458);
    assert.strictEqual(telemetry.manpowerMonthlyRecovery, 350);
    assert.strictEqual(telemetry.manpowerMax, 35000);
  });
});
