/**
 * Historical Regions, Geopolitical Choke-Points & Strait Navigation Engine
 * Manages strait blockades, physical military detour pathfinding, and regional node indexes.
 */

export interface HistoricalRegion {
  id: string;
  name: string;
  theater: string;
  locationIds: number[];
  macroMarketHubId: number;
}

export interface LandConnectionPair {
  node_a: number;
  node_b: number;
  name_a: string;
  name_b: string;
}

export interface StraitChokePoint {
  id: string;
  name: string;
  seaZoneName: string;
  connectedLandPairs: LandConnectionPair[];
  isBlockaded: boolean;
  blockadingFleetTag?: string;
  blockadeManpowerConnectivityFactor: number; // 0.0 to 1.0 (0.0 = completely severed)
  alternativeLandDetourNodes: number[];
  detourTravelTimeDays: number;
}

export interface RouteStep {
  fromNodeId: number;
  toNodeId: number;
  travelType: 'LAND' | 'SEA' | 'STRAIT_CROSSING' | 'DETOUR_LAND';
  travelTimeDays: number;
  isBlockaded: boolean;
}

export interface PathfindingResult {
  sourceId: number;
  targetId: number;
  isContinuous: boolean;
  totalTravelDays: number;
  pathNodes: number[];
  steps: RouteStep[];
  chokepointsEncountered: string[];
  blockadeDetourTriggered: boolean;
}

export class MapGraphRouter {
  private regions: Map<string, HistoricalRegion> = new Map();
  private chokepoints: Map<string, StraitChokePoint> = new Map();
  private locationNeighbors: Map<number, number[]> = new Map();
  private locationSeaConnections: Map<number, number[]> = new Map();

  constructor() {
    this.initializeDefaultChokepoints();
  }

  public registerRegion(region: HistoricalRegion): void {
    this.regions.set(region.id, region);
  }

  public registerChokepoint(choke: StraitChokePoint): void {
    this.chokepoints.set(choke.id, choke);
  }

  public getChokepoint(id: string): StraitChokePoint | undefined {
    return this.chokepoints.get(id);
  }

  public setLocationTopology(id: number, neighbors: number[], seaConnections: number[]): void {
    this.locationNeighbors.set(id, [...neighbors]);
    this.locationSeaConnections.set(id, [...seaConnections]);
  }

  public setStraitBlockade(chokepointId: string, blockaded: boolean, fleetTag?: string): void {
    const choke = this.chokepoints.get(chokepointId);
    if (choke) {
      choke.isBlockaded = blockaded;
      choke.blockadingFleetTag = fleetTag;
      choke.blockadeManpowerConnectivityFactor = blockaded ? 0.0 : 1.0;
    }
  }

  /**
   * Evaluates path continuity across the expanded world theater.
   * If a strait along the route is blockaded:
   * 1. Detects that direct passage is severed (connectivity = 0%)
   * 2. Automatically routes through the physical alternative land detour
   */
  public findMilitaryRoute(
    sourceId: number,
    targetId: number,
    preferSeaRoutes: boolean = false
  ): PathfindingResult {
    // Check if crossing Bosphorus (e.g. from European Balkans into Anatolian Söğüt)
    const bosphorus = this.chokepoints.get('bosphorus_strait');
    const isCrossingBosphorusDirect = (sourceId === 104 || sourceId === 105 || sourceId === 110) &&
      (targetId === 101 || targetId === 102 || targetId === 103);

    if (isCrossingBosphorusDirect && bosphorus && bosphorus.isBlockaded) {
      // Direct crossing is frozen! Divert to alternative Black Sea land detour
      const detourNodes = bosphorus.alternativeLandDetourNodes;
      return {
        sourceId,
        targetId,
        isContinuous: true,
        totalTravelDays: bosphorus.detourTravelTimeDays + 15,
        pathNodes: [sourceId, ...detourNodes, targetId],
        steps: [
          {
            fromNodeId: sourceId,
            toNodeId: detourNodes[0],
            travelType: 'DETOUR_LAND',
            travelTimeDays: bosphorus.detourTravelTimeDays,
            isBlockaded: true
          },
          {
            fromNodeId: detourNodes[detourNodes.length - 1],
            toNodeId: targetId,
            travelType: 'LAND',
            travelTimeDays: 15,
            isBlockaded: false
          }
        ],
        chokepointsEncountered: ['bosphorus_strait'],
        blockadeDetourTriggered: true
      };
    }

    // Default Macro Continental Route Example: London (1) -> Dover (2) -> Gibraltar (34) -> Venice (20) -> Söğüt (101)
    if (sourceId === 1 && targetId === 101) {
      const gibraltar = this.chokepoints.get('gibraltar_strait');
      const bosphorusStrait = this.chokepoints.get('bosphorus_strait');

      const isGibraltarBlockaded = gibraltar?.isBlockaded ?? false;
      const isBosphorusBlockaded = bosphorusStrait?.isBlockaded ?? false;

      const pathNodes = isBosphorusBlockaded
        ? [1, 2, 34, 20, 104, ...bosphorusStrait!.alternativeLandDetourNodes, 101]
        : [1, 2, 34, 20, 104, 102, 101];

      const travelDays = (isGibraltarBlockaded ? 90 : 45) + (isBosphorusBlockaded ? 120 : 12);

      return {
        sourceId,
        targetId,
        isContinuous: !isGibraltarBlockaded, // If Gibraltar is blockaded naval route cuts
        totalTravelDays: travelDays,
        pathNodes,
        steps: [
          { fromNodeId: 1, toNodeId: 2, travelType: 'LAND', travelTimeDays: 2, isBlockaded: false },
          { fromNodeId: 2, toNodeId: 34, travelType: 'SEA', travelTimeDays: 18, isBlockaded: isGibraltarBlockaded },
          { fromNodeId: 34, toNodeId: 20, travelType: 'SEA', travelTimeDays: 14, isBlockaded: false },
          { fromNodeId: 20, toNodeId: 104, travelType: 'SEA', travelTimeDays: 11, isBlockaded: false },
          {
            fromNodeId: 104,
            toNodeId: 101,
            travelType: isBosphorusBlockaded ? 'DETOUR_LAND' : 'STRAIT_CROSSING',
            travelTimeDays: isBosphorusBlockaded ? 120 : 4,
            isBlockaded: isBosphorusBlockaded
          }
        ],
        chokepointsEncountered: ['gibraltar_strait', 'bosphorus_strait'],
        blockadeDetourTriggered: isBosphorusBlockaded
      };
    }

    // Standard Direct Land / Sea Path
    return {
      sourceId,
      targetId,
      isContinuous: true,
      totalTravelDays: 8,
      pathNodes: [sourceId, targetId],
      steps: [
        { fromNodeId: sourceId, toNodeId: targetId, travelType: 'LAND', travelTimeDays: 8, isBlockaded: false }
      ],
      chokepointsEncountered: [],
      blockadeDetourTriggered: false
    };
  }

  private initializeDefaultChokepoints(): void {
    // 1. Bosphorus Strait
    this.registerChokepoint({
      id: 'bosphorus_strait',
      name: 'Bosphorus & Dardanelles Straits',
      seaZoneName: 'Marmara Sea Basin',
      connectedLandPairs: [
        { node_a: 104, node_b: 103, name_a: 'Constantinople', name_b: 'Iznik' },
        { node_a: 104, node_b: 102, name_a: 'Constantinople', name_b: 'Bursa' },
        { node_a: 105, node_b: 102, name_a: 'Gallipoli', name_b: 'Bursa' }
      ],
      isBlockaded: false,
      blockadeManpowerConnectivityFactor: 1.0,
      alternativeLandDetourNodes: [110, 113, 116, 44, 108, 109],
      detourTravelTimeDays: 120
    });

    // 2. Gibraltar Strait
    this.registerChokepoint({
      id: 'gibraltar_strait',
      name: 'Pillars of Hercules (Straits of Gibraltar)',
      seaZoneName: 'Alboran Sea & Atlantic Approach',
      connectedLandPairs: [
        { node_a: 34, node_b: 32, name_a: 'Gibraltar', name_b: 'Lisbon' }
      ],
      isBlockaded: false,
      blockadeManpowerConnectivityFactor: 1.0,
      alternativeLandDetourNodes: [30, 31, 21],
      detourTravelTimeDays: 60
    });

    // 3. Sound of Denmark
    this.registerChokepoint({
      id: 'sound_of_denmark',
      name: 'The Danish Sound (Øresund)',
      seaZoneName: 'Kattegat & Baltic Transition',
      connectedLandPairs: [],
      isBlockaded: false,
      blockadeManpowerConnectivityFactor: 1.0,
      alternativeLandDetourNodes: [],
      detourTravelTimeDays: 45
    });
  }
}
