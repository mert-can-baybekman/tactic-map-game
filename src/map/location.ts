import { TerrainType, ClimateType } from '../core/types.ts';

export interface LocationData {
  id: number;
  name: string;
  province_id: number;
  country_id: number;
  terrain: TerrainType;
  climate: ClimateType;
  infrastructure_capacity: number;
  current_infrastructure: number;
  devastation: number; // 0.0 to 1.0
  base_material_potentials: Record<string, number>;
  neighbors: number[];
  is_port: boolean;
  sea_connections: number[];
  market_hub_id: number;
  control: number; // 0.0 to 1.0
  has_fort: boolean;
  fort_level: number;
  zoc_radius: number;
  buildings: string[];
  plague_infected: boolean;
  plague_intensity: number; // 0.0 to 1.0
  tax_base: number;
}

export class LocationRegistry {
  private locations: Map<number, LocationData> = new Map();

  public register(location: LocationData): void {
    this.locations.set(location.id, location);
  }

  public get(id: number): LocationData | undefined {
    return this.locations.get(id);
  }

  public getAll(): LocationData[] {
    return Array.from(this.locations.values());
  }

  public getTerrainMovementCost(terrain: TerrainType): number {
    switch (terrain) {
      case TerrainType.Farmland: return 1.0;
      case TerrainType.Woods: return 1.3;
      case TerrainType.Hills: return 1.5;
      case TerrainType.Marsh: return 2.2;
      case TerrainType.Mountains: return 2.8;
      case TerrainType.Steppe: return 1.1;
      case TerrainType.Desert: return 2.0;
      case TerrainType.Coast: return 1.0;
      default: return 1.0;
    }
  }

  public applyDevastationDecay(recoveryRate: number = 0.005): void {
    for (const loc of this.locations.values()) {
      if (loc.devastation > 0) {
        loc.devastation = Math.max(0.0, loc.devastation - recoveryRate);
      }
    }
  }
}
