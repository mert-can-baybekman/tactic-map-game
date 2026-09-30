/**
 * Strategic AI Decision Matrix & Utility AI Core
 * Evaluates economic investments, adjacent threat vectors/war goals, and event choices.
 */

import type { AIDecisionContext, AIActionCandidate, StrategicWarGoal } from './types.ts';
import { UtilityMath } from './utility.ts';
import type { GameEvent, EventOption } from '../events/types.ts';

export class StrategicAIDecisionMatrix {
  /**
   * Economic AI Evaluation Loop:
   * Scans market clearing prices & local supply.
   * If weapon supply is low (< 30 units or demand > supply) and treasury > 500 gold,
   * schedules construction of a Foundry / Armory.
   */
  public evaluateEconomicDecisions(context: AIDecisionContext): AIActionCandidate[] {
    const candidates: AIActionCandidate[] = [];

    const weaponData = context.marketPrices['weapons'] || { price: 18.0, supply: 20, demand: 25 };
    const isWeaponDeficit = weaponData.supply < weaponData.demand || weaponData.supply < 30;
    const hasAdequateTreasury = context.treasuryGold >= 500.0;

    if (isWeaponDeficit && hasAdequateTreasury) {
      // Calculate desirability based on gold margin and deficit severity
      const deficitRatio = UtilityMath.clamp(weaponData.demand / Math.max(1, weaponData.supply), 1.0, 3.0) / 3.0;
      const goldAffordability = UtilityMath.clamp((context.treasuryGold - 500.0) / 1000.0, 0.2, 1.0);
      const stewardshipBonus = (context.rulerStewardship / 100.0) * 0.3;

      const desirability = UtilityMath.clamp(deficitRatio * 0.5 + goldAffordability * 0.3 + stewardshipBonus * 0.2);

      candidates.push({
        id: 'action_construct_foundry',
        category: 'ECONOMIC_CONSTRUCTION',
        title: 'Construct Munitions Foundry & Weapons Manufactory',
        desirabilityScore: desirability,
        actionPayload: {
          buildingType: 'Munitions Foundry & Armory',
          targetLocationId: 1, // Capital London
          goldCost: 180.0,
          expectedWeaponOutput: 15
        }
      });
    }

    return candidates;
  }

  /**
   * Diplomatic / Military AI Evaluation Loop:
   * Evaluates adjacent nation threat vectors.
   * If an adjacent enclave's Crown Control < 30.0% (0.30), the AI registers a Conquest_War_Goal
   * and plans pathfinding routes to deploy its Levy army stacks.
   */
  public evaluateDiplomaticMilitaryDecisions(context: AIDecisionContext): StrategicWarGoal[] {
    const warGoals: StrategicWarGoal[] = [];

    for (const adjacent of context.adjacentLocations) {
      // Check if adjacent enclave is weak (Crown Control < 0.30)
      if (adjacent.control < 0.30) {
        // High desirability to seize vulnerable adjacent hub
        const weaknessScore = 1.0 - adjacent.control; // e.g. 0.78
        const martialDriver = context.rulerMartial / 100.0; // e.g. 0.85
        const manpowerReadiness = UtilityMath.clamp(context.manpowerCurrent / Math.max(1, context.manpowerMax));

        const desirability = UtilityMath.clamp(weaknessScore * 0.5 + manpowerReadiness * 0.25 + martialDriver * 0.25);

        // Pathfinding route: Capital (1) -> Dover (2) -> Target
        const path = [1, 2, adjacent.id];
        const recommendedLevies = Math.min(context.manpowerCurrent, 4500);

        warGoals.push({
          goalId: `war_goal_conquest_${adjacent.id}`,
          type: 'CONQUEST_ENCLAVE',
          targetLocationId: adjacent.id,
          targetCountryTag: adjacent.country,
          desirabilityScore: desirability,
          pathfindingRoute: path,
          assignedLevySize: recommendedLevies
        });
      }
    }

    return warGoals;
  }

  /**
   * Event Decision Subsystem:
   * Evaluates selectable options in an active event (e.g. Burgher Guild Petition).
   * Calculates utility for each option based on active internal utility values:
   * Estate loyalty floor, Crown Control valuation, Gold value, and Ruler personality traits.
   */
  public evaluateEventChoice(event: GameEvent, context: AIDecisionContext): { selectedOption: EventOption; desirabilityScore: number } {
    let bestOption: EventOption = event.options[0];
    let highestScore: number = -1.0;

    for (const option of event.options) {
      let score = option.aiWeightBase;

      // Trait modifier passes
      if (option.aiModifiers) {
        for (const mod of option.aiModifiers) {
          if (mod.rulerTrait && context.rulerTraits.includes(mod.rulerTrait)) {
            score *= mod.weightMultiplier;
          }
        }
      }

      // Contextual estate loyalty evaluation
      const payload = option.mutationPayload;
      if (payload.estateLoyaltyDeltas) {
        for (const [estate, delta] of Object.entries(payload.estateLoyaltyDeltas)) {
          const currentLoyalty = context.estateLoyalties[estate] ?? 50.0;
          // If estate loyalty is critically low (< 35%), gaining loyalty has massive utility
          if (currentLoyalty < 35.0 && delta > 0) {
            score *= 1.5;
          }
          // If estate loyalty is comfortable (> 65%), losing loyalty is less punishing
          if (currentLoyalty > 65.0 && delta < 0) {
            score *= 0.85;
          }
        }
      }

      // Contextual gold evaluation (diminishing returns)
      if (payload.treasuryGoldDelta && payload.treasuryGoldDelta > 0) {
        const goldUtility = UtilityMath.diminishingReturns(context.treasuryGold);
        // Poorer realms covet the gold gift more
        score *= (1.0 + (1.0 - goldUtility) * 0.4);
      }

      // Crown Control penalty aversion: if ruler is Feudal Sovereign, hates giving up Crown Control
      if (payload.locationControlDeltas) {
        for (const delta of Object.values(payload.locationControlDeltas)) {
          if (delta < 0 && context.rulerTraits.includes('feudal_sovereign')) {
            score *= 0.65; // Heavily penalize surrendering Crown Control
          }
        }
      }

      const finalClampedScore = UtilityMath.clamp(score, 0.01, 1.0);
      if (finalClampedScore > highestScore) {
        highestScore = finalClampedScore;
        bestOption = option;
      }
    }

    return {
      selectedOption: bestOption,
      desirabilityScore: highestScore
    };
  }
}
