/**
 * UI Navigation Core Module
 * Binds spatial camera navigation with frontend HUD controls, mouse gestures,
 * touch gestures, and LOD culling transitions.
 */

import { SpatialCameraController, type LODLevel } from '../graphics/map_render/camera.ts';

export class UIMapNavigationCore {
  private camera: SpatialCameraController;
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private onCameraChangeCallbacks: Array<(transform: string, lod: LODLevel) => void> = [];

  constructor(canvasWidth: number = 1600, canvasHeight: number = 900) {
    this.camera = new SpatialCameraController(canvasWidth, canvasHeight);
  }

  public getCameraController(): SpatialCameraController {
    return this.camera;
  }

  public registerOnCameraChange(callback: (transform: string, lod: LODLevel) => void): void {
    this.onCameraChangeCallbacks.push(callback);
  }

  private notifyCameraChange(): void {
    const transform = this.camera.getSVGTransform();
    const lod = this.camera.getState().lodLevel;
    for (const cb of this.onCameraChangeCallbacks) {
      cb(transform, lod);
    }
  }

  public handleMouseDown(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;
  }

  public handleMouseMove(clientX: number, clientY: number): void {
    if (!this.isDragging) return;
    const dx = clientX - this.lastMouseX;
    const dy = clientY - this.lastMouseY;
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;

    this.camera.panBy(dx, dy);
    this.camera.updatePhysicsTick(1.0);
    this.notifyCameraChange();
  }

  public handleMouseUp(): void {
    this.isDragging = false;
  }

  public handleWheel(deltaY: number, focalX?: number, focalY?: number): void {
    const zoomDelta = deltaY < 0 ? 0.25 : -0.25;
    this.camera.zoomBy(zoomDelta, focalX, focalY);
    this.camera.updatePhysicsTick(1.0);
    this.notifyCameraChange();
  }

  public zoomIn(): void {
    this.camera.zoomBy(0.35);
    this.camera.updatePhysicsTick(1.0);
    this.notifyCameraChange();
  }

  public zoomOut(): void {
    this.camera.zoomBy(-0.35);
    this.camera.updatePhysicsTick(1.0);
    this.notifyCameraChange();
  }

  public resetView(): void {
    this.camera.resetView();
    this.camera.updatePhysicsTick(1.0);
    this.notifyCameraChange();
  }

  public focusLocation(x: number, y: number, zoomLevel: number = 2.4): void {
    this.camera.focusOnNode(x, y, zoomLevel);
    this.camera.updatePhysicsTick(1.0);
    this.notifyCameraChange();
  }
}
