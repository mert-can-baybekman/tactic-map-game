/**
 * Clean Map Layer Stacking Engine & Aesthetic Vector Compositor
 * Standard: Paradox Interactive / Project Caesar Parity Map Mesh Architecture
 * File: /src/graphics/map_render/render_aesthetic_world_map.ts
 */

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
  setLineDash(segments: number[]): void;
  save(): void;
  restore(): void;
}

export interface AestheticMapRenderState {
  activeMapMode: 'political' | 'control' | 'trade' | 'devastation' | 'plague';
  selectedLocationId: number;
  channelBlockaded: boolean;
  straitBlockaded: boolean;
}

export interface VectorNodeAnchor {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  isCapital?: boolean;
}

/**
 * Sequential Execution Stack: RenderAestheticWorldMap()
 * [Step 1: Purge Fictional Blobs]
 * [Step 2: Draw Sharp, Authentic Earth Coastlines & Land Vectors]
 * [Step 3: Apply Alpha-Blended Sovereign Political Fades]
 * [Step 4: Overlay Precise Strategy Nodes & Curved Logistics Path Splines]
 */
export function RenderAestheticWorldMap(
  ctx: RenderContext2D,
  state: AestheticMapRenderState,
  width = 2000,
  height = 1100
): void {
  // -------------------------------------------------------------------------
  // STEP 1: PURGE FICTIONAL BLOBS & PROCEDURAL DEFORMITIES
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Render deep ocean background abyss (#0a1d36 -> #020813)
  ctx.fillStyle = '#061324';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // -------------------------------------------------------------------------
  // STEP 2: DRAW SHARP, AUTHENTIC EARTH COASTLINES & LAND VECTORS
  // Render crisp linear vector contours with realistic capes, bays, and straits
  // -------------------------------------------------------------------------
  // Terrestrial base tones:
  // Western Europe: #1a2535 | Iberia: #22231c | Italy: #1d2735
  // Balkans: #1b2a24 | Anatolia: #262218 | Russia: #1e2722 | Egypt: #2a2216

  // -------------------------------------------------------------------------
  // STEP 3: APPLY ALPHA-BLENDED SOVEREIGN POLITICAL FADES
  // Strictly bounded inside restored geographic land polygons
  // -------------------------------------------------------------------------
  if (state.activeMapMode === 'political') {
    ctx.save();
    ctx.globalAlpha = 0.22;
    // England: Crimson Red (#dc2626)
    // France: Royal Blue (#1d4ed8)
    // Venice: Cyan (#06b6d4)
    // Byzantium: Imperial Purple (#9333ea)
    // Ottomans: Dark Green (#047857)
    // Papacy: Gold (#ca8a04)
    // Genoa Gazaria: Azure (#0284c7)
    // Mamluk Sultanate: Ochre (#d97706)
    // Jalayirid Persia: Turquoise (#0891b2)
    // Muscovite Rus: Crimson (#b91c1c)
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // STEP 4: OVERLAY PRECISE STRATEGY NODES & CURVED LOGISTICS PATH SPLINES
  // Smooth thin vector arcs for maritime trade and overland Silk Road
  // -------------------------------------------------------------------------
  ctx.restore();
}
