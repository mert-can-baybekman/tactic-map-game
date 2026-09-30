/**
 * Military Logistics & Strategic Army Window
 * Features Army/Navy Stack Details and the Tactical Combat Grid.
 */

import { BaseUIWindow } from '../base.ts';

export interface CombatUnitCard {
  slotId: number;
  row: 'front' | 'back' | 'flank';
  unitType: 'Men-at-Arms' | 'Longbowmen' | 'Heavy Cavalry' | 'Bombard Artillery';
  icon: string;
  strengthCurrent: number;
  strengthMax: number;
  moraleCurrent: number;
  moraleMax: number;
  damageInflictedTick: number;
  damageTakenTick: number;
  isEngaged: boolean;
}

export class MilitaryWindow extends BaseUIWindow {
  public armyName: string = 'Royal Vanguard of England';
  public commanderName: string = 'King Edward III (Valiant Warrior)';
  public commanderMartial: number = 85;
  public shockBonusMultiplier: number = 1.15; // +15% Shock Damage
  public currentMorale: number = 94.5;
  public maxMorale: number = 100.0;
  public totalManpower: number = 8500;
  public reinforcementRateSlider: number = 100; // 0 - 100%
  public supplyDepotPathClear: boolean = true;
  public attritionRate: number = 1.0; // 1.0%

  public combatGrid: CombatUnitCard[] = [
    // Front Row (Center)
    { slotId: 1, row: 'front', unitType: 'Men-at-Arms', icon: '🛡️', strengthCurrent: 980, strengthMax: 1000, moraleCurrent: 92, moraleMax: 100, damageInflictedTick: 48, damageTakenTick: 32, isEngaged: true },
    { slotId: 2, row: 'front', unitType: 'Men-at-Arms', icon: '🛡️', strengthCurrent: 940, strengthMax: 1000, moraleCurrent: 88, moraleMax: 100, damageInflictedTick: 52, damageTakenTick: 41, isEngaged: true },
    { slotId: 3, row: 'front', unitType: 'Men-at-Arms', icon: '🛡️', strengthCurrent: 990, strengthMax: 1000, moraleCurrent: 95, moraleMax: 100, damageInflictedTick: 44, damageTakenTick: 25, isEngaged: true },
    // Flanks
    { slotId: 4, row: 'flank', unitType: 'Heavy Cavalry', icon: '🐎', strengthCurrent: 480, strengthMax: 500, moraleCurrent: 98, moraleMax: 100, damageInflictedTick: 85, damageTakenTick: 15, isEngaged: true },
    { slotId: 5, row: 'flank', unitType: 'Heavy Cavalry', icon: '🐎', strengthCurrent: 500, strengthMax: 500, moraleCurrent: 100, moraleMax: 100, damageInflictedTick: 92, damageTakenTick: 12, isEngaged: true },
    // Back Row
    { slotId: 6, row: 'back', unitType: 'Longbowmen', icon: '🏹', strengthCurrent: 1000, strengthMax: 1000, moraleCurrent: 96, moraleMax: 100, damageInflictedTick: 65, damageTakenTick: 0, isEngaged: true },
    { slotId: 7, row: 'back', unitType: 'Longbowmen', icon: '🏹', strengthCurrent: 1000, strengthMax: 1000, moraleCurrent: 96, moraleMax: 100, damageInflictedTick: 62, damageTakenTick: 0, isEngaged: true },
    { slotId: 8, row: 'back', unitType: 'Bombard Artillery', icon: '💣', strengthCurrent: 120, strengthMax: 120, moraleCurrent: 100, moraleMax: 100, damageInflictedTick: 110, damageTakenTick: 0, isEngaged: true }
  ];

  constructor() {
    super('window_military', 'Grand Army Headquarters & Tactical Combat', '⚔️');
  }

  protected onSimulationTick(simulationData: any): void {
    // If army has general with shock bonus, simulate tick damage
    for (const card of this.combatGrid) {
      if (card.isEngaged) {
        card.damageInflictedTick = Math.round(card.damageInflictedTick * (1.0 + (Math.random() * 0.1 - 0.05)));
      }
    }
    this.markDirty();
  }

  public render(simData: any): string {
    const frontUnits = this.combatGrid.filter(u => u.row === 'front');
    const flankUnits = this.combatGrid.filter(u => u.row === 'flank');
    const backUnits = this.combatGrid.filter(u => u.row === 'back');

    const renderUnitCard = (u: CombatUnitCard) => `
      <div class="combat-grid-card ${u.row}">
        <div class="unit-card-top">
          <span class="unit-icon">${u.icon}</span>
          <strong class="unit-name">${u.unitType}</strong>
        </div>
        <div class="unit-strength-bar">
          <div class="strength-fill" style="width: ${(u.strengthCurrent / u.strengthMax) * 100}%;"></div>
        </div>
        <div class="unit-morale-bar">
          <div class="morale-fill" style="width: ${(u.moraleCurrent / u.moraleMax) * 100}%;"></div>
        </div>
        <div class="unit-combat-vectors">
          <span class="dmg-dealt" title="Tick Damage Dealt">⚔️ +${u.damageInflictedTick}</span>
          <span class="dmg-taken" title="Tick Casualties Taken">🩸 -${u.damageTakenTick}</span>
        </div>
      </div>
    `;

    return `
      <div class="ui-window-content military-window">
        <div class="window-tab-bar">
          <button class="win-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Army Stack Details</button>
          <button class="win-tab-btn ${this.activeTab === 'combat' ? 'active' : ''}" data-tab="combat">Tactical Combat Grid (Active Battle)</button>
        </div>
        <div class="window-body-scroll">
          <div class="army-hero-banner">
            <div class="army-crest">⚔️</div>
            <div class="army-info">
              <h3>${this.armyName}</h3>
              <div class="commander-badge">
                <span>Commander: <strong>${this.commanderName}</strong></span>
                <span class="martial-pill">Martial: ${this.commanderMartial} (+15% Shock Modifier)</span>
              </div>
            </div>
            <div class="army-morale-box">
              <span>Morale: <strong>${this.currentMorale.toFixed(1)} / ${this.maxMorale}</strong></span>
              <div class="meter-track"><div class="meter-bar" style="width: ${(this.currentMorale / this.maxMorale) * 100}%; background: #10b981;"></div></div>
            </div>
          </div>

          ${this.activeTab === 'combat' ? `
            <div class="combat-grid-container">
              <div class="combat-grid-header">
                <h4>Tactical Battle Array (Frontage Width: 30)</h4>
                <span class="pipeline-badge ${this.supplyDepotPathClear ? 'connected' : 'starved'}">
                  ${this.supplyDepotPathClear ? '✓ Supply Pipeline Connected' : '⚠️ Route Severed (Starvation)'}
                </span>
              </div>

              <!-- FLANKS & FRONT ROW -->
              <div class="grid-tactical-tier">
                <span class="tier-label">Flanks & Vanguard Engagement:</span>
                <div class="grid-cards-row">
                  ${flankUnits.slice(0, 1).map(renderUnitCard).join('')}
                  ${frontUnits.map(renderUnitCard).join('')}
                  ${flankUnits.slice(1, 2).map(renderUnitCard).join('')}
                </div>
              </div>

              <!-- BACK ROW -->
              <div class="grid-tactical-tier">
                <span class="tier-label">Reserve, Ranged & Bombard Artillery:</span>
                <div class="grid-cards-row">
                  ${backUnits.map(renderUnitCard).join('')}
                </div>
              </div>
            </div>
          ` : `
            <div class="army-stack-settings">
              <div class="army-slider-block">
                <label>Reinforcement Priority: <strong>${this.reinforcementRateSlider}%</strong></label>
                <input type="range" min="0" max="100" value="${this.reinforcementRateSlider}" class="reinforce-slider">
              </div>
              <div class="army-stats-deck">
                <div class="stat-pill">Effective Strength: <strong>${this.totalManpower.toLocaleString()} Men</strong></div>
                <div class="stat-pill">Attrition Rate: <strong>${this.attritionRate}% / mo</strong></div>
                <div class="stat-pill">Shock Damage Multiplier: <strong>${this.shockBonusMultiplier}x</strong></div>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
