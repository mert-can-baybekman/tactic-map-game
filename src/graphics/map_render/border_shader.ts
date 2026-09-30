/**
 * Micro-Province Dynamic Boundary Shader & Tessellation Engine
 * High-performance runtime tessellation and O(1) sovereign border re-rendering
 */

export interface MicroProvincePolygon {
  provinceId: number;
  name: string;
  sovereignTag: string;
  controllerTag: string;
  colorRgba: [number, number, number, number]; // [R, G, B, A]
  vertices: [number, number][]; // Projected Screen Coordinates or Geo [lon, lat]
  centroid: [number, number];
  neighbors: number[]; // Neighboring province IDs
  isWasteland: boolean;
}

export interface BorderEdgeSegment {
  edgeKey: string;
  provA: number;
  provB: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isInternational: boolean;
}

export class DynamicBorderPipeline {
  private provinces: Map<number, MicroProvincePolygon> = new Map();
  private edgeSegments: Map<string, BorderEdgeSegment> = new Map();
  private tagColors: Map<string, [number, number, number, number]> = new Map([
    ['ENG', [220, 38, 38, 0.22]],
    ['FRA', [37, 99, 235, 0.22]],
    ['TUR', [5, 150, 105, 0.25]],
    ['BYZ', [147, 51, 234, 0.28]],
    ['VEN', [2, 132, 199, 0.25]],
    ['PAP', [234, 179, 8, 0.24]],
    ['KAR', [217, 119, 6, 0.24]],   // Karamanids
    ['CND', [13, 148, 136, 0.24]],  // Candar
    ['REB', [185, 28, 28, 0.40]],   // Rebels
    ['WST', [60, 60, 60, 0.50]],    // Wasteland
  ]);

  constructor() {
    this.initializeHistoricalMicroProvinces();
    this.rebuildAllEdges();
  }

  /**
   * Initializes historical micro-provinces with granular sub-polygon tessellation
   */
  private initializeHistoricalMicroProvinces(): void {
    // Anatolian Micro-Provinces
    this.addProvince({
      provinceId: 101,
      name: 'Söğüt',
      sovereignTag: 'TUR',
      controllerTag: 'TUR',
      colorRgba: this.tagColors.get('TUR')!,
      vertices: [[1220, 665], [1255, 660], [1265, 690], [1230, 695]],
      centroid: [1243, 674],
      neighbors: [102, 103, 105],
      isWasteland: false
    });

    this.addProvince({
      provinceId: 102,
      name: 'Bursa',
      sovereignTag: 'TUR',
      controllerTag: 'TUR',
      colorRgba: this.tagColors.get('TUR')!,
      vertices: [[1195, 655], [1225, 650], [1235, 680], [1200, 685]],
      centroid: [1209, 668],
      neighbors: [101, 103, 106],
      isWasteland: false
    });

    this.addProvince({
      provinceId: 103,
      name: 'İznik (Nicaea)',
      sovereignTag: 'TUR',
      controllerTag: 'TUR',
      colorRgba: this.tagColors.get('TUR')!,
      vertices: [[1215, 640], [1245, 638], [1250, 660], [1220, 665]],
      centroid: [1232, 651],
      neighbors: [101, 102, 104],
      isWasteland: false
    });

    this.addProvince({
      provinceId: 105,
      name: 'Karaman (Konya Basin)',
      sovereignTag: 'KAR',
      controllerTag: 'KAR',
      colorRgba: this.tagColors.get('KAR')!,
      vertices: [[1265, 690], [1350, 695], [1360, 770], [1270, 765]],
      centroid: [1310, 730],
      neighbors: [101, 107],
      isWasteland: false
    });

    this.addProvince({
      provinceId: 106,
      name: 'Candar (Kastamonu / Pontus)',
      sovereignTag: 'CND',
      controllerTag: 'CND',
      colorRgba: this.tagColors.get('CND')!,
      vertices: [[1280, 620], [1370, 605], [1380, 660], [1290, 670]],
      centroid: [1330, 635],
      neighbors: [101, 102],
      isWasteland: false
    });

    // Thrace & Byzantine Micro-Provinces
    this.addProvince({
      provinceId: 104,
      name: 'Constantinople',
      sovereignTag: 'BYZ',
      controllerTag: 'BYZ',
      colorRgba: this.tagColors.get('BYZ')!,
      vertices: [[1190, 625], [1215, 625], [1215, 645], [1190, 645]],
      centroid: [1207, 637],
      neighbors: [103, 110, 108],
      isWasteland: false
    });

    this.addProvince({
      provinceId: 108,
      name: 'Gallipoli (Kallipolis)',
      sovereignTag: 'BYZ',
      controllerTag: 'BYZ',
      colorRgba: this.tagColors.get('BYZ')!,
      vertices: [[1115, 650], [1140, 645], [1145, 665], [1120, 670]],
      centroid: [1130, 658],
      neighbors: [104, 110],
      isWasteland: false
    });

    this.addProvince({
      provinceId: 110,
      name: 'Adrianople (Edirne)',
      sovereignTag: 'TUR',
      controllerTag: 'TUR',
      colorRgba: this.tagColors.get('TUR')!,
      vertices: [[1110, 595], [1160, 595], [1165, 635], [1115, 635]],
      centroid: [1134, 612],
      neighbors: [104, 108],
      isWasteland: false
    });

    // Impassable Mountain Wasteland: Swiss Alps Crest
    this.addProvince({
      provinceId: 999,
      name: 'High Alps Massif (Wasteland)',
      sovereignTag: 'WST',
      controllerTag: 'WST',
      colorRgba: this.tagColors.get('WST')!,
      vertices: [[620, 420], [670, 415], [680, 440], [630, 445]],
      centroid: [650, 430],
      neighbors: [],
      isWasteland: true
    });
  }

  public addProvince(prov: MicroProvincePolygon): void {
    this.provinces.set(prov.provinceId, prov);
  }

  public getProvince(id: number): MicroProvincePolygon | undefined {
    return this.provinces.get(id);
  }

  public getAllProvinces(): MicroProvincePolygon[] {
    return Array.from(this.provinces.values());
  }

  /**
   * Rebuilds boundary edge topology between micro-polygons
   */
  public rebuildAllEdges(): void {
    this.edgeSegments.clear();

    for (const prov of this.provinces.values()) {
      for (const nId of prov.neighbors) {
        const neighbor = this.provinces.get(nId);
        if (!neighbor) continue;

        const key = prov.provinceId < nId 
          ? `${prov.provinceId}_${nId}` 
          : `${nId}_${prov.provinceId}`;

        if (!this.edgeSegments.has(key)) {
          const isInternational = prov.sovereignTag !== neighbor.sovereignTag ||
                                  prov.controllerTag !== neighbor.controllerTag;

          // Midpoint frontier dividing the two centroids
          const midX = (prov.centroid[0] + neighbor.centroid[0]) / 2;
          const midY = (prov.centroid[1] + neighbor.centroid[1]) / 2;
          const dx = neighbor.centroid[0] - prov.centroid[0];
          const dy = neighbor.centroid[1] - prov.centroid[1];

          // Perpendicular segment
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = (-dy / len) * 20;
          const perpY = (dx / len) * 20;

          this.edgeSegments.set(key, {
            edgeKey: key,
            provA: prov.provinceId,
            provB: nId,
            x1: Math.round(midX - perpX),
            y1: Math.round(midY - perpY),
            x2: Math.round(midX + perpX),
            y2: Math.round(midY + perpY),
            isInternational
          });
        }
      }
    }
  }

  /**
   * O(1) Real-Time Border Mutation: Updates sovereign control without full rebuild
   */
  public updateProvinceSovereignty(
    provinceId: number, 
    newSovereignTag: string, 
    newControllerTag?: string
  ): BorderEdgeSegment[] {
    const prov = this.provinces.get(provinceId);
    if (!prov) return [];

    prov.sovereignTag = newSovereignTag;
    prov.controllerTag = newControllerTag || newSovereignTag;
    prov.colorRgba = this.tagColors.get(newSovereignTag) || [100, 100, 100, 0.2];

    const modifiedEdges: BorderEdgeSegment[] = [];

    // O(1) update of only incident neighbor edges
    for (const nId of prov.neighbors) {
      const neighbor = this.provinces.get(nId);
      if (!neighbor) continue;

      const key = prov.provinceId < nId 
        ? `${prov.provinceId}_${nId}` 
        : `${nId}_${prov.provinceId}`;

      const edge = this.edgeSegments.get(key);
      if (edge) {
        edge.isInternational = prov.sovereignTag !== neighbor.sovereignTag ||
                               prov.controllerTag !== neighbor.controllerTag;
        modifiedEdges.push(edge);
      }
    }

    return modifiedEdges;
  }

  public getInternationalBorders(): BorderEdgeSegment[] {
    return Array.from(this.edgeSegments.values()).filter(e => e.isInternational);
  }

  public compileSvgBorderPaths(): string {
    const borders = this.getInternationalBorders();
    return borders.map(b => `M ${b.x1},${b.y1} L ${b.x2},${b.y2}`).join(' ');
  }
}
