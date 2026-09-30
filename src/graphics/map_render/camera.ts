/**
 * Spatial Viewport Navigation & Camera Controller
 * Manages 2D/3D smooth camera zooming, dragging/panning, and Dynamic Level-of-Detail (LOD) culling.
 */

export type LODLevel = 'MACRO' | 'REGIONAL' | 'TACTICAL';

export interface CameraState {
  zoom: number;         // 0.8x to 4.5x
  targetZoom: number;
  offsetX: number;
  offsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  lodLevel: LODLevel;
  minZoom: number;
  maxZoom: number;
}

export class SpatialCameraController {
  private state: CameraState = {
    zoom: 1.0,
    targetZoom: 1.0,
    offsetX: 0.0,
    offsetY: 0.0,
    targetOffsetX: 0.0,
    targetOffsetY: 0.0,
    lodLevel: 'MACRO',
    minZoom: 0.8,
    maxZoom: 4.5
  };

  private readonly canvasWidth: number;
  private readonly canvasHeight: number;

  constructor(canvasWidth: number = 1600, canvasHeight: number = 900) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  public getState(): Readonly<CameraState> {
    return { ...this.state };
  }

  public setZoom(zoom: number, focalX?: number, focalY?: number): void {
    const clamped = Math.max(this.state.minZoom, Math.min(this.state.maxZoom, zoom));
    
    // Zoom around focal point if provided
    if (focalX !== undefined && focalY !== undefined) {
      const zoomRatio = clamped / this.state.zoom;
      this.state.targetOffsetX = focalX - (focalX - this.state.offsetX) * zoomRatio;
      this.state.targetOffsetY = focalY - (focalY - this.state.offsetY) * zoomRatio;
      this.state.offsetX = this.state.targetOffsetX;
      this.state.offsetY = this.state.targetOffsetY;
    }

    this.state.targetZoom = clamped;
    this.state.zoom = clamped;
    this.updateLOD();
  }

  public zoomBy(delta: number, focalX?: number, focalY?: number): void {
    this.setZoom(this.state.targetZoom + delta, focalX, focalY);
  }

  public panBy(dx: number, dy: number): void {
    this.state.targetOffsetX += dx;
    this.state.targetOffsetY += dy;
    this.clampPan();
  }

  public focusOnNode(x: number, y: number, desiredZoom: number = 2.4): void {
    const clamped = Math.max(this.state.minZoom, Math.min(this.state.maxZoom, desiredZoom));
    this.state.targetZoom = clamped;
    this.state.zoom = clamped;
    // Center node in the middle of the viewport
    this.state.targetOffsetX = (this.canvasWidth / 2) - x * this.state.targetZoom;
    this.state.targetOffsetY = (this.canvasHeight / 2) - y * this.state.targetZoom;
    this.state.offsetX = this.state.targetOffsetX;
    this.state.offsetY = this.state.targetOffsetY;
    this.updateLOD();
  }

  public resetView(): void {
    this.state.targetZoom = 1.0;
    this.state.targetOffsetX = 0.0;
    this.state.targetOffsetY = 0.0;
    this.updateLOD();
  }

  /**
   * Smooth physics dampening tick for 60fps asynchronous navigation.
   */
  public updatePhysicsTick(lerpFactor: number = 0.25): void {
    this.state.zoom += (this.state.targetZoom - this.state.zoom) * lerpFactor;
    this.state.offsetX += (this.state.targetOffsetX - this.state.offsetX) * lerpFactor;
    this.state.offsetY += (this.state.targetOffsetY - this.state.offsetY) * lerpFactor;
    this.updateLOD();
  }

  private clampPan(): void {
    const maxBoundX = this.canvasWidth * (this.state.targetZoom - 1.0) + 400.0;
    const maxBoundY = this.canvasHeight * (this.state.targetZoom - 1.0) + 300.0;
    this.state.targetOffsetX = Math.max(-maxBoundX, Math.min(400.0, this.state.targetOffsetX));
    this.state.targetOffsetY = Math.max(-maxBoundY, Math.min(300.0, this.state.targetOffsetY));
  }

  private updateLOD(): void {
    if (this.state.zoom <= 1.25) {
      this.state.lodLevel = 'MACRO';
    } else if (this.state.zoom <= 2.25) {
      this.state.lodLevel = 'REGIONAL';
    } else {
      this.state.lodLevel = 'TACTICAL';
    }
  }

  /**
   * Level-of-Detail (LOD) Rules:
   * When zoomed out (MACRO): hide granular labels & minor boundaries to maximize performance.
   * When zoomed in (TACTICAL): fade in micro location boundaries and asset infrastructure icons.
   */
  public shouldRenderGranularLabel(isCapitalHub: boolean): boolean {
    if (isCapitalHub) return true; // Capital hubs (London, Paris, Constantinople, Bursa) always render
    return this.state.lodLevel !== 'MACRO';
  }

  public shouldRenderMicroInfrastructure(): boolean {
    return this.state.lodLevel === 'TACTICAL';
  }

  public shouldRenderDetailedTerrainContours(): boolean {
    return this.state.lodLevel !== 'MACRO';
  }

  public getSVGTransform(): string {
    return `translate(${this.state.offsetX.toFixed(1)}, ${this.state.offsetY.toFixed(1)}) scale(${this.state.zoom.toFixed(3)})`;
  }
}
