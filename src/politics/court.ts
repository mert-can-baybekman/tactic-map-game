/**
 * Character Lifecycle, Dynastic Succession & Court System
 * Inspired by Clausewitz Engine & Project Caesar Dynasty Framework
 */

export const CharacterRole = {
  Ruler: 'Ruler',
  Consort: 'Consort',
  Heir: 'Heir',
  General: 'General',
  Admiral: 'Admiral',
  CabinetAdvisor: 'CabinetAdvisor',
  Explorer: 'Explorer',
  Courtier: 'Courtier'
} as const;
export type CharacterRole = typeof CharacterRole[keyof typeof CharacterRole];

export const CharacterSex = {
  Male: 'Male',
  Female: 'Female'
} as const;
export type CharacterSex = typeof CharacterSex[keyof typeof CharacterSex];

export interface CharacterAttributes {
  martial: number;      // 0 - 100 (Clamped)
  diplomacy: number;    // 0 - 100 (Clamped)
  stewardship: number;  // 0 - 100 (Clamped)
  learning: number;     // 0 - 100 (Clamped)
  intrigue: number;     // 0 - 100 (Clamped)
}

export interface CharacterTrait {
  id: string;
  name: string;
  category: 'personality' | 'lifestyle' | 'commander' | 'congenital';
  modifiers: {
    estate_loyalty_impact?: Record<string, number>; // e.g. { "Nobility": 10.0 }
    prestige_gain?: number;
    stability_cost?: number;
    combat_shock_bonus?: number;
    tax_efficiency_bonus?: number;
    health_degradation_penalty?: number;
  };
}

export interface RulerCharacter {
  id: number;
  dynasty_id: number;
  dynasty_name: string;
  first_name: string;
  country_id: number;
  age: number;
  sex: CharacterSex;
  portrait_asset_ref: string;
  current_role: CharacterRole;
  assigned_assignment_id?: string; // e.g. "army_vanguard_1"
  attributes: CharacterAttributes;
  traits: CharacterTrait[];
  culture_id: string;
  sub_culture_variant: string;
  religion_id: string;
  health: number; // 0.0 to 100.0 (Health pool)
  is_alive: boolean;
  spouse_character_id?: number;
  father_id?: number;
  mother_id?: number;
  children_ids: number[];
  dynastic_prestige: number;
  active_modifiers: {
    combat_shock_multiplier: number;
    nobility_loyalty_delta: number;
    stewardship_construction_discount: number;
    monthly_tax_multiplier: number;
  };
}

export interface RoyalMarriageLink {
  country_a_id: number;
  country_b_id: number;
  character_a_id: number;
  character_b_id: number;
  established_year: number;
  dynastic_claim_strength: number; // 0.0 - 1.0
}

export class CourtAndDynastyEngine {
  private characters: Map<number, RulerCharacter> = new Map();
  private marriages: RoyalMarriageLink[] = [];
  private nextCharId: number = 100;

  public createCharacter(params: Omit<RulerCharacter, 'id' | 'active_modifiers' | 'health'> & { health?: number }): RulerCharacter {
    const character: RulerCharacter = {
      id: this.nextCharId++,
      ...params,
      health: params.health ?? 85.0,
      attributes: {
        martial: Math.max(0, Math.min(100, params.attributes.martial)),
        diplomacy: Math.max(0, Math.min(100, params.attributes.diplomacy)),
        stewardship: Math.max(0, Math.min(100, params.attributes.stewardship)),
        learning: Math.max(0, Math.min(100, params.attributes.learning)),
        intrigue: Math.max(0, Math.min(100, params.attributes.intrigue))
      },
      traits: [...params.traits],
      children_ids: [...params.children_ids],
      active_modifiers: {
        combat_shock_multiplier: 1.0,
        nobility_loyalty_delta: 0.0,
        stewardship_construction_discount: 0.0,
        monthly_tax_multiplier: 1.0
      }
    };

    this.applyTraitModifiers(character);
    this.characters.set(character.id, character);
    return character;
  }

  /**
   * Evaluates character attributes and active trait pipeline
   * - Valiant Warrior: +15% Shock Damage
   * - Feudal Sovereign: +10 Nobility Loyalty
   * - Gout Afflicted: -15 Health Degradation Penalty
   * - Stewardship scaling: construction speed & integration speed factor
   */
  public applyTraitModifiers(character: RulerCharacter): void {
    character.active_modifiers.combat_shock_multiplier = 1.0;
    character.active_modifiers.nobility_loyalty_delta = 0.0;
    character.active_modifiers.monthly_tax_multiplier = 1.0 + (character.attributes.stewardship * 0.002);
    // Stewardship reduction factor: 65 stewardship -> 16.25% speedup
    character.active_modifiers.stewardship_construction_discount = (character.attributes.stewardship / 100.0) * 0.25;

    for (const trait of character.traits) {
      if (trait.modifiers.combat_shock_bonus) {
        character.active_modifiers.combat_shock_multiplier += trait.modifiers.combat_shock_bonus;
      }
      if (trait.modifiers.estate_loyalty_impact?.Nobility) {
        character.active_modifiers.nobility_loyalty_delta += trait.modifiers.estate_loyalty_impact.Nobility;
      }
      if (trait.modifiers.tax_efficiency_bonus) {
        character.active_modifiers.monthly_tax_multiplier += trait.modifiers.tax_efficiency_bonus;
      }
    }
  }

  public getCharacter(id: number): RulerCharacter | undefined {
    return this.characters.get(id);
  }

  public getCountryCourt(countryId: number): RulerCharacter[] {
    return Array.from(this.characters.values()).filter(c => c.country_id === countryId && c.is_alive);
  }

  public getCountryRuler(countryId: number): RulerCharacter | undefined {
    return Array.from(this.characters.values()).find(
      c => c.country_id === countryId && c.current_role === CharacterRole.Ruler && c.is_alive
    );
  }

  public getCountryHeir(countryId: number): RulerCharacter | undefined {
    return Array.from(this.characters.values()).find(
      c => c.country_id === countryId && c.current_role === CharacterRole.Heir && c.is_alive
    );
  }

  public arrangeRoyalMarriage(
    charAId: number,
    charBId: number
  ): { success: boolean; personalUnionPotential: boolean; reason: string } {
    const charA = this.characters.get(charAId);
    const charB = this.characters.get(charBId);

    if (!charA || !charB || !charA.is_alive || !charB.is_alive) {
      return { success: false, personalUnionPotential: false, reason: 'Invalid or deceased character.' };
    }

    if (charA.spouse_character_id || charB.spouse_character_id) {
      return { success: false, personalUnionPotential: false, reason: 'One of the parties is already married.' };
    }

    if (charA.country_id === charB.country_id) {
      return { success: false, personalUnionPotential: false, reason: 'Internal marriage does not form international treaty.' };
    }

    charA.spouse_character_id = charB.id;
    charB.spouse_character_id = charA.id;

    const claimStrength = Math.min(1.0, (charA.attributes.diplomacy + charB.attributes.diplomacy) / 140.0);

    const marriageLink: RoyalMarriageLink = {
      country_a_id: charA.country_id,
      country_b_id: charB.country_id,
      character_a_id: charA.id,
      character_b_id: charB.id,
      established_year: 1350,
      dynastic_claim_strength: claimStrength
    };

    this.marriages.push(marriageLink);

    return {
      success: true,
      personalUnionPotential: claimStrength > 0.65,
      reason: `Royal union forged between House ${charA.dynasty_name} and House ${charB.dynasty_name}.`
    };
  }

  public appointAsGeneral(charId: number, armyId?: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.is_alive) return false;
    char.current_role = CharacterRole.General;
    if (armyId) char.assigned_assignment_id = armyId;
    return true;
  }

  public appointAsCabinetAdvisor(charId: number, portfolio: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.is_alive) return false;
    char.current_role = CharacterRole.CabinetAdvisor;
    char.assigned_assignment_id = portfolio;
    return true;
  }

  /**
   * Health Degradation & Gout Afflicted Tick
   * Annual / monthly pass checking natural mortality and sudden succession
   */
  public executeHealthAndMortalityTick(): { rulerDied: boolean; newRuler?: RulerCharacter; reason?: string } {
    for (const char of this.characters.values()) {
      if (!char.is_alive) continue;

      let healthDegradation = 0.2; // Base aging wear
      const goutTrait = char.traits.find(t => t.id === 'gout_afflicted');
      if (goutTrait) {
        healthDegradation += 1.8; // Gout wears down ruler health rapidly
      }

      if (char.age > 50) {
        healthDegradation += (char.age - 50) * 0.15;
      }

      char.health = Math.max(0, char.health - healthDegradation);

      if (char.health <= 0 || (char.health < 25 && Math.random() < 0.05)) {
        char.is_alive = false;
        if (char.current_role === CharacterRole.Ruler) {
          const succession = this.handleRulerDeath(char.id);
          const newRuler = succession.successorId ? this.getCharacter(succession.successorId) : undefined;
          return { rulerDied: true, newRuler, reason: succession.reason };
        }
      }
    }
    return { rulerDied: false };
  }

  public handleRulerDeath(deceasedRulerId: number): {
    successorId?: number;
    personalUnionSeniorId?: number;
    dynasticWarRisk: boolean;
    reason: string;
  } {
    const deceased = this.characters.get(deceasedRulerId);
    if (!deceased) return { dynasticWarRisk: false, reason: 'Ruler not found.' };

    deceased.is_alive = false;
    deceased.current_role = CharacterRole.Courtier;

    const heir = this.getCountryHeir(deceased.country_id);
    if (heir && heir.is_alive) {
      heir.current_role = CharacterRole.Ruler;
      this.applyTraitModifiers(heir);
      return {
        successorId: heir.id,
        dynasticWarRisk: false,
        reason: `Crown smoothly inherited by designated heir ${heir.first_name} of House ${heir.dynasty_name}.`
      };
    }

    const validMarriage = this.marriages.find(
      m => (m.country_a_id === deceased.country_id || m.country_b_id === deceased.country_id) && m.dynastic_claim_strength >= 0.50
    );

    if (validMarriage) {
      const seniorCountryId = validMarriage.country_a_id === deceased.country_id ? validMarriage.country_b_id : validMarriage.country_a_id;
      const seniorRuler = this.getCountryRuler(seniorCountryId);

      if (seniorRuler && seniorRuler.is_alive) {
        return {
          personalUnionSeniorId: seniorCountryId,
          dynasticWarRisk: true,
          reason: `Ruler died without issue! Country ${deceased.country_id} falls into a PERSONAL UNION under King ${seniorRuler.first_name} of Country ${seniorCountryId}!`
        };
      }
    }

    const newRuler = this.createCharacter({
      dynasty_id: deceased.dynasty_id + 1,
      dynasty_name: 'de Beaufort',
      first_name: 'Arthur',
      country_id: deceased.country_id,
      age: 26,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'noble_male_02.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 45, diplomacy: 50, stewardship: 48, learning: 40, intrigue: 35 },
      traits: [],
      culture_id: deceased.culture_id,
      sub_culture_variant: deceased.sub_culture_variant,
      religion_id: deceased.religion_id,
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 15.0
    });

    return {
      successorId: newRuler.id,
      dynasticWarRisk: false,
      reason: `Dynasty collapsed! Local nobility elevated Arthur de Beaufort to the throne.`
    };
  }
}
