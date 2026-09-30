import type { GoodDefinition } from '../core/types.ts';

export interface TradeRouteEdge {
  id: string;
  sourceHubId: number;
  targetHubId: number;
  capacity: number;
  transport_cost_multiplier: number;
  is_blockaded: boolean;
  is_embargoed: boolean;
  active_throughput: number;
}

export interface MarketHubNode {
  id: number;
  name: string;
  location_ids: number[];
  inventory: Map<string, number>; // good_id -> stockpiled volume
  supply: Map<string, number>;    // good_id -> current tick supply
  demand: Map<string, number>;    // good_id -> current tick demand
  prices: Map<string, number>;    // good_id -> calculated market price
}

export class MarketEconomyEngine {
  private goodsDefinitions: Map<string, GoodDefinition> = new Map();
  private hubs: Map<number, MarketHubNode> = new Map();
  private tradeRoutes: TradeRouteEdge[] = [];

  public registerGood(good: GoodDefinition): void {
    this.goodsDefinitions.set(good.id, good);
  }

  public registerHub(hub: MarketHubNode): void {
    this.hubs.set(hub.id, hub);
  }

  public getHub(id: number): MarketHubNode | undefined {
    return this.hubs.get(id);
  }

  public getAllHubs(): MarketHubNode[] {
    return Array.from(this.hubs.values());
  }

  public addTradeRoute(route: TradeRouteEdge): void {
    this.tradeRoutes.push(route);
  }

  public getTradeRoutes(): TradeRouteEdge[] {
    return this.tradeRoutes;
  }

  public setRouteBlockade(routeId: string, blockaded: boolean): void {
    const route = this.tradeRoutes.find(r => r.id === routeId);
    if (route) {
      route.is_blockaded = blockaded;
      if (blockaded) route.active_throughput = 0.0;
    }
  }

  /**
   * Market Clearing & Dynamic Price Equilibrium:
   * Price = Base_Price * (Total_Demand / Total_Supply)^Elasticity_Factor
   */
  public executeMarketClearingTick(): void {
    // 0. Preliminary price estimation based on local supply & demand imbalances
    for (const hub of this.hubs.values()) {
      for (const [goodId, def] of this.goodsDefinitions.entries()) {
        const s = Math.max(0.001, hub.supply.get(goodId) || 0.001);
        const d = Math.max(0.001, hub.demand.get(goodId) || 0.001);
        const p = def.base_price * Math.pow(d / s, def.elasticity_factor);
        hub.prices.set(goodId, Math.max(def.base_price * 0.15, Math.min(def.base_price * 12.0, p)));
      }
    }

    // 1. Inter-hub dynamic trade flow arbitrage across graph edges
    for (const route of this.tradeRoutes) {
      if (route.is_blockaded || route.is_embargoed) {
        route.active_throughput = 0.0;
        continue;
      }

      const source = this.hubs.get(route.sourceHubId);
      const target = this.hubs.get(route.targetHubId);
      if (!source || !target) continue;

      let routeVolume = 0.0;

      // Check price arbitrage for each registered good
      for (const [goodId, def] of this.goodsDefinitions.entries()) {
        const sourcePrice = source.prices.get(goodId) || def.base_price;
        const targetPrice = target.prices.get(goodId) || def.base_price;

        const transportFriction = def.weight_logistics * route.transport_cost_multiplier;
        const profitMargin = targetPrice - (sourcePrice + transportFriction);

        if (profitMargin > 0.01) {
          const exportSurplus = Math.max(0, (source.supply.get(goodId) || 0) - (source.demand.get(goodId) || 0));
          const importDeficit = Math.max(0, (target.demand.get(goodId) || 0) - (target.supply.get(goodId) || 0));

          const tradeableVolume = Math.min(exportSurplus, importDeficit, route.capacity * 0.5);
          if (tradeableVolume > 0.001) {
            // Transfer supply to target hub
            source.supply.set(goodId, (source.supply.get(goodId) || 0) - tradeableVolume);
            target.supply.set(goodId, (target.supply.get(goodId) || 0) + tradeableVolume);
            routeVolume += tradeableVolume;
          }
        }
      }

      route.active_throughput = Math.min(route.capacity, routeVolume);
    }

    // 2. Clear prices inside each Hub based on cleared supply & demand
    for (const hub of this.hubs.values()) {
      for (const [goodId, def] of this.goodsDefinitions.entries()) {
        const supply = Math.max(0.001, hub.supply.get(goodId) || 0.001);
        const demand = Math.max(0.001, hub.demand.get(goodId) || 0.001);

        // Core Mathematical Equation:
        // Price = Base_Price * (Total_Demand / Total_Supply)^Elasticity_Factor
        const ratio = demand / supply;
        const priceMultiplier = Math.pow(ratio, def.elasticity_factor);
        const calculatedPrice = def.base_price * priceMultiplier;

        // Bounded between 0.15x base price (deflationary glut) and 12.0x base price (famine/crisis)
        const clampedPrice = Math.max(def.base_price * 0.15, Math.min(def.base_price * 12.0, calculatedPrice));

        if (Number.isNaN(clampedPrice)) {
          throw new Error(`NaN price calculation for good ${goodId} in hub ${hub.id}!`);
        }

        hub.prices.set(goodId, clampedPrice);
      }
    }
  }

  /**
   * Reset tick supply/demand pools ready for production & consumption aggregation
   */
  public resetTickSupplyDemand(): void {
    for (const hub of this.hubs.values()) {
      for (const goodId of this.goodsDefinitions.keys()) {
        hub.supply.set(goodId, 0.0);
        hub.demand.set(goodId, 0.0);
      }
    }
  }

  public recordSupply(hubId: number, goodId: string, amount: number): void {
    const hub = this.hubs.get(hubId);
    if (hub) {
      hub.supply.set(goodId, (hub.supply.get(goodId) || 0) + Math.max(0, amount));
    }
  }

  public recordDemand(hubId: number, goodId: string, amount: number): void {
    const hub = this.hubs.get(hubId);
    if (hub) {
      hub.demand.set(goodId, (hub.demand.get(goodId) || 0) + Math.max(0, amount));
    }
  }

  public getGoodPrice(hubId: number, goodId: string): number {
    const hub = this.hubs.get(hubId);
    if (!hub) return this.goodsDefinitions.get(goodId)?.base_price || 1.0;
    return hub.prices.get(goodId) || this.goodsDefinitions.get(goodId)?.base_price || 1.0;
  }
}
