/**
 * Multi-Stage Branching Event Chains Engine
 * Manages stateful storylines, persistent memory variables, and dynamic condition-driven stage progression.
 */

import type { GameEvent, EventOption } from './types.ts';

export interface EventChainStage {
  stageIndex: number;
  stageId: string;
  event: GameEvent;
  // Dynamic branching evaluator function determining which branch or next event to trigger
  branchingEvaluator: (
    memory: Record<string, any>,
    worldState: any
  ) => { nextStageId?: string; nextStageIndex?: number; chainCompleted?: boolean };
}

export interface ActiveEventChain {
  chainId: string;
  titleKey: string;
  descriptionKey: string;
  currentStageIndex: number;
  currentStageId: string;
  globalCooldownTicks: number;
  isCompleted: boolean;
  startDate: string;
  // Dynamic key-value storage dictionary remembering previous player/AI choices
  memoryVariables: Record<string, any>;
  stages: Map<string, EventChainStage>;
  activeEvent: GameEvent | null;
}

export class EventChainManager {
  private activeChains: Map<string, ActiveEventChain> = new Map();
  private completedChainHistory: ActiveEventChain[] = [];

  public startChain(chainDef: {
    chainId: string;
    titleKey: string;
    descriptionKey: string;
    initialStageId: string;
    stages: EventChainStage[];
    startDate?: string;
  }): ActiveEventChain {
    const stagesMap = new Map<string, EventChainStage>();
    for (const stage of chainDef.stages) {
      stagesMap.set(stage.stageId, stage);
    }

    const firstStage = stagesMap.get(chainDef.initialStageId);
    if (!firstStage) {
      throw new Error(`Initial stage ${chainDef.initialStageId} not found in chain ${chainDef.chainId}`);
    }

    const chain: ActiveEventChain = {
      chainId: chainDef.chainId,
      titleKey: chainDef.titleKey,
      descriptionKey: chainDef.descriptionKey,
      currentStageIndex: firstStage.stageIndex,
      currentStageId: firstStage.stageId,
      globalCooldownTicks: 0,
      isCompleted: false,
      startDate: chainDef.startDate || '1350-01-01',
      memoryVariables: {},
      stages: stagesMap,
      activeEvent: firstStage.event
    };

    this.activeChains.set(chain.chainId, chain);
    return chain;
  }

  public getActiveChain(chainId: string): ActiveEventChain | undefined {
    return this.activeChains.get(chainId);
  }

  public getAllActiveChains(): ActiveEventChain[] {
    return Array.from(this.activeChains.values());
  }

  /**
   * Resolves current stage event choice:
   * 1. Records player/AI decision into memoryVariables
   * 2. Executes mutation payload
   * 3. Sets cooldown and prepares next evaluation
   */
  public selectOptionAndAdvance(
    chainId: string,
    optionId: string,
    worldState: any,
    decisionMemoryKey?: string,
    decisionMemoryValue?: any
  ): { success: boolean; nextEvent?: GameEvent; chainCompleted: boolean } {
    const chain = this.activeChains.get(chainId);
    if (!chain || chain.isCompleted || !chain.activeEvent) {
      return { success: false, chainCompleted: true };
    }

    const currentStage = chain.stages.get(chain.currentStageId);
    if (!currentStage) {
      return { success: false, chainCompleted: true };
    }

    const chosenOption = chain.activeEvent.options.find(o => o.id === optionId);
    if (!chosenOption) {
      return { success: false, chainCompleted: false };
    }

    // 1. Record decision in dynamic memory dictionary
    if (decisionMemoryKey) {
      chain.memoryVariables[decisionMemoryKey] = decisionMemoryValue !== undefined ? decisionMemoryValue : true;
    }
    chain.memoryVariables[`last_chosen_option_stage_${chain.currentStageIndex}`] = optionId;

    // 2. Apply option payload to world state
    this.applyOptionPayload(chosenOption, worldState);

    // 3. Clear active event and set cooldown ticks before next branching evaluation
    chain.activeEvent = null;
    chain.globalCooldownTicks = 30; // 30 daily ticks cooldown between chain beats

    // 4. Run branching evaluator to queue next stage or mark completion
    const branchResult = currentStage.branchingEvaluator(chain.memoryVariables, worldState);

    if (branchResult.chainCompleted || !branchResult.nextStageId) {
      chain.isCompleted = true;
      this.completedChainHistory.push(chain);
      this.activeChains.delete(chainId);
      return { success: true, chainCompleted: true };
    }

    const nextStage = chain.stages.get(branchResult.nextStageId);
    if (nextStage) {
      chain.currentStageId = nextStage.stageId;
      chain.currentStageIndex = branchResult.nextStageIndex ?? nextStage.stageIndex;
      chain.activeEvent = nextStage.event;
      return { success: true, nextEvent: nextStage.event, chainCompleted: false };
    }

    chain.isCompleted = true;
    this.completedChainHistory.push(chain);
    this.activeChains.delete(chainId);
    return { success: true, chainCompleted: true };
  }

  /**
   * Monthly / Daily Tick Pass:
   * Decrements cooldown ticks and checks if queued branch events should pop up.
   */
  public evaluateChainsTick(worldState: any): GameEvent[] {
    const firingEvents: GameEvent[] = [];

    for (const chain of this.activeChains.values()) {
      if (chain.isCompleted) continue;

      if (chain.globalCooldownTicks > 0) {
        chain.globalCooldownTicks--;
      }

      if (chain.globalCooldownTicks === 0 && chain.activeEvent) {
        firingEvents.push(chain.activeEvent);
      }
    }

    return firingEvents;
  }

  private applyOptionPayload(option: EventOption, state: any): void {
    const p = option.mutationPayload;
    if (p.treasuryGoldDelta) {
      state.crownTreasury = (state.crownTreasury || 0) + p.treasuryGoldDelta;
    }
    if (p.manpowerDelta) {
      state.manpower = (state.manpower || 0) + p.manpowerDelta;
    }
    if (p.stabilityDelta) {
      state.crownPower = Math.min(1.0, Math.max(0.0, (state.crownPower || 0) + p.stabilityDelta));
    }
    if (p.estateLoyaltyDeltas && Array.isArray(state.estates)) {
      for (const [estateName, delta] of Object.entries(p.estateLoyaltyDeltas)) {
        const est = state.estates.find((e: any) => e.type === estateName);
        if (est) {
          est.loyalty = Math.max(0.0, Math.min(100.0, est.loyalty + delta));
        }
      }
    }
    if (p.locationControlDeltas && Array.isArray(state.locations)) {
      for (const [locId, delta] of Object.entries(p.locationControlDeltas)) {
        const loc = state.locations.find((l: any) => l.id === Number(locId));
        if (loc) {
          loc.control = Math.max(0.0, Math.min(1.0, loc.control + delta));
        }
      }
    }
  }
}
