/**
 * Procedural Nation Formation & Tag Evolution Engine
 * Subsystem: /src/politics/formation.ts
 */

export interface FormableNationRequirement {
  targetTag: string;
  targetName: string;
  requiredPrestige: number;
  requiredLocationIds: number[];
  allowedSourceTags: string[];
  newPrimaryCulture: string;
  newGovernmentRank: 'Kingdom' | 'Empire';
  permanentClaimsRegion: string;
  prestigeReward: number;
  legitimacyReward: number;
}

export interface FormationExecutionPayload {
  previousTag: string;
  newTag: string;
  newCountryName: string;
  gainedCoreLocationIds: number[];
  prestigeBonus: number;
  legitimacyBonus: number;
  unlockedIdeasGroup: string;
  newGovernmentRank: 'Kingdom' | 'Empire';
}

export class NationFormationManager {
  private formables: Map<string, FormableNationRequirement> = new Map();

  constructor() {
    this.registerDefaultFormables();
  }

  public registerFormable(req: FormableNationRequirement): void {
    this.formables.set(req.targetTag, req);
  }

  private registerDefaultFormables(): void {
    // 1. Anatolian / Ottoman Empire Unification
    this.registerFormable({
      targetTag: 'TUR',
      targetName: 'Ottoman Empire',
      requiredPrestige: 70.0,
      requiredLocationIds: [101, 102, 110, 117, 128], // Söğüt, Bursa, Konya, Amasya, Ankara
      allowedSourceTags: ['OTT', 'KRM', 'CND', 'GER', 'AYD', 'SAR', 'MEN', 'ERT'],
      newPrimaryCulture: 'Turkish',
      newGovernmentRank: 'Empire',
      permanentClaimsRegion: 'Near_East_Macro_Region',
      prestigeReward: 25.0,
      legitimacyReward: 30.0
    });

    // 2. Kingdom of France
    this.registerFormable({
      targetTag: 'FRA',
      targetName: 'Kingdom of France',
      requiredPrestige: 60.0,
      requiredLocationIds: [2, 4, 5, 6], // Paris, Rouen, Orleans, Lyon
      allowedSourceTags: ['ORL', 'BUR', 'ARM', 'BRI', 'PRO'],
      newPrimaryCulture: 'French',
      newGovernmentRank: 'Kingdom',
      permanentClaimsRegion: 'French_Region',
      prestigeReward: 20.0,
      legitimacyReward: 25.0
    });

    // 3. Kingdom of Great Britain
    this.registerFormable({
      targetTag: 'GBR',
      targetName: 'Kingdom of Great Britain',
      requiredPrestige: 65.0,
      requiredLocationIds: [1, 7, 8], // London, York, Edinburgh
      allowedSourceTags: ['ENG', 'SCO', 'WAL'],
      newPrimaryCulture: 'British',
      newGovernmentRank: 'Kingdom',
      permanentClaimsRegion: 'British_Isles_Region',
      prestigeReward: 20.0,
      legitimacyReward: 25.0
    });

    // 4. Kingdom of Italy
    this.registerFormable({
      targetTag: 'ITA',
      targetName: 'Kingdom of Italy',
      requiredPrestige: 75.0,
      requiredLocationIds: [20, 21, 22, 23], // Rome, Milan, Florence, Venice
      allowedSourceTags: ['VEN', 'GEN', 'FLO', 'MIL', 'NAP', 'SAV'],
      newPrimaryCulture: 'Italian',
      newGovernmentRank: 'Kingdom',
      permanentClaimsRegion: 'Italian_Peninsula_Region',
      prestigeReward: 30.0,
      legitimacyReward: 30.0
    });
  }

  /**
   * Evaluates if a sovereign tag satisfies the requirements to execute procedural nation formation
   */
  public checkFormationEligibility(
    currentTag: string,
    currentPrestige: number,
    ownedLocationIds: number[],
    targetTag: string
  ): boolean {
    const req = this.formables.get(targetTag);
    if (!req) return false;

    if (currentPrestige < req.requiredPrestige) {
      return false;
    }

    if (!req.allowedSourceTags.includes(currentTag)) {
      return false;
    }

    const ownedSet = new Set(ownedLocationIds);
    for (const locId of req.requiredLocationIds) {
      if (!ownedSet.has(locId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Executes procedural nation formation, mutating state parameters and injecting permanent claims
   */
  public executeNationFormation(
    currentTag: string,
    currentPrestige: number,
    ownedLocationIds: number[],
    targetTag: string
  ): FormationExecutionPayload | null {
    if (!this.checkFormationEligibility(currentTag, currentPrestige, ownedLocationIds, targetTag)) {
      return null;
    }

    const req = this.formables.get(targetTag)!;

    return {
      previousTag: currentTag,
      newTag: req.targetTag,
      newCountryName: req.targetName,
      gainedCoreLocationIds: [...req.requiredLocationIds],
      prestigeBonus: req.prestigeReward,
      legitimacyBonus: req.legitimacyReward,
      unlockedIdeasGroup: `${req.targetTag}_national_ideas`,
      newGovernmentRank: req.newGovernmentRank
    };
  }

  public getFormable(targetTag: string): FormableNationRequirement | undefined {
    return this.formables.get(targetTag);
  }
}
