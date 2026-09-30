/**
 * Event-Driven Scripting & Trigger Engine: Types & Data Structures
 * Paradox / Project Caesar standard event object model and conditional triggers.
 */

export type TriggerOperator = 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'NOT_EQUALS' | 'IN_RANGE';

export interface TriggerCondition {
  field: string;
  operator: TriggerOperator;
  value: number | string | boolean;
  scope?: 'GLOBAL' | 'LOCATION' | 'ESTATE' | 'CHARACTER';
  targetId?: number | string;
}

export interface StateMutationPayload {
  treasuryGoldDelta?: number;
  manpowerDelta?: number;
  stabilityDelta?: number;
  legitimacyDelta?: number;
  estateLoyaltyDeltas?: Record<string, number>; // e.g. { Nobility: -15.0, Burghers: 10.0 }
  locationControlDeltas?: Record<number, number>; // Location ID -> Delta
  locationDevastationDeltas?: Record<number, number>;
  charterToggles?: Record<string, boolean>;
  customScriptHook?: string;
}

export interface EventOption {
  id: string;
  textLocalizationKey: string;
  tooltipText: string;
  mutationPayload: StateMutationPayload;
  aiWeightBase: number; // Base utility weight 0.0 - 1.0
  aiModifiers?: {
    rulerTrait?: string;
    weightMultiplier: number;
  }[];
}

export interface GameEvent {
  id: string;
  titleLocalizationKey: string;
  descriptionLocalizationKey: string;
  pictureAssetRef: string;
  category: 'DOMESTIC' | 'EPIDEMIC' | 'DIPLOMATIC' | 'MILITARY' | 'ESTATE';
  triggerConditions: TriggerCondition[];
  options: EventOption[];
  meanTimeToHappenDays?: number; // MTTH
  fireOnce?: boolean;
  hasFired?: boolean;
}

export interface ActiveEventNotification {
  event: GameEvent;
  scopeLocationId?: number;
  scopeEstateType?: string;
  firingDate: string;
}
