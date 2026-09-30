/**
 * Hardcoded UI-to-Simulation Data Hooks & Action Bindings
 * Connects the active HUD screens directly to backend simulation matrices
 */

import { CourtAndDynastyEngine, type RulerCharacter, CharacterRole } from '../politics/court.ts';
import { TacticalCombatEngine } from '../military/combat.ts';

export interface DiplomaticMarriageRelation {
  initiatorCountryId: number;
  targetCountryId: number;
  rulerCharacterId: number;
  foreignSpouseName: string;
  dynasticClaimStrength: number;
  activeTreaty: boolean;
}

export class SimulationDataBindingEngine {
  private activeMarriageRelations: DiplomaticMarriageRelation[] = [];
  public lordHighChancellorAppointed: boolean = false;
  public royalVanguardCommanderAssigned: boolean = false;

  /**
   * Applies ruler stat multipliers:
   * - 85 Martial -> 1.425x levy speed & army morale
   * - 79 Diplo -> 1.395x vassal loyalty & relation recovery
   * - 65 Steward -> 1.13x tax efficiency & 16.25% construction speedup
   * - 50 Learn -> 1.0x baseline technology progress
   * - 68 Intrigue -> 1.34x spy defense
   */
  public computeRulerStatMultipliers(ruler: RulerCharacter): {
    levyMobilizationMultiplier: number;
    diplomaticRelationMultiplier: number;
    stewardshipTaxMultiplier: number;
    constructionSpeedMultiplier: number;
    intrigueDefenseMultiplier: number;
  } {
    return {
      levyMobilizationMultiplier: 1.0 + (ruler.attributes.martial / 100.0) * 0.5,
      diplomaticRelationMultiplier: 1.0 + (ruler.attributes.diplomacy / 100.0) * 0.5,
      stewardshipTaxMultiplier: 1.0 + (ruler.attributes.stewardship / 100.0) * 0.2,
      constructionSpeedMultiplier: 1.0 + (ruler.attributes.stewardship / 100.0) * 0.25,
      intrigueDefenseMultiplier: 1.0 + (ruler.attributes.intrigue / 100.0) * 0.5
    };
  }

  /**
   * Combat Shock Damage Hook:
   * Injects 1.15 float modifier to front-row combat grid damage ticks
   * when King Edward III (Valiant Warrior) is marked as active general
   */
  public getCombatShockModifier(ruler: RulerCharacter): number {
    if (ruler.is_alive && ruler.current_role === CharacterRole.General) {
      const valiant = ruler.traits.find(t => t.id === 'valiant_warrior');
      if (valiant && valiant.modifiers.combat_shock_bonus) {
        return 1.0 + valiant.modifiers.combat_shock_bonus; // 1.15x
      }
    }
    return 1.0;
  }

  /**
   * Annual Gout Afflicted Health Reduction Pass
   * -5 Health reduction. If health <= 0, triggers succession protocol
   */
  public processAnnualGoutPass(
    ruler: RulerCharacter,
    courtEngine: CourtAndDynastyEngine
  ): { died: boolean; newRulerId?: number; successionReason?: string } {
    if (!ruler.is_alive) return { died: false };

    const gout = ruler.traits.find(t => t.id === 'gout_afflicted');
    if (gout) {
      ruler.health -= 5.0; // Flat -5 Health reduction per year
    }

    if (ruler.health <= 0) {
      const succession = courtEngine.handleRulerDeath(ruler.id);
      return {
        died: true,
        newRulerId: succession.successorId,
        successionReason: succession.reason
      };
    }

    return { died: false };
  }

  /**
   * Dynamic Action Button Interaction: Arrange Royal Marriage
   */
  public executeArrangeRoyalMarriage(
    ruler: RulerCharacter,
    targetCountryName: string = 'Flanders',
    spouseName: string = 'Duchess Margaret of Flanders'
  ): DiplomaticMarriageRelation {
    const relation: DiplomaticMarriageRelation = {
      initiatorCountryId: ruler.country_id,
      targetCountryId: 2, // Flanders
      rulerCharacterId: ruler.id,
      foreignSpouseName: spouseName,
      dynasticClaimStrength: 0.75, // Strong Personal Union potential
      activeTreaty: true
    };
    ruler.spouse_character_id = 999;
    this.activeMarriageRelations.push(relation);
    return relation;
  }

  /**
   * Dynamic Action Button Interaction: Appoint as Field General
   * Detaches King Edward III from court and assigns pointer to Royal Vanguard
   */
  public executeAppointAsFieldGeneral(ruler: RulerCharacter): boolean {
    ruler.current_role = CharacterRole.General;
    ruler.assigned_assignment_id = 'army_royal_vanguard';
    this.royalVanguardCommanderAssigned = true;
    return true;
  }

  public executeAppointFieldGeneral(ruler: RulerCharacter, _court?: CourtAndDynastyEngine, assignmentId: string = 'army_royal_vanguard'): boolean {
    ruler.current_role = CharacterRole.General;
    ruler.assigned_assignment_id = assignmentId;
    this.royalVanguardCommanderAssigned = true;
    return true;
  }

  /**
   * Dynamic Action Button Interaction: Appoint Cabinet Advisor
   * Registers ruler into active Lord High Chancellor execution slot
   */
  public executeAppointCabinetAdvisor(ruler: RulerCharacter): boolean {
    ruler.current_role = CharacterRole.CabinetAdvisor;
    ruler.assigned_assignment_id = 'lord_high_chancellor';
    this.lordHighChancellorAppointed = true;
    return true;
  }

  public getActiveMarriages(): DiplomaticMarriageRelation[] {
    return this.activeMarriageRelations;
  }
}
