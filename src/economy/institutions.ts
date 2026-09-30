/**
 * Institution Proximity & Technology Propagation Engine
 * Implements organic single-origin spawning, graph-based edge diffusion,
 * and tech cost / construction outliner scaling penalties.
 */

import { EstateType } from '../core/types.ts';
import type { PopEntity } from '../demographics/pop.ts';

export interface InstitutionDefinition {
  id: string;
  name: string;
  historicalEra: string;
  spawnConditions: (location: InstitutionLocationContext, rulerLearning: number) => boolean;
  techCostModifier: number; // e.g. -0.15 (-15% tech cost when embraced)
  unembracedPenaltyFactor: number; // e.g. +0.50 (+50% construction time / costs)
}

export interface InstitutionLocationContext {
  id: number;
  name: string;
  country: string;
  isMarketHub: boolean;
  totalPopulation: number;
  burgherPopulation: number;
  totalWealth: number;
  devastation: number; // 0.0 to 1.0
  infrastructureCapacity: number; // 0.1 to 2.0 (e.g. 1.2 = high roads/harbor)
  connectedTradeThroughput: number; // 0.1 to 3.0 (throughput factor)
  adjacentLocationIds: number[];
  institutionPresence: Record<string, number>; // institution_id -> presence 0.0 to 100.0%
}

export interface InstitutionSpawnRecord {
  institutionId: string;
  originLocationId: number;
  originLocationName: string;
  spawnDate: string;
}

export class InstitutionPropagationEngine {
  private institutions: Map<string, InstitutionDefinition> = new Map();
  private spawnedInstitutions: Map<string, InstitutionSpawnRecord> = new Map();
  public baseDiffusionConstant: number = 2.5; // Monthly percentage presence growth constant

  constructor() {
    this.registerDefaultInstitutions();
    // Feudalism is the global traditional baseline institution already active at start
    this.spawnedInstitutions.set('feudalism', {
      institutionId: 'feudalism',
      originLocationId: 1,
      originLocationName: 'Traditional Baseline',
      spawnDate: '1000-01-01'
    });
  }

  public registerInstitution(def: InstitutionDefinition): void {
    this.institutions.set(def.id, def);
  }

  public getInstitution(id: string): InstitutionDefinition | undefined {
    return this.institutions.get(id);
  }

  public getSpawnRecord(id: string): InstitutionSpawnRecord | undefined {
    return this.spawnedInstitutions.get(id);
  }

  public getAllSpawned(): InstitutionSpawnRecord[] {
    return Array.from(this.spawnedInstitutions.values());
  }

  /**
   * Evaluates Spawning Conditions for Unspawned Institutions:
   * (e.g. Renaissance spawns in a market hub with >10% Burghers, >500 wealth, and Ruler Learning > 70)
   */
  public evaluateSpawningPass(
    locations: InstitutionLocationContext[],
    rulerLearning: number,
    currentDateStr: string = '1350-01-01'
  ): InstitutionSpawnRecord[] {
    const newlySpawned: InstitutionSpawnRecord[] = [];

    for (const institution of this.institutions.values()) {
      if (this.spawnedInstitutions.has(institution.id)) {
        continue;
      }

      for (const loc of locations) {
        if (institution.spawnConditions(loc, rulerLearning)) {
          // Institution successfully spawns!
          loc.institutionPresence[institution.id] = 100.0; // Origin location starts at 100% presence

          const record: InstitutionSpawnRecord = {
            institutionId: institution.id,
            originLocationId: loc.id,
            originLocationName: loc.name,
            spawnDate: currentDateStr
          };

          this.spawnedInstitutions.set(institution.id, record);
          newlySpawned.push(record);
          break; // Only spawns in one global origin location
        }
      }
    }

    return newlySpawned;
  }

  /**
   * Monthly Graph Proximity Diffusion Algorithm:
   * Equation:
   * Spread_Rate = Base_Diffusion_Constant * (1.0 - Devastation) * (Infrastructure_Capacity) * Connected_Trade_Throughput_Volume
   * Spills over from high-presence locations to adjacent connected nodes along graph edges.
   */
  public processInstitutionMonthlyDiffusion(
    locationsMap: Map<number, InstitutionLocationContext>
  ): void {
    for (const institutionId of this.spawnedInstitutions.keys()) {
      const presenceDeltas: Map<number, number> = new Map();

      for (const [locId, loc] of locationsMap.entries()) {
        const currentPresence = loc.institutionPresence[institutionId] || 0.0;
        if (currentPresence >= 100.0) continue;

        // Check adjacent neighbors for presence spillover
        let maxNeighborPresence = 0.0;
        let connectedHighPresenceCount = 0;

        for (const adjId of loc.adjacentLocationIds) {
          const adjLoc = locationsMap.get(adjId);
          if (adjLoc) {
            const adjPresence = adjLoc.institutionPresence[institutionId] || 0.0;
            if (adjPresence > maxNeighborPresence) {
              maxNeighborPresence = adjPresence;
            }
            if (adjPresence > 30.0) {
              connectedHighPresenceCount++;
            }
          }
        }

        // Diffusion only spills over if an adjacent neighbor has significant presence (> 10%)
        if (maxNeighborPresence >= 10.0) {
          const devastationMitigation = Math.max(0.0, 1.0 - loc.devastation);
          const infraCapacity = Math.max(0.1, loc.infrastructureCapacity);
          const tradeThroughput = Math.max(0.1, loc.connectedTradeThroughput);

          // Neighbor presence gradient factor (0.1 to 1.0)
          const gradient = (maxNeighborPresence - currentPresence) / 100.0;
          if (gradient > 0) {
            const spreadRate = this.baseDiffusionConstant *
              devastationMitigation *
              infraCapacity *
              tradeThroughput *
              gradient *
              (1.0 + (connectedHighPresenceCount - 1) * 0.25);

            presenceDeltas.set(locId, spreadRate);
          }
        }
      }

      // Apply all calculated diffusion steps atomically
      for (const [locId, delta] of presenceDeltas.entries()) {
        const loc = locationsMap.get(locId);
        if (loc) {
          const oldVal = loc.institutionPresence[institutionId] || 0.0;
          loc.institutionPresence[institutionId] = Math.min(100.0, oldVal + delta);
        }
      }
    }
  }

  /**
   * Computes National Tech & Outliner Project Penalties:
   * - 100% presence applies direct tech cost reduction
   * - 0% presence applies compounding construction penalty to items like Bastion of Calais
   */
  public calculateRealmInstitutionModifiers(
    realmLocations: InstitutionLocationContext[],
    institutionId: string = 'renaissance'
  ): { averagePresence: number; techCostModifier: number; outlinerConstructionTimeMultiplier: number } {
    if (realmLocations.length === 0) {
      return { averagePresence: 0, techCostModifier: 0, outlinerConstructionTimeMultiplier: 1.0 };
    }

    const inst = this.institutions.get(institutionId);
    const techBaseMod = inst ? inst.techCostModifier : -0.15;
    const penaltyFactor = inst ? inst.unembracedPenaltyFactor : 0.50;

    let totalPresence = 0;
    for (const loc of realmLocations) {
      totalPresence += (loc.institutionPresence[institutionId] || 0.0);
    }

    const avgPresence = totalPresence / realmLocations.length; // 0.0 to 100.0
    const presenceFraction = avgPresence / 100.0;

    // Tech cost scales from +penaltyFactor down to techBaseMod
    const techCostModifier = (1.0 - presenceFraction) * penaltyFactor + (presenceFraction * techBaseMod);
    const outlinerConstructionTimeMultiplier = 1.0 + (1.0 - presenceFraction) * penaltyFactor;

    return {
      averagePresence: avgPresence,
      techCostModifier,
      outlinerConstructionTimeMultiplier
    };
  }

  private registerDefaultInstitutions(): void {
    // 1. Feudalism: Global traditional start
    this.registerInstitution({
      id: 'feudalism',
      name: 'Feudalism',
      historicalEra: 'High Medieval',
      spawnConditions: () => true,
      techCostModifier: -0.10,
      unembracedPenaltyFactor: 0.30
    });

    // 2. Renaissance: Early modern paradigm shift
    // Requires a market hub location with >10% Burgher population, >500 wealth, and Ruler Learning > 70
    this.registerInstitution({
      id: 'renaissance',
      name: 'Renaissance',
      historicalEra: 'Early Modern',
      spawnConditions: (loc, rulerLearning) => {
        const burgherShare = loc.totalPopulation > 0 ? (loc.burgherPopulation / loc.totalPopulation) : 0;
        return loc.isMarketHub &&
          burgherShare >= 0.10 &&
          loc.totalWealth >= 500.0 &&
          rulerLearning >= 70;
      },
      techCostModifier: -0.15,
      unembracedPenaltyFactor: 0.50
    });
  }
}
