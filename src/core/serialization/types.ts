/**
 * High-Performance State Persistence & Serialization: Types & Schemas
 * Full deep world state mapping for Project Caesar standard save files.
 */

export interface SaveFileHeader {
  saveEngineVersion: string;
  gameTitle: string;
  saveTimestamp: number;
  calendarDate: { year: number; month: number; day: number };
  playerCountryTag: string;
  checksum: string;
}

export interface SavedLocationState {
  id: number;
  name: string;
  country: string;
  terrain: string;
  control: number;
  devastation: number;
  infrastructure: number;
  tax_base: number;
  plague_infected: boolean;
  nobleDominated: boolean;
  buildings: string[];
  pops: {
    estate: string;
    subCulture: string;
    size: number;
    wealth: number;
    unrest: number;
  }[];
}

export interface SavedCharacterState {
  id: number;
  firstName: string;
  dynasty: string;
  age: number;
  sex: string;
  culture: string;
  religion: string;
  health: number;
  isAlive: boolean;
  attributes: {
    martial: number;
    diplomacy: number;
    stewardship: number;
    learning: number;
    intrigue: number;
  };
  traits: { id: string; name: string; [key: string]: any }[];
  isMarried: boolean;
  spouseName: string | null;
  isGeneral: boolean;
  isCabinetAdvisor: boolean;
}

export interface SavedOutlinerState {
  normandyIntegration: number;
  calaisBastion: number;
  alerts: { id: string; title: string; desc: string }[];
  armies: { id: string; name: string; size: number; commander: string; location: string; morale: number }[];
}

export interface SavedWorldState {
  header: SaveFileHeader;
  calendar: { year: number; month: number; day: number };
  crownTreasury: number;
  monthlyTaxIncome: number;
  monthlyMaintenance: number;
  manpower: number;
  maxManpower: number;
  crownPower: number;
  channelBlockaded: boolean;
  charters: Record<string, { id: string; name: string; active: boolean; [key: string]: any }>;
  ruler: SavedCharacterState;
  heir: { id: number; firstName: string; dynasty: string; age: number; claim: number; [key: string]: any };
  estates: { type: string; wealth: number; loyalty: number; power: number }[];
  locations: SavedLocationState[];
  outliner: SavedOutlinerState;
  marketGoods: Record<string, { price: number; base: number; supply: number; demand: number }>;
}
