/**
 * Intercontinental Trade Integration & Choke-Point Expansion Engine
 * Implements rigid maritime bottlenecks (Hormuz, Bab-el-Mandeb, Kerch, Bosphorus, Gibraltar, Channel)
 * and continental caravan routing (Persian Silk Loop via Anatolia to Europe).
 */

export const ChokepointTier = {
  GLOBAL_MARITIME_GATE: 'GLOBAL_MARITIME_GATE',
  CONTINENTAL_CARAVAN_PASS: 'CONTINENTAL_CARAVAN_PASS',
  REGIONAL_INLAND_STRAIT: 'REGIONAL_INLAND_STRAIT'
} as const;

export type ChokepointTier = typeof ChokepointTier[keyof typeof ChokepointTier];

export interface StrategicChokepoint {
  id: string;
  name: string;
  tier: ChokepointTier;
  controllingTag: string;
  seaZoneId: number;
  flankingNodeA: number;
  flankingNodeB: number;
  isBlockaded: boolean;
  tollTariffRate: number;              // e.g. 0.05 (5%)
  blockadeInterdictionRate: number;    // 0.0 to 1.0 (1.0 = completely severed)
  overlandRerouteCostMultiplier: number; // e.g. 2.5x to 3.5x penalty when severed
}

export interface CaravanRouteSegment {
  segmentId: string;
  originNodeId: number;
  destinationNodeId: number;
  name: string;
  baseTravelDays: number;
  baseTransportCost: number;
  banditryAttritionRisk: number;       // 0.0 to 1.0
  isActive: boolean;
}

export interface IntercontinentalTradePacket {
  packetId: string;
  goodId: string;                      // e.g. 'silk', 'spices', 'porcelain'
  originHubId: number;                 // e.g. 601 (Tabriz)
  destinationHubId: number;            // e.g. 1 (London)
  cargoUnits: number;
  baseUnitValue: number;               // in Ducats
  accumulatedTransitCost: number;
  transitDays: number;
  chokepointsCrossed: string[];
  isDivertedOverland: boolean;
  isIntercepted: boolean;
}

export interface RouteTransitResult {
  packet: IntercontinentalTradePacket;
  pathLocationIds: number[];
  finalDeliveredUnitCost: number;
  marketClearingPrice: number;
  priceSpikeFactor: number;
  success: boolean;
}

export class IntercontinentalTradeEngine {
  private chokepoints: Map<string, StrategicChokepoint> = new Map();
  private caravanSegments: Map<string, CaravanRouteSegment> = new Map();

  constructor() {
    this.initializeStrategicChokepoints();
    this.initializeCaravanCorridors();
  }

  private initializeStrategicChokepoints(): void {
    // 1. Strait of Hormuz (The Persian Gulf Gate)
    this.registerChokepoint({
      id: 'choke_hormuz',
      name: 'Strait of Hormuz',
      tier: ChokepointTier.GLOBAL_MARITIME_GATE,
      controllingTag: 'HOR',
      seaZoneId: 801,
      flankingNodeA: 606, // Hormuz
      flankingNodeB: 603, // Shiraz / Gulf shore
      isBlockaded: false,
      tollTariffRate: 0.08,
      blockadeInterdictionRate: 0.0,
      overlandRerouteCostMultiplier: 2.8
    });

    // 2. Bab-el-Mandeb (The Red Sea Gate)
    this.registerChokepoint({
      id: 'choke_babelmandeb',
      name: 'Bab-el-Mandeb Gate',
      tier: ChokepointTier.GLOBAL_MARITIME_GATE,
      controllingTag: 'ADE',
      seaZoneId: 802,
      flankingNodeA: 614, // Aden
      flankingNodeB: 615, // Massawa
      isBlockaded: false,
      tollTariffRate: 0.06,
      blockadeInterdictionRate: 0.0,
      overlandRerouteCostMultiplier: 3.2
    });

    // 3. Kerch Strait (Azov-Black Sea Choke)
    this.registerChokepoint({
      id: 'choke_kerch',
      name: 'Strait of Kerch',
      tier: ChokepointTier.REGIONAL_INLAND_STRAIT,
      controllingTag: 'GEN',
      seaZoneId: 803,
      flankingNodeA: 501, // Caffa
      flankingNodeB: 503, // Tana / Azov
      isBlockaded: false,
      tollTariffRate: 0.04,
      blockadeInterdictionRate: 0.0,
      overlandRerouteCostMultiplier: 2.2
    });

    // 4. Strait of Bosphorus (Eurasian Hinge)
    this.registerChokepoint({
      id: 'choke_bosphorus',
      name: 'Bosphorus & Dardanelles',
      tier: ChokepointTier.GLOBAL_MARITIME_GATE,
      controllingTag: 'BYZ',
      seaZoneId: 804,
      flankingNodeA: 104, // Constantinople
      flankingNodeB: 102, // Bursa
      isBlockaded: false,
      tollTariffRate: 0.07,
      blockadeInterdictionRate: 0.0,
      overlandRerouteCostMultiplier: 2.5
    });

    // 5. Strait of Gibraltar (Pillars of Hercules)
    this.registerChokepoint({
      id: 'choke_gibraltar',
      name: 'Strait of Gibraltar',
      tier: ChokepointTier.GLOBAL_MARITIME_GATE,
      controllingTag: 'CAS',
      seaZoneId: 805,
      flankingNodeA: 34,  // Gibraltar
      flankingNodeB: 715, // Ceuta
      isBlockaded: false,
      tollTariffRate: 0.05,
      blockadeInterdictionRate: 0.0,
      overlandRerouteCostMultiplier: 3.0
    });

    // 6. English Channel / Dover Straits
    this.registerChokepoint({
      id: 'choke_channel',
      name: 'Dover Strait Corridor',
      tier: ChokepointTier.REGIONAL_INLAND_STRAIT,
      controllingTag: 'ENG',
      seaZoneId: 806,
      flankingNodeA: 31, // Dover
      flankingNodeB: 32, // Calais
      isBlockaded: false,
      tollTariffRate: 0.03,
      blockadeInterdictionRate: 0.0,
      overlandRerouteCostMultiplier: 2.0
    });
  }

  private initializeCaravanCorridors(): void {
    // Tabriz -> Sivas -> Ankara -> Bursa -> Constantinople (Anatolian Continental Loop)
    this.registerCaravanSegment({
      segmentId: 'seg_tabriz_sivas',
      originNodeId: 601, // Tabriz
      destinationNodeId: 108, // Sivas
      name: 'Armenian Highland Caravan Path',
      baseTravelDays: 18,
      baseTransportCost: 25.0,
      banditryAttritionRisk: 0.08,
      isActive: true
    });

    this.registerCaravanSegment({
      segmentId: 'seg_sivas_ankara',
      originNodeId: 108, // Sivas
      destinationNodeId: 107, // Ankara
      name: 'Central Anatolian Plateau Track',
      baseTravelDays: 10,
      baseTransportCost: 15.0,
      banditryAttritionRisk: 0.04,
      isActive: true
    });

    this.registerCaravanSegment({
      segmentId: 'seg_ankara_bursa',
      originNodeId: 107, // Ankara
      destinationNodeId: 102, // Bursa
      name: 'Bithynian Silk Road Terminus',
      baseTravelDays: 8,
      baseTransportCost: 12.0,
      banditryAttritionRisk: 0.02,
      isActive: true
    });

    this.registerCaravanSegment({
      segmentId: 'seg_bursa_constantinople',
      originNodeId: 102, // Bursa
      destinationNodeId: 104, // Constantinople
      name: 'Propontis Crossing & Golden Horn Terminal',
      baseTravelDays: 4,
      baseTransportCost: 8.0,
      banditryAttritionRisk: 0.01,
      isActive: true
    });
  }

  public registerChokepoint(chokepoint: StrategicChokepoint): void {
    this.chokepoints.set(chokepoint.id, chokepoint);
  }

  public getChokepoint(id: string): StrategicChokepoint | undefined {
    return this.chokepoints.get(id);
  }

  public getAllChokepoints(): StrategicChokepoint[] {
    return Array.from(this.chokepoints.values());
  }

  public setBlockadeState(
    chokepointId: string,
    isBlockaded: boolean,
    interdictionRate: number,
    controllingTag?: string
  ): boolean {
    const cp = this.chokepoints.get(chokepointId);
    if (!cp) return false;
    cp.isBlockaded = isBlockaded;
    cp.blockadeInterdictionRate = Math.max(0.0, Math.min(1.0, interdictionRate));
    if (controllingTag) cp.controllingTag = controllingTag;
    return true;
  }

  public registerCaravanSegment(segment: CaravanRouteSegment): void {
    this.caravanSegments.set(segment.segmentId, segment);
  }

  public getCaravanSegment(segmentId: string): CaravanRouteSegment | undefined {
    return this.caravanSegments.get(segmentId);
  }

  /**
   * Routes Persian Silk overland across the Anatolian corridor:
   * Tabriz (601) -> Sivas (108) -> Ankara (107) -> Bursa (102) -> Constantinople (104)
   */
  public routeContinentalSilkCaravan(
    cargoUnits: number,
    baseUnitValue: number = 16.0
  ): RouteTransitResult {
    const packet: IntercontinentalTradePacket = {
      packetId: `silk_caravan_${Date.now()}`,
      goodId: 'silk',
      originHubId: 601, // Tabriz
      destinationHubId: 104, // Constantinople
      cargoUnits,
      baseUnitValue,
      accumulatedTransitCost: 0,
      transitDays: 0,
      chokepointsCrossed: [],
      isDivertedOverland: true,
      isIntercepted: false
    };

    const pathNodes = [601, 108, 107, 102, 104];
    const segmentKeys = [
      'seg_tabriz_sivas',
      'seg_sivas_ankara',
      'seg_ankara_bursa',
      'seg_bursa_constantinople'
    ];

    for (const segKey of segmentKeys) {
      const seg = this.caravanSegments.get(segKey);
      if (seg && seg.isActive) {
        packet.transitDays += seg.baseTravelDays;
        const segmentCost = seg.baseTransportCost * (1.0 + seg.banditryAttritionRisk);
        packet.accumulatedTransitCost += segmentCost;
      }
    }

    const bosphorus = this.chokepoints.get('choke_bosphorus');
    if (bosphorus) {
      packet.chokepointsCrossed.push(bosphorus.id);
      if (bosphorus.isBlockaded) {
        packet.accumulatedTransitCost *= bosphorus.overlandRerouteCostMultiplier;
      } else {
        packet.accumulatedTransitCost += packet.cargoUnits * packet.baseUnitValue * bosphorus.tollTariffRate;
      }
    }

    const totalDeliveredValue = (packet.cargoUnits * packet.baseUnitValue) + packet.accumulatedTransitCost;
    const finalDeliveredUnitCost = totalDeliveredValue / packet.cargoUnits;
    const priceSpikeFactor = finalDeliveredUnitCost / packet.baseUnitValue;
    const marketClearingPrice = finalDeliveredUnitCost * 1.25; // 25% terminal margin

    return {
      packet,
      pathLocationIds: pathNodes,
      finalDeliveredUnitCost,
      marketClearingPrice,
      priceSpikeFactor,
      success: true
    };
  }

  /**
   * Routes an intercontinental trade packet all the way from Tabriz (601) to London (1):
   * Tabriz -> Constantinople -> Mediterranean Sea -> Gibraltar -> Dover/Channel -> London
   */
  public routeIntercontinentalTabrizToLondon(
    cargoUnits: number,
    baseUnitValue: number = 18.0,
    options?: { forceOverlandEurope?: boolean }
  ): RouteTransitResult {
    const packet: IntercontinentalTradePacket = {
      packetId: `global_pkg_${Date.now()}`,
      goodId: 'silk',
      originHubId: 601, // Tabriz
      destinationHubId: 1, // London
      cargoUnits,
      baseUnitValue,
      accumulatedTransitCost: 0,
      transitDays: 0,
      chokepointsCrossed: [],
      isDivertedOverland: false,
      isIntercepted: false
    };

    // Phase 1: Tabriz to Constantinople overland pass
    const caravanLeg = this.routeContinentalSilkCaravan(cargoUnits, baseUnitValue);
    packet.transitDays += caravanLeg.packet.transitDays;
    packet.accumulatedTransitCost += caravanLeg.packet.accumulatedTransitCost;
    packet.chokepointsCrossed.push(...caravanLeg.packet.chokepointsCrossed);

    const fullPath: number[] = [...caravanLeg.pathLocationIds];

    // Phase 2: Mediterranean maritime voyage from Constantinople (104) to Gibraltar (34)
    // Path: Constantinople (104) -> Venice/Genoa basin (20/22) -> Gibraltar (34)
    packet.transitDays += 24; // Average sailing days in 14th century
    packet.accumulatedTransitCost += 35.0; // Base maritime freight

    fullPath.push(20, 34);

    // Evaluate Gibraltar bottleneck
    const gibraltar = this.chokepoints.get('choke_gibraltar');
    if (gibraltar) {
      packet.chokepointsCrossed.push(gibraltar.id);
      if (gibraltar.isBlockaded && gibraltar.blockadeInterdictionRate >= 0.8) {
        packet.isDivertedOverland = true;
        // Overland detour through France/Iberia adds 45 days and 3x transport cost
        packet.transitDays += 45;
        packet.accumulatedTransitCost *= gibraltar.overlandRerouteCostMultiplier;
      } else {
        const toll = packet.cargoUnits * packet.baseUnitValue * gibraltar.tollTariffRate;
        packet.accumulatedTransitCost += toll;
        packet.accumulatedTransitCost *= (1.0 + gibraltar.blockadeInterdictionRate * 1.2);
      }
    }

    // Phase 3: Atlantic Coast & Channel into London
    // Path: Gibraltar (34) -> Calais (32) -> Dover (31) -> London (1)
    packet.transitDays += 14;
    packet.accumulatedTransitCost += 22.0;

    fullPath.push(32, 31, 1);

    const channel = this.chokepoints.get('choke_channel');
    if (channel) {
      packet.chokepointsCrossed.push(channel.id);
      if (channel.isBlockaded) {
        packet.accumulatedTransitCost *= channel.overlandRerouteCostMultiplier;
        packet.transitDays += 10;
      } else {
        packet.accumulatedTransitCost += packet.cargoUnits * packet.baseUnitValue * channel.tollTariffRate;
      }
    }

    const totalDeliveredValue = (packet.cargoUnits * packet.baseUnitValue) + packet.accumulatedTransitCost;
    const finalDeliveredUnitCost = totalDeliveredValue / packet.cargoUnits;
    const priceSpikeFactor = finalDeliveredUnitCost / packet.baseUnitValue;
    const marketClearingPrice = finalDeliveredUnitCost * 1.30; // 30% metropolitan clearing markup in London

    return {
      packet,
      pathLocationIds: fullPath,
      finalDeliveredUnitCost,
      marketClearingPrice,
      priceSpikeFactor,
      success: true
    };
  }

  /**
   * Routes goods from the Indian Ocean / Persian Gulf through the Red Sea axis:
   * Hormuz (606) -> Aden (614) -> Jeddah (612) -> Suez (707) -> Alexandria (701)
   */
  public routeRedSeaSpicesToAlexandria(
    cargoUnits: number,
    baseUnitValue: number = 22.0
  ): RouteTransitResult {
    const packet: IntercontinentalTradePacket = {
      packetId: `spice_route_${Date.now()}`,
      goodId: 'spices',
      originHubId: 606, // Hormuz
      destinationHubId: 701, // Alexandria
      cargoUnits,
      baseUnitValue,
      accumulatedTransitCost: 40.0,
      transitDays: 28,
      chokepointsCrossed: [],
      isDivertedOverland: false,
      isIntercepted: false
    };

    const pathNodes = [606, 614, 612, 707, 701];

    // 1. Hormuz
    const hormuz = this.chokepoints.get('choke_hormuz');
    if (hormuz) {
      packet.chokepointsCrossed.push(hormuz.id);
      if (hormuz.isBlockaded) {
        packet.accumulatedTransitCost *= hormuz.overlandRerouteCostMultiplier;
      } else {
        packet.accumulatedTransitCost += packet.cargoUnits * packet.baseUnitValue * hormuz.tollTariffRate;
      }
    }

    // 2. Bab-el-Mandeb
    const bab = this.chokepoints.get('choke_babelmandeb');
    if (bab) {
      packet.chokepointsCrossed.push(bab.id);
      if (bab.isBlockaded) {
        packet.accumulatedTransitCost *= bab.overlandRerouteCostMultiplier;
        packet.isDivertedOverland = true;
      } else {
        packet.accumulatedTransitCost += packet.cargoUnits * packet.baseUnitValue * bab.tollTariffRate;
      }
    }

    const totalDeliveredValue = (packet.cargoUnits * packet.baseUnitValue) + packet.accumulatedTransitCost;
    const finalDeliveredUnitCost = totalDeliveredValue / packet.cargoUnits;
    const priceSpikeFactor = finalDeliveredUnitCost / packet.baseUnitValue;
    const marketClearingPrice = finalDeliveredUnitCost * 1.28;

    return {
      packet,
      pathLocationIds: pathNodes,
      finalDeliveredUnitCost,
      marketClearingPrice,
      priceSpikeFactor,
      success: true
    };
  }
}
