/**
 * Graph-Based Espionage & Covert Action Grid
 * Implements spy network accretion, counter-espionage mitigation,
 * and tactical covert actions (Sow Unrest, Infiltrate Administration).
 */

import type { PopEntity } from '../demographics/pop.ts';
import { EstateType } from '../core/types.ts';

export interface EspionageAgent {
  id: string;
  name: string;
  intrigueSkill: number; // 0 to 100
  assignedTargetTag?: string;
  assignedLocationId?: number;
  isCaptured?: boolean;
}

export interface SpyNetworkState {
  sourceCountryTag: string; // e.g. 'ENG'
  targetCountryTag: string; // e.g. 'FRA'
  targetLocationId: number; // e.g. 4 (Rouen) or Paris
  networkSize: number; // 0.0 to 100.0
  agent?: EspionageAgent;
  targetCounterEspionage: number; // 0.0 to 1.0
  distanceFactor: number; // 0.0 to 1.0 (closer enclaves have higher factor)
  activeInfiltratedDebuffDuration: number; // Months remaining of -25% control debuff
}

export interface CovertActionResult {
  actionName: string;
  success: boolean;
  costPaid: number;
  remainingNetwork: number;
  description: string;
  affectedPopsCount?: number;
  affectedLocationId?: number;
}

export class EspionageGridManager {
  private networks: Map<string, SpyNetworkState> = new Map();
  public baseIntrigueRate: number = 0.05; // Base intrigue scaling factor

  private getNetworkKey(source: string, target: string): string {
    return `${source}_to_${target}`;
  }

  public registerNetwork(
    sourceTag: string,
    targetTag: string,
    targetLocationId: number,
    agent: EspionageAgent,
    targetCounterEspionage: number = 0.15,
    distanceFactor: number = 0.85
  ): SpyNetworkState {
    const key = this.getNetworkKey(sourceTag, targetTag);
    const network: SpyNetworkState = {
      sourceCountryTag: sourceTag,
      targetCountryTag: targetTag,
      targetLocationId,
      networkSize: 0.0,
      agent,
      targetCounterEspionage: Math.min(0.95, Math.max(0.0, targetCounterEspionage)),
      distanceFactor: Math.min(1.0, Math.max(0.1, distanceFactor)),
      activeInfiltratedDebuffDuration: 0
    };
    this.networks.set(key, network);
    return network;
  }

  public getNetwork(sourceTag: string, targetTag: string): SpyNetworkState | undefined {
    return this.networks.get(this.getNetworkKey(sourceTag, targetTag));
  }

  public getAllNetworks(): SpyNetworkState[] {
    return Array.from(this.networks.values());
  }

  /**
   * Monthly Tick Network Growth Pass:
   * Equation:
   * Network_Growth_Delta = Base_Agent_Intrigue * (1.0 - Target_Nation_Counter_Espionage) * (Target_Location_Distance_Factor)
   */
  public executeMonthlyEspionageTick(): void {
    for (const net of this.networks.values()) {
      if (!net.agent || net.agent.isCaptured) {
        // Unmanaged network slowly decays
        net.networkSize = Math.max(0.0, net.networkSize - 1.5);
        continue;
      }

      // Equation evaluation
      const agentIntrigueFactor = net.agent.intrigueSkill * this.baseIntrigueRate; // e.g. 75 * 0.05 = 3.75
      const counterEspionageMitigation = Math.max(0.05, 1.0 - net.targetCounterEspionage);
      const distanceFactor = net.distanceFactor;

      const networkGrowthDelta = agentIntrigueFactor * counterEspionageMitigation * distanceFactor;
      net.networkSize = Math.min(100.0, Math.max(0.0, net.networkSize + networkGrowthDelta));

      if (net.activeInfiltratedDebuffDuration > 0) {
        net.activeInfiltratedDebuffDuration--;
      }
    }
  }

  /**
   * Tactical Covert Action 1: Sow Unrest (Cost: 35 Network)
   * Directly injects local +0.3 Unrest modifier to specific culture or class pops in the target location,
   * accelerating their Rebel_Faction spawning loop.
   */
  public executeSowUnrest(
    sourceTag: string,
    targetTag: string,
    targetPops: PopEntity[],
    targetClassOrCulture?: { estate?: EstateType; culture?: string }
  ): CovertActionResult {
    const net = this.getNetwork(sourceTag, targetTag);
    if (!net || net.networkSize < 35.0) {
      return {
        actionName: 'Sow Unrest',
        success: false,
        costPaid: 0,
        remainingNetwork: net?.networkSize || 0,
        description: 'Insufficient spy network size. Requires at least 35.0 Network.'
      };
    }

    net.networkSize -= 35.0;
    let affectedCount = 0;

    for (const pop of targetPops) {
      if (pop.location_id !== net.targetLocationId) continue;

      let matches = true;
      if (targetClassOrCulture?.estate && pop.estate_type !== targetClassOrCulture.estate) {
        matches = false;
      }
      if (targetClassOrCulture?.culture && pop.culture_id !== targetClassOrCulture.culture) {
        matches = false;
      }

      if (matches) {
        // Direct injection of +0.30 Unrest
        pop.militancy_unrest = Math.min(1.0, pop.militancy_unrest + 0.30);
        affectedCount++;
      }
    }

    return {
      actionName: 'Sow Unrest',
      success: true,
      costPaid: 35.0,
      remainingNetwork: net.networkSize,
      description: `Successfully agitated target pops! Injected +0.30 Unrest across ${affectedCount} pop clusters in location ${net.targetLocationId}.`,
      affectedPopsCount: affectedCount,
      affectedLocationId: net.targetLocationId
    };
  }

  /**
   * Tactical Covert Action 2: Infiltrate Administration (Cost: 50 Network)
   * Temporarily forces a flat -25% Crown Control penalty on adjacent target enclaves,
   * redirecting their monthly tax flow directly into local nobility estate balance sheets!
   */
  public executeInfiltrateAdministration(
    sourceTag: string,
    targetTag: string,
    targetLocations: Array<{ id: number; name: string; control: number; monthlyTaxBase: number }>,
    targetNobilityEstate?: { institutional_wealth: number }
  ): CovertActionResult {
    const net = this.getNetwork(sourceTag, targetTag);
    if (!net || net.networkSize < 50.0) {
      return {
        actionName: 'Infiltrate Administration',
        success: false,
        costPaid: 0,
        remainingNetwork: net?.networkSize || 0,
        description: 'Insufficient spy network size. Requires at least 50.0 Network.'
      };
    }

    net.networkSize -= 50.0;
    net.activeInfiltratedDebuffDuration = 12; // 12 months debuff

    const targetLoc = targetLocations.find(l => l.id === net.targetLocationId);
    if (targetLoc) {
      // Force flat -25% Crown Control penalty
      targetLoc.control = Math.max(0.0, targetLoc.control - 0.25);

      // Skim monthly tax flow directly into local nobility estate vault
      const siphonedTaxes = targetLoc.monthlyTaxBase * 0.25;
      if (targetNobilityEstate) {
        targetNobilityEstate.institutional_wealth += siphonedTaxes;
      }
    }

    return {
      actionName: 'Infiltrate Administration',
      success: true,
      costPaid: 50.0,
      remainingNetwork: net.networkSize,
      description: `Infiltrated ducal chancery at location ${net.targetLocationId}. Applied -25% Crown Control penalty and siphoned taxes to local barons.`,
      affectedLocationId: net.targetLocationId
    };
  }
}
