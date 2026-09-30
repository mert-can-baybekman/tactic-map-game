/**
 * Grand Strategy Engine: Core Type Definitions
 * Designed for Data-Oriented Design & Zero-Cost Type Stripping
 */

export const TerrainType = {
  Farmland: 'Farmland',
  Woods: 'Woods',
  Marsh: 'Marsh',
  Mountains: 'Mountains',
  Steppe: 'Steppe',
  Desert: 'Desert',
  Hills: 'Hills',
  Coast: 'Coast'
} as const;
export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

export const ClimateType = {
  Temperate: 'Temperate',
  Mediterranean: 'Mediterranean',
  Continental: 'Continental',
  Arid: 'Arid',
  Subarctic: 'Subarctic'
} as const;
export type ClimateType = typeof ClimateType[keyof typeof ClimateType];

export const EstateType = {
  Nobility: 'Nobility',
  Clergy: 'Clergy',
  Burghers: 'Burghers',
  Commoners: 'Commoners',
  Tribes: 'Tribes'
} as const;
export type EstateType = typeof EstateType[keyof typeof EstateType];

export const UnitType = {
  PeasantInfantry: 'PeasantInfantry',
  PikeMilitia: 'PikeMilitia',
  Longbowmen: 'Longbowmen',
  Crossbowmen: 'Crossbowmen',
  HeavyCavalry: 'HeavyCavalry',
  LightCavalry: 'LightCavalry',
  BombardArtillery: 'BombardArtillery'
} as const;
export type UnitType = typeof UnitType[keyof typeof UnitType];

export const CombatPosition = {
  FrontRow: 'FrontRow',
  BackRow: 'BackRow',
  LeftFlank: 'LeftFlank',
  RightFlank: 'RightFlank',
  Reserve: 'Reserve'
} as const;
export type CombatPosition = typeof CombatPosition[keyof typeof CombatPosition];

export interface GoodDefinition {
  id: string;
  name: string;
  category: 'raw' | 'manufactured' | 'luxury';
  base_price: number;
  weight_logistics: number;
  elasticity_factor: number;
  needs_category: 'basic' | 'luxury' | 'industrial' | 'military';
  caloric_density: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  type: 'extraction' | 'manufacturing';
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  labor_estate: EstateType;
  labor_quantity: number;
  build_cost_gold: number;
  maintenance_gold: number;
}

export interface CultureDefinition {
  id: string;
  name: string;
  language_family: string;
  base_assimilation_resistance: number;
  tradition_tags: string[];
}

export interface ReligionDefinition {
  id: string;
  name: string;
  group: string;
  fervor: number;
  conversion_resistance: number;
  papal_influence: boolean;
}
