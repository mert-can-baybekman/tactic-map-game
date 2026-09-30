import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  UIManager,
  VirtualListRenderer,
  NestedTooltipManager,
  GovernmentWindow,
  EstatesWindow,
  DemographicsWindow,
  EconomyWindow,
  TradeWindow,
  DiplomacyWindow,
  MilitaryWindow
} from '../src/ui/index.ts';

describe('Frontend UI Ecosystem: Architecture & Virtualization', () => {
  test('UIManager manages window registration, focus stack, and z-index ordering', () => {
    const ui = new UIManager();
    const govWin = new GovernmentWindow();
    const estWin = new EstatesWindow();

    ui.registerWindow(govWin);
    ui.registerWindow(estWin);

    assert.strictEqual(ui.getAllWindows().length, 2);
    assert.strictEqual(govWin.isOpen, false);

    // Open Government
    ui.openWindow(govWin.id);
    assert.strictEqual(govWin.isOpen, true);
    assert.ok(govWin.zIndex >= 100);

    // Open Estates
    ui.openWindow(estWin.id);
    assert.strictEqual(estWin.isOpen, true);
    assert.ok(estWin.zIndex > govWin.zIndex, 'Topmost window must have higher z-index');

    // Close topmost window
    const closed = ui.closeTopmostWindow();
    assert.strictEqual(closed, true);
    assert.strictEqual(estWin.isOpen, false);
    assert.strictEqual(govWin.isOpen, true);
  });

  test('VirtualListRenderer computes accurate visible slices and padding offsets', () => {
    const list = new VirtualListRenderer<number>(40, 2);
    const mockData = Array.from({ length: 1000 }, (_, i) => i);

    // 1000 items * 40px = 40,000px total height
    const slice = list.computeSlice(mockData, 400, 800);

    assert.strictEqual(slice.totalHeight, 40000);
    // At scrollTop 800, raw start = 800 / 40 = 20. With 2 buffer = startIndex 18
    assert.strictEqual(slice.startIndex, 18);
    // Visible count = 400 / 40 = 10 items. End index = 20 + 10 + 2 = 32
    assert.strictEqual(slice.endIndex, 32);
    assert.strictEqual(slice.topPadding, 18 * 40);
    assert.ok(slice.visibleItems.length > 0);
  });

  test('NestedTooltipManager handles multi-level recursive tooltip stacks', () => {
    const tt = new NestedTooltipManager();
    tt.registerTooltip({
      id: 'pop_tooltip',
      title: 'Commoner Pop Cluster',
      description: 'Rural peasantry engaged in grain cultivation',
      nestedTooltipIds: ['estate_nobility']
    });
    tt.registerTooltip({
      id: 'estate_nobility',
      title: 'Nobility Estate',
      description: 'Feudal landholders demanding tithe exemptions'
    });

    assert.strictEqual(tt.pushTooltip('pop_tooltip'), true);
    assert.strictEqual(tt.pushTooltip('estate_nobility'), true);

    const stack = tt.getActiveStack();
    assert.strictEqual(stack.length, 2);
    assert.strictEqual(stack[0].id, 'pop_tooltip');
    assert.strictEqual(stack[1].id, 'estate_nobility');

    const popped = tt.popTooltip();
    assert.strictEqual(popped, 'estate_nobility');
    assert.strictEqual(tt.getActiveStack().length, 1);
  });
});

describe('Frontend UI Ecosystem: Window Modules Validation', () => {
  test('GovernmentWindow renders cabinet slots and advances mandates on tick', () => {
    const gov = new GovernmentWindow();
    gov.open();
    assert.strictEqual(gov.ministers.length, 4);

    const initialProgress = gov.ministers[0].activeAction?.progressPercentage ?? 0;
    gov.onTick({});
    const updatedProgress = gov.ministers[0].activeAction?.progressPercentage ?? 0;
    assert.ok(updatedProgress > initialProgress, 'Minister action progress must advance on tick');

    const html = gov.render({ ruler: { firstName: 'Edward III', dynasty: 'Plantagenet' } });
    assert.ok(html.includes('William of Wykeham'));
    assert.ok(html.includes('Lord High Chancellor'));
  });

  test('EstatesWindow modifies estate loyalty upon granting or revoking privileges', () => {
    const est = new EstatesWindow();
    est.open();

    const nobility = est.estates.find(e => e.type === 'Nobility')!;
    const initialLoyalty = nobility.loyalty;

    // Feudal Tithe Exemption is initially active (+15 loyalty bonus)
    // Revoking it must drop loyalty
    est.togglePrivilege('feudal_tithe_exemption');
    assert.strictEqual(nobility.loyalty, initialLoyalty - 15.0);

    // Granting it back restores loyalty
    est.togglePrivilege('feudal_tithe_exemption');
    assert.strictEqual(nobility.loyalty, initialLoyalty);

    // Test Parliament voting
    const passResult = est.voteParliamentBill(true, true);
    assert.strictEqual(passResult, true, 'With nobility and burgher concessions, bill passes');
    assert.strictEqual(est.activeBill.passed, true);
  });

  test('DemographicsWindow tracks Pop needs satisfaction, wealth trend, and militancy', () => {
    const demo = new DemographicsWindow();
    demo.open();
    assert.ok(demo.popClusters.length >= 20);

    const initialMilitancy = demo.popClusters[0].militancy;
    demo.onTick({});
    assert.strictEqual(typeof demo.popClusters[0].militancy, 'number');

    const html = demo.render({});
    assert.ok(html.includes('Social Class Strata Partition'));
    assert.ok(html.includes('Pop Clusters Ledger'));
  });

  test('EconomyWindow correctly tallies income, expenses, and construction queue', () => {
    const econ = new EconomyWindow();
    econ.open();

    const totalIncome = econ.getTotalIncome();
    const totalExpense = econ.getTotalExpense();
    const netBalance = econ.getNetBalance();

    assert.ok(totalIncome > 0);
    assert.ok(totalExpense > 0);
    assert.strictEqual(netBalance, totalIncome - totalExpense);

    const htmlOverview = econ.render({});
    assert.ok(htmlOverview.includes('National Budget Balance Sheet'));

    econ.setActiveTab('construction');
    const htmlConstruction = econ.render({});
    assert.ok(htmlConstruction.includes('Bastion Citadel'));
  });

  test('TradeWindow applies price spikes and deficit warnings upon blockade', () => {
    const trade = new TradeWindow();
    trade.open();

    // Normal trade
    trade.setBlockaded(false);
    assert.strictEqual(trade.blockadeEffectivenessPercent, 0.0);

    // Naval blockade
    trade.setBlockaded(true);
    assert.strictEqual(trade.blockadeEffectivenessPercent, 85.0);
    const timber = trade.goods.find(g => g.goodId === 'timber')!;
    assert.strictEqual(timber.marketClearingPrice, 14.2);
    assert.strictEqual(timber.isDeficit, true);
  });

  test('DiplomacyWindow calculates two-sided peace desirability score and AI acceptance', () => {
    const diplo = new DiplomacyWindow();
    diplo.open();

    assert.strictEqual(diplo.attackerDemands.length, 4);
    assert.strictEqual(diplo.defenderConcessions.length, 2);

    const desirability = diplo.getPeaceDesirability();
    assert.strictEqual(typeof desirability, 'number');

    diplo.setActiveTab('peace');
    const html = diplo.render({});
    assert.ok(html.includes('Peace Treaty Barter Floor'));
    assert.ok(html.includes('War Reparations'));
  });

  test('MilitaryWindow manages tactical battle arrays and front/back/flank combat cards', () => {
    const mil = new MilitaryWindow();
    mil.open();

    assert.strictEqual(mil.combatGrid.length, 8);
    const front = mil.combatGrid.filter(u => u.row === 'front');
    const back = mil.combatGrid.filter(u => u.row === 'back');
    const flank = mil.combatGrid.filter(u => u.row === 'flank');

    assert.strictEqual(front.length, 3);
    assert.strictEqual(flank.length, 2);
    assert.strictEqual(back.length, 3);

    mil.setActiveTab('combat');
    const html = mil.render({});
    assert.ok(html.includes('Tactical Battle Array'));
    assert.ok(html.includes('Longbowmen'));
  });
});
