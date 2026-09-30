/**
 * GIS Geography & Topography Projection Pipeline
 * Handles accurate geographical projection of historical coordinates,
 * physical coastline polygons, river trajectories, and terrain mesh binding.
 */

export interface GeoCoordinate {
  longitude: number; // e.g. -0.1276 for London, 28.9784 for Constantinople
  latitude: number;  // e.g. 51.5074 for London, 41.0082 for Constantinople
}

export interface PhysicalTerrainAttributes {
  elevationMeters: number;
  elevationNormalized: number; // 0.0 to 1.0
  riverProximity: boolean;
  adjacentRiverName: string | null;
  isCoastal: boolean;
  biome: 'Farmland' | 'Hills' | 'Coast' | 'Marsh' | 'Mountains';
  coastlineVertices: [number, number][]; // Screen space boundary points
}

export interface HistoricalNodeGISData {
  locationId: number;
  name: string;
  countryTag: string;
  geoCoord: GeoCoordinate;
  screenPos: [number, number];
  terrain: PhysicalTerrainAttributes;
}

export class GISProjectionPipeline {
  // Bounding box for pan-European & Near-East theater
  public readonly minLon = -11.0; // Atlantic / Western Ireland & Iberia
  public readonly maxLon = 42.0;  // Eastern Anatolia & Caucasus / Black Sea
  public readonly minLat = 34.0;  // Mediterranean Basin / North Africa / Cyprus
  public readonly maxLat = 58.0;  // Scotland / Baltic Sea

  public readonly canvasWidth = 1600.0;
  public readonly canvasHeight = 900.0;

  private registeredNodes: Map<number, HistoricalNodeGISData> = new Map();

  constructor() {
    this.initializeHistoricalNodes();
  }

  /**
   * Equirectangular / Standard Grand Strategy GIS Projection Matrix
   * Maps Latitude/Longitude directly to active high-resolution viewport pixels.
   */
  public project(coord: GeoCoordinate): [number, number] {
    const clampedLon = Math.max(this.minLon, Math.min(this.maxLon, coord.longitude));
    const clampedLat = Math.max(this.minLat, Math.min(this.maxLat, coord.latitude));

    const u = (clampedLon - this.minLon) / (this.maxLon - this.minLon);
    // Invert latitude: north (56°) maps to top of canvas (0 px)
    const v = (this.maxLat - clampedLat) / (this.maxLat - this.minLat);

    const x = Number((u * this.canvasWidth).toFixed(1));
    const y = Number((v * this.canvasHeight).toFixed(1));
    return [x, y];
  }

  /**
   * Inverse projection from screen pixel coordinates back to real-world GIS coordinates.
   */
  public unproject(screenX: number, screenY: number): GeoCoordinate {
    const u = screenX / this.canvasWidth;
    const v = screenY / this.canvasHeight;

    const lon = this.minLon + u * (this.maxLon - this.minLon);
    const lat = this.maxLat - v * (this.maxLat - this.minLat);
    return {
      longitude: Number(lon.toFixed(4)),
      latitude: Number(lat.toFixed(4))
    };
  }

  private initializeHistoricalNodes(): void {
    // 1. London (UK)
    this.registerNode(1, 'London', 'ENG', { longitude: -0.1276, latitude: 51.5074 }, {
      elevationMeters: 35.0,
      elevationNormalized: 0.12,
      riverProximity: true,
      adjacentRiverName: 'River Thames',
      isCoastal: false,
      biome: 'Farmland',
      coastlineVertices: [[210, 205], [230, 205], [225, 215]]
    });

    // 2. Dover (UK Port)
    this.registerNode(2, 'Dover', 'ENG', { longitude: 1.3134, latitude: 51.1279 }, {
      elevationMeters: 20.0,
      elevationNormalized: 0.08,
      riverProximity: false,
      adjacentRiverName: null,
      isCoastal: true,
      biome: 'Coast',
      coastlineVertices: [[295, 235], [305, 240], [300, 245]]
    });

    // 3. Calais (Continental Enclave)
    this.registerNode(3, 'Calais', 'ENG', { longitude: 1.8587, latitude: 50.9513 }, {
      elevationMeters: 10.0,
      elevationNormalized: 0.04,
      riverProximity: false,
      adjacentRiverName: null,
      isCoastal: true,
      biome: 'Marsh',
      coastlineVertices: [[345, 260], [355, 265], [350, 270]]
    });

    // 4. Rouen (Foundry Basin)
    this.registerNode(4, 'Rouen', 'FRA', { longitude: 1.0993, latitude: 49.4432 }, {
      elevationMeters: 45.0,
      elevationNormalized: 0.15,
      riverProximity: true,
      adjacentRiverName: 'River Seine',
      isCoastal: false,
      biome: 'Farmland',
      coastlineVertices: []
    });

    // 5. Paris (France Capital)
    this.registerNode(5, 'Paris', 'FRA', { longitude: 2.3522, latitude: 48.8566 }, {
      elevationMeters: 65.0,
      elevationNormalized: 0.18,
      riverProximity: true,
      adjacentRiverName: 'River Seine',
      isCoastal: false,
      biome: 'Farmland',
      coastlineVertices: []
    });

    // 6. Venice (Italian Maritime Republic)
    this.registerNode(20, 'Venice', 'VEN', { longitude: 12.3155, latitude: 45.4408 }, {
      elevationMeters: 2.0,
      elevationNormalized: 0.02,
      riverProximity: true,
      adjacentRiverName: 'Po River Delta / Venetian Lagoon',
      isCoastal: true,
      biome: 'Coast',
      coastlineVertices: [[735, 415], [745, 420], [740, 425]]
    });

    // 7. Rome (Holy See)
    this.registerNode(23, 'Rome', 'PAP', { longitude: 12.4964, latitude: 41.9028 }, {
      elevationMeters: 40.0,
      elevationNormalized: 0.14,
      riverProximity: true,
      adjacentRiverName: 'Tiber River',
      isCoastal: false,
      biome: 'Farmland',
      coastlineVertices: []
    });

    // 8. Adrianople (Edirne / Balkan Hub)
    this.registerNode(110, 'Adrianople', 'TUR', { longitude: 26.5557, latitude: 41.6772 }, {
      elevationMeters: 80.0,
      elevationNormalized: 0.22,
      riverProximity: true,
      adjacentRiverName: 'Maritsa (Meriç) River',
      isCoastal: false,
      biome: 'Farmland',
      coastlineVertices: []
    });

    // 9. Constantinople (Byzantine Choke-point)
    this.registerNode(104, 'Constantinople', 'BYZ', { longitude: 28.9784, latitude: 41.0082 }, {
      elevationMeters: 55.0,
      elevationNormalized: 0.19,
      riverProximity: false,
      adjacentRiverName: 'Golden Horn / Bosphorus',
      isCoastal: true,
      biome: 'Farmland',
      coastlineVertices: [[1235, 455], [1245, 460], [1240, 465]]
    });

    // 10. Bursa (Ottoman Capital Hub)
    this.registerNode(102, 'Bursa', 'TUR', { longitude: 29.0610, latitude: 40.1885 }, {
      elevationMeters: 240.0,
      elevationNormalized: 0.42,
      riverProximity: true,
      adjacentRiverName: 'Nilüfer River (Uludağ Foothills)',
      isCoastal: true,
      biome: 'Hills',
      coastlineVertices: [[1315, 505], [1325, 510], [1320, 515]]
    });

    // 11. Söğüt (Ottoman Cradle)
    this.registerNode(101, 'Söğüt', 'TUR', { longitude: 30.1819, latitude: 40.0189 }, {
      elevationMeters: 665.0,
      elevationNormalized: 0.62,
      riverProximity: false,
      adjacentRiverName: 'Sakarya River Basin',
      isCoastal: false,
      biome: 'Hills',
      coastlineVertices: []
    });
  }

  public registerNode(
    id: number,
    name: string,
    countryTag: string,
    geoCoord: GeoCoordinate,
    terrain: PhysicalTerrainAttributes
  ): void {
    const screenPos = this.project(geoCoord);
    this.registeredNodes.set(id, {
      locationId: id,
      name,
      countryTag,
      geoCoord,
      screenPos,
      terrain
    });
  }

  public getNode(id: number): HistoricalNodeGISData | undefined {
    return this.registeredNodes.get(id);
  }

  public getAllNodes(): HistoricalNodeGISData[] {
    return Array.from(this.registeredNodes.values());
  }
}
