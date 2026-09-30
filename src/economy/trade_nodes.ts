/**
 * Silk Road Supply Terminals & Mediterranean Maritime Flow Engine
 * Handles dynamic macro-injection of luxury goods (silk, spices, porcelain)
 * into the directed trade graph, computes war disruption decay, and reroutes
 * shipping corridors upon maritime interception or blockade.
 */

export interface LuxuryGoodInjection {
  goodId: 'silk' | 'spices' | 'porcelain';
  baseVolume: number;
  basePrice: number;
}

export interface SilkRoadTerminalNode {
  locationId: number;
  name: string;
  countryTag: string;
  luxuryGoods: LuxuryGoodInjection[];
  currentDevastation: number;
  isTerminalActive: boolean;
}

export interface DynamicPortShippingCorridor {
  corridorId: string;
  name: string;
  pathNodes: number[]; // e.g. [20, 104, 102] (Venice -> Constantinople -> Bursa)
  overlandBackupNodes: number[]; // e.g. [102, 104, 110, 30, 20] (Bursa -> Constantinople -> Adrianople -> Buda -> Venice)
  baseTransportCostFactor: number;
  activeTransportCostFactor: number;
  isInterceptedOrBlockaded: boolean;
  transitEfficiency: number; // 0.0 to 1.0
}

export interface TradeThroughputResult {
  terminalId: number;
  terminalName: string;
  goodId: string;
  baseVolume: number;
  devastationPenalty: number;
  warDecayFactor: number;
  effectiveThroughput: number;
  priceSpikeMultiplier: number;
}

export class SilkRoadTradeEngine {
  private terminals: Map<number, SilkRoadTerminalNode> = new Map();
  private shippingCorridors: Map<string, DynamicPortShippingCorridor> = new Map();
  private downstreamMarketPrices: Map<string, Map<string, number>> = new Map(); // market -> (goodId -> price)

  constructor() {
    this.initializeDefaultTerminals();
    this.initializeDefaultCorridors();
  }

  private initializeDefaultTerminals(): void {
    // 1. Bursa Terminal (Ottoman Silk Hub - ID 102)
    this.registerTerminal({
      locationId: 102,
      name: 'Bursa',
      countryTag: 'TUR',
      luxuryGoods: [
        { goodId: 'silk', baseVolume: 120.0, basePrice: 15.0 },
        { goodId: 'spices', baseVolume: 80.0, basePrice: 20.0 },
        { goodId: 'porcelain', baseVolume: 40.0, basePrice: 35.0 }
      ],
      currentDevastation: 0.0,
      isTerminalActive: true
    });

    // 2. Aleppo Terminal (Levant Silk Road Vertex - ID 105)
    this.registerTerminal({
      locationId: 105,
      name: 'Aleppo',
      countryTag: 'MAM',
      luxuryGoods: [
        { goodId: 'silk', baseVolume: 100.0, basePrice: 14.0 },
        { goodId: 'spices', baseVolume: 150.0, basePrice: 18.0 },
        { goodId: 'porcelain', baseVolume: 50.0, basePrice: 32.0 }
      ],
      currentDevastation: 0.0,
      isTerminalActive: true
    });
  }

  private initializeDefaultCorridors(): void {
    // Maritime shipping lane: Venice -> Constantinople -> Bursa
    this.registerShippingCorridor({
      corridorId: 'venice_constantinople_bursa_sea',
      name: 'Venice-Levant Maritime Route',
      pathNodes: [20, 104, 102],
      overlandBackupNodes: [102, 104, 110, 30, 20],
      baseTransportCostFactor: 1.0,
      activeTransportCostFactor: 1.0,
      isInterceptedOrBlockaded: false,
      transitEfficiency: 1.0
    });
  }

  public registerTerminal(terminal: SilkRoadTerminalNode): void {
    this.terminals.set(terminal.locationId, terminal);
  }

  public getTerminal(locationId: number): SilkRoadTerminalNode | undefined {
    return this.terminals.get(locationId);
  }

  public registerShippingCorridor(corridor: DynamicPortShippingCorridor): void {
    this.shippingCorridors.set(corridor.corridorId, corridor);
  }

  public getShippingCorridor(corridorId: string): DynamicPortShippingCorridor | undefined {
    return this.shippingCorridors.get(corridorId);
  }

  /**
   * Calculates dynamic throughput for Silk Road Terminals (Bursa & Aleppo)
   * Formula: Silk_Road_Throughput = Base_Volume * (1.0 - Near_East_Devastation_Average)
   * War condition: If Ottoman (OTT/TUR) or Mamluk (MAM) tags are at war, apply 50% decay factor.
   */
  public calculateTerminalThroughput(
    terminalLocationId: number,
    nearEastDevastationAverage: number,
    isAtWar: boolean
  ): TradeThroughputResult[] {
    const terminal = this.terminals.get(terminalLocationId);
    if (!terminal || !terminal.isTerminalActive) {
      return [];
    }

    const clampedDevastation = Math.max(0.0, Math.min(1.0, nearEastDevastationAverage));
    const devastationFactor = 1.0 - clampedDevastation;
    const warDecayFactor = isAtWar ? 0.50 : 1.0;

    const results: TradeThroughputResult[] = [];

    for (const luxury of terminal.luxuryGoods) {
      const throughput = luxury.baseVolume * devastationFactor * warDecayFactor;
      // Price increases inversely with available volume
      const supplyRatio = Math.max(0.05, throughput / luxury.baseVolume);
      const priceSpikeMultiplier = 1.0 / supplyRatio;

      results.push({
        terminalId: terminal.locationId,
        terminalName: terminal.name,
        goodId: luxury.goodId,
        baseVolume: luxury.baseVolume,
        devastationPenalty: clampedDevastation,
        warDecayFactor,
        effectiveThroughput: Number(throughput.toFixed(2)),
        priceSpikeMultiplier: Number(priceSpikeMultiplier.toFixed(2))
      });
    }

    return results;
  }

  /**
   * Updates maritime shipping lines.
   * If naval interception occurs or blockade is active, instantly scales transport cost by 10x,
   * forcing rerouting via overland backup corridor through Adrianople and Buda.
   */
  public updateShippingCorridorState(
    corridorId: string,
    isInterceptedOrBlockaded: boolean
  ): {
    corridor: DynamicPortShippingCorridor;
    activeRoute: number[];
    isOverlandDetour: boolean;
    costMultiplier: number;
  } {
    const corridor = this.shippingCorridors.get(corridorId);
    if (!corridor) {
      throw new Error(`Shipping corridor ${corridorId} not found`);
    }

    corridor.isInterceptedOrBlockaded = isInterceptedOrBlockaded;

    if (isInterceptedOrBlockaded) {
      // 10x transport cost spike as naval passage is interdicted
      corridor.activeTransportCostFactor = corridor.baseTransportCostFactor * 10.0;
      corridor.transitEfficiency = 0.35; // Overland pack-mule inefficiency
      return {
        corridor,
        activeRoute: corridor.overlandBackupNodes,
        isOverlandDetour: true,
        costMultiplier: corridor.activeTransportCostFactor
      };
    } else {
      corridor.activeTransportCostFactor = corridor.baseTransportCostFactor;
      corridor.transitEfficiency = 1.0;
      return {
        corridor,
        activeRoute: corridor.pathNodes,
        isOverlandDetour: false,
        costMultiplier: 1.0
      };
    }
  }

  /**
   * Computes downstream European luxury prices (Venice, Paris, London)
   * factoring terminal throughput volume and corridor transport cost factor.
   */
  public evaluateDownstreamMarketPrices(
    marketTag: 'VENICE' | 'PARIS' | 'LONDON',
    throughputResults: TradeThroughputResult[],
    transportCostMultiplier: number
  ): Map<string, number> {
    const prices = new Map<string, number>();

    for (const item of throughputResults) {
      let baseMarketMarkup = 1.2;
      if (marketTag === 'PARIS') baseMarketMarkup = 1.45;
      if (marketTag === 'LONDON') baseMarketMarkup = 1.70;

      // Price = base * priceSpikeMultiplier * (transportCostMultiplier ^ 0.5) * marketDistanceMarkup
      const finalPrice = 15.0 * item.priceSpikeMultiplier * Math.sqrt(transportCostMultiplier) * baseMarketMarkup;
      prices.set(item.goodId, Number(finalPrice.toFixed(2)));
    }

    this.downstreamMarketPrices.set(marketTag, prices);
    return prices;
  }
}
