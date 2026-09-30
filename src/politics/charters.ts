/**
 * Active Royal Charters & Estate Leverage Management
 * Inspired by Project Caesar Institutional Decrees & Charters
 */

import { EstateType } from '../core/types.ts';

export interface RoyalCharterDefinition {
  id: string;
  name: string;
  target_estate: EstateType;
  loyalty_floor: number;          // e.g. +15% minimum floor
  loyalty_bonus: number;          // e.g. +15.0
  wealth_accumulation_rate: number; // e.g. +25% monthly
  tax_skimming_penalty: number;   // e.g. -20% from tax skimming where estate dominates
  crown_control_penalty: number;  // e.g. -10% control penalty across connected hubs
  active: boolean;
  revocation_unrest_cost: number;
}

export class RoyalCharterRegistry {
  private charters: Map<string, RoyalCharterDefinition> = new Map();

  constructor() {
    this.initializeDefaultCharters();
  }

  private initializeDefaultCharters(): void {
    // 1. Feudal Tithe Exemption (Nobility)
    this.charters.set('feudal_tithe_exemption', {
      id: 'feudal_tithe_exemption',
      name: 'Feudal Tithe Exemption',
      target_estate: EstateType.Nobility,
      loyalty_floor: 15.0,
      loyalty_bonus: 15.0,
      wealth_accumulation_rate: 0.10,
      tax_skimming_penalty: 0.20, // -20% tax deduction on noble-dominated locations
      crown_control_penalty: 0.0,
      active: true,
      revocation_unrest_cost: 25.0
    });

    // 2. Wool Export Monopoly (Burghers)
    this.charters.set('wool_export_monopoly', {
      id: 'wool_export_monopoly',
      name: 'Wool Export Monopoly',
      target_estate: EstateType.Burghers,
      loyalty_floor: 10.0,
      loyalty_bonus: 20.0,
      wealth_accumulation_rate: 0.25, // +25% monthly wealth accumulation index
      tax_skimming_penalty: 0.0,
      crown_control_penalty: 0.10, // -10% Crown Control across Dover-Calais trade graph
      active: true,
      revocation_unrest_cost: 20.0
    });
  }

  public getCharter(id: string): RoyalCharterDefinition | undefined {
    return this.charters.get(id);
  }

  public getAllCharters(): RoyalCharterDefinition[] {
    return Array.from(this.charters.values());
  }

  public activateCharter(id: string): boolean {
    const charter = this.charters.get(id);
    if (!charter) return false;
    charter.active = true;
    return true;
  }

  public revokeCharter(id: string): boolean {
    const charter = this.charters.get(id);
    if (!charter) return false;
    charter.active = false;
    return true;
  }

  /**
   * Applies active charter modifiers to estate tax skimming calculations
   */
  public computeCharterTaxModifier(isNobleDominated: boolean): number {
    const titheCharter = this.charters.get('feudal_tithe_exemption');
    if (titheCharter && titheCharter.active && isNobleDominated) {
      return 1.0 - titheCharter.tax_skimming_penalty; // Flat -20% deduction
    }
    return 1.0;
  }

  /**
   * Computes the Crown Control penalty from active Burgher monopolies
   */
  public computeCharterControlPenalty(isConnectedToDoverCalais: boolean): number {
    const woolCharter = this.charters.get('wool_export_monopoly');
    if (woolCharter && woolCharter.active && isConnectedToDoverCalais) {
      return woolCharter.crown_control_penalty; // -10% control penalty
    }
    return 0.0;
  }

  /**
   * Returns minimum loyalty floor and bonus
   */
  public getEstateLoyaltyModifiers(estate: EstateType): { bonus: number; floor: number } {
    let bonus = 0;
    let floor = 0;
    for (const c of this.charters.values()) {
      if (c.active && c.target_estate === estate) {
        bonus += c.loyalty_bonus;
        floor = Math.max(floor, c.loyalty_floor);
      }
    }
    return { bonus, floor };
  }
}
