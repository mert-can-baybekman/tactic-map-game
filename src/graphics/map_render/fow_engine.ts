/**
 * GPU-Accelerated Fog of War (FoW) Vision Engine
 * Dynamic vision circle casting, multi-state visibility culling, and shader texture mapping
 */

export const VisionState = {
  TerraIncognita: 0, // Unexplored, completely black
  ShroudOfWar: 1,    // Explored, topography visible, units/plague culled
  ActiveVision: 2    // Clear, fully visible in real-time
} as const;

export type VisionState = typeof VisionState[keyof typeof VisionState];

export interface VisionEntity {
  id: string;
  name: string;
  type: 'Army' | 'Navy' | 'Fort';
  ownerTag: string;
  screenPos: [number, number]; // [X, Y]
  geoPos: [number, number];    // [Longitude, Latitude]
  baseRadius: number;
  scoutingTraitBonus: number;
}

export class FogOfWarEngine {
  private playerTag: string;
  private visionEntities: Map<string, VisionEntity> = new Map();
  private exploredLocations: Set<number> = new Set(); // Locations explored by player

  constructor(playerTag: string = 'ENG') {
    this.playerTag = playerTag;
    this.initializeDefaultExploration();
  }

  private initializeDefaultExploration(): void {
    // Default explored locations for England & Western/Mediterranean trade sphere
    const defaultExplored = [1, 2, 3, 4, 5, 20, 23, 101, 102, 104, 110];
    for (const id of defaultExplored) {
      this.exploredLocations.add(id);
    }
  }

  public setPlayerTag(tag: string): void {
    this.playerTag = tag;
  }

  public registerVisionEntity(entity: VisionEntity): void {
    this.visionEntities.set(entity.id, entity);
  }

  public removeVisionEntity(entityId: string): void {
    this.visionEntities.delete(entityId);
  }

  public getEffectiveVisionRadius(entity: VisionEntity): number {
    return entity.baseRadius + entity.scoutingTraitBonus;
  }

  public markLocationExplored(locationId: number): void {
    this.exploredLocations.add(locationId);
  }

  public isLocationExplored(locationId: number): boolean {
    return this.exploredLocations.has(locationId);
  }

  /**
   * Evaluates the Fog of War vision state for a given coordinate point
   * @param x Screen X
   * @param y Screen Y
   * @param locationId Optional location node ID to check exploration
   */
  public queryVisionState(x: number, y: number, locationId?: number): VisionState {
    // 1. Check Terra Incognita
    if (locationId !== undefined && !this.exploredLocations.has(locationId)) {
      return VisionState.TerraIncognita;
    }

    // 2. Check Active Vision Circles from friendly assets
    for (const entity of this.visionEntities.values()) {
      if (entity.ownerTag !== this.playerTag) continue;

      const effectiveRadius = this.getEffectiveVisionRadius(entity);
      const dx = x - entity.screenPos[0];
      const dy = y - entity.screenPos[1];
      const distSq = dx * dx + dy * dy;

      if (distSq <= effectiveRadius * effectiveRadius) {
        return VisionState.ActiveVision;
      }
    }

    // 3. Fallback to Shroud of War (Explored, but no active asset)
    return VisionState.ShroudOfWar;
  }

  /**
   * Culling Query: Evaluates whether a foreign unit stack should be culled from rendering
   * Units inside Shroud of War or Terra Incognita are hidden.
   * Units inside Active Vision are visible and un-culled.
   */
  public shouldCullForeignEntity(unitOwnerTag: string, unitX: number, unitY: number, locationId?: number): boolean {
    // Friendly units are never culled
    if (unitOwnerTag === this.playerTag) {
      return false;
    }

    const state = this.queryVisionState(unitX, unitY, locationId);
    return state !== VisionState.ActiveVision;
  }

  /**
   * Generates SVG Vision Mask / Clip Path elements for frontend rendering
   */
  public generateSvgVisionMask(canvasWidth: number = 1600, canvasHeight: number = 900): string {
    const activeCircles: string[] = [];

    for (const entity of this.visionEntities.values()) {
      if (entity.ownerTag !== this.playerTag) continue;
      const radius = this.getEffectiveVisionRadius(entity);
      activeCircles.push(
        `<circle cx="${entity.screenPos[0]}" cy="${entity.screenPos[1]}" r="${radius}" fill="black" />`
      );
    }

    return `
      <mask id="fow-shroud-mask">
        <!-- White base: Shroud covers everything -->
        <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="white" />
        <!-- Black circles cut out holes: Active vision is completely clear -->
        ${activeCircles.join('\n        ')}
      </mask>
    `;
  }
}
