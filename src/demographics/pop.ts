import { EstateType } from '../core/types.ts';
import { LocationRegistry, type LocationData } from '../map/location.ts';

export interface PopEntity {
  id: number;
  location_id: number;
  estate_type: EstateType;
  culture_id: string;
  religion_id: string;
  culture_distribution: Record<string, number>; // Sub-faction tracking e.g. { "anglo_norman": 0.85, "francien": 0.15 }
  religion_distribution: Record<string, number>; // Sub-faction tracking e.g. { "catholic": 0.90, "cathar": 0.10 }
  size: number; // Uint32 individual count
  wealth: number; // Stored capital float
  basic_needs_satisfaction: number; // 0.0 to 1.0
  luxury_needs_satisfaction: number; // 0.0 to 1.0
  militancy_unrest: number; // 0.0 to 1.0
}

export interface MigrationVector {
  pop_id: number;
  origin_location_id: number;
  target_location_id: number;
  migrating_count: number;
  capital_transferred: number;
}

export class PopDemographicEngine {
  private pops: Map<number, PopEntity> = new Map();
  private nextPopId: number = 1;

  public createPop(params: Omit<PopEntity, 'id'>): PopEntity {
    const pop: PopEntity = {
      id: this.nextPopId++,
      ...params,
      size: Math.max(0, Math.floor(params.size)),
      culture_distribution: { ...params.culture_distribution },
      religion_distribution: { ...params.religion_distribution }
    };
    this.pops.set(pop.id, pop);
    return pop;
  }

  public getPop(id: number): PopEntity | undefined {
    return this.pops.get(id);
  }

  public getAllPops(): PopEntity[] {
    return Array.from(this.pops.values());
  }

  public getPopsInLocation(locationId: number): PopEntity[] {
    const result: PopEntity[] = [];
    for (const pop of this.pops.values()) {
      if (pop.location_id === locationId) {
        result.push(pop);
      }
    }
    return result;
  }

  public getTotalPopulation(): number {
    let total = 0;
    for (const pop of this.pops.values()) {
      total += pop.size;
    }
    return total;
  }

  /**
   * Demographic Tick:
   * Equation: Growth_Rate = Base_Rate * Basic_Needs_Satisfaction - (Devastation_Multiplier * 0.1)
   */
  public executeGrowthTick(locationRegistry: LocationRegistry, baseRate: number = 0.002): void {
    for (const pop of this.pops.values()) {
      const loc = locationRegistry.get(pop.location_id);
      const devastation = loc ? loc.devastation : 0.0;

      // Exact mathematical formula
      const growthRate = (baseRate * pop.basic_needs_satisfaction) - (devastation * 0.1);
      const deltaPop = Math.round(pop.size * growthRate);

      pop.size = Math.max(0, pop.size + deltaPop);

      // Unrest feedback loop: if basic needs fall below 0.3, militancy increases
      if (pop.basic_needs_satisfaction < 0.3) {
        pop.militancy_unrest = Math.min(1.0, pop.militancy_unrest + 0.02);
      } else {
        pop.militancy_unrest = Math.max(0.0, pop.militancy_unrest - 0.01);
      }

      // Safeguard against NaN
      if (Number.isNaN(pop.size) || Number.isNaN(pop.wealth) || Number.isNaN(pop.militancy_unrest)) {
        throw new Error(`NaN corruption detected in pop ID ${pop.id} after growth tick!`);
      }
    }
  }

  /**
   * Migration Flow Vectors:
   * Triggers if Devastation > 0.4 OR Local_Wealth < Global_Average * 0.6
   */
  public calculateMigrationFlows(
    locationRegistry: LocationRegistry,
    globalAverageWealth: number
  ): MigrationVector[] {
    const migrationVectors: MigrationVector[] = [];

    for (const pop of this.pops.values()) {
      if (pop.size <= 10) continue;

      const loc = locationRegistry.get(pop.location_id);
      if (!loc) continue;

      const shouldMigrate = loc.devastation > 0.4 || pop.wealth < (globalAverageWealth * 0.6);
      if (!shouldMigrate) continue;

      // Find candidates: adjacent locations or connected market hub with lower devastation and higher control
      let bestTarget: LocationData | null = null;
      let bestScore = -Infinity;

      for (const neighborId of loc.neighbors) {
        const neighbor = locationRegistry.get(neighborId);
        if (!neighbor) continue;

        // Attractiveness score: High Control, Low Devastation, High Infrastructure
        const score = (neighbor.control * 2.0) + (neighbor.current_infrastructure * 0.5) - (neighbor.devastation * 3.0);
        if (score > bestScore && neighbor.devastation < loc.devastation) {
          bestScore = score;
          bestTarget = neighbor;
        }
      }

      if (bestTarget && bestScore > 0) {
        const migrateFraction = loc.devastation > 0.6 ? 0.15 : 0.08;
        const migratingCount = Math.floor(pop.size * migrateFraction);
        const capitalTransferred = pop.wealth * migrateFraction;

        if (migratingCount > 0) {
          migrationVectors.push({
            pop_id: pop.id,
            origin_location_id: loc.id,
            target_location_id: bestTarget.id,
            migrating_count: migratingCount,
            capital_transferred: capitalTransferred
          });
        }
      }
    }

    return migrationVectors;
  }

  /**
   * Apply migration vectors with atomic demographic conservation
   */
  public applyMigration(vectors: MigrationVector[]): void {
    for (const vec of vectors) {
      const sourcePop = this.pops.get(vec.pop_id);
      if (!sourcePop || sourcePop.size < vec.migrating_count) continue;

      sourcePop.size -= vec.migrating_count;
      sourcePop.wealth -= vec.capital_transferred;

      // Find or create matching Pop entity in target location
      let targetPop = this.getPopsInLocation(vec.target_location_id).find(
        p => p.estate_type === sourcePop.estate_type &&
             p.culture_id === sourcePop.culture_id &&
             p.religion_id === sourcePop.religion_id
      );

      if (targetPop) {
        targetPop.size += vec.migrating_count;
        targetPop.wealth += vec.capital_transferred;
      } else {
        this.createPop({
          location_id: vec.target_location_id,
          estate_type: sourcePop.estate_type,
          culture_id: sourcePop.culture_id,
          religion_id: sourcePop.religion_id,
          culture_distribution: { ...sourcePop.culture_distribution },
          religion_distribution: { ...sourcePop.religion_distribution },
          size: vec.migrating_count,
          wealth: vec.capital_transferred,
          basic_needs_satisfaction: sourcePop.basic_needs_satisfaction,
          luxury_needs_satisfaction: sourcePop.luxury_needs_satisfaction,
          militancy_unrest: sourcePop.militancy_unrest
        });
      }
    }
  }

  /**
   * Black Death & Plague Epidemiological Simulation:
   * Infection_Chance = Base_Virulence * (Pop_Density_Ratio) * (1 + Trade_Throughput_Volume) * e^(-Distance / 50)
   */
  public executePlagueContagionTick(
    locationRegistry: LocationRegistry,
    tradeThroughputs: Map<number, number>, // locationId -> throughput volume
    baseVirulence: number = 0.45
  ): { newlyInfectedLocations: number[]; totalPlagueDeaths: number } {
    const locations = locationRegistry.getAll();
    const newlyInfected: number[] = [];
    let totalPlagueDeaths = 0;

    // Phase 1: Contagion spread from infected to uninfected
    for (const sourceLoc of locations) {
      if (!sourceLoc.plague_infected) continue;

      const sourcePops = this.getPopsInLocation(sourceLoc.id);
      const sourcePopCount = sourcePops.reduce((sum, p) => sum + p.size, 0);
      const densityRatio = Math.min(3.0, sourcePopCount / Math.max(1, sourceLoc.infrastructure_capacity * 500));

      for (const targetLoc of locations) {
        if (targetLoc.plague_infected) continue;

        // Calculate topological distance (1 hop for direct neighbor, 2 for sea)
        const isNeighbor = sourceLoc.neighbors.includes(targetLoc.id);
        const isSeaLinked = sourceLoc.sea_connections.includes(targetLoc.id);
        if (!isNeighbor && !isSeaLinked) continue;

        const distance = isNeighbor ? 20.0 : 35.0;
        const tradeThroughput = tradeThroughputs.get(targetLoc.id) || 0.0;

        // Exact formula
        const infectionChance = baseVirulence * densityRatio * (1.0 + tradeThroughput) * Math.exp(-distance / 50.0);

        if (Math.random() < Math.min(0.95, infectionChance)) {
          newlyInfected.push(targetLoc.id);
        }
      }
    }

    for (const id of newlyInfected) {
      const loc = locationRegistry.get(id);
      if (loc) {
        loc.plague_infected = true;
        loc.plague_intensity = 0.7;
      }
    }

    // Phase 2: Plague mortality and virulence decay
    for (const loc of locations) {
      if (!loc.plague_infected) continue;

      const pops = this.getPopsInLocation(loc.id);
      const mortalityRate = 0.10 * loc.plague_intensity;

      for (const pop of pops) {
        const casualties = Math.floor(pop.size * mortalityRate);
        pop.size -= casualties;
        totalPlagueDeaths += casualties;
        pop.wealth = Math.max(0, pop.wealth * 0.9); // Economic collapse
      }

      loc.devastation = Math.min(1.0, loc.devastation + (loc.plague_intensity * 0.15));

      // Plague burns out over time
      loc.plague_intensity -= 0.1;
      if (loc.plague_intensity <= 0.05) {
        loc.plague_infected = false;
        loc.plague_intensity = 0.0;
      }
    }

    return { newlyInfectedLocations: newlyInfected, totalPlagueDeaths };
  }

  /**
   * Organic Cultural and Religious Conversion
   */
  public executeAssimilationTick(dominantCulture: string, dominantReligion: string, conversionSpeed: number = 0.005): void {
    for (const pop of this.pops.values()) {
      // Assimilate culture fractions
      for (const cultId of Object.keys(pop.culture_distribution)) {
        if (cultId !== dominantCulture) {
          const shift = Math.min(pop.culture_distribution[cultId], conversionSpeed);
          pop.culture_distribution[cultId] -= shift;
          pop.culture_distribution[dominantCulture] = (pop.culture_distribution[dominantCulture] || 0) + shift;
        }
      }

      // Convert religion fractions
      for (const relId of Object.keys(pop.religion_distribution)) {
        if (relId !== dominantReligion) {
          const shift = Math.min(pop.religion_distribution[relId], conversionSpeed);
          pop.religion_distribution[relId] -= shift;
          pop.religion_distribution[dominantReligion] = (pop.religion_distribution[dominantReligion] || 0) + shift;
        }
      }

      // Update primary identity if minority exceeds threshold
      if ((pop.culture_distribution[dominantCulture] || 0) > 0.6) {
        pop.culture_id = dominantCulture;
      }
      if ((pop.religion_distribution[dominantReligion] || 0) > 0.6) {
        pop.religion_id = dominantReligion;
      }
    }
  }
}
