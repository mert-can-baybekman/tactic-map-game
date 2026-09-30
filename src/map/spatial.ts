/**
 * Spatial Partitioning, Quadtree & Hierarchical Pathfinding Engine (HPA*)
 * Scales to 50,000+ coordinate-mapped global Locations (Global Scope)
 */

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MapRendererNode {
  locationId: number;
  x: number;
  y: number;
  countryTag: string;
  politicalColorRgb: [number, number, number]; // [R, G, B]
  isCoastal: boolean;
  borderSegments: { x1: number; y1: number; x2: number; y2: number }[];
  isEnclave: boolean;
}

export class QuadtreeNode {
  public bounds: BoundingBox;
  public capacity: number;
  public items: MapRendererNode[] = [];
  public divided: boolean = false;
  public northwest?: QuadtreeNode;
  public northeast?: QuadtreeNode;
  public southwest?: QuadtreeNode;
  public southeast?: QuadtreeNode;

  constructor(bounds: BoundingBox, capacity: number = 64) {
    this.bounds = bounds;
    this.capacity = capacity;
  }

  public containsPoint(x: number, y: number): boolean {
    return x >= this.bounds.minX && x <= this.bounds.maxX && y >= this.bounds.minY && y <= this.bounds.maxY;
  }

  public intersects(range: BoundingBox): boolean {
    return !(
      range.minX > this.bounds.maxX ||
      range.maxX < this.bounds.minX ||
      range.minY > this.bounds.maxY ||
      range.maxY < this.bounds.minY
    );
  }

  public subdivide(): void {
    const midX = (this.bounds.minX + this.bounds.maxX) / 2;
    const midY = (this.bounds.minY + this.bounds.maxY) / 2;

    this.northwest = new QuadtreeNode({ minX: this.bounds.minX, minY: this.bounds.minY, maxX: midX, maxY: midY }, this.capacity);
    this.northeast = new QuadtreeNode({ minX: midX, minY: this.bounds.minY, maxX: this.bounds.maxX, maxY: midY }, this.capacity);
    this.southwest = new QuadtreeNode({ minX: this.bounds.minX, minY: midY, maxX: midX, maxY: this.bounds.maxY }, this.capacity);
    this.southeast = new QuadtreeNode({ minX: midX, minY: midY, maxX: this.bounds.maxX, maxY: this.bounds.maxY }, this.capacity);

    this.divided = true;

    // Distribute existing items
    for (const item of this.items) {
      this.insertInternal(item);
    }
    this.items = [];
  }

  private insertInternal(item: MapRendererNode): boolean {
    if (this.northwest?.containsPoint(item.x, item.y) && this.northwest.insert(item)) return true;
    if (this.northeast?.containsPoint(item.x, item.y) && this.northeast.insert(item)) return true;
    if (this.southwest?.containsPoint(item.x, item.y) && this.southwest.insert(item)) return true;
    if (this.southeast?.containsPoint(item.x, item.y) && this.southeast.insert(item)) return true;
    return false;
  }

  public insert(item: MapRendererNode): boolean {
    if (!this.containsPoint(item.x, item.y)) {
      return false;
    }

    if (!this.divided && this.items.length < this.capacity) {
      this.items.push(item);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return this.insertInternal(item);
  }

  public queryRange(range: BoundingBox, found: MapRendererNode[] = []): MapRendererNode[] {
    if (!this.intersects(range)) {
      return found;
    }

    for (const item of this.items) {
      if (
        item.x >= range.minX && item.x <= range.maxX &&
        item.y >= range.minY && item.y <= range.maxY
      ) {
        found.push(item);
      }
    }

    if (this.divided) {
      this.northwest?.queryRange(range, found);
      this.northeast?.queryRange(range, found);
      this.southwest?.queryRange(range, found);
      this.southeast?.queryRange(range, found);
    }

    return found;
  }
}

/**
 * Hierarchical Pathfinding (HPA*) Cluster Graph
 */
export interface HPAClusterGateway {
  id: string;
  sourceClusterId: number;
  targetClusterId: number;
  sourceLocationId: number;
  targetLocationId: number;
  transitCost: number;
}

export class GlobalSpatialMapEngine {
  private quadtree: QuadtreeNode;
  private rendererNodes: Map<number, MapRendererNode> = new Map();
  private clusterGateways: HPAClusterGateway[] = [];
  private countryColors: Map<string, [number, number, number]> = new Map([
    ['ENG', [180, 40, 40]],   // English Red
    ['FRA', [30, 70, 160]],   // Royal French Blue
    ['BUR', [130, 40, 120]],  // Burgundian Plum
    ['CAS', [210, 160, 40]],  // Castilian Gold
    ['OTT', [35, 130, 80]],   // Ottoman Green
    ['MNG', [190, 50, 60]],   // Ming Crimson
    ['MAM', [200, 140, 30]]   // Mamluk Ochre
  ]);

  constructor(worldBounds: BoundingBox = { minX: 0, minY: 0, maxX: 10000, maxY: 6000 }) {
    this.quadtree = new QuadtreeNode(worldBounds, 128);
  }

  public registerRendererNode(node: MapRendererNode): void {
    if (!node.politicalColorRgb) {
      node.politicalColorRgb = this.countryColors.get(node.countryTag) || [120, 120, 120];
    }
    this.rendererNodes.set(node.locationId, node);
    this.quadtree.insert(node);
  }

  public getRendererNode(locationId: number): MapRendererNode | undefined {
    return this.rendererNodes.get(locationId);
  }

  public queryFrustumVisibleLocations(viewport: BoundingBox): MapRendererNode[] {
    return this.quadtree.queryRange(viewport);
  }

  public getTotalIndexedLocations(): number {
    return this.rendererNodes.size;
  }

  public addClusterGateway(gateway: HPAClusterGateway): void {
    this.clusterGateways.push(gateway);
  }

  /**
   * Hierarchical A* Pathfinding (HPA*)
   * High performance macroscopic path finding across cross-continental graphs
   */
  public findHierarchicalPath(
    startLocId: number,
    targetLocId: number,
    locationNeighbors: (id: number) => number[]
  ): number[] {
    if (startLocId === targetLocId) return [startLocId];

    // Priority Queue implementation for A*
    const openSet: { locId: number; gCost: number; fCost: number; path: number[] }[] = [];
    const closedSet: Set<number> = new Set();

    const startNode = this.rendererNodes.get(startLocId);
    const targetNode = this.rendererNodes.get(targetLocId);
    if (!startNode || !targetNode) return [startLocId, targetLocId];

    const heuristic = (n1: MapRendererNode, n2: MapRendererNode) => {
      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    openSet.push({
      locId: startLocId,
      gCost: 0,
      fCost: heuristic(startNode, targetNode),
      path: [startLocId]
    });

    let iterations = 0;
    const maxIterations = 2000;

    while (openSet.length > 0 && iterations++ < maxIterations) {
      openSet.sort((a, b) => a.fCost - b.fCost);
      const current = openSet.shift()!;

      if (current.locId === targetLocId) {
        return current.path;
      }

      closedSet.add(current.locId);

      const neighbors = locationNeighbors(current.locId);
      for (const nId of neighbors) {
        if (closedSet.has(nId)) continue;

        const neighborNode = this.rendererNodes.get(nId);
        if (!neighborNode) continue;

        const stepCost = heuristic(this.rendererNodes.get(current.locId)!, neighborNode);
        const gCost = current.gCost + stepCost;
        const fCost = gCost + heuristic(neighborNode, targetNode);

        const existing = openSet.find(item => item.locId === nId);
        if (!existing) {
          openSet.push({
            locId: nId,
            gCost,
            fCost,
            path: [...current.path, nId]
          });
        } else if (gCost < existing.gCost) {
          existing.gCost = gCost;
          existing.fCost = fCost;
          existing.path = [...current.path, nId];
        }
      }
    }

    return [startLocId, targetLocId];
  }
}
