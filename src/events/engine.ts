/**
 * Conditional Trigger Evaluator & Event Resolution Pipeline
 * Scans state on every tick, evaluates multi-variable triggers, and applies atomic mutation payloads.
 */

import type { GameEvent, EventOption, TriggerCondition, ActiveEventNotification } from './types.ts';

export class EventScriptingEngine {
  private registeredEvents: Map<string, GameEvent> = new Map();
  private firedEventIds: Set<string> = new Set();
  public activeEventQueue: ActiveEventNotification[] = [];

  public registerEvent(event: GameEvent): void {
    this.registeredEvents.set(event.id, event);
  }

  public registerEvents(events: GameEvent[]): void {
    for (const e of events) {
      this.registerEvent(e);
    }
  }

  public getEvent(id: string): GameEvent | undefined {
    return this.registeredEvents.get(id);
  }

  /**
   * Scans global state against conditional trigger criteria on Daily / Monthly ticks.
   */
  public evaluateTickTriggers(state: any, dateString: string): ActiveEventNotification[] {
    const newlyFired: ActiveEventNotification[] = [];

    for (const event of this.registeredEvents.values()) {
      if (event.fireOnce && this.firedEventIds.has(event.id)) {
        continue;
      }

      // Check if already in queue
      if (this.activeEventQueue.some(item => item.event.id === event.id)) {
        continue;
      }

      const meetsConditions = this.evaluateAllConditions(event.triggerConditions, state);
      if (meetsConditions) {
        const notification: ActiveEventNotification = {
          event,
          firingDate: dateString
        };
        this.activeEventQueue.push(notification);
        newlyFired.push(notification);

        if (event.fireOnce) {
          this.firedEventIds.add(event.id);
        }
      }
    }

    return newlyFired;
  }

  /**
   * Evaluates individual condition against state slice
   */
  public evaluateCondition(cond: TriggerCondition, state: any): boolean {
    let resolvedValue: any = null;

    if (cond.scope === 'LOCATION' && cond.targetId !== undefined) {
      const loc = state.locations?.find((l: any) => l.id === cond.targetId);
      if (!loc) return false;
      resolvedValue = loc[cond.field];
    } else if (cond.scope === 'ESTATE' && cond.targetId !== undefined) {
      const estate = state.estates?.find((e: any) => e.type === cond.targetId);
      if (!estate) return false;
      resolvedValue = estate[cond.field];
    } else if (cond.scope === 'CHARACTER') {
      resolvedValue = state.ruler?.[cond.field];
    } else {
      // Global scope
      resolvedValue = state[cond.field];
    }

    if (resolvedValue === undefined || resolvedValue === null) {
      return false;
    }

    switch (cond.operator) {
      case 'GREATER_THAN':
        return Number(resolvedValue) > Number(cond.value);
      case 'LESS_THAN':
        return Number(resolvedValue) < Number(cond.value);
      case 'EQUALS':
        return resolvedValue === cond.value;
      case 'NOT_EQUALS':
        return resolvedValue !== cond.value;
      case 'IN_RANGE':
        if (Array.isArray(cond.value) && cond.value.length === 2) {
          const num = Number(resolvedValue);
          return num >= Number(cond.value[0]) && num <= Number(cond.value[1]);
        }
        return false;
      default:
        return false;
    }
  }

  public evaluateAllConditions(conditions: TriggerCondition[], state: any): boolean {
    for (const cond of conditions) {
      if (!this.evaluateCondition(cond, state)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolves a fired event with a chosen option and executes atomic state mutation
   */
  public resolveEvent(eventId: string, optionId: string, state: any): boolean {
    const eventIndex = this.activeEventQueue.findIndex(item => item.event.id === eventId);
    if (eventIndex === -1) return false;

    const event = this.activeEventQueue[eventIndex].event;
    const option = event.options.find(o => o.id === optionId);
    if (!option) return false;

    // Apply Mutation Payload
    this.applyMutationPayload(option.mutationPayload, state);

    // Remove from queue
    this.activeEventQueue.splice(eventIndex, 1);
    return true;
  }

  /**
   * Mutates engine state variables directly
   */
  public applyMutationPayload(payload: any, state: any): void {
    if (!payload) return;

    if (payload.treasuryGoldDelta !== undefined) {
      state.crownTreasury = (state.crownTreasury || 0) + payload.treasuryGoldDelta;
    }
    if (payload.manpowerDelta !== undefined) {
      state.manpower = Math.max(0, (state.manpower || 0) + payload.manpowerDelta);
    }

    // Estate loyalties mutation
    if (payload.estateLoyaltyDeltas && state.estates) {
      for (const [estateType, delta] of Object.entries(payload.estateLoyaltyDeltas)) {
        const est = state.estates.find((e: any) => e.type === estateType);
        if (est) {
          est.loyalty = Math.max(0, Math.min(100, est.loyalty + Number(delta)));
        }
      }
    }

    // Location control mutation
    if (payload.locationControlDeltas && state.locations) {
      for (const [locId, delta] of Object.entries(payload.locationControlDeltas)) {
        const loc = state.locations.find((l: any) => l.id === Number(locId));
        if (loc) {
          loc.control = Math.max(0.01, Math.min(1.0, loc.control + Number(delta)));
        }
      }
    }

    // Location devastation mutation
    if (payload.locationDevastationDeltas && state.locations) {
      for (const [locId, delta] of Object.entries(payload.locationDevastationDeltas)) {
        const loc = state.locations.find((l: any) => l.id === Number(locId));
        if (loc) {
          loc.devastation = Math.max(0.0, Math.min(1.0, loc.devastation + Number(delta)));
        }
      }
    }

    // Charter toggles
    if (payload.charterToggles && state.charters) {
      for (const [charterKey, activeState] of Object.entries(payload.charterToggles)) {
        if (state.charters[charterKey]) {
          state.charters[charterKey].active = Boolean(activeState);
        }
      }
    }
  }
}
