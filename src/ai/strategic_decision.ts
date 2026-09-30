/**
 * Macro-Strategic AI Aggression, Conquest & Defense Matrix
 * Subsystem: /src/ai/strategic_decision.ts
 */

export const AIStrategicStance = {
  Passive_Defense: 'Passive_Defense',
  Armed_Neutrality: 'Armed_Neutrality',
  Opportunistic_Pressure: 'Opportunistic_Pressure',
  Aggressive_Conquest: 'Aggressive_Conquest'
} as const;

export type AIStrategicStance = typeof AIStrategicStance[keyof typeof AIStrategicStance];

export interface NeighborThreatProfile {
  neighbor_country_tag: string;
  neighbor_army_size: number;
  my_army_size: number;
  bilateral_opinion: number; // -1.0 to 1.0 (or -100 to 100)
  has_casus_belli: boolean;
  target_crown_control: number; // 0.0 to 1.0
  is_in_civil_war: boolean;
  threat_score: number;
}

export interface StrategicLocationCandidate {
  locationId: number;
  countryTag: string;
  isCapital: boolean;
  isMarketHub: boolean;
  burgherWealth: number;
  zoneOfControlActive: boolean;
}

export interface StrategicConquestPlan {
  target_country_tag: string;
  target_location_id: number;
  stance: AIStrategicStance;
  assigned_army_size: number;
  invasion_vector_path: number[];
  prioritize_market_vertex: boolean;
  war_declaration_recommended: boolean;
  expected_warscore_yield: number;
}

export class AISecurityEvaluator {
  /**
   * Calculates threat score of an adjacent country
   * Threat_Score = (Neighbor_Army_Size / My_Army_Size) * (1.0 - Bilateral_Opinion)
   */
  public static calculateThreatScore(
    neighborArmy: number,
    myArmy: number,
    bilateralOpinion: number
  ): number {
    const safeMyArmy = Math.max(100, myArmy);
    const armyRatio = neighborArmy / safeMyArmy;
    
    // Normalize opinion if provided in range [-100, 100]
    const normalizedOpinion = Math.abs(bilateralOpinion) > 1.0
      ? bilateralOpinion / 100.0
      : bilateralOpinion;

    const hostilityFactor = Math.max(0.0, Math.min(2.0, 1.0 - normalizedOpinion));
    return Number((armyRatio * hostilityFactor).toFixed(4));
  }

  /**
   * Build complete threat profile for a neighbor
   */
  public static buildThreatProfile(
    neighborTag: string,
    neighborArmy: number,
    myArmy: number,
    opinion: number,
    hasCB: boolean,
    targetCrownControl: number,
    isCivilWar: boolean
  ): NeighborThreatProfile {
    const threatScore = this.calculateThreatScore(neighborArmy, myArmy, opinion);
    return {
      neighbor_country_tag: neighborTag,
      neighbor_army_size: neighborArmy,
      my_army_size: myArmy,
      bilateral_opinion: opinion,
      has_casus_belli: hasCB,
      target_crown_control: targetCrownControl,
      is_in_civil_war: isCivilWar,
      threat_score: threatScore
    };
  }

  /**
   * Evaluates the Opportunity Matrix:
   * If Crown Control < 40% (0.40) or fighting a Civil War, AI sets stance to Aggressive_Conquest
   */
  public static evaluateOpportunityStance(
    profile: NeighborThreatProfile
  ): { stance: AIStrategicStance; triggerAggression: boolean } {
    if (profile.target_crown_control < 0.40 || profile.is_in_civil_war) {
      return {
        stance: AIStrategicStance.Aggressive_Conquest,
        triggerAggression: true
      };
    }

    if (profile.threat_score > 1.25 && profile.has_casus_belli) {
      return {
        stance: AIStrategicStance.Opportunistic_Pressure,
        triggerAggression: true
      };
    }

    if (profile.threat_score > 0.8) {
      return {
        stance: AIStrategicStance.Armed_Neutrality,
        triggerAggression: false
      };
    }

    return {
      stance: AIStrategicStance.Passive_Defense,
      triggerAggression: false
    };
  }

  /**
   * Core execution function: EvaluateWarDeclarationOpportunity()
   * Evaluates adjacent nodes, identifies crumbling targets (Crown Control < 40% or Civil War),
   * prioritizes high-wealth burgher market hubs or capitals, and computes optimal invasion vectors
   * bypassing Zone of Control (ZoC) forts.
   */
  public static evaluateWarDeclarationOpportunity(
    myTag: string,
    myArmySize: number,
    neighborProfiles: NeighborThreatProfile[],
    locationCandidates: StrategicLocationCandidate[],
    startLocationId: number,
    pathRouter?: (
      fromId: number,
      toId: number,
      isPassable?: (id: number) => boolean,
      stepCostModifier?: (from: number, to: number) => number
    ) => number[]
  ): StrategicConquestPlan | null {
    // 1. Filter neighbors suitable for conquest
    const viableProfiles = neighborProfiles.filter(p => {
      const evaluation = this.evaluateOpportunityStance(p);
      return evaluation.triggerAggression;
    });

    if (viableProfiles.length === 0) {
      return null;
    }

    // Sort by weakness: prioritize lowest crown control and civil wars
    viableProfiles.sort((a, b) => {
      if (a.is_in_civil_war && !b.is_in_civil_war) return -1;
      if (!a.is_in_civil_war && b.is_in_civil_war) return 1;
      return a.target_crown_control - b.target_crown_control;
    });

    const primaryTarget = viableProfiles[0];
    const targetLocations = locationCandidates.filter(loc => loc.countryTag === primaryTarget.neighbor_country_tag);

    if (targetLocations.length === 0) {
      return null;
    }

    // 2. Target selection: High-wealth burgher market vertex or capital node
    // Score targets: burgherWealth * 1.5 + (isCapital ? 500 : 0) + (isMarketHub ? 300 : 0) - (ZoC ? 200 : 0)
    targetLocations.sort((a, b) => {
      const scoreA = (a.burgherWealth * 1.5) + (a.isCapital ? 500 : 0) + (a.isMarketHub ? 300 : 0) - (a.zoneOfControlActive ? 200 : 0);
      const scoreB = (b.burgherWealth * 1.5) + (b.isCapital ? 500 : 0) + (b.isMarketHub ? 300 : 0) - (b.zoneOfControlActive ? 200 : 0);
      return scoreB - scoreA;
    });

    const chosenObjective = targetLocations[0];

    // 3. Compute invasion vector path bypassing Zone of Control (ZoC) forts
    let invasionPath: number[] = [startLocationId, chosenObjective.locationId];
    if (pathRouter) {
      // Step cost modifier imposes +500 penalty for traversing active ZoC locations unless it is the final target
      const stepCostMod = (_fromId: number, toId: number): number => {
        const candidate = locationCandidates.find(c => c.locationId === toId);
        if (candidate && candidate.zoneOfControlActive && toId !== chosenObjective.locationId) {
          return 500; // heavy ZoC evasion penalty
        }
        return 1.0;
      };

      invasionPath = pathRouter(startLocationId, chosenObjective.locationId, undefined, stepCostMod);
    }

    const assignedTroops = Math.min(myArmySize, Math.max(1000, Math.floor(primaryTarget.neighbor_army_size * 1.35)));

    return {
      target_country_tag: primaryTarget.neighbor_country_tag,
      target_location_id: chosenObjective.locationId,
      stance: AIStrategicStance.Aggressive_Conquest,
      assigned_army_size: assignedTroops,
      invasion_vector_path: invasionPath,
      prioritize_market_vertex: chosenObjective.isMarketHub || chosenObjective.burgherWealth > 300,
      war_declaration_recommended: true,
      expected_warscore_yield: chosenObjective.isCapital ? 65 : 45
    };
  }
}
