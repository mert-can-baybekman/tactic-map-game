/**
 * Grand Diplomatic & Peace Negotiation Window
 * Features Bilateral Relations Dashboard and the Two-Sided Peace Deal Barter Matrix.
 */

import { BaseUIWindow } from '../base.ts';

export interface PeaceConcession {
  id: string;
  title: string;
  warScoreCost: number;
  prestigeValue: number;
  selected: boolean;
}

export interface DiplomaticRelationTarget {
  tag: string;
  name: string;
  opinion: number;
  trust: number;
  favors: number;
  treaties: string[];
}

export class DiplomacyWindow extends BaseUIWindow {
  public targetNation: DiplomaticRelationTarget = {
    tag: 'FRA',
    name: 'Kingdom of France (House Valois)',
    opinion: -85,
    trust: 12,
    favors: 0,
    treaties: ['Hundred Years War Belligerent', 'Truce Expired']
  };

  public currentWarScore: number = 42; // +42% in favor of England

  public attackerDemands: PeaceConcession[] = [
    { id: 'cede_calais', title: 'Cede Sovereignty of Calais & Pale', warScoreCost: 18, prestigeValue: 10, selected: true },
    { id: 'cede_rouen', title: 'Cede Duchy of Normandy (Rouen)', warScoreCost: 26, prestigeValue: 15, selected: false },
    { id: 'war_reparations', title: 'War Reparations (10% Monthly Income for 10 yrs)', warScoreCost: 12, prestigeValue: 5, selected: true },
    { id: 'renounce_claim_gascony', title: 'Renounce French Crown Feudal Claims on Gascony', warScoreCost: 15, prestigeValue: 10, selected: false }
  ];

  public defenderConcessions: PeaceConcession[] = [
    { id: 'lift_channel_privateers', title: 'Disband Norman Privateer Guilds', warScoreCost: -8, prestigeValue: -5, selected: true },
    { id: 'def_indemnity_gold', title: 'Pay 150 Ducats Lump-Sum Indemnity', warScoreCost: -10, prestigeValue: -5, selected: false }
  ];

  constructor() {
    super('window_diplomacy', 'Chancery of Foreign Affairs & Treaties', '🕊️');
  }

  public toggleAttackerDemand(id: string): void {
    const item = this.attackerDemands.find(c => c.id === id);
    if (item) {
      item.selected = !item.selected;
      this.markDirty();
    }
  }

  public toggleDefenderConcession(id: string): void {
    const item = this.defenderConcessions.find(c => c.id === id);
    if (item) {
      item.selected = !item.selected;
      this.markDirty();
    }
  }

  public getSelectedDemandsWarScore(): number {
    return this.attackerDemands.filter(c => c.selected).reduce((sum, c) => sum + c.warScoreCost, 0);
  }

  public getPeaceDesirability(): number {
    const demandedScore = this.getSelectedDemandsWarScore();
    // Peace desirability = WarScore - DemandedScore + (Defenders Concessions offset)
    const offset = this.defenderConcessions.filter(c => c.selected).reduce((sum, c) => sum + Math.abs(c.warScoreCost), 0);
    const balance = this.currentWarScore - demandedScore + offset;
    // Scale between -100 to +100
    return Math.max(-100, Math.min(100, balance * 2.5));
  }

  protected onSimulationTick(simulationData: any): void {
    // Reactive update if needed
  }

  public render(simData: any): string {
    const demandedScore = this.getSelectedDemandsWarScore();
    const desirability = this.getPeaceDesirability();
    const aiAccepts = desirability >= 0;

    const attackerListHtml = this.attackerDemands.map(d => `
      <div class="peace-item-row ${d.selected ? 'selected' : ''}">
        <label class="peace-checkbox-label">
          <input type="checkbox" class="cb-demand" data-id="${d.id}" ${d.selected ? 'checked' : ''}>
          <span class="peace-item-title">${d.title}</span>
        </label>
        <span class="peace-cost-badge">${d.warScoreCost}% WS</span>
      </div>
    `).join('');

    const defenderListHtml = this.defenderConcessions.map(c => `
      <div class="peace-item-row ${c.selected ? 'selected' : ''}">
        <label class="peace-checkbox-label">
          <input type="checkbox" class="cb-concession" data-id="${c.id}" ${c.selected ? 'checked' : ''}>
          <span class="peace-item-title">${c.title}</span>
        </label>
        <span class="peace-cost-badge">${Math.abs(c.warScoreCost)}% WS</span>
      </div>
    `).join('');

    return `
      <div class="ui-window-content diplomacy-window">
        <div class="window-tab-bar">
          <button class="win-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Bilateral Relations</button>
          <button class="win-tab-btn ${this.activeTab === 'peace' ? 'active' : ''}" data-tab="peace">Peace Treaty Barter Floor</button>
        </div>
        <div class="window-body-scroll">
          <div class="target-nation-banner">
            <div class="target-crest">⚜️</div>
            <div class="target-info">
              <h3>${this.targetNation.name}</h3>
              <div class="target-opinion-chips">
                <span class="chip neg">Opinion: ${this.targetNation.opinion}</span>
                <span class="chip">Trust: ${this.targetNation.trust} / 100</span>
                <span class="chip">Favors: ${this.targetNation.favors}</span>
              </div>
            </div>
            <div class="war-score-pill ${this.currentWarScore >= 0 ? 'pos' : 'neg'}">
              War Score: +${this.currentWarScore}%
            </div>
          </div>

          ${this.activeTab === 'peace' ? `
            <div class="peace-deal-matrix">
              <div class="peace-two-columns">
                <div class="peace-col attacker-col">
                  <h4>⚔️ English Demands (Attacker)</h4>
                  <div class="peace-items-scroll">${attackerListHtml}</div>
                </div>
                <div class="peace-col defender-col">
                  <h4>🛡️ French Concessions & Offers</h4>
                  <div class="peace-items-scroll">${defenderListHtml}</div>
                </div>
              </div>

              <div class="peace-evaluation-footer">
                <div class="score-summary">
                  <span>Demanded War Score: <strong>${demandedScore}%</strong> / Available: <strong>${this.currentWarScore}%</strong></span>
                </div>
                <div class="desirability-meter-block">
                  <div class="desirability-label">
                    <span>AI Peace Desirability:</span>
                    <strong style="color: ${aiAccepts ? '#34d399' : '#ef4444'};">
                      ${desirability.toFixed(0)} (${aiAccepts ? 'WILL ACCEPT' : 'WILL REFUSE'})
                    </strong>
                  </div>
                  <div class="meter-track">
                    <div class="meter-bar ${aiAccepts ? 'pos' : 'neg'}" style="width: ${Math.min(100, Math.max(10, Math.abs(desirability)))}%; background: ${aiAccepts ? '#10b981' : '#ef4444'};"></div>
                  </div>
                </div>
                <button class="action-btn btn-primary ${aiAccepts ? '' : 'disabled'}" id="btn-send-peace-envoy">
                  🕊️ Ratify Treaty & Dispatch Royal Emissary
                </button>
              </div>
            </div>
          ` : `
            <div class="treaties-overview-card">
              <h4>Active Bilateral Treaties & Envoys</h4>
              <ul>${this.targetNation.treaties.map(t => `<li>• ${t}</li>`).join('')}</ul>
              <div class="diplomatic-actions-strip">
                <button class="action-btn" id="btn-improve-relations">🕊️ Improve Relations (+2/mo)</button>
                <button class="action-btn" id="btn-fabricate-claim">🗡️ Fabricate Casus Belli</button>
                <button class="action-btn" id="btn-open-peace-matrix">⚖️ Open Peace Treaty Matrix</button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
