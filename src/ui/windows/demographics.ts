/**
 * Micro-Demographic Population Window
 * Renders granular pop strata, needs fulfillment gradients, and militancy vectors using virtualized lists.
 */

import { BaseUIWindow, VirtualListRenderer } from '../base.ts';

export interface PopClusterEntry {
  id: number;
  locationName: string;
  estateClass: 'Nobility' | 'Clergy' | 'Burghers' | 'Commoners' | 'Tribes';
  cultureGroup: string;
  religion: string;
  headcount: number;
  basicNeedsPercent: number;  // 0 - 100%
  luxuryNeedsPercent: number; // 0 - 100%
  wealthDucats: number;
  wealthMonthlyDelta: number;
  militancy: number;          // 0.0 - 10.0 (Unrest)
  militancyDelta: number;     // e.g. +0.05/mo
}

export class DemographicsWindow extends BaseUIWindow {
  public popClusters: PopClusterEntry[] = [];
  public virtualList: VirtualListRenderer<PopClusterEntry> = new VirtualListRenderer<PopClusterEntry>(44, 5);
  public selectedLocationFilter: string = 'All';

  constructor() {
    super('window_demographics', 'Demographics & Social Strata Registry', '👥');
    this.seedSampleDemographics();
  }

  private seedSampleDemographics(): void {
    const locations = ['London', 'Dover', 'Calais', 'Rouen', 'Paris'];
    const cultures = ['Anglo-Norman', 'English', 'Flemish', 'Norman French', 'Francien'];
    const estates: ('Nobility' | 'Clergy' | 'Burghers' | 'Commoners' | 'Tribes')[] = ['Nobility', 'Clergy', 'Burghers', 'Commoners'];

    let popId = 1;
    for (const loc of locations) {
      for (const est of estates) {
        for (const cul of cultures) {
          const isCommoner = est === 'Commoners';
          const size = isCommoner ? 8500 + (popId * 130) : 800 + (popId * 40);
          const basic = isCommoner ? 78.5 - (popId % 20) : 98.0;
          const luxury = est === 'Nobility' ? 92.0 : est === 'Burghers' ? 74.0 : 25.0;
          const militancy = basic < 70 ? 4.2 + (popId % 3) * 0.8 : 0.8;

          this.popClusters.push({
            id: popId++,
            locationName: loc,
            estateClass: est,
            cultureGroup: cul,
            religion: 'Catholic',
            headcount: size,
            basicNeedsPercent: basic,
            luxuryNeedsPercent: luxury,
            wealthDucats: isCommoner ? 14.5 : 240.0,
            wealthMonthlyDelta: basic > 75 ? 0.4 : -0.2,
            militancy,
            militancyDelta: basic < 70 ? 0.08 : -0.02
          });
        }
      }
    }
  }

  public getFilteredClusters(): PopClusterEntry[] {
    if (this.selectedLocationFilter === 'All') return this.popClusters;
    return this.popClusters.filter(p => p.locationName === this.selectedLocationFilter);
  }

  protected onSimulationTick(simulationData: any): void {
    // Dynamically update basic needs and militancy vectors
    for (const pop of this.popClusters) {
      pop.militancy = Math.max(0, Math.min(10.0, pop.militancy + pop.militancyDelta));
      pop.wealthDucats = Math.max(0, pop.wealthDucats + pop.wealthMonthlyDelta);
    }
    this.markDirty();
  }

  public render(simData: any): string {
    const filtered = this.getFilteredClusters();
    const totalPop = filtered.reduce((sum, p) => sum + p.headcount, 0);

    // Compute strata proportions
    const strataCounts: Record<string, number> = {};
    for (const p of filtered) {
      strataCounts[p.estateClass] = (strataCounts[p.estateClass] || 0) + p.headcount;
    }

    const strataBreakdownHtml = Object.entries(strataCounts).map(([cls, count]) => {
      const pct = ((count / totalPop) * 100).toFixed(1);
      return `
        <div class="strata-bar-item">
          <div class="strata-label"><span>${cls}</span><strong>${count.toLocaleString()} (${pct}%)</strong></div>
          <div class="meter-track"><div class="meter-bar ${cls.toLowerCase()}" style="width: ${pct}%;"></div></div>
        </div>
      `;
    }).join('');

    // Virtual list slice simulation (render top 25 for DOM preview)
    const listSlice = this.virtualList.computeSlice(filtered, 400, 0);
    const popRowsHtml = listSlice.visibleItems.map(({ item: p }) => {
      const basicColor = p.basicNeedsPercent > 80 ? '#34d399' : p.basicNeedsPercent > 60 ? '#facc15' : '#ef4444';
      const militancyColor = p.militancy > 5.0 ? '#ef4444' : p.militancy > 2.5 ? '#f59e0b' : '#34d399';

      return `
        <div class="pop-ledger-row">
          <div class="pop-cell pop-loc"><strong>${p.locationName}</strong></div>
          <div class="pop-cell pop-identity">
            <span class="pop-class-pill ${p.estateClass.toLowerCase()}">${p.estateClass}</span>
            <span class="pop-culture">${p.cultureGroup}</span>
          </div>
          <div class="pop-cell pop-size">${p.headcount.toLocaleString()}</div>
          <div class="pop-cell pop-needs">
            <div class="need-slider" title="Basic Needs: ${p.basicNeedsPercent.toFixed(1)}%">
              <div class="need-fill" style="width: ${p.basicNeedsPercent}%; background: ${basicColor};"></div>
            </div>
            <div class="need-slider luxury" title="Luxury Needs: ${p.luxuryNeedsPercent.toFixed(1)}%">
              <div class="need-fill" style="width: ${p.luxuryNeedsPercent}%; background: #60a5fa;"></div>
            </div>
          </div>
          <div class="pop-cell pop-wealth">
            ${p.wealthDucats.toFixed(1)} D 
            <small class="${p.wealthMonthlyDelta >= 0 ? 'pos' : 'neg'}">(${p.wealthMonthlyDelta >= 0 ? '+' : ''}${p.wealthMonthlyDelta.toFixed(1)})</small>
          </div>
          <div class="pop-cell pop-militancy" style="color: ${militancyColor}; font-weight: bold;">
            ${p.militancy.toFixed(1)} / 10
            <span class="vector-arrow">${p.militancyDelta >= 0 ? '▲' : '▼'}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ui-window-content demographics-window">
        <div class="window-tab-bar">
          <button class="win-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Class & Culture Breakdown</button>
          <button class="win-tab-btn ${this.activeTab === 'ledger' ? 'active' : ''}" data-tab="ledger">Pop Clusters Ledger (${filtered.length})</button>
        </div>
        <div class="window-body-scroll">
          <div class="demo-summary-deck">
            <div class="demo-metric-badge">
              <span class="badge-title">Total Census</span>
              <span class="badge-val">${totalPop.toLocaleString()}</span>
            </div>
            <div class="demo-metric-badge">
              <span class="badge-title">Active Pop Clusters</span>
              <span class="badge-val">${filtered.length} Indexed</span>
            </div>
            <div class="demo-metric-badge">
              <span class="badge-title">Rebellion Unrest Index</span>
              <span class="badge-val" style="color: #f87171;">Low (1.4)</span>
            </div>
          </div>

          <div class="strata-distribution-card">
            <h4>Social Class Strata Partition</h4>
            <div class="strata-bars-grid">${strataBreakdownHtml}</div>
          </div>

          <div class="pop-ledger-container">
            <div class="pop-ledger-header">
              <span class="pop-cell pop-loc">Location</span>
              <span class="pop-cell pop-identity">Class & Culture</span>
              <span class="pop-cell pop-size">Headcount</span>
              <span class="pop-cell pop-needs">Basic & Lux Needs</span>
              <span class="pop-cell pop-wealth">Wealth & Delta</span>
              <span class="pop-cell pop-militancy">Militancy Risk</span>
            </div>
            <div class="pop-virtual-scroll-area">
              ${popRowsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
