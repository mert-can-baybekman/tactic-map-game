/**
 * Overseas Colony Charters & Global Resource Injection
 * Subsystem: /src/economy/colonization.ts
 */

export const LuxuryGoodType = {
  Tobacco: 'tobacco',
  Sugar: 'sugar',
  Gold_Ore: 'gold_ore'
} as const;

export type LuxuryGoodType = typeof LuxuryGoodType[keyof typeof LuxuryGoodType];

export interface ColonyCharterOutpost {
  charterId: string;
  countryTag: string;
  locationId: number;
  locationName: string;
  monthlyGoldMaintenance: number; // Gold deducted from national treasury
  currentPopulation: number;
  nativePopSize: number;
  nativeAggressionFloat: number; // 0.0 to 100.0
  stateBurgherSatisfaction: number; // 0.0 to 100.0
  isCoreLocation: boolean;
  luxuryResource: LuxuryGoodType;
  connectedHomeMarketNodeId: number;
  tradeEdgeEstablished: boolean;
}

export class ColonyCharterManager {
  private colonies: Map<string, ColonyCharterOutpost> = new Map();

  public deployColonyCharter(
    countryTag: string,
    locationId: number,
    locationName: string,
    luxuryResource: LuxuryGoodType,
    connectedHomeMarketNodeId: number,
    nativePopSize: number = 2500,
    nativeAggression: number = 30.0,
    monthlyMaintenance: number = 20.0
  ): ColonyCharterOutpost {
    const charterId = `colony_${countryTag}_loc_${locationId}`;
    const colony: ColonyCharterOutpost = {
      charterId,
      countryTag,
      locationId,
      locationName,
      monthlyGoldMaintenance: monthlyMaintenance,
      currentPopulation: 100, // Initial settlers
      nativePopSize,
      nativeAggressionFloat: nativeAggression,
      stateBurgherSatisfaction: 75.0,
      isCoreLocation: false,
      luxuryResource,
      connectedHomeMarketNodeId,
      tradeEdgeEstablished: false
    };

    this.colonies.set(charterId, colony);
    return colony;
  }

  /**
   * Monthly Population Growth & Outpost Core Conversion Tick:
   * Colony_Growth_Rate = Base_Immigration_Rate + (State_Burgher_Satisfaction * 0.1) - (Native_Aggression * 0.05)
   * Upon reaching 5,000 pops, converts into regular core Location node and injects luxury resources into trade graph.
   */
  public processMonthlyColonyTick(
    charterId: string,
    baseImmigrationRate: number = 45.0
  ): {
    charterId: string;
    netGrowth: number;
    currentPopulation: number;
    monthlyMaintenance: number;
    convertedToCore: boolean;
    resourceInjected?: LuxuryGoodType;
  } {
    const colony = this.colonies.get(charterId);
    if (!colony) {
      return {
        charterId,
        netGrowth: 0,
        currentPopulation: 0,
        monthlyMaintenance: 0,
        convertedToCore: false
      };
    }

    // If already core, standard normal growth and zero charter maintenance
    if (colony.isCoreLocation) {
      const normalGrowth = Math.floor(colony.currentPopulation * 0.002);
      colony.currentPopulation += normalGrowth;
      return {
        charterId,
        netGrowth: normalGrowth,
        currentPopulation: colony.currentPopulation,
        monthlyMaintenance: 0,
        convertedToCore: false,
        resourceInjected: colony.luxuryResource
      };
    }

    // Monthly Growth Formula:
    // Base_Immigration_Rate + (State_Burgher_Satisfaction * 0.1) - (Native_Aggression * 0.05)
    const rawGrowth = baseImmigrationRate 
      + (colony.stateBurgherSatisfaction * 0.10) 
      - (colony.nativeAggressionFloat * 0.05);

    const netGrowth = Math.max(5, Math.floor(rawGrowth));
    colony.currentPopulation += netGrowth;

    let converted = false;
    let resourceInjected: LuxuryGoodType | undefined;

    // Check 5,000 threshold for full core conversion
    if (colony.currentPopulation >= 5000) {
      colony.isCoreLocation = true;
      colony.tradeEdgeEstablished = true;
      colony.monthlyGoldMaintenance = 0; // Outpost becomes self-sustaining tax-paying core
      converted = true;
      resourceInjected = colony.luxuryResource;
    }

    return {
      charterId,
      netGrowth,
      currentPopulation: colony.currentPopulation,
      monthlyMaintenance: colony.monthlyGoldMaintenance,
      convertedToCore: converted,
      resourceInjected
    };
  }

  public getColony(charterId: string): ColonyCharterOutpost | undefined {
    return this.colonies.get(charterId);
  }

  public getActiveCharters(countryTag?: string): ColonyCharterOutpost[] {
    const all = Array.from(this.colonies.values());
    if (countryTag) {
      return all.filter(c => c.countryTag === countryTag);
    }
    return all;
  }
}
