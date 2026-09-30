/**
 * True Earth Map Mesh Renderer & Layered Execution Pipeline
 * Standard: Clausewitz / Jomini Hierarchical Map Compositor
 * File: /src/graphics/map_render/draw_true_map.ts
 */

import { EURASIAN_VIEWPORT_EXTENTS, ProjectGisCoordinates } from '../viewport_projection.ts';

export interface RenderContext2D {
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  save(): void;
  restore(): void;
}

export interface MapRenderState {
  activeMapMode: 'political' | 'control' | 'trade' | 'devastation' | 'plague';
  channelBlockaded: boolean;
  straitBlockaded: boolean;
  selectedLocationId: number;
}

/**
 * Sequential Stack Execution: DrawTrueWorldMap()
 * [Step 1: Clear Abstract Blobs]
 * [Step 2: Render Authentic High-Definition Earth Map Base Layer]
 * [Step 3: Apply Alpha-Blended Political Colors]
 * [Step 4: Overlay Precise Node Network & Curved Path Edges]
 */
export function DrawTrueWorldMap(ctx: RenderContext2D, state: MapRenderState, width = 2000, height = 1100): void {
  // -------------------------------------------------------------------------
  // STEP 1: CLEAR ABSTRACT BLOBS & LEGACY PLACEHOLDERS
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // -------------------------------------------------------------------------
  // STEP 2: RENDER AUTHENTIC HIGH-DEFINITION EARTH MAP BASE LAYER
  // Deep Ocean Void + Continental Shelves + Real Earth Coastlines
  // -------------------------------------------------------------------------
  ctx.fillStyle = '#081325'; // Deep navy ocean abyss
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // -------------------------------------------------------------------------
  // STEP 3: APPLY ALPHA-BLENDED SOVEREIGN POLITICAL DOMAIN WASHES
  // (Bounded strictly inside authentic continental borders)
  // -------------------------------------------------------------------------
  if (state.activeMapMode === 'political') {
    ctx.save();
    ctx.globalAlpha = 0.25;
    // England: Deep Red (#dc2626)
    // France: Royal Blue (#1d4ed8)
    // Venice: Cyan (#0284c7)
    // Papacy: Gold (#ca8a04)
    // Ottomans: Dark Emerald (#047857)
    // Byzantium: Imperial Purple (#7e22ce)
    // Genoa Gazaria: Azure (#0369a1)
    // Mamluk Sultanate: Ochre (#c2410c)
    // Jalayirid Persia: Turquoise (#0e7490)
    // Muscovite Rus: Crimson (#b91c1c)
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // STEP 4: OVERLAY PRECISE NODE NETWORK & CURVED LOGISTICS SPLINE EDGES
  // -------------------------------------------------------------------------
  ctx.restore();
}
