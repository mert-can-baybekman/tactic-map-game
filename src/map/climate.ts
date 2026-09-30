/**
 * Seasonal Climate Vectors, Winter Attrition & Impassable Wastelands Engine
 * Handles dynamic weather state ticks and logistical constraints across real-world geography
 */

export type WeatherState = 'Mild' | 'Severe_Winter' | 'Arid_Summer' | 'Monsoon/Heavy_Rain';

export interface ClimateZone {
  locationId: number;
  name: string;
  latitude: number;
  longitude: number;
  elevationMeters: number;
  isMountainous: boolean;
  isWasteland: boolean;
  activeWeather: WeatherState;
  logisticsMultiplier: number;
  monthlyAttritionRate: number; // e.g. 0.025 for +2.5%
}

export interface ImpassableWasteland {
  id: string;
  name: string;
  polygon: [number, number][]; // Screen [x, y] or Geo [lon, lat]
  boundingRadius: number;
  center: [number, number];
}

export class ClimateEngine {
  private zones: Map<number, ClimateZone> = new Map();
  private wastelands: Map<string, ImpassableWasteland> = new Map();

  constructor() {
    this.initializeDefaultWastelands();
    this.initializeDefaultZones();
  }

  private initializeDefaultWastelands(): void {
    // 1. Swiss Alps High Massif (Impassable Peaks)
    this.wastelands.set('swiss_alps_massif', {
      id: 'swiss_alps_massif',
      name: 'High Alps Glacial Massif',
      polygon: [[630, 420], [670, 410], [680, 440], [640, 450]],
      boundingRadius: 40,
      center: [655, 430]
    });

    // 2. Rhodope Alpine Crags (Balkan Impassable Crest)
    this.wastelands.set('rhodope_alpine_crag', {
      id: 'rhodope_alpine_crag',
      name: 'Rhodope Alpine Crags',
      polygon: [[1050, 580], [1090, 570], [1100, 600], [1060, 610]],
      boundingRadius: 30,
      center: [1075, 590]
    });

    // 3. Central Anatolian Tuz Salt Desert (Tuz Gölü Basin)
    this.wastelands.set('anatolian_salt_desert', {
      id: 'anatolian_salt_desert',
      name: 'Central Anatolian Salt Desert (Tuz Gölü)',
      polygon: [[1330, 710], [1370, 700], [1380, 740], [1340, 750]],
      boundingRadius: 35,
      center: [1355, 725]
    });
  }

  private initializeDefaultZones(): void {
    // Core locations with authentic real-world elevation and latitude
    const initialLocs: { id: number; name: string; lat: number; lon: number; elev: number; mountain: boolean; wasteland?: boolean }[] = [
      { id: 1, name: 'London', lat: 51.5074, lon: -0.1278, elev: 35, mountain: false },
      { id: 2, name: 'Dover', lat: 51.1279, lon: 1.3134, elev: 20, mountain: false },
      { id: 3, name: 'Calais', lat: 50.9513, lon: 1.8587, elev: 5, mountain: false },
      { id: 4, name: 'Rouen', lat: 49.4432, lon: 1.0999, elev: 15, mountain: false },
      { id: 5, name: 'Paris', lat: 48.8566, lon: 2.3522, elev: 35, mountain: false },
      { id: 20, name: 'Venice', lat: 45.4408, lon: 12.3155, elev: 1, mountain: false },
      { id: 23, name: 'Rome', lat: 41.9028, lon: 12.4964, elev: 21, mountain: false },
      { id: 110, name: 'Adrianople', lat: 41.6772, lon: 26.5557, elev: 42, mountain: false },
      { id: 104, name: 'Constantinople', lat: 41.0082, lon: 28.9784, elev: 39, mountain: false },
      { id: 102, name: 'Bursa', lat: 40.1885, lon: 29.0610, elev: 155, mountain: true }, // Uludağ Foothills
      { id: 101, name: 'Söğüt', lat: 40.0177, lon: 30.1819, elev: 665, mountain: true }, // Bilecik Highlands
      { id: 120, name: 'Alps Pass (Brenner)', lat: 47.0000, lon: 11.5000, elev: 1370, mountain: true },
      { id: 121, name: 'Balkan Pass (Shipka)', lat: 42.7500, lon: 25.3200, elev: 1150, mountain: true },
      { id: 999, name: 'High Alps Massif', lat: 46.5000, lon: 8.5000, elev: 3800, mountain: true, wasteland: true }
    ];

    for (const loc of initialLocs) {
      this.zones.set(loc.id, {
        locationId: loc.id,
        name: loc.name,
        latitude: loc.lat,
        longitude: loc.lon,
        elevationMeters: loc.elev,
        isMountainous: loc.mountain,
        isWasteland: !!loc.wasteland,
        activeWeather: 'Mild',
        logisticsMultiplier: 1.0,
        monthlyAttritionRate: 0.0
      });
    }
  }

  public registerZone(zone: ClimateZone): void {
    this.zones.set(zone.locationId, zone);
  }

  public getZone(locationId: number): ClimateZone | undefined {
    return this.zones.get(locationId);
  }

  public getAllZones(): ClimateZone[] {
    return Array.from(this.zones.values());
  }

  public getAllWastelands(): ImpassableWasteland[] {
    return Array.from(this.wastelands.values());
  }

  /**
   * Evaluates dynamic weather states and attrition modifiers on calendar tick
   * @param month 1-12
   * @param day 1-30
   */
  public evaluateSeasonTick(month: number, day: number): void {
    const isWinterMonth = (month === 11 || month === 12 || month === 1 || month === 2);
    const isSummerMonth = (month === 7 || month === 8);

    for (const zone of this.zones.values()) {
      if (zone.isWasteland) {
        zone.activeWeather = 'Severe_Winter';
        zone.logisticsMultiplier = 999999.0;
        zone.monthlyAttritionRate = 1.0;
        continue;
      }

      // Severe Winter Trigger: Winter months + (Elevation >= 600m OR Mountainous OR High Latitude >= 46.0)
      if (isWinterMonth && (zone.elevationMeters >= 600 || zone.isMountainous || zone.latitude >= 46.0)) {
        zone.activeWeather = 'Severe_Winter';
        zone.logisticsMultiplier = 3.0; // 3x Logistical Maintenance Cost
        zone.monthlyAttritionRate = 0.025; // +2.5% Monthly Attrition
      } else if (isSummerMonth && zone.latitude <= 38.0) {
        zone.activeWeather = 'Arid_Summer';
        zone.logisticsMultiplier = 1.35;
        zone.monthlyAttritionRate = 0.008;
      } else {
        zone.activeWeather = 'Mild';
        zone.logisticsMultiplier = 1.0;
        zone.monthlyAttritionRate = 0.0;
      }
    }
  }

  /**
   * Applies daily attrition to an army stack traversing a location
   * @param armySize Number of men
   * @param locationId Location node ID
   * @returns Casualties suffered on this tick
   */
  public calculateDailyArmyAttrition(armySize: number, locationId: number): number {
    const zone = this.zones.get(locationId);
    if (!zone) return 0;

    // Daily attrition = Monthly rate / 30
    const dailyRate = zone.monthlyAttritionRate / 30.0;
    const casualties = Math.floor(armySize * dailyRate);
    return casualties;
  }

  /**
   * Checks whether a coordinate point or path intersects an impassable wasteland
   */
  public isPointInWasteland(x: number, y: number): boolean {
    for (const wl of this.wastelands.values()) {
      const dx = x - wl.center[0];
      const dy = y - wl.center[1];
      if (Math.sqrt(dx * dx + dy * dy) <= wl.boundingRadius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks whether a target location is an impassable wasteland
   */
  public isLocationPassable(locationId: number): boolean {
    const zone = this.zones.get(locationId);
    if (!zone) return true;
    return !zone.isWasteland;
  }
}
