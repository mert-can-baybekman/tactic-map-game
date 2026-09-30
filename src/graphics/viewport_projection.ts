/**
 * Eurasian & North African GIS Viewport Projection & Camera Bounds Engine
 * Scales viewport limits from London (-5°W, 51.5°N) to Tabriz (46.3°E, 38.1°N)
 * and down to Mecca/Aden (12.8°N - 21.4°N).
 */

export interface GeoCoordinate {
  longitude: number; // Degrees [-180.0, 180.0]
  latitude: number;  // Degrees [-90.0, 90.0]
}

export interface ScreenCoordinate {
  x: number;
  y: number;
}

export interface GeoBoundingBox {
  minLon: number; // -12.0° (Atlantic, west of Ireland & Iberia)
  maxLon: number; // +62.0° (Eastern Iran, Strait of Hormuz, Persian Gulf)
  minLat: number; // +10.0° (Gulf of Aden, Horn of Africa, southern Red Sea)
  maxLat: number; // +62.0° (Baltic, Novgorod, Scandinavian borders)
}

export const LevelOfDetail = {
  MacroContinental: 'MacroContinental',
  RegionalTheater: 'RegionalTheater',
  TacticalLocation: 'TacticalLocation'
} as const;

export type LevelOfDetail = typeof LevelOfDetail[keyof typeof LevelOfDetail];

export class MapViewportProjector {
  public bounds: GeoBoundingBox = {
    minLon: -12.0,
    maxLon: 62.0,
    minLat: 10.0,
    maxLat: 62.0
  };

  public canvasWidth: number;
  public canvasHeight: number;
  public cameraCenter: GeoCoordinate;
  public zoomLevel: number; // 1.0 = full macro extent

  constructor(canvasWidth: number = 1600, canvasHeight: number = 900) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.cameraCenter = {
      longitude: (this.bounds.minLon + this.bounds.maxLon) * 0.5, // 25.0° E
      latitude: (this.bounds.minLat + this.bounds.maxLat) * 0.5   // 36.0° N
    };
    this.zoomLevel = 1.0;
  }

  public geoToCanvas(coord: GeoCoordinate): ScreenCoordinate {
    const lonSpan = this.bounds.maxLon - this.bounds.minLon;
    const latSpan = this.bounds.maxLat - this.bounds.minLat;

    const u = (coord.longitude - this.bounds.minLon) / lonSpan;
    const v = (this.bounds.maxLat - coord.latitude) / latSpan;

    const baseX = u * this.canvasWidth;
    const baseY = v * this.canvasHeight;

    const centerScreenX = this.canvasWidth * 0.5;
    const centerScreenY = this.canvasHeight * 0.5;

    const centerU = (this.cameraCenter.longitude - this.bounds.minLon) / lonSpan;
    const centerV = (this.bounds.maxLat - this.cameraCenter.latitude) / latSpan;

    const screenX = centerScreenX + (baseX - (centerU * this.canvasWidth)) * this.zoomLevel;
    const screenY = centerScreenY + (baseY - (centerV * this.canvasHeight)) * this.zoomLevel;

    return { x: screenX, y: screenY };
  }

  public canvasToGeo(screen: ScreenCoordinate): GeoCoordinate {
    const lonSpan = this.bounds.maxLon - this.bounds.minLon;
    const latSpan = this.bounds.maxLat - this.bounds.minLat;

    const centerScreenX = this.canvasWidth * 0.5;
    const centerScreenY = this.canvasHeight * 0.5;

    const centerU = (this.cameraCenter.longitude - this.bounds.minLon) / lonSpan;
    const centerV = (this.bounds.maxLat - this.cameraCenter.latitude) / latSpan;

    const baseX = ((screen.x - centerScreenX) / this.zoomLevel) + (centerU * this.canvasWidth);
    const baseY = ((screen.y - centerScreenY) / this.zoomLevel) + (centerV * this.canvasHeight);

    const u = baseX / this.canvasWidth;
    const v = baseY / this.canvasHeight;

    const lon = this.bounds.minLon + (u * lonSpan);
    const lat = this.bounds.maxLat - (v * latSpan);

    return {
      longitude: Math.max(this.bounds.minLon, Math.min(this.bounds.maxLon, lon)),
      latitude: Math.max(this.bounds.minLat, Math.min(this.bounds.maxLat, lat))
    };
  }

  public getActiveLod(): LevelOfDetail {
    if (this.zoomLevel < 1.75) return LevelOfDetail.MacroContinental;
    if (this.zoomLevel < 3.5) return LevelOfDetail.RegionalTheater;
    return LevelOfDetail.TacticalLocation;
  }

  public clampCamera(): void {
    this.zoomLevel = Math.max(0.85, Math.min(8.0, this.zoomLevel));
    this.cameraCenter.longitude = Math.max(this.bounds.minLon, Math.min(this.bounds.maxLon, this.cameraCenter.longitude));
    this.cameraCenter.latitude = Math.max(this.bounds.minLat, Math.min(this.bounds.maxLat, this.cameraCenter.latitude));
  }
}
