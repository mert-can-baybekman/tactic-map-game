/**
 * Strategic AI Decision Matrix & Utility AI Core: Types & Models
 * Provides Desirability Scoring (0.0 to 1.0), Strategic War Goals, and Candidate Action schemas.
 */

export type AIArchetype = 'MILITARIST' | 'MERCHANT_CAPITALIST' | 'FEUDAL_TRADITIONALIST' | 'DIPLOMAT';

export interface AIDecisionContext {
  countryTag: string;
  treasuryGold: number;
  monthlyIncome: number;
  manpowerCurrent: number;
  manpowerMax: number;
  rulerTraits: string[];
  rulerMartial: number;
  rulerStewardship: number;
  estateLoyalties: Record<string, number>; // e.g. { Nobility: 65.3, Burghers: 56.7 }
  marketPrices: Record<string, { price: number; supply: number; demand: number }>;
  adjacentLocations: {
    id: number;
    name: string;
    country: string;
    control: number;
    devastation: number;
    isEnclave: boolean;
  }[];
}

export interface StrategicWarGoal {
  goalId: string;
  type: 'CONQUEST_ENCLAVE' | 'RECONQUEST_DE_JURE' | 'TRADE_EMBARGO_REVERSAL';
  targetLocationId: number;
  targetCountryTag: string;
  desirabilityScore: number;
  pathfindingRoute: number[];
  assignedLevySize: number;
}

export interface AIActionCandidate {
  id: string;
  category: 'ECONOMIC_CONSTRUCTION' | 'MILITARY_WAR_GOAL' | 'EVENT_CHOICE' | 'ESTATE_CONCESSION';
  title: string;
  desirabilityScore: number; // 0.0 to 1.0
  actionPayload: any;
}
