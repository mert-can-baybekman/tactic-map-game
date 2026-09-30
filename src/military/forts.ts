/**
 * Fort Zone of Control (ZoC) & Granular Siege Interception Matrix
 * Implements defensive projection grids, pathfinding ZoC locks,
 * and monthly siege breach progression rolls.
 */

export type BreachStatusEnum = 'None' | 'Food_Shortage' | 'Water_Shortage' | 'Wall_Breached';

export interface FortBuilding {
  id: string;
  locationId: number;
  locationName: string;
  countryTag: string;
  fortLevel: number; // 1 to 5 (e.g., Level 3 Theodosian Walls in Constantinople)
  defensiveInfrastructureLevel: number; // e.g. 3.0
  garrisonSize: number; // Active defenders
  maxGarrisonSize: number;
  isOperational: boolean;
  isUnderSiege: boolean;
  zocProtectedLocationIds: number[];
}

export interface ActiveSiege {
  siegeId: string;
  fortLocationId: number;
  besiegerArmyId: string;
  besiegerCountryTag: string;
  armyArtilleryCount: number;
  leaderSiegeTrait: number; // e.g. +2 for Master Engineer
  currentPhaseProgress: number; // 0 to 100
  breachStatus: BreachStatusEnum;
  monthsBesieged: number;
  garrisonCasualties: number;
  isCompleted: boolean;
}

export interface SiegeTickResult {
  siegeId: string;
  phaseIncrement: number;
  newProgress: number;
  breachStatus: BreachStatusEnum;
  fortSurrendered: boolean;
  devastationInflicted: number;
  newControllerTag?: string;
}

export class FortSubsystem {
  private forts: Map<number, FortBuilding> = new Map(); // locationId -> Fort
  private activeSieges: Map<number, ActiveSiege> = new Map(); // fortLocationId -> ActiveSiege

  public registerFort(fort: FortBuilding): void {
    this.forts.set(fort.locationId, fort);
  }

  public getFort(locationId: number): FortBuilding | undefined {
    return this.forts.get(locationId);
  }

  public getAllForts(): FortBuilding[] {
    return Array.from(this.forts.values());
  }

  public getActiveSiege(fortLocationId: number): ActiveSiege | undefined {
    return this.activeSieges.get(fortLocationId);
  }

  /**
   * Zone of Control (ZoC) Calculation Loop:
   * Any location directly adjacent to a friendly operational Fort building is marked as a ZoC_Protected_Node.
   */
  public calculateZoneOfControl(
    locationAdjacencies: Map<number, number[]>,
    countryOwnershipMap: Map<number, string>
  ): Map<number, Set<number>> {
    // Returns countryTag -> Set of protected location IDs
    const zocByCountry: Map<number, Set<number>> = new Map();

    for (const fort of this.forts.values()) {
      if (!fort.isOperational) continue;

      const neighbors = locationAdjacencies.get(fort.locationId) || [];
      const fortOwner = countryOwnershipMap.get(fort.locationId) || fort.countryTag;

      fort.zocProtectedLocationIds = [fort.locationId];

      for (const adjId of neighbors) {
        const neighborOwner = countryOwnershipMap.get(adjId);
        // ZoC projects over friendly or contested border territory
        if (neighborOwner === fortOwner || neighborOwner === undefined) {
          fort.zocProtectedLocationIds.push(adjId);
        }
      }
    }

    return zocByCountry;
  }

  /**
   * Evaluates if an army's proposed movement step is blocked by a hostile Fort ZoC:
   * If an enemy army attempts to move through a ZoC node without besieging the central Fort,
   * pathfinding locks (forces remaining or retreating).
   */
  public isMovementBlockedByZoC(
    currentLocationId: number,
    nextLocationId: number,
    armyCountryTag: string
  ): { isBlocked: boolean; blockingFortLocationId?: number; reason?: string } {
    for (const fort of this.forts.values()) {
      if (!fort.isOperational || fort.countryTag === armyCountryTag) {
        continue;
      }

      // If moving from a ZoC node into another non-fort node while ignoring the operational fort
      const currentInZoC = fort.zocProtectedLocationIds.includes(currentLocationId);
      const nextInZoC = fort.zocProtectedLocationIds.includes(nextLocationId);
      const isEnteringFortNode = nextLocationId === fort.locationId;

      if (currentInZoC && nextInZoC && !isEnteringFortNode && currentLocationId !== fort.locationId) {
        return {
          isBlocked: true,
          blockingFortLocationId: fort.locationId,
          reason: `Movement blocked by hostile Fort Zone of Control projected from ${fort.locationName} (ID ${fort.locationId}). Must besiege central fort first.`
        };
      }
    }

    return { isBlocked: false };
  }

  /**
   * Initiates a discrete siege on an operational Fort
   */
  public initiateSiege(
    fortLocationId: number,
    besiegerArmyId: string,
    besiegerCountryTag: string,
    armyArtilleryCount: number = 2,
    leaderSiegeTrait: number = 1
  ): ActiveSiege {
    const fort = this.forts.get(fortLocationId);
    if (!fort) {
      throw new Error(`Cannot initiate siege: No fort registered at location ${fortLocationId}`);
    }

    fort.isUnderSiege = true;

    const siege: ActiveSiege = {
      siegeId: `siege_${fortLocationId}_${Date.now()}`,
      fortLocationId,
      besiegerArmyId,
      besiegerCountryTag,
      armyArtilleryCount,
      leaderSiegeTrait,
      currentPhaseProgress: 0,
      breachStatus: 'None',
      monthsBesieged: 0,
      garrisonCasualties: 0,
      isCompleted: false
    };

    this.activeSieges.set(fortLocationId, siege);
    return siege;
  }

  /**
   * Granular Monthly Siege Tick Matrix:
   * Equation:
   * Siege_Phase_Progress = Army_Artillery_Count + Leader_Siege_Trait - Fort_Defensive_Infrastructure_Level
   * Advances breach status: None -> Food_Shortage -> Water_Shortage -> Wall_Breached
   * Upon 100% threshold: Fort surrenders, transfers location control, collapses ZoC, and inflicts +0.40 Devastation.
   */
  public executeMonthlySiegeTick(
    fortLocationId: number,
    locationData?: { devastation: number; country: string }
  ): SiegeTickResult {
    const fort = this.forts.get(fortLocationId);
    const siege = this.activeSieges.get(fortLocationId);

    if (!fort || !siege || siege.isCompleted) {
      return {
        siegeId: '',
        phaseIncrement: 0,
        newProgress: 0,
        breachStatus: 'None',
        fortSurrendered: false,
        devastationInflicted: 0
      };
    }

    siege.monthsBesieged++;

    // Calculate progress increment roll
    const netProgressFactor = Math.max(
      3,
      (siege.armyArtilleryCount * 4) + (siege.leaderSiegeTrait * 5) - Math.round(fort.defensiveInfrastructureLevel * 2)
    );

    siege.currentPhaseProgress = Math.min(100, siege.currentPhaseProgress + netProgressFactor);

    // Update Breach Status based on progress milestones
    if (siege.currentPhaseProgress >= 85) {
      siege.breachStatus = 'Wall_Breached';
    } else if (siege.currentPhaseProgress >= 55) {
      siege.breachStatus = 'Water_Shortage';
    } else if (siege.currentPhaseProgress >= 30) {
      siege.breachStatus = 'Food_Shortage';
    }

    // Attrition on defending garrison
    const casualties = Math.round(fort.garrisonSize * 0.12);
    fort.garrisonSize = Math.max(0, fort.garrisonSize - casualties);
    siege.garrisonCasualties += casualties;

    // Victory check
    let surrendered = false;
    let devastation = 0.05; // Base siege wear and tear

    if (siege.currentPhaseProgress >= 100 || fort.garrisonSize <= 0) {
      surrendered = true;
      siege.isCompleted = true;
      fort.isUnderSiege = false;
      fort.isOperational = false; // Collapses local ZoC projection!
      fort.zocProtectedLocationIds = [];
      devastation = 0.40; // Massive breach destruction

      if (locationData) {
        locationData.country = siege.besiegerCountryTag;
        locationData.devastation = Math.min(1.0, locationData.devastation + devastation);
      }

      this.activeSieges.delete(fortLocationId);
    }

    return {
      siegeId: siege.siegeId,
      phaseIncrement: netProgressFactor,
      newProgress: siege.currentPhaseProgress,
      breachStatus: siege.breachStatus,
      fortSurrendered: surrendered,
      devastationInflicted: devastation,
      newControllerTag: surrendered ? siege.besiegerCountryTag : undefined
    };
  }
}
