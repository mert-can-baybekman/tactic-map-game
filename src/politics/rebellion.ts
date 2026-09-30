/**
 * Micro-Unrest, Rebel Factions & Civil War Simulator
 * Handles unrest accumulation, faction mobilization, and structural nation fracturing.
 */

import type { PopEntity } from '../demographics/pop.ts';
import { EstateType } from '../core/types.ts';

export type RebelFactionType = 'NobilityCoup' | 'PeasantRevolt' | 'ReligiousHeretics' | 'Separatist';

export interface RebelFaction {
  id: string;
  name: string;
  type: RebelFactionType;
  estateOrigin?: EstateType;
  cultureOrigin?: string;
  religionOrigin?: string;
  enlistedPopCount: number;
  totalManpowerPool: number;
  aggregateUnrest: number; // 0.0 to 1.0
  insurgencyProgress: number; // 0.0 to 100.0
  demands: string;
  isActive: boolean;
  targetLocationIds: number[];
}

export interface CivilWarCrisisState {
  isCivilWarActive: boolean;
  rebelTag: string;
  rebelCapitalLocationId: number;
  secededLocationIds: number[];
  defectedArmyManpower: number;
  retainedCrownManpower: number;
  crisisAlertMessage: string;
  outlinerCrisisMode: boolean;
}

export interface UnrestLocationSnapshot {
  id: number;
  name: string;
  country: string;
  control: number; // 0.0 to 1.0
  devastation: number;
}

export class InternalRebellionEngine {
  private activeFactions: Map<string, RebelFaction> = new Map();
  private civilWarState: CivilWarCrisisState = {
    isCivilWarActive: false,
    rebelTag: '',
    rebelCapitalLocationId: 0,
    secededLocationIds: [],
    defectedArmyManpower: 0,
    retainedCrownManpower: 0,
    crisisAlertMessage: '',
    outlinerCrisisMode: false
  };

  public getActiveFactions(): RebelFaction[] {
    return Array.from(this.activeFactions.values());
  }

  public getCivilWarState(): CivilWarCrisisState {
    return { ...this.civilWarState };
  }

  /**
   * Unrest Aggregation Pass:
   * Increments Pop militancy unrest dynamically:
   * 1. Basic needs starvation (satisfaction < 0.50)
   * 2. Heavy taxation without Crown Control (taxRate > 0.15 AND control < 0.40)
   */
  public updatePopUnrest(
    pops: PopEntity[],
    locationsMap: Map<number, UnrestLocationSnapshot>,
    nationalTaxRate: number = 0.20
  ): void {
    for (const pop of pops) {
      const loc = locationsMap.get(pop.location_id);
      const control = loc ? loc.control : 0.50;

      let unrestDelta = 0.0;

      // 1. Basic needs starvation penalty
      if (pop.basic_needs_satisfaction < 0.50) {
        unrestDelta += (0.50 - pop.basic_needs_satisfaction) * 0.04;
      }

      // 2. High taxation without Crown Control protection penalty
      if (nationalTaxRate > 0.15 && control < 0.40) {
        const taxationExaction = (nationalTaxRate - 0.15) * 1.5;
        const lowControlVulnerability = (0.40 - control) * 2.0;
        unrestDelta += taxationExaction * lowControlVulnerability * 0.05;
      }

      // Natural pacification if needs are met and control is high
      if (pop.basic_needs_satisfaction >= 0.70 && control >= 0.60) {
        unrestDelta -= 0.015;
      }

      pop.militancy_unrest = Math.max(0.0, Math.min(1.0, pop.militancy_unrest + unrestDelta));
    }
  }

  /**
   * Rebel Faction Aggregation & Mobilization Loop:
   * Scans Pop groups (Peasants/Commoners, Nobility, Heretics, Separatists).
   * Spawns formal Rebel_Faction when group aggregate unrest breaks 70% (0.70).
   */
  public evaluateRebelFactionProgress(
    pops: PopEntity[],
    totalStateMilitaryForce: number,
    statePrimaryCulture: string = 'english',
    statePrimaryReligion: string = 'catholic'
  ): { spawnedFactions: RebelFaction[]; civilWarTriggered: boolean } {
    const spawned: RebelFaction[] = [];

    // Group pops into faction categories
    const groups: Record<RebelFactionType, { pops: PopEntity[]; totalMilitancy: number; totalSize: number }> = {
      PeasantRevolt: { pops: [], totalMilitancy: 0, totalSize: 0 },
      NobilityCoup: { pops: [], totalMilitancy: 0, totalSize: 0 },
      ReligiousHeretics: { pops: [], totalMilitancy: 0, totalSize: 0 },
      Separatist: { pops: [], totalMilitancy: 0, totalSize: 0 }
    };

    for (const pop of pops) {
      if (pop.estate_type === EstateType.Commoners || pop.estate_type === EstateType.Tribes) {
        groups.PeasantRevolt.pops.push(pop);
        groups.PeasantRevolt.totalMilitancy += pop.militancy_unrest * pop.size;
        groups.PeasantRevolt.totalSize += pop.size;
      } else if (pop.estate_type === EstateType.Nobility) {
        groups.NobilityCoup.pops.push(pop);
        groups.NobilityCoup.totalMilitancy += pop.militancy_unrest * pop.size;
        groups.NobilityCoup.totalSize += pop.size;
      }

      if (pop.religion_id !== statePrimaryReligion) {
        groups.ReligiousHeretics.pops.push(pop);
        groups.ReligiousHeretics.totalMilitancy += pop.militancy_unrest * pop.size;
        groups.ReligiousHeretics.totalSize += pop.size;
      }

      if (pop.culture_id !== statePrimaryCulture) {
        groups.Separatist.pops.push(pop);
        groups.Separatist.totalMilitancy += pop.militancy_unrest * pop.size;
        groups.Separatist.totalSize += pop.size;
      }
    }

    // Evaluate each faction category against the 0.70 unrest threshold
    for (const [typeKey, group] of Object.entries(groups)) {
      const type = typeKey as RebelFactionType;
      if (group.totalSize === 0) continue;

      const aggregateUnrest = group.totalMilitancy / group.totalSize;
      const factionId = `faction_${type.toLowerCase()}`;

      if (aggregateUnrest >= 0.70) {
        // Enlisted pops with active militancy >= 0.60
        const radicalPops = group.pops.filter(p => p.militancy_unrest >= 0.60);
        const enlistedCount = radicalPops.reduce((sum, p) => sum + p.size, 0);

        // Manpower muster rate: 5% of enlisted radical population can bear arms
        const musteredManpower = Math.round(enlistedCount * 0.05);

        const targetLocs = Array.from(new Set(radicalPops.map(p => p.location_id)));

        let faction = this.activeFactions.get(factionId);
        if (!faction) {
          faction = {
            id: factionId,
            name: this.generateFactionName(type),
            type,
            enlistedPopCount: enlistedCount,
            totalManpowerPool: musteredManpower,
            aggregateUnrest,
            insurgencyProgress: 15.0,
            demands: this.getFactionDemands(type),
            isActive: true,
            targetLocationIds: targetLocs
          };
          this.activeFactions.set(factionId, faction);
          spawned.push(faction);
        } else {
          faction.enlistedPopCount = enlistedCount;
          faction.totalManpowerPool = musteredManpower;
          faction.aggregateUnrest = aggregateUnrest;
          faction.targetLocationIds = targetLocs;
          // Progress advances towards full civil war
          faction.insurgencyProgress = Math.min(100.0, faction.insurgencyProgress + (aggregateUnrest - 0.50) * 20.0);
        }
      } else {
        // Decaying faction if unrest drops below threshold
        const existing = this.activeFactions.get(factionId);
        if (existing) {
          existing.insurgencyProgress = Math.max(0.0, existing.insurgencyProgress - 10.0);
          if (existing.insurgencyProgress <= 0.0) {
            existing.isActive = false;
            this.activeFactions.delete(factionId);
          }
        }
      }
    }

    // Check Civil War Threshold:
    // If ANY Rebel Faction's manpower pool >= 40% of the state's military force OR insurgencyProgress reaches 100%
    let civilWarTriggered = false;
    for (const faction of this.activeFactions.values()) {
      const manpowerThresholdMet = totalStateMilitaryForce > 0 &&
        (faction.totalManpowerPool >= 0.40 * totalStateMilitaryForce);

      if ((manpowerThresholdMet || faction.insurgencyProgress >= 100.0) && !this.civilWarState.isCivilWarActive) {
        civilWarTriggered = true;
        break;
      }
    }

    return { spawnedFactions: spawned, civilWarTriggered };
  }

  /**
   * The Civil War Protocol:
   * Automatically fractures the nation graph, allocates low-control locations to a newly generated rebel tag,
   * splits standing armies based on estate loyalty metrics, and switches the outliner HUD into crisis survival state.
   */
  public triggerCivilWarProtocol(
    primaryFaction: RebelFaction,
    liveLocations: Array<{ id: number; name: string; country: string; control: number }>,
    liveArmies: Array<{ id: string; name: string; size: number; location: string }>,
    nobilityLoyalty: number,
    totalStateMilitaryForce: number
  ): CivilWarCrisisState {
    const rebelTag = `REB_${liveLocations[0]?.country || 'ENG'}`;
    const secededLocationIds: number[] = [];

    // 1. Fracture nation graph: Allocate low-control locations (Control < 0.40) to the rebel tag
    for (const loc of liveLocations) {
      if (loc.control < 0.40 || primaryFaction.targetLocationIds.includes(loc.id)) {
        loc.country = rebelTag;
        loc.control = 0.60; // Rebel faction asserts provisional control
        secededLocationIds.push(loc.id);
      }
    }

    // If no low-control location existed, seize at least one target location
    if (secededLocationIds.length === 0 && liveLocations.length > 0) {
      const seized = liveLocations[liveLocations.length - 1];
      seized.country = rebelTag;
      secededLocationIds.push(seized.id);
    }

    const rebelCapital = secededLocationIds[0] || liveLocations[0]?.id || 1;

    // 2. Split standing armies based on estate loyalty metrics
    let defectedManpower = 0;
    let retainedManpower = 0;

    // If Nobility Loyalty < 35%, 50% of the military defects to the rebellion
    const defectionRatio = nobilityLoyalty < 35.0 ? 0.50 : 0.25;

    for (const army of liveArmies) {
      const defectingCount = Math.round(army.size * defectionRatio);
      defectedManpower += defectingCount;
      army.size -= defectingCount;
      retainedManpower += army.size;
    }

    // 3. Switch Outliner HUD into crisis survival mode
    this.civilWarState = {
      isCivilWarActive: true,
      rebelTag,
      rebelCapitalLocationId: rebelCapital,
      secededLocationIds,
      defectedArmyManpower: defectedManpower,
      retainedCrownManpower: retainedManpower,
      crisisAlertMessage: `CRITICAL ALERT: Civil War broke out! ${primaryFaction.name} has formed ${rebelTag} with ${defectedManpower + primaryFaction.totalManpowerPool} combatants.`,
      outlinerCrisisMode: true
    };

    return this.civilWarState;
  }

  private generateFactionName(type: RebelFactionType): string {
    switch (type) {
      case 'PeasantRevolt': return "Great Peasant Jacquerie";
      case 'NobilityCoup': return "Baronial League of Reform";
      case 'ReligiousHeretics': return "Lollard Heretic Communion";
      case 'Separatist': return "Regional Separatist Front";
    }
  }

  private getFactionDemands(type: RebelFactionType): string {
    switch (type) {
      case 'PeasantRevolt': return "Abolition of Serfdom & Capitation Tax Skimming";
      case 'NobilityCoup': return "Restoration of Feudal Autonomy & Sovereign Limitation";
      case 'ReligiousHeretics': return "Confiscation of Clerical Tithes & Vernacular Scripture";
      case 'Separatist': return "Complete Recognition of Enclave Sovereignty";
    }
  }
}
