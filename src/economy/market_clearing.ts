/**
 * Dynamic Market Clearing & Supply-Demand Price Fixing Engine
 * Localized price equilibrium calculation, blockade starvation spikes,
 * and topbar HUD tax income telemetry synchronization.
 */

export interface MarketGoodMetrics {
  id: string;
  name: string;
  basePrice: number;
  elasticityFactor: number; // 0.3 to 0.7
  isStrategic: boolean;
}

export interface HubGoodBalance {
  goodId: string;
  supply: number;
  demand: number;
  currentPrice: number;
  isStarved: boolean;
}

export interface DynamicMarketHub {
  id: number;
  name: string;
  countryTag: string;
  locationIds: number[];
  goods: Map<string, HubGoodBalance>;
}

export class MarketClearingEngine {
  private goods: Map<string, MarketGoodMetrics> = new Map();
  private hubs: Map<number, DynamicMarketHub> = new Map();

  constructor() {
    this.initializeDefaultGoods();
    this.initializeDefaultHubs();
  }

  private initializeDefaultGoods(): void {
    const defaultGoods: MarketGoodMetrics[] = [
      { id: 'grain', name: 'Grain', basePrice: 2.5, elasticityFactor: 0.40, isStrategic: false },
      { id: 'wool', name: 'Raw Wool', basePrice: 3.5, elasticityFactor: 0.50, isStrategic: false },
      { id: 'iron', name: 'Iron Ore', basePrice: 6.0, elasticityFactor: 0.65, isStrategic: true },
      { id: 'timber', name: 'Hardwood Timber', basePrice: 4.0, elasticityFactor: 0.55, isStrategic: true },
      { id: 'weapons', name: 'Manufactured Weapons', basePrice: 18.0, elasticityFactor: 0.70, isStrategic: true },
      { id: 'silk', name: 'Silk', basePrice: 15.0, elasticityFactor: 0.60, isStrategic: false },
      { id: 'spices', name: 'Exotic Spices', basePrice: 20.0, elasticityFactor: 0.60, isStrategic: false }
    ];

    for (const g of defaultGoods) {
      this.goods.set(g.id, g);
    }
  }

  private initializeDefaultHubs(): void {
    // Hub 10: London / English Channel Market
    this.registerHub({
      id: 10,
      name: 'London Market Hub',
      countryTag: 'ENG',
      locationIds: [1, 2, 3],
      goods: new Map([
        ['grain', { goodId: 'grain', supply: 120.0, demand: 90.0, currentPrice: 2.5, isStarved: false }],
        ['wool', { goodId: 'wool', supply: 60.0, demand: 45.0, currentPrice: 3.5, isStarved: false }],
        ['iron', { goodId: 'iron', supply: 45.0, demand: 40.0, currentPrice: 6.0, isStarved: false }],
        ['timber', { goodId: 'timber', supply: 60.0, demand: 50.0, currentPrice: 4.0, isStarved: false }],
        ['weapons', { goodId: 'weapons', supply: 20.0, demand: 25.0, currentPrice: 18.0, isStarved: false }]
      ])
    });

    // Hub 20: Paris / Continental French Market
    this.registerHub({
      id: 20,
      name: 'Paris Market Hub',
      countryTag: 'FRA',
      locationIds: [4, 5],
      goods: new Map([
        ['grain', { goodId: 'grain', supply: 150.0, demand: 130.0, currentPrice: 2.5, isStarved: false }],
        ['wool', { goodId: 'wool', supply: 40.0, demand: 55.0, currentPrice: 3.5, isStarved: false }],
        ['iron', { goodId: 'iron', supply: 30.0, demand: 35.0, currentPrice: 6.0, isStarved: false }],
        ['timber', { goodId: 'timber', supply: 40.0, demand: 45.0, currentPrice: 4.0, isStarved: false }],
        ['weapons', { goodId: 'weapons', supply: 15.0, demand: 20.0, currentPrice: 18.0, isStarved: false }]
      ])
    });

    // Hub 30: Bursa / Marmara Silk Market
    this.registerHub({
      id: 30,
      name: 'Bursa / Marmara Hub',
      countryTag: 'TUR',
      locationIds: [101, 102, 104, 110],
      goods: new Map([
        ['grain', { goodId: 'grain', supply: 140.0, demand: 110.0, currentPrice: 2.5, isStarved: false }],
        ['silk', { goodId: 'silk', supply: 120.0, demand: 40.0, currentPrice: 15.0, isStarved: false }],
        ['spices', { goodId: 'spices', supply: 80.0, demand: 30.0, currentPrice: 20.0, isStarved: false }],
        ['iron', { goodId: 'iron', supply: 35.0, demand: 30.0, currentPrice: 6.0, isStarved: false }],
        ['weapons', { goodId: 'weapons', supply: 25.0, demand: 25.0, currentPrice: 18.0, isStarved: false }]
      ])
    });
  }

  public registerHub(hub: DynamicMarketHub): void {
    this.hubs.set(hub.id, hub);
  }

  public getHub(id: number): DynamicMarketHub | undefined {
    return this.hubs.get(id);
  }

  public getAllHubs(): DynamicMarketHub[] {
    return Array.from(this.hubs.values());
  }

  /**
   * Localized Price Equilibrium Calculation:
   * Market_Price = Base_Price * (Demand / Supply)^Elasticity_Factor
   */
  public calculateClearingPrice(basePrice: number, demand: number, supply: number, elasticity: number): number {
    const s = Math.max(0.01, supply);
    const d = Math.max(0.01, demand);
    const ratio = d / s;
    const price = basePrice * Math.pow(ratio, elasticity);

    // Clamp between -85% minimum and +400% maximum price ceiling (5.0x base)
    return Math.max(basePrice * 0.15, Math.min(basePrice * 5.0, price));
  }

  /**
   * Monthly Market Clearing Pass across all Hubs
   */
  public executeMarketClearingPass(): void {
    for (const hub of this.hubs.values()) {
      for (const [goodId, balance] of hub.goods.entries()) {
        const def = this.goods.get(goodId);
        if (!def) continue;

        if (balance.isStarved) {
          // Blockade / Starvation price spike: +400% (5.0x base)
          balance.currentPrice = def.basePrice * 5.0;
        } else {
          balance.currentPrice = this.calculateClearingPrice(
            def.basePrice,
            balance.demand,
            balance.supply,
            def.elasticityFactor
          );
        }
      }
    }
  }

  /**
   * Applies blockade starvation feedback loop:
   * Spikes strategic goods prices by 400%, halts weapon workshops, and computes topbar HUD impact
   */
  public applyBlockadeStarvation(
    hubId: number,
    isBlockaded: boolean
  ): {
    hubId: number;
    starvedGoods: string[];
    weaponsManufacturingHalted: boolean;
    hudTreasuryImpactDelta: number;
  } {
    const hub = this.hubs.get(hubId);
    if (!hub) {
      return { hubId, starvedGoods: [], weaponsManufacturingHalted: false, hudTreasuryImpactDelta: 0 };
    }

    const starvedGoods: string[] = [];
    let weaponsManufacturingHalted = false;
    let hudTreasuryImpactDelta = 0;

    for (const [goodId, balance] of hub.goods.entries()) {
      const def = this.goods.get(goodId);
      if (!def) continue;

      if (isBlockaded && def.isStrategic) {
        // Supply drops to zero/near-zero
        balance.supply = 1.0; // Starved down to near zero
        balance.isStarved = true;
        balance.currentPrice = def.basePrice * 5.0; // +400% spike
        starvedGoods.push(goodId);

        if (goodId === 'iron' || goodId === 'timber') {
          weaponsManufacturingHalted = true;
        }

        // Higher resource prices drain crown treasury maintenance
        hudTreasuryImpactDelta -= 25.0;
      } else if (!isBlockaded) {
        balance.isStarved = false;
        // Restore standard baseline supply
        balance.supply = Math.max(balance.supply, balance.demand * 1.1);
        balance.currentPrice = this.calculateClearingPrice(
          def.basePrice,
          balance.demand,
          balance.supply,
          def.elasticityFactor
        );
      }
    }

    return {
      hubId,
      starvedGoods,
      weaponsManufacturingHalted,
      hudTreasuryImpactDelta
    };
  }

  /**
   * Computes national market tax value flowing into topbar HUD treasury
   */
  public calculateHubTaxGeneration(hubId: number, nationalTaxEfficiency: number = 1.0): number {
    const hub = this.hubs.get(hubId);
    if (!hub) return 0;

    let tradeValue = 0;
    for (const balance of hub.goods.values()) {
      tradeValue += (balance.supply * balance.currentPrice * 0.05); // 5% commercial turnover tax
    }

    return tradeValue * nationalTaxEfficiency;
  }
}
