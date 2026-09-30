import { EstateType } from '../core/types.ts';
import { PopDemographicEngine } from '../demographics/pop.ts';

export interface EstatePrivilege {
  id: string;
  name: string;
  target_estate: EstateType;
  loyalty_boost: number; // e.g. +20
  crown_power_drain: number; // e.g. -0.05 global crown power reduction
  tax_efficiency_penalty: number; // e.g. -0.08 tax efficiency reduction
  active: boolean;
  revocation_crown_power_cost: number;
}

export interface EstateState {
  type: EstateType;
  raw_power: number; // 0.0 to 1.0 (share of total realm power)
  loyalty: number; // 0.0 to 100.0
  loyalty_equilibrium: number;
  institutional_wealth: number; // Ducats in private vaults
  land_share: number; // 0.0 to 1.0
  active_privileges: string[];
}

export class EstateGovernanceEngine {
  private estates: Map<EstateType, EstateState> = new Map();
  private privilegeDefinitions: Map<string, EstatePrivilege> = new Map();

  constructor() {
    this.initializeDefaultEstates();
    this.initializeDefaultPrivileges();
  }

  private initializeDefaultEstates(): void {
    const types: EstateType[] = [
      EstateType.Nobility,
      EstateType.Clergy,
      EstateType.Burghers,
      EstateType.Commoners,
      EstateType.Tribes
    ];

    for (const t of types) {
      this.estates.set(t, {
        type: t,
        raw_power: 0.2,
        loyalty: 60.0,
        loyalty_equilibrium: 60.0,
        institutional_wealth: 500.0,
        land_share: t === EstateType.Nobility ? 0.45 : (t === EstateType.Clergy ? 0.25 : 0.1),
        active_privileges: []
      });
    }
  }

  private initializeDefaultPrivileges(): void {
    const privileges: EstatePrivilege[] = [
      {
        id: 'feudal_tax_exemption',
        name: 'Feudal Tithe Exemption',
        target_estate: EstateType.Nobility,
        loyalty_boost: 25.0,
        crown_power_drain: 0.08,
        tax_efficiency_penalty: 0.12,
        active: false,
        revocation_crown_power_cost: 0.25
      },
      {
        id: 'burgher_trade_monopoly',
        name: 'Burgher Guild Monopoly Charters',
        target_estate: EstateType.Burghers,
        loyalty_boost: 20.0,
        crown_power_drain: 0.05,
        tax_efficiency_penalty: 0.06,
        active: false,
        revocation_crown_power_cost: 0.20
      },
      {
        id: 'ecclesiastical_courts',
        name: 'Ecclesiastical Jurisdiction',
        target_estate: EstateType.Clergy,
        loyalty_boost: 18.0,
        crown_power_drain: 0.06,
        tax_efficiency_penalty: 0.05,
        active: false,
        revocation_crown_power_cost: 0.15
      }
    ];

    for (const p of privileges) {
      this.privilegeDefinitions.set(p.id, p);
    }
  }

  public getEstate(type: EstateType): EstateState {
    return this.estates.get(type)!;
  }

  public getAllEstates(): EstateState[] {
    return Array.from(this.estates.values());
  }

  /**
   * Recalculates estate power & equilibrium dynamically
   */
  public updateEstatePowerEquilibriums(popEngine: PopDemographicEngine, crownPower: number): void {
    const pops = popEngine.getAllPops();
    const totalPops = Math.max(1, popEngine.getTotalPopulation());

    // Aggregate pop size and wealth per estate
    const popSums: Record<EstateType, number> = {
      [EstateType.Nobility]: 0,
      [EstateType.Clergy]: 0,
      [EstateType.Burghers]: 0,
      [EstateType.Commoners]: 0,
      [EstateType.Tribes]: 0
    };
    const wealthSums: Record<EstateType, number> = {
      [EstateType.Nobility]: 0,
      [EstateType.Clergy]: 0,
      [EstateType.Burghers]: 0,
      [EstateType.Commoners]: 0,
      [EstateType.Tribes]: 0
    };

    for (const pop of pops) {
      popSums[pop.estate_type] += pop.size;
      wealthSums[pop.estate_type] += pop.wealth;
    }

    const totalWealth = Object.values(wealthSums).reduce((a, b) => a + b, 1);

    for (const estate of this.estates.values()) {
      const popShare = popSums[estate.type] / totalPops;
      const wealthShare = wealthSums[estate.type] / totalWealth;

      // Base weight: Nobility and Clergy exert disproportionate institutional leverage
      let politicalWeight = 1.0;
      if (estate.type === EstateType.Nobility) politicalWeight = 3.5;
      if (estate.type === EstateType.Clergy) politicalWeight = 2.2;
      if (estate.type === EstateType.Burghers) politicalWeight = 2.0;
      if (estate.type === EstateType.Commoners) politicalWeight = 0.5;

      // Raw Power calculation
      estate.raw_power = (popShare * 0.3 + wealthShare * 0.4 + estate.land_share * 0.3) * politicalWeight;

      // Loyalty Equilibrium calculation:
      // High crown power creates resentment among powerful estates
      const crownResentment = crownPower * (estate.type === EstateType.Nobility ? 35.0 : 20.0);
      const privilegeLoyaltyMod = estate.active_privileges.length * 10.0;

      estate.loyalty_equilibrium = Math.max(10.0, Math.min(100.0, 50.0 + privilegeLoyaltyMod - crownResentment));

      // Gradual drift towards equilibrium
      estate.loyalty += (estate.loyalty_equilibrium - estate.loyalty) * 0.05;
    }
  }

  /**
   * Privilege State Machine: Grant Privilege
   */
  public grantPrivilege(privilegeId: string, currentCrownPower: number): { success: boolean; newCrownPower: number } {
    const privilege = this.privilegeDefinitions.get(privilegeId);
    if (!privilege || privilege.active) {
      return { success: false, newCrownPower: currentCrownPower };
    }

    const estate = this.estates.get(privilege.target_estate);
    if (!estate) return { success: false, newCrownPower: currentCrownPower };

    privilege.active = true;
    estate.active_privileges.push(privilege.id);

    // Boost short-term loyalty
    estate.loyalty = Math.min(100.0, estate.loyalty + privilege.loyalty_boost);

    // Permanent Crown Power drain
    const newCrownPower = Math.max(0.05, currentCrownPower - privilege.crown_power_drain);

    return { success: true, newCrownPower };
  }

  /**
   * Privilege State Machine: Revoke Privilege
   */
  public revokePrivilege(privilegeId: string, currentCrownPower: number): { success: boolean; newCrownPower: number } {
    const privilege = this.privilegeDefinitions.get(privilegeId);
    if (!privilege || !privilege.active) {
      return { success: false, newCrownPower: currentCrownPower };
    }

    if (currentCrownPower < privilege.revocation_crown_power_cost) {
      return { success: false, newCrownPower: currentCrownPower };
    }

    const estate = this.estates.get(privilege.target_estate);
    if (!estate) return { success: false, newCrownPower: currentCrownPower };

    privilege.active = false;
    estate.active_privileges = estate.active_privileges.filter(p => p !== privilege.id);

    // Massive loyalty penalty on revocation
    estate.loyalty = Math.max(5.0, estate.loyalty - 35.0);

    // Regain Crown Power
    const newCrownPower = Math.min(1.0, currentCrownPower + (privilege.crown_power_drain * 0.8));

    return { success: true, newCrownPower };
  }

  public getGlobalTaxEfficiencyModifier(): number {
    let penalty = 0.0;
    for (const p of this.privilegeDefinitions.values()) {
      if (p.active) {
        penalty += p.tax_efficiency_penalty;
      }
    }
    return Math.max(0.1, 1.0 - penalty);
  }
}
