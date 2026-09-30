/**
 * Domestic Government & Cabinet Window
 * Displays Monarch & Dynastic Court alongside the Privy Council / Cabinet Grid.
 */

import { BaseUIWindow } from '../base.ts';

export interface CabinetMinister {
  id: string;
  seatTitle: string;
  characterName: string;
  portraitIcon: string;
  governingAttribute: 'Martial' | 'Diplomacy' | 'Stewardship' | 'Learning' | 'Intrigue';
  attributeValue: number;
  monthlyCostGold: number;
  activeAction: {
    id: string;
    title: string;
    description: string;
    progressPercentage: number;
    completionEtaMonths: number;
  } | null;
}

export class GovernmentWindow extends BaseUIWindow {
  public ministers: CabinetMinister[] = [
    {
      id: 'lord_high_chancellor',
      seatTitle: 'Lord High Chancellor',
      characterName: 'William of Wykeham',
      portraitIcon: '📜',
      governingAttribute: 'Stewardship',
      attributeValue: 74,
      monthlyCostGold: 14.5,
      activeAction: {
        id: 'centralize_region',
        title: 'Centralizing Home Counties',
        description: '+0.15% monthly Crown Control growth across London & Dover',
        progressPercentage: 62.4,
        completionEtaMonths: 8
      }
    },
    {
      id: 'grand_marshal',
      seatTitle: 'Grand Marshal',
      characterName: 'Henry of Grosmont (Duke of Lancaster)',
      portraitIcon: '⚔️',
      governingAttribute: 'Martial',
      attributeValue: 88,
      monthlyCostGold: 18.0,
      activeAction: {
        id: 'drill_levies',
        title: 'Reorganizing Feudal Levies',
        description: '+10% reinforcement recovery speed and +5 Army Morale',
        progressPercentage: 45.0,
        completionEtaMonths: 11
      }
    },
    {
      id: 'high_treasurer',
      seatTitle: 'High Treasurer',
      characterName: 'Walter de Merton',
      portraitIcon: '🪙',
      governingAttribute: 'Stewardship',
      attributeValue: 81,
      monthlyCostGold: 12.0,
      activeAction: {
        id: 'audit_burghers',
        title: 'Auditing Wool Customs Receipts',
        description: '+8.5 Ducats monthly tariff yield across Dover Straits',
        progressPercentage: 80.2,
        completionEtaMonths: 4
      }
    },
    {
      id: 'lord_privy_seal',
      seatTitle: 'Lord Privy Seal',
      characterName: 'John de Thoresby',
      portraitIcon: '🗡️',
      governingAttribute: 'Intrigue',
      attributeValue: 70,
      monthlyCostGold: 9.5,
      activeAction: {
        id: 'slander_rival',
        title: 'Fabricating Claims on Valois Fleets',
        description: 'Sowing maritime dissent in Normandy & Picardy ports',
        progressPercentage: 28.5,
        completionEtaMonths: 16
      }
    }
  ];

  constructor() {
    super('window_government', 'Royal Government & Privy Council', '👑');
  }

  public assignMinisterAction(ministerId: string, actionId: string, actionTitle: string, desc: string): boolean {
    const min = this.ministers.find(m => m.id === ministerId);
    if (!min) return false;
    min.activeAction = {
      id: actionId,
      title: actionTitle,
      description: desc,
      progressPercentage: 0.0,
      completionEtaMonths: 12
    };
    this.markDirty();
    return true;
  }

  protected onSimulationTick(simulationData: any): void {
    // Advance active minister actions progress
    for (const minister of this.ministers) {
      if (minister.activeAction) {
        minister.activeAction.progressPercentage = Math.min(
          100.0,
          minister.activeAction.progressPercentage + (minister.attributeValue / 100.0) * 2.5
        );
      }
    }
    this.markDirty();
  }

  public render(simData: any): string {
    const ruler = simData?.ruler || {
      firstName: 'Edward III',
      dynasty: 'Plantagenet',
      attributes: { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 }
    };

    const ministerCards = this.ministers.map(m => `
      <div class="cabinet-slot-card">
        <div class="cabinet-slot-header">
          <div class="cabinet-avatar">${m.portraitIcon}</div>
          <div>
            <div class="cabinet-title">${m.seatTitle}</div>
            <div class="cabinet-name">${m.characterName}</div>
          </div>
          <div class="cabinet-attr-pill ${m.governingAttribute.toLowerCase()}">
            ${m.governingAttribute}: <strong>${m.attributeValue}</strong>
          </div>
        </div>
        <div class="cabinet-action-box">
          ${m.activeAction ? `
            <div class="action-info">
              <span class="action-label">Active Mandate:</span>
              <strong class="action-title">${m.activeAction.title}</strong>
            </div>
            <div class="action-desc">${m.activeAction.description}</div>
            <div class="action-progress-bar">
              <div class="action-progress-fill" style="width: ${m.activeAction.progressPercentage.toFixed(1)}%;"></div>
            </div>
            <div class="action-meta">Progress: ${m.activeAction.progressPercentage.toFixed(1)}% • ETA: ${m.activeAction.completionEtaMonths} mos</div>
          ` : `
            <div class="action-idle">Seat Idle - Select Ministerial Mandate</div>
          `}
        </div>
      </div>
    `).join('');

    return `
      <div class="ui-window-content government-window">
        <div class="window-tab-bar">
          <button class="win-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Crown & Succession</button>
          <button class="win-tab-btn ${this.activeTab === 'cabinet' ? 'active' : ''}" data-tab="cabinet">Privy Council (${this.ministers.length})</button>
          <button class="win-tab-btn ${this.activeTab === 'institutions' ? 'active' : ''}" data-tab="institutions">Institutions & Laws</button>
        </div>
        <div class="window-body-scroll">
          ${this.activeTab === 'cabinet' ? `
            <div class="cabinet-grid">${ministerCards}</div>
          ` : `
            <div class="ruler-court-composite">
              <div class="court-summary-card">
                <h3>👑 Sovereign: ${ruler.firstName} ${ruler.dynasty}</h3>
                <p>Governing Monarch of the Realm with Divine Legitimacy.</p>
                <div class="stats-row">
                  <span>Martial: <strong>${ruler.attributes?.martial ?? 85}</strong></span>
                  <span>Diplo: <strong>${ruler.attributes?.diplomacy ?? 79}</strong></span>
                  <span>Steward: <strong>${ruler.attributes?.stewardship ?? 65}</strong></span>
                  <span>Learn: <strong>${ruler.attributes?.learning ?? 50}</strong></span>
                  <span>Intrigue: <strong>${ruler.attributes?.intrigue ?? 68}</strong></span>
                </div>
              </div>
              <div class="cabinet-preview-section">
                <h4>Active Privy Council Overview</h4>
                <div class="cabinet-grid compact">${ministerCards}</div>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
