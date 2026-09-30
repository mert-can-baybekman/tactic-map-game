/**
 * Macro-Unrest Accumulation & Structural Civil War Fracture Engine
 * Implements virtualized unrest aggregation, physical army stack instantiation,
 * and the 45% Total State Civil War Fracture Protocol.
 */

import type { PopEntity } from '../demographics/pop.ts';
import { EstateType } from '../core/types.ts';

export type RebelFactionTypeEnum =
  | 'Peasant_Revolt'
  | 'Nobles_Coup'
  | 'Heretic_Uprising'
  | 'Pretender_Claim';

export interface GeneralCharacter {
  id: string;
  name: string;
  loyalty: number; // 0 to 100
  assignedArmyId?: string;
  isRebelSympathizer?: boolean;
}

export interface ArmyStackEntity {
  id: string;
  name: string;
  countryTag: string;
  locationId: number;
  locationName: string;
  size: number; // Manpower count
  isRebelStack: boolean;
  commander?: GeneralCharacter;
  morale: number; // 0 to 100
}

export interface RebelFaction {
  factionId: string;
  name: string;
  factionType: RebelFactionTypeEnum;
  totalEnlistedPopsCount: number;
  accumulatedRadicalism: number; // 0.0 to 1.0 (Hits 1.0 -> Spawns Army Stack)
  financierEstatePointer: EstateType;
  targetLocationIds: number[];
  spawnedArmyStacks: ArmyStackEntity[];
  isActive: boolean;
}

export interface UnrestLocationData {
  id: number;
  name: string;
  country: string;
  control: number; // 0.0 to 1.0
  devastation: number;
  dominantEstate?: EstateType;
  dominantEstatePower?: number; // 0.0 to 1.0
}

export interface TotalFractureResult {
  isCivilWarActive: boolean;
  rebelTag: string;
  rebelCapitalLocationId: number;
  secededLocations: UnrestLocationData[];
  defectedArmies: ArmyStackEntity[];
  retainedCrownArmies: ArmyStackEntity[];
  totalRebelCombatants: number;
  outlinerCrisisMode: boolean;
  crisisAlert: string;
}

export class MacroUnrestEngine {
  private factions: Map<string, RebelFaction> = new Map();
  private spawnedRebelArmies: ArmyStackEntity[] = [];
  private activeCivilWar: TotalFractureResult | null = null;

  public conscriptionFactor: number = 0.08; // 8% of enlisted radical pops form armed stacks

  public getFactions(): RebelFaction[] {
    return Array.from(this.factions.values());
  }

  public getCivilWarState(): TotalFractureResult | null {
    return this.activeCivilWar;
  }

  public getSpawnedRebelArmies(): ArmyStackEntity[] {
    return [...this.spawnedRebelArmies];
  }

  /**
   * Virtualized Unrest Aggregation Network:
   * Aggregates micro-unrest variables across pops based on:
   * 1. Basic food needs starvation (basic_needs_satisfaction < 0.50)
   * 2. High tax burden without Crown Control protection (taxRate > 0.15 AND control < 0.40)
   * 3. Cultural discrimination (pop.culture_id !== stateCulture)
   */
  public aggregatePopUnrestPass(
    pops: PopEntity[],
    locationsMap: Map<number, UnrestLocationData>,
    nationalTaxRate: number = 0.20,
    stateCulture: string = 'english'
  ): void {
    for (const pop of pops) {
      const loc = locationsMap.get(pop.location_id);
      const control = loc ? loc.control : 0.50;

      let deltaUnrest = 0.0;

      // 1. Food starvation penalty
      if (pop.basic_needs_satisfaction < 0.50) {
        deltaUnrest += (0.50 - pop.basic_needs_satisfaction) * 0.05;
      }

      // 2. High tax burden without Crown Control
      if (nationalTaxRate > 0.15 && control < 0.40) {
        deltaUnrest += (nationalTaxRate - 0.15) * (0.40 - control) * 0.15;
      }

      // 3. Cultural discrimination penalty
      if (pop.culture_id !== stateCulture) {
        deltaUnrest += 0.015;
      }

      // Natural pacification if needs are met and control is solid
      if (pop.basic_needs_satisfaction >= 0.75 && control >= 0.70 && pop.culture_id === stateCulture) {
        deltaUnrest -= 0.02;
      }

      pop.militancy_unrest = Math.max(0.0, Math.min(1.0, pop.militancy_unrest + deltaUnrest));
    }
  }

  /**
   * Monthly Faction Radicalism Progression & Aggregation Check:
   * Compiles individual unrest into centralized state-wide Rebel_Faction data containers.
   */
  public evaluateFactionsProgression(
    pops: PopEntity[],
    stateReligion: string = 'catholic'
  ): RebelFaction[] {
    // Categorize pops into faction buckets
    const categories: Record<RebelFactionTypeEnum, {
      pops: PopEntity[];
      totalRadicalism: number;
      totalSize: number;
      financier: EstateType;
    }> = {
      Peasant_Revolt: { pops: [], totalRadicalism: 0, totalSize: 0, financier: EstateType.Commoners },
      Nobles_Coup: { pops: [], totalRadicalism: 0, totalSize: 0, financier: EstateType.Nobility },
      Heretic_Uprising: { pops: [], totalRadicalism: 0, totalSize: 0, financier: EstateType.Clergy },
      Pretender_Claim: { pops: [], totalRadicalism: 0, totalSize: 0, financier: EstateType.Nobility }
    };

    for (const pop of pops) {
      if (pop.estate_type === EstateType.Commoners || pop.estate_type === EstateType.Tribes) {
        categories.Peasant_Revolt.pops.push(pop);
        categories.Peasant_Revolt.totalRadicalism += pop.militancy_unrest * pop.size;
        categories.Peasant_Revolt.totalSize += pop.size;
      } else if (pop.estate_type === EstateType.Nobility) {
        // High unrest nobles can back Coups or Pretenders
        if (pop.militancy_unrest > 0.65) {
          categories.Pretender_Claim.pops.push(pop);
          categories.Pretender_Claim.totalRadicalism += pop.militancy_unrest * pop.size;
          categories.Pretender_Claim.totalSize += pop.size;
        } else {
          categories.Nobles_Coup.pops.push(pop);
          categories.Nobles_Coup.totalRadicalism += pop.militancy_unrest * pop.size;
          categories.Nobles_Coup.totalSize += pop.size;
        }
      }

      if (pop.religion_id !== stateReligion || pop.religion_distribution?.religious_heretics) {
        categories.Heretic_Uprising.pops.push(pop);
        categories.Heretic_Uprising.totalRadicalism += pop.militancy_unrest * pop.size;
        categories.Heretic_Uprising.totalSize += pop.size;
      }
    }

    const updatedFactions: RebelFaction[] = [];

    for (const [key, cat] of Object.entries(categories)) {
      const factionType = key as RebelFactionTypeEnum;
      if (cat.totalSize === 0) continue;

      const avgRadicalism = cat.totalRadicalism / cat.totalSize;
      const factionId = `faction_${factionType.toLowerCase()}`;

      // Only manifest when average radicalism exceeds 0.50
      if (avgRadicalism >= 0.50) {
        const radicalPops = cat.pops.filter(p => p.militancy_unrest >= 0.60);
        const enlistedCount = radicalPops.reduce((sum, p) => sum + p.size, 0);
        const targetLocs = Array.from(new Set(radicalPops.map(p => p.location_id)));

        let faction = this.factions.get(factionId);
        if (!faction) {
          faction = {
            factionId,
            name: this.generateFactionTitle(factionType),
            factionType,
            totalEnlistedPopsCount: enlistedCount,
            accumulatedRadicalism: Math.min(1.0, avgRadicalism),
            financierEstatePointer: cat.financier,
            targetLocationIds: targetLocs,
            spawnedArmyStacks: [],
            isActive: true
          };
          this.factions.set(factionId, faction);
        } else {
          faction.totalEnlistedPopsCount = enlistedCount;
          faction.targetLocationIds = targetLocs;
          // Radicalism builds up each month
          const growth = (avgRadicalism - 0.40) * 0.25;
          faction.accumulatedRadicalism = Math.min(1.0, faction.accumulatedRadicalism + growth);
        }
        updatedFactions.push(faction);
      } else {
        const existing = this.factions.get(factionId);
        if (existing) {
          existing.accumulatedRadicalism = Math.max(0.0, existing.accumulatedRadicalism - 0.10);
          if (existing.accumulatedRadicalism <= 0.0) {
            existing.isActive = false;
            this.factions.delete(factionId);
          }
        }
      }
    }

    return updatedFactions;
  }

  /**
   * Physical Rebellion Spawning & Map Interception:
   * When Accumulated_Radicalism == 1.0:
   * Instantiates an Army_Stack entity directly on those Location coordinates.
   * Army_Manpower = Enlisted_Pop_Size * Conscription_Factor
   */
  public checkAndSpawnPhysicalRebellions(
    locationsMap: Map<number, UnrestLocationData>
  ): ArmyStackEntity[] {
    const newlySpawned: ArmyStackEntity[] = [];

    for (const faction of this.factions.values()) {
      if (faction.accumulatedRadicalism >= 1.0 && faction.spawnedArmyStacks.length === 0) {
        // Calculate army size directly out of enlisted pop count numbers
        const totalManpower = Math.max(1000, Math.round(faction.totalEnlistedPopsCount * this.conscriptionFactor));
        const spawnLocId = faction.targetLocationIds[0] || 1;
        const loc = locationsMap.get(spawnLocId);
        const locName = loc ? loc.name : `Location_${spawnLocId}`;

        const armyStack: ArmyStackEntity = {
          id: `rebel_stack_${faction.factionId}_${Date.now()}`,
          name: `${faction.name} Insurgent Host`,
          countryTag: 'REB_ENG',
          locationId: spawnLocId,
          locationName: locName,
          size: totalManpower,
          isRebelStack: true,
          morale: 85
        };

        faction.spawnedArmyStacks.push(armyStack);
        this.spawnedRebelArmies.push(armyStack);
        newlySpawned.push(armyStack);
      }
    }

    return newlySpawned;
  }

  /**
   * The Total State Civil War Fracture Algorithm:
   * If a Rebel Faction's calculated aggregate manpower exceeds 45% of the Crown's standing professional forces + levies:
   * 1. Instantiates a dynamic civil war counter-tag (e.g. REB_ENG)
   * 2. Scans all map nodes: Any location with Crown Control < 50% OR dominant localized estate backing rebellion has high power (> 0.35) secedes
   * 3. Splits standing armies: Low loyalty generals (loyalty < 40) immediately defect
   */
  public evaluateTotalFractureProtocol(
    primaryFaction: RebelFaction,
    locations: UnrestLocationData[],
    standingArmies: ArmyStackEntity[],
    generals: GeneralCharacter[],
    crownTotalMilitaryForce: number
  ): TotalFractureResult | null {
    const rebelManpower = Math.round(primaryFaction.totalEnlistedPopsCount * this.conscriptionFactor);

    // 45% Threshold check
    const civilWarThreshold = crownTotalMilitaryForce * 0.45;
    if (rebelManpower < civilWarThreshold && primaryFaction.accumulatedRadicalism < 1.0) {
      return null;
    }

    const rebelTag = `REB_${locations[0]?.country || 'ENG'}`;
    const secededLocations: UnrestLocationData[] = [];

    // Map node scanning sequence:
    // Any Location with Crown Control < 50% OR dominant localized estate backing rebellion with high power (> 0.35)
    for (const loc of locations) {
      const lowControl = loc.control < 0.50;
      const estateBacking = loc.dominantEstate === primaryFaction.financierEstatePointer && (loc.dominantEstatePower || 0) >= 0.35;

      if (lowControl || estateBacking || primaryFaction.targetLocationIds.includes(loc.id)) {
        loc.country = rebelTag;
        loc.control = 0.55; // Rebel faction asserts provisional garrisons
        secededLocations.push(loc);
      }
    }

    if (secededLocations.length === 0 && locations.length > 0) {
      const fallback = locations[locations.length - 1];
      fallback.country = rebelTag;
      secededLocations.push(fallback);
    }

    // Split standing armies: Generals with loyalty < 40 defect with their entire army
    const defectedArmies: ArmyStackEntity[] = [];
    const retainedCrownArmies: ArmyStackEntity[] = [];

    for (const army of standingArmies) {
      const general = generals.find(g => g.assignedArmyId === army.id);
      if (general && general.loyalty < 40) {
        army.countryTag = rebelTag;
        army.isRebelStack = true;
        defectedArmies.push(army);
      } else {
        retainedCrownArmies.push(army);
      }
    }

    const defectedManpower = defectedArmies.reduce((sum, a) => sum + a.size, 0);

    const result: TotalFractureResult = {
      isCivilWarActive: true,
      rebelTag,
      rebelCapitalLocationId: secededLocations[0]?.id || 1,
      secededLocations,
      defectedArmies,
      retainedCrownArmies,
      totalRebelCombatants: rebelManpower + defectedManpower,
      outlinerCrisisMode: true,
      crisisAlert: `CIVIL WAR: ${primaryFaction.name} triggered Total State Fracture! ${secededLocations.length} locations seceded to ${rebelTag}.`
    };

    this.activeCivilWar = result;
    return result;
  }

  private generateFactionTitle(type: RebelFactionTypeEnum): string {
    switch (type) {
      case 'Peasant_Revolt': return "Great Peasant Jacquerie";
      case 'Nobles_Coup': return "Baronial League of Defense";
      case 'Heretic_Uprising': return "Lollard Heretic Communion";
      case 'Pretender_Claim': return "House of Lancaster Pretenders";
    }
  }
}
