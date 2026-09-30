import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { SilkRoadTradeEngine } from '../src/economy/trade_nodes.ts';
import { StraitInterdictionEngine, MaritimeStrait } from '../src/map/straits.ts';
import { ImperialCollapseEngine, type LocationState, type NationState } from '../src/politics/events/collapse.ts';

describe('Silk Road Supply Terminals & Mediterranean Maritime Flow', () => {
  test('Calculates Silk Road terminal throughput and applies 50% war decay factor', () => {
    const tradeEngine = new SilkRoadTradeEngine();

    // 1. Peaceful baseline: Devastation = 0.0, War = false
    const baselineResults = tradeEngine.calculateTerminalThroughput(102, 0.0, false);
    assert.strictEqual(baselineResults.length, 3);
    const silkBaseline = baselineResults.find(r => r.goodId === 'silk');
    assert.ok(silkBaseline);
    assert.strictEqual(silkBaseline.effectiveThroughput, 120.0);
    assert.strictEqual(silkBaseline.priceSpikeMultiplier, 1.0);

    // 2. Devastation impact: Devastation = 0.25 (Throughput = 120 * 0.75 = 90.0)
    const devastatedResults = tradeEngine.calculateTerminalThroughput(102, 0.25, false);
    const silkDevastated = devastatedResults.find(r => r.goodId === 'silk');
    assert.ok(silkDevastated);
    assert.strictEqual(silkDevastated.effectiveThroughput, 90.0);

    // 3. War impact: Ottoman or Mamluk at war applies 50% decay factor
    // Throughput = 120 * (1.0 - 0.25) * 0.50 = 45.0
    const warResults = tradeEngine.calculateTerminalThroughput(102, 0.25, true);
    const silkWar = warResults.find(r => r.goodId === 'silk');
    assert.ok(silkWar);
    assert.strictEqual(silkWar.effectiveThroughput, 45.0);
    assert.strictEqual(silkWar.warDecayFactor, 0.50);
    assert.ok(silkWar.priceSpikeMultiplier > 2.0); // Price spikes over 2x
  });

  test('Maritime shipping line scales transport cost by 10x and forces overland rerouting upon blockade', () => {
    const tradeEngine = new SilkRoadTradeEngine();

    // 1. Initial maritime line state
    const corridorBefore = tradeEngine.getShippingCorridor('venice_constantinople_bursa_sea');
    assert.ok(corridorBefore);
    assert.strictEqual(corridorBefore.baseTransportCostFactor, 1.0);
    assert.strictEqual(corridorBefore.activeTransportCostFactor, 1.0);

    // 2. Trigger naval interception or Aegean/Channel blockade
    const updateResult = tradeEngine.updateShippingCorridorState('venice_constantinople_bursa_sea', true);
    assert.strictEqual(updateResult.isOverlandDetour, true);
    assert.strictEqual(updateResult.costMultiplier, 10.0);
    assert.deepStrictEqual(updateResult.activeRoute, [102, 104, 110, 30, 20]); // Adrianople & Buda corridor

    // 3. Downstream European market price impact (Venice, Paris, London)
    const warThroughput = tradeEngine.calculateTerminalThroughput(102, 0.20, true);
    const venicePrices = tradeEngine.evaluateDownstreamMarketPrices('VENICE', warThroughput, updateResult.costMultiplier);
    const londonPrices = tradeEngine.evaluateDownstreamMarketPrices('LONDON', warThroughput, updateResult.costMultiplier);

    assert.ok(venicePrices.get('silk')! > 50.0);
    assert.ok(londonPrices.get('silk')! > venicePrices.get('silk')!); // London prices higher due to distance
  });
});

describe('Strait Interdiction Blockade Engine & The Bosphorus Barrier', () => {
  test('Foreign fleet or law embargo blocks strait crossing and demands 300% toll or starves logistics', () => {
    const straitEngine = new StraitInterdictionEngine();
    const bosphorus = straitEngine.getStrait('bosphorus_strait');
    assert.ok(bosphorus);

    // 1. Uninhibited crossing for friendly nation
    const openPass = straitEngine.evaluateStraitPassage('bosphorus_strait', 'BYZ', 5000, 1000);
    assert.strictEqual(openPass.isTraversable, true);
    assert.strictEqual(openPass.requiresToll, false);
    assert.strictEqual(openPass.logisticalReinforcementEfficiency, 1.0);

    // 2. Hostile Genoese fleet blockades Bosphorus
    bosphorus.setBlockade(1.0, 'GEN', 24);

    // Ottoman army with insufficient gold refuses/cannot pay 300% toll
    const deniedPass = straitEngine.evaluateStraitPassage('bosphorus_strait', 'TUR', 10000, 100.0, false);
    assert.strictEqual(deniedPass.isTraversable, false);
    assert.strictEqual(deniedPass.logisticalReinforcementEfficiency, 0.0); // Starved
    assert.strictEqual(deniedPass.tollRatePercent, 300.0);
    assert.strictEqual(deniedPass.reason, 'BLOCKADED_BY_FLEET');

    // Ottoman army with treasury pays 300% toll
    // 10,000 men * 0.05 * 3.0 = 1500.0 gold
    const tollPass = straitEngine.evaluateStraitPassage('bosphorus_strait', 'TUR', 10000, 2000.0, true);
    assert.strictEqual(tollPass.isTraversable, true);
    assert.strictEqual(tollPass.requiresToll, true);
    assert.strictEqual(tollPass.tollAmountGold, 1500.0);
    assert.strictEqual(tollPass.logisticalReinforcementEfficiency, 0.15); // Severe logistics friction
    assert.strictEqual(tollPass.reason, 'TOLL_PAID');
  });

  test('State law passage embargo enforces blockade behavior without naval fleets', () => {
    const straitEngine = new StraitInterdictionEngine();
    const bosphorus = straitEngine.getStrait('bosphorus_strait')!;
    bosphorus.setLawPassageEmbargo(true);

    const embargoed = straitEngine.evaluateStraitPassage('bosphorus_strait', 'TUR', 4000, 50, false);
    assert.strictEqual(embargoed.isTraversable, false);
    assert.strictEqual(embargoed.reason, 'EMBARGOED_BY_LAW');
  });
});

describe('Procedural Imperial Decay & Fall of Constantinople End-Game Suite', () => {
  test('Encircle Capital Protocol triggers Imperial Encirclement with +2.0 unrest and 10% control floor', () => {
    const collapseEngine = new ImperialCollapseEngine();

    const constantinople: LocationState = {
      id: 104,
      name: 'Constantinople',
      country: 'BYZ',
      control: 0.85,
      unrest: 1.0,
      isCapital: true,
      isWorldMarketHub: false,
      religion: 'orthodox',
      culture: 'greek'
    };

    // 1. Partial encirclement (only Adrianople 110 conquered)
    const partial = collapseEngine.evaluateImperialEncirclement('TUR', [110], constantinople);
    assert.strictEqual(partial.isEncircled, false);
    assert.strictEqual(constantinople.control, 0.85);

    // 2. Total encirclement (Adrianople 110, Thessalonica 107, Gallipoli 103 all controlled)
    const complete = collapseEngine.evaluateImperialEncirclement('TUR', [110, 107, 103], constantinople);
    assert.strictEqual(complete.isEncircled, true);
    assert.strictEqual(complete.monthlyUnrestModifier, 2.0);
    assert.strictEqual(constantinople.unrest, 3.0); // 1.0 + 2.0
    assert.strictEqual(constantinople.control, 0.10); // Clamped to 10% floor
  });

  test('Conquest Execution Payload renames to Istanbul, moves capital, and executes estate realignment', () => {
    const collapseEngine = new ImperialCollapseEngine();

    const constantinople: LocationState = {
      id: 104,
      name: 'Constantinople',
      country: 'BYZ',
      control: 0.10,
      unrest: 3.0,
      isCapital: true,
      isWorldMarketHub: false,
      religion: 'orthodox',
      culture: 'greek'
    };

    const ottomanNation: NationState = {
      tag: 'TUR',
      name: 'Ottoman Empire',
      capitalLocationId: 102, // Currently Bursa
      estates: {
        nobilityLoyalty: 65.0,
        nobilityPower: 50.0,
        burgherLoyalty: 55.0,
        burgherWealthRate: 1.0,
        clergyLoyalty: 60.0
      },
      monthlyTradeIncomeBonus: 0.0
    };

    // Siege tick at 100%
    const payload = collapseEngine.triggerFallOfConstantinople(constantinople, ottomanNation, 100.0);

    // 1. Name and tag transformed
    assert.strictEqual(payload.success, true);
    assert.strictEqual(constantinople.name, 'Istanbul');
    assert.strictEqual(constantinople.country, 'TUR');
    assert.strictEqual(constantinople.isWorldMarketHub, true);

    // 2. Primary capital pointer shifted to 104 (Istanbul)
    assert.strictEqual(ottomanNation.capitalLocationId, 104);

    // 3. Estate loyalty realignment
    assert.strictEqual(ottomanNation.estates.nobilityLoyalty, 35.0); // 65.0 - 30.0
    assert.strictEqual(ottomanNation.estates.burgherWealthRate, 1.50); // 1.0 * 1.50
    assert.strictEqual(ottomanNation.monthlyTradeIncomeBonus, 50.0);
  });
});
