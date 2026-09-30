/**
 * Trade War, Famine & Monetary Inflation Simulator
 * Evaluates army-induced devastation, agricultural famine events, and gold reserve inflation scaling
 */

export interface FamineLocationNode {
  locationId: number;
  name: string;
  countryTag: string;
  devastation: number; // 0.0 to 1.0
  armyOccupationDays: number;
  isSevereWinter: boolean;
  isFamineActive: boolean;
  commonerPopSize: number;
  grainOutputCapacity: number;
  woolOutputCapacity: number;
}

export interface MonetaryInflationMetrics {
  countryTag: string;
  treasuryGold: number;
  globalGoodsSupplyIndex: number;
  inflationMultiplier: number;
  outlinerConstructionCostScale: number;
  armyMaintenanceCostScale: number;
}

export class EconomicCrisisSimulator {
  private locations: Map<number, FamineLocationNode> = new Map();
  private nationalInflation: Map<string, MonetaryInflationMetrics> = new Map();

  constructor() {
    this.initializeDefaultLocations();
  }

  private initializeDefaultLocations(): void {
    const locs: FamineLocationNode[] = [
      {
        locationId: 1,
        name: 'London',
        countryTag: 'ENG',
        devastation: 0.0,
        armyOccupationDays: 0,
        isSevereWinter: false,
        isFamineActive: false,
        commonerPopSize: 22000,
        grainOutputCapacity: 1.2,
        woolOutputCapacity: 0.8
      },
      {
        locationId: 3,
        name: 'Calais',
        countryTag: 'ENG',
        devastation: 0.10,
        armyOccupationDays: 0,
        isSevereWinter: false,
        isFamineActive: false,
        commonerPopSize: 7300,
        grainOutputCapacity: 0.2,
        woolOutputCapacity: 0.4
      },
      {
        locationId: 4,
        name: 'Rouen',
        countryTag: 'FRA',
        devastation: 0.15,
        armyOccupationDays: 0,
        isSevereWinter: false,
        isFamineActive: false,
        commonerPopSize: 12500,
        grainOutputCapacity: 0.9,
        woolOutputCapacity: 0.3
      },
      {
        locationId: 104,
        name: 'Constantinople',
        countryTag: 'BYZ',
        devastation: 0.08,
        armyOccupationDays: 0,
        isSevereWinter: false,
        isFamineActive: false,
        commonerPopSize: 50000,
        grainOutputCapacity: 0.5,
        woolOutputCapacity: 0.2
      }
    ];

    for (const l of locs) {
      this.locations.set(l.locationId, l);
    }
  }

  public registerLocation(loc: FamineLocationNode): void {
    this.locations.set(loc.locationId, loc);
  }

  public getLocation(locationId: number): FamineLocationNode | undefined {
    return this.locations.get(locationId);
  }

  /**
   * Daily Simulation Pass: evaluates military foraging devastation and winter strains
   */
  public executeDailyDevastationTick(
    activeArmyLocations: { locationId: number; daysStationed: number }[]
  ): void {
    // Increment occupation days for active army locations
    const activeLocIds = new Set<number>();
    for (const army of activeArmyLocations) {
      activeLocIds.add(army.locationId);
      const loc = this.locations.get(army.locationId);
      if (loc) {
        loc.armyOccupationDays = army.daysStationed;

        // If army stays > 3 consecutive days, devastation surges
        if (loc.armyOccupationDays >= 3) {
          loc.devastation = Math.min(1.0, loc.devastation + 0.015);
        }
      }
    }

    // Natural recovery for unoccupied locations
    for (const loc of this.locations.values()) {
      if (!activeLocIds.has(loc.locationId)) {
        loc.armyOccupationDays = 0;
        if (loc.devastation > 0.0) {
          loc.devastation = Math.max(0.0, loc.devastation - 0.001); // Slow daily recovery
        }
      }

      if (loc.isSevereWinter) {
        loc.devastation = Math.min(1.0, loc.devastation + 0.005);
      }
    }
  }

  /**
   * Monthly Famine Evaluation Loop:
   * When Devastation > 0.60:
   * - Commoner pop sizes decay by 5% monthly due to starvation.
   * - Raw material extraction (grain, wool) drops to absolute 0.0.
   */
  public executeMonthlyFaminePass(): {
    famineLocationIds: number[];
    totalStarvationCasualties: number;
  } {
    const famineLocationIds: number[] = [];
    let totalStarvationCasualties = 0;

    for (const loc of this.locations.values()) {
      if (loc.devastation > 0.60) {
        loc.isFamineActive = true;
        // Raw material extraction drops to absolute 0.0
        loc.grainOutputCapacity = 0.0;
        loc.woolOutputCapacity = 0.0;

        // 5% monthly starvation mortality on commoners
        const casualties = Math.floor(loc.commonerPopSize * 0.05);
        loc.commonerPopSize = Math.max(100, loc.commonerPopSize - casualties);
        totalStarvationCasualties += casualties;

        famineLocationIds.push(loc.locationId);
      } else {
        loc.isFamineActive = false;
        // Standard capacities restored
        loc.grainOutputCapacity = 1.0;
        loc.woolOutputCapacity = 0.5;
      }
    }

    return { famineLocationIds, totalStarvationCasualties };
  }

  /**
   * Monetary Inflation Calculation Loop:
   * Inflation_Multiplier = Total_Gold_Reserves / Global_Goods_Supply_Index
   * High inflation scales Outliner construction costs and recruitment maintenance
   */
  public calculateMonetaryInflation(
    countryTag: string,
    treasuryGold: number,
    globalGoodsSupplyIndex: number
  ): MonetaryInflationMetrics {
    const safeGoods = Math.max(100.0, globalGoodsSupplyIndex);
    const ratio = treasuryGold / safeGoods;

    // Inflation multiplier base 1.0; scales up if gold drastically exceeds goods supply
    const multiplier = Math.max(1.0, 1.0 + (ratio - 1.0) * 0.40);
    const constructionScale = multiplier;
    const maintenanceScale = 1.0 + (multiplier - 1.0) * 0.75;

    const metrics: MonetaryInflationMetrics = {
      countryTag,
      treasuryGold,
      globalGoodsSupplyIndex: safeGoods,
      inflationMultiplier: multiplier,
      outlinerConstructionCostScale: constructionScale,
      armyMaintenanceCostScale: maintenanceScale
    };

    this.nationalInflation.set(countryTag, metrics);
    return metrics;
  }

  public getInflationMetrics(countryTag: string): MonetaryInflationMetrics | undefined {
    return this.nationalInflation.get(countryTag);
  }
}
