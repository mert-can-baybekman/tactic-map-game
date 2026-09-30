/**
 * Macro-Economic, Taxation & Production Window
 * Features the National Budget Balance Sheet and Infrastructure & Construction Matrix.
 */

import { BaseUIWindow } from '../base.ts';

export interface BudgetItem {
  category: string;
  amountDucats: number;
  percentageOfTotal: number;
}

export interface ConstructionQueueItem {
  id: string;
  buildingName: string;
  locationName: string;
  progressPercent: number;
  remainingMonths: number;
  goldCost: number;
  ironRequired: number;
  timberRequired: number;
  missingGoodsWarning: boolean;
}

export class EconomyWindow extends BaseUIWindow {
  public incomeLedger: BudgetItem[] = [
    { category: 'Direct Pop Taxation (Control Scaled)', amountDucats: 168.4, percentageOfTotal: 58.3 },
    { category: 'RGO Production & Manufactories', amountDucats: 62.0, percentageOfTotal: 21.5 },
    { category: 'Maritime Trade Tariffs (Dover Straits)', amountDucats: 38.4, percentageOfTotal: 13.3 },
    { category: 'Gascon & Aquitaine Vassal Tributes', amountDucats: 20.0, percentageOfTotal: 6.9 }
  ];

  public expenseLedger: BudgetItem[] = [
    { category: 'Standing Army & Retinue Upkeep', amountDucats: 58.0, percentageOfTotal: 48.3 },
    { category: 'Channel Fleet Maintenance', amountDucats: 28.0, percentageOfTotal: 23.3 },
    { category: 'Calais & Dover Coastal Fort Subsidies', amountDucats: 20.0, percentageOfTotal: 16.7 },
    { category: 'Privy Council & Court Ceremonial Dues', amountDucats: 14.0, percentageOfTotal: 11.7 }
  ];

  public constructionQueue: ConstructionQueueItem[] = [
    {
      id: 'proj_bastion_calais',
      buildingName: 'Bastion Citadel & Deep-Sea Pier',
      locationName: 'Calais',
      progressPercent: 68.2,
      remainingMonths: 5,
      goldCost: 220.0,
      ironRequired: 40,
      timberRequired: 90,
      missingGoodsWarning: false
    },
    {
      id: 'proj_timber_mill_dover',
      buildingName: 'Hydraulic Sawmill & Hardwood Yard',
      locationName: 'Dover',
      progressPercent: 43.6,
      remainingMonths: 8,
      goldCost: 85.0,
      ironRequired: 15,
      timberRequired: 20,
      missingGoodsWarning: false
    },
    {
      id: 'proj_armory_london',
      buildingName: 'Royal Armory & Plate Foundry',
      locationName: 'London',
      progressPercent: 12.0,
      remainingMonths: 14,
      goldCost: 180.0,
      ironRequired: 50,
      timberRequired: 30,
      missingGoodsWarning: true // High weapon demand in war
    }
  ];

  constructor() {
    super('window_economy', 'Crown Exchequer, Budget & Production Matrix', '🪙');
  }

  public getTotalIncome(): number {
    return this.incomeLedger.reduce((sum, item) => sum + item.amountDucats, 0);
  }

  public getTotalExpense(): number {
    return this.expenseLedger.reduce((sum, item) => sum + item.amountDucats, 0);
  }

  public getNetBalance(): number {
    return this.getTotalIncome() - this.getTotalExpense();
  }

  protected onSimulationTick(simulationData: any): void {
    if (simulationData?.monthlyTaxIncome) {
      this.incomeLedger[0].amountDucats = simulationData.monthlyTaxIncome;
    }
    // Advance construction queue
    for (const proj of this.constructionQueue) {
      if (proj.progressPercent < 100.0) {
        proj.progressPercent = Math.min(100.0, proj.progressPercent + (100.0 / Math.max(1, proj.remainingMonths * 4)));
      }
    }
    this.markDirty();
  }

  public render(simData: any): string {
    const totalIncome = this.getTotalIncome();
    const totalExpense = this.getTotalExpense();
    const netMonthly = this.getNetBalance();

    const incomeRows = this.incomeLedger.map(item => `
      <div class="ledger-row income">
        <span class="ledger-cat">${item.category}</span>
        <span class="ledger-val pos">+${item.amountDucats.toFixed(1)} D</span>
      </div>
    `).join('');

    const expenseRows = this.expenseLedger.map(item => `
      <div class="ledger-row expense">
        <span class="ledger-cat">${item.category}</span>
        <span class="ledger-val neg">-${item.amountDucats.toFixed(1)} D</span>
      </div>
    `).join('');

    const constructionCards = this.constructionQueue.map(p => `
      <div class="construction-card ${p.missingGoodsWarning ? 'warning-missing' : ''}">
        <div class="construction-head">
          <div>
            <strong>${p.buildingName}</strong>
            <span class="construction-loc">📍 ${p.locationName}</span>
          </div>
          <span class="construction-eta">ETA: ${p.remainingMonths} mos</span>
        </div>
        <div class="construction-progress-bar">
          <div class="construction-progress-fill" style="width: ${p.progressPercent.toFixed(1)}%;"></div>
        </div>
        <div class="construction-footer">
          <span>Cost: <strong>${p.goldCost} D</strong> • Timber: ${p.timberRequired} • Iron: ${p.ironRequired}</span>
          ${p.missingGoodsWarning ? `
            <span class="warning-badge" title="Local market lacks required iron/timber throughput!">⚠️ Input Shortage</span>
          ` : `
            <span class="active-badge">✓ Inputs Clear</span>
          `}
        </div>
      </div>
    `).join('');

    return `
      <div class="ui-window-content economy-window">
        <div class="window-tab-bar">
          <button class="win-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">National Budget Balance Sheet</button>
          <button class="win-tab-btn ${this.activeTab === 'construction' ? 'active' : ''}" data-tab="construction">Construction & Infrastructure (${this.constructionQueue.length})</button>
        </div>
        <div class="window-body-scroll">
          <div class="budget-summary-banner ${netMonthly >= 0 ? 'surplus' : 'deficit'}">
            <div class="budget-summary-side">
              <span>Total Monthly Revenue</span>
              <strong style="color: #34d399;">+${totalIncome.toFixed(1)} Ducats</strong>
            </div>
            <div class="budget-net-pillar">
              <span>Net Monthly Balance</span>
              <strong style="font-size: 18px; color: ${netMonthly >= 0 ? '#34d399' : '#f87171'};">
                ${netMonthly >= 0 ? '+' : ''}${netMonthly.toFixed(1)} Ducats
              </strong>
            </div>
            <div class="budget-summary-side">
              <span>Total Monthly Outlay</span>
              <strong style="color: #f87171;">-${totalExpense.toFixed(1)} Ducats</strong>
            </div>
          </div>

          ${this.activeTab === 'construction' ? `
            <div class="construction-queue-section">
              <h4>Active Infrastructure Projects</h4>
              <div class="construction-list">${constructionCards}</div>
            </div>
          ` : `
            <div class="split-ledger-grid">
              <div class="ledger-column">
                <h4>🟢 Crown Income Streams</h4>
                <div class="ledger-box">${incomeRows}</div>
              </div>
              <div class="ledger-column">
                <h4>🔴 Crown Maintenance & Expenses</h4>
                <div class="ledger-box">${expenseRows}</div>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
