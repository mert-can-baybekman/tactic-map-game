/**
 * Comprehensive Estate & Parliament / Diet Window
 * Manages Estate Leverage HUD and the Diet / Parliament Assembly Floor.
 */

import { BaseUIWindow } from '../base.ts';

export interface EstateCardData {
  type: string;
  icon: string;
  power: number;      // 0 - 100%
  loyalty: number;    // 0 - 100%
  wealthGold: number; // Stored Institutional Wealth
  privilegesCount: number;
  demandedConcessions: string[];
}

export interface PrivilegeEntry {
  id: string;
  name: string;
  estateType: string;
  active: boolean;
  loyaltyBonus: number;
  crownPowerCost: number;
  economicEffect: string;
}

export interface ParliamentIssue {
  id: string;
  title: string;
  description: string;
  supportNobility: boolean;
  supportClergy: boolean;
  supportBurghers: boolean;
  ayeVotes: number;
  nayVotes: number;
  passed: boolean;
}

export class EstatesWindow extends BaseUIWindow {
  public estates: EstateCardData[] = [
    {
      type: 'Nobility',
      icon: '🛡️',
      power: 45.0,
      loyalty: 65.3,
      wealthGold: 528.0,
      privilegesCount: 3,
      demandedConcessions: ['Feudal Tithe Exemption Guarantee', 'Levy Commutation Caps']
    },
    {
      type: 'Clergy',
      icon: '⛪',
      power: 22.0,
      loyalty: 56.7,
      wealthGold: 500.0,
      privilegesCount: 2,
      demandedConcessions: ['Ecclesiastical Court Autonomy']
    },
    {
      type: 'Burghers',
      icon: '🐑',
      power: 20.0,
      loyalty: 56.7,
      wealthGold: 512.0,
      privilegesCount: 3,
      demandedConcessions: ['Wool Staple Monopoly in Calais', 'Hanseatic Tariff Parity']
    },
    {
      type: 'Commoners',
      icon: '🌾',
      power: 10.0,
      loyalty: 52.0,
      wealthGold: 240.0,
      privilegesCount: 1,
      demandedConcessions: ['Relief from Corvée Labor']
    },
    {
      type: 'Tribes',
      icon: '🏹',
      power: 3.0,
      loyalty: 50.0,
      wealthGold: 85.0,
      privilegesCount: 0,
      demandedConcessions: ['Borderland Foraging Rights']
    }
  ];

  public privileges: PrivilegeEntry[] = [
    {
      id: 'feudal_tithe_exemption',
      name: 'Feudal Tithe Exemption',
      estateType: 'Nobility',
      active: true,
      loyaltyBonus: 15.0,
      crownPowerCost: 10.0,
      economicEffect: '-20% tax skimming deduction on noble lands'
    },
    {
      id: 'wool_export_monopoly',
      name: 'Wool Export Monopoly',
      estateType: 'Burghers',
      active: true,
      loyaltyBonus: 12.0,
      crownPowerCost: 8.0,
      economicEffect: '+25% monthly Burgher wealth index, -10% Crown Control across Dover-Calais'
    },
    {
      id: 'clerical_tithe_immunity',
      name: 'Papal Sanctuary & Tithe Immunity',
      estateType: 'Clergy',
      active: true,
      loyaltyBonus: 10.0,
      crownPowerCost: 6.0,
      economicEffect: '+0.5 Papal Influence, -5% Church land taxation'
    },
    {
      id: 'guild_charter_rights',
      name: 'Charter of Urban Guild Freeholds',
      estateType: 'Burghers',
      active: true,
      loyaltyBonus: 8.0,
      crownPowerCost: 5.0,
      economicEffect: '+10% workshop production output in market hubs'
    }
  ];

  public activeBill: ParliamentIssue = {
    id: 'bill_hundred_years_war_subsidy',
    title: 'Statute of Continental War Subsidies (1350)',
    description: 'Levies a nationwide extraordinary subsidy on all wool sacks and feudal manors to finance campaigns in Normandy and Gascony.',
    supportNobility: false,
    supportClergy: true,
    supportBurghers: false,
    ayeVotes: 48,
    nayVotes: 52,
    passed: false
  };

  constructor() {
    super('window_estates', 'Estates of the Realm & Parliament Floor', '⚖️');
  }

  public togglePrivilege(privilegeId: string): boolean {
    const priv = this.privileges.find(p => p.id === privilegeId);
    if (!priv) return false;
    priv.active = !priv.active;

    // Mutate corresponding estate loyalty
    const estate = this.estates.find(e => e.type === priv.estateType);
    if (estate) {
      estate.loyalty += priv.active ? priv.loyaltyBonus : -priv.loyaltyBonus;
      estate.loyalty = Math.max(0, Math.min(100, estate.loyalty));
    }

    this.markDirty();
    return true;
  }

  public voteParliamentBill(bribeNobility: boolean, bribeBurghers: boolean): boolean {
    let aye = 40;
    if (bribeNobility) aye += 25;
    if (bribeBurghers) aye += 20;

    this.activeBill.ayeVotes = aye;
    this.activeBill.nayVotes = 100 - aye;
    this.activeBill.passed = aye >= 50;
    this.markDirty();
    return this.activeBill.passed;
  }

  protected onSimulationTick(simulationData: any): void {
    if (simulationData?.estates) {
      for (const simEst of simulationData.estates) {
        const target = this.estates.find(e => e.type === simEst.type);
        if (target) {
          target.wealthGold = simEst.wealth;
          target.loyalty = simEst.loyalty;
          target.power = simEst.power;
        }
      }
    }
    this.markDirty();
  }

  public render(simData: any): string {
    const estateCardsHtml = this.estates.map(e => `
      <div class="estate-hud-card">
        <div class="estate-card-head">
          <span class="estate-badge-icon">${e.icon}</span>
          <div class="estate-title-block">
            <h4>${e.type}</h4>
            <span class="estate-priv-count">${e.privilegesCount} Active Privileges</span>
          </div>
          <span class="estate-wealth-tag">${e.wealthGold.toFixed(1)} Ducats</span>
        </div>
        <div class="estate-bars-container">
          <div class="metric-meter">
            <div class="meter-label"><span>Power</span><strong>${e.power.toFixed(1)}%</strong></div>
            <div class="meter-track"><div class="meter-bar power" style="width: ${e.power}%;"></div></div>
          </div>
          <div class="metric-meter">
            <div class="meter-label"><span>Loyalty</span><strong style="color: ${e.loyalty >= 50 ? '#34d399' : '#f87171'};">${e.loyalty.toFixed(1)}%</strong></div>
            <div class="meter-track"><div class="meter-bar loyalty" style="width: ${e.loyalty}%; background: ${e.loyalty >= 50 ? '#10b981' : '#ef4444'};"></div></div>
          </div>
        </div>
        <div class="estate-demands-box">
          <span class="demands-title">Current Assembly Demands:</span>
          <ul>${e.demandedConcessions.map(d => `<li>• ${d}</li>`).join('')}</ul>
        </div>
      </div>
    `).join('');

    const privilegesHtml = this.privileges.map(p => `
      <div class="privilege-row-card ${p.active ? 'active' : 'revoked'}">
        <div class="priv-main">
          <div class="priv-header">
            <strong>${p.name}</strong>
            <span class="priv-estate-tag">${p.estateType}</span>
          </div>
          <div class="priv-effect">${p.economicEffect}</div>
          <div class="priv-meta">Loyalty Delta: +${p.loyaltyBonus}% • Crown Power Cost: -${p.crownPowerCost}%</div>
        </div>
        <button class="priv-toggle-btn ${p.active ? 'btn-revoke' : 'btn-grant'}" data-priv-id="${p.id}">
          ${p.active ? 'Revoke Privilege' : 'Grant Privilege'}
        </button>
      </div>
    `).join('');

    return `
      <div class="ui-window-content estates-window">
        <div class="window-tab-bar">
          <button class="win-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Estates Leverage HUD</button>
          <button class="win-tab-btn ${this.activeTab === 'parliament' ? 'active' : ''}" data-tab="parliament">Parliament & Diet Floor</button>
          <button class="win-tab-btn ${this.activeTab === 'privileges' ? 'active' : ''}" data-tab="privileges">Crown Privileges Ledger (${this.privileges.length})</button>
        </div>
        <div class="window-body-scroll">
          ${this.activeTab === 'parliament' ? `
            <div class="parliament-assembly-floor">
              <div class="bill-hero-card">
                <div class="bill-title-bar">
                  <h3>📜 ${this.activeBill.title}</h3>
                  <span class="bill-status-pill ${this.activeBill.passed ? 'passed' : 'pending'}">
                    ${this.activeBill.passed ? 'ENACTED LAW' : 'PENDING DIVISION'}
                  </span>
                </div>
                <p class="bill-desc">${this.activeBill.description}</p>
                <div class="vote-chamber-bar">
                  <div class="vote-segment ayes" style="width: ${this.activeBill.ayeVotes}%;">Ayes: ${this.activeBill.ayeVotes}</div>
                  <div class="vote-segment noes" style="width: ${this.activeBill.nayVotes}%;">Noes: ${this.activeBill.nayVotes}</div>
                </div>
                <div class="parliament-actions">
                  <button class="action-btn" id="btn-concede-nobility">💰 Offer Nobility Feudal Guarantees (+25 Votes)</button>
                  <button class="action-btn" id="btn-concede-burghers">🐑 Grant Burgher Export Subsidy (+20 Votes)</button>
                  <button class="action-btn btn-primary" id="btn-call-division">⚖️ Call Division & Vote</button>
                </div>
              </div>
            </div>
          ` : this.activeTab === 'privileges' ? `
            <div class="privileges-ledger-list">${privilegesHtml}</div>
          ` : `
            <div class="estates-hud-grid">${estateCardsHtml}</div>
          `}
        </div>
      </div>
    `;
  }
}
