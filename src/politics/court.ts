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
  };
}

export interface CharacterEntity {
  id: number;
  dynasty_id: number;
  dynasty_name: string;
  first_name: string;
  country_id: number;
  age: number;
  sex: CharacterSex;
  portrait_asset_ref: string;
  current_role: CharacterRole;
  assigned_assignment_id?: string; // Regiment ID, Fleet ID, or Province ID
  attributes: CharacterAttributes;
  traits: CharacterTrait[];
  culture_id: string;
  sub_culture_variant: string;
  religion_id: string;
  is_alive: boolean;
  spouse_character_id?: number;
  father_id?: number;
  mother_id?: number;
  children_ids: number[];
  dynastic_prestige: number;
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
  private characters: Map<number, CharacterEntity> = new Map();
  private marriages: RoyalMarriageLink[] = [];
  private nextCharId: number = 100;

  public createCharacter(params: Omit<CharacterEntity, 'id'>): CharacterEntity {
    const character: CharacterEntity = {
      id: this.nextCharId++,
      ...params,
      attributes: {
        martial: Math.max(0, Math.min(100, params.attributes.martial)),
        diplomacy: Math.max(0, Math.min(100, params.attributes.diplomacy)),
        stewardship: Math.max(0, Math.min(100, params.attributes.stewardship)),
        learning: Math.max(0, Math.min(100, params.attributes.learning)),
        intrigue: Math.max(0, Math.min(100, params.attributes.intrigue))
      },
      traits: [...params.traits],
      children_ids: [...params.children_ids]
    };
    this.characters.set(character.id, character);
    return character;
  }

  public getCharacter(id: number): CharacterEntity | undefined {
    return this.characters.get(id);
  }

  public getCountryCourt(countryId: number): CharacterEntity[] {
    return Array.from(this.characters.values()).filter(c => c.country_id === countryId && c.is_alive);
  }

  public getCountryRuler(countryId: number): CharacterEntity | undefined {
    return Array.from(this.characters.values()).find(
      c => c.country_id === countryId && c.current_role === CharacterRole.Ruler && c.is_alive
    );
  }

  public getCountryHeir(countryId: number): CharacterEntity | undefined {
    return Array.from(this.characters.values()).find(
      c => c.country_id === countryId && c.current_role === CharacterRole.Heir && c.is_alive
    );
  }

  /**
   * Royal Marriage Matrix & Dynastic Tie Evaluation
   */
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

    // Bind spouse IDs
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

  /**
   * Succession & Personal Union Resolution
   * Triggers dynamically when a sovereign dies
   */
  public handleRulerDeath(
    deceasedRulerId: number
  ): {
    successorId?: number;
    personalUnionSeniorId?: number;
    dynasticWarRisk: boolean;
    reason: string;
  } {
    const deceased = this.characters.get(deceasedRulerId);
    if (!deceased) return { dynasticWarRisk: false, reason: 'Ruler not found.' };

    deceased.is_alive = false;
    deceased.current_role = CharacterRole.Courtier;

    // Check for direct legitimate heir
    const heir = this.getCountryHeir(deceased.country_id);
    if (heir && heir.is_alive) {
      heir.current_role = CharacterRole.Ruler;
      return {
        successorId: heir.id,
        dynasticWarRisk: false,
        reason: `Crown smoothly inherited by designated heir ${heir.first_name} of House ${heir.dynasty_name}.`
      };
    }

    // No heir: Check royal marriages for Personal Union eligibility
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

    // Local noble elected
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

  /**
   * Action: Appoint As General
   */
  public appointAsGeneral(charId: number, armyId?: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.is_alive) return false;
    char.current_role = CharacterRole.General;
    if (armyId) char.assigned_assignment_id = armyId;
    return true;
  }

  /**
   * Action: Appoint As Cabinet Advisor
   */
  public appointAsCabinetAdvisor(charId: number, portfolio: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.is_alive) return false;
    char.current_role = CharacterRole.CabinetAdvisor;
    char.assigned_assignment_id = portfolio;
    return true;
  }

  /**
   * Action: Appoint As Admiral
   */
  public appointAsAdmiral(charId: number, fleetId?: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.is_alive) return false;
    char.current_role = CharacterRole.Admiral;
    if (fleetId) char.assigned_assignment_id = fleetId;
    return true;
  }

  /**
   * Monthly aging and natural mortality tick
   */
  public executeCourtMonthlyTick(): void {
    for (const char of this.characters.values()) {
      if (!char.is_alive) continue;

      // 1/12th of a year
      // Natural mortality calculation if age > 50
      if (char.age > 50) {
        const annualDeathChance = 0.02 + ((char.age - 50) * 0.008);
        const monthlyDeathChance = annualDeathChance / 12.0;
        if (Math.random() < monthlyDeathChance) {
          char.is_alive = false;
        }
      }
    }
  }
}
