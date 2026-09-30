/**
 * Minor Tag Diplomatic Absorption & Annexation Core
 * Subsystem: /src/politics/diplomacy/annexation.ts
 */

export interface AnnexationTask {
  taskId: string;
  liegeTag: string;
  subjectTag: string;
  progressPercentage: number; // 0.0 to 100.0%
  isCompleted: boolean;
  subjectLocationIds: number[];
  monthlyDiplomaticCost: number;
}

export interface AbsorbedLocationEntry {
  locationId: number;
  newOwnerTag: string;
  localAutonomyFloor: number; // Fixed 0.60 (60%) floor
}

export interface AbsorptionMemoryPayload {
  liegeTag: string;
  annexedSubjectTag: string;
  absorbedLocations: AbsorbedLocationEntry[];
  purgedFromActiveAI: boolean;
}

export class DiplomaticAnnexationManager {
  private tasks: Map<string, AnnexationTask> = new Map();
  private completedPayloads: Map<string, AbsorptionMemoryPayload> = new Map();

  /**
   * Evaluates if peaceful annexation can be initiated:
   * Requires: Liberty_Desire < 30.0% and Bilateral Relations >= 100.0
   */
  public canInitiateAnnexation(libertyDesire: number, relations: number): boolean {
    return libertyDesire < 30.0 && relations >= 100.0;
  }

  public startAnnexation(
    liegeTag: string,
    subjectTag: string,
    subjectLocationIds: number[],
    libertyDesire: number,
    relations: number
  ): AnnexationTask | null {
    if (!this.canInitiateAnnexation(libertyDesire, relations)) {
      return null;
    }

    const taskId = `annex_${liegeTag}_${subjectTag}`;
    const task: AnnexationTask = {
      taskId,
      liegeTag,
      subjectTag,
      progressPercentage: 0.0,
      isCompleted: false,
      subjectLocationIds: [...subjectLocationIds],
      monthlyDiplomaticCost: 2.0 // Diplomatic capacity draw
    };

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Monthly Annexation Progression Pass:
   * Progress increments proportionally to Diplomatic Reputation and low Liberty Desire.
   * If Liberty Desire spikes >= 50.0%, integration pauses.
   * Upon 100% completion:
   * - Fires Memory Fusion Loop: reassigns Owner_Tag_ID to liege
   * - Imposes Local Autonomy Shock: sets local autonomy to 60% floor
   * - Purges minor tag from active AI calculations to preserve L1/L2 cache performance
   */
  public processMonthlyAnnexationTick(
    taskId: string,
    diplomaticReputation: number = 2.0,
    currentLibertyDesire: number = 20.0
  ): {
    progress: number;
    completed: boolean;
    payload?: AbsorptionMemoryPayload;
  } {
    const task = this.tasks.get(taskId);
    if (!task || task.isCompleted) {
      return { progress: task?.progressPercentage ?? 100.0, completed: task?.isCompleted ?? false };
    }

    // High liberty desire halts progress
    if (currentLibertyDesire >= 50.0) {
      return { progress: task.progressPercentage, completed: false };
    }

    const speed = 1.5 * diplomaticReputation * (1.0 - (currentLibertyDesire / 100.0));
    task.progressPercentage = Number(Math.min(100.0, task.progressPercentage + speed).toFixed(2));

    if (task.progressPercentage >= 100.0) {
      task.isCompleted = true;

      // Memory Fusion Loop: Absorbs locations and sets fixed 60% autonomy floor
      const absorbedLocations: AbsorbedLocationEntry[] = task.subjectLocationIds.map(locId => ({
        locationId: locId,
        newOwnerTag: task.liegeTag,
        localAutonomyFloor: 0.60 // Fixed 60% autonomy floor
      }));

      const payload: AbsorptionMemoryPayload = {
        liegeTag: task.liegeTag,
        annexedSubjectTag: task.subjectTag,
        absorbedLocations,
        purgedFromActiveAI: true // Flags minor tag for purge from heavy AI actor arrays
      };

      this.completedPayloads.set(task.subjectTag, payload);

      return {
        progress: 100.0,
        completed: true,
        payload
      };
    }

    return {
      progress: task.progressPercentage,
      completed: false
    };
  }

  public getAnnexationTask(taskId: string): AnnexationTask | undefined {
    return this.tasks.get(taskId);
  }

  public getAbsorptionPayload(subjectTag: string): AbsorptionMemoryPayload | undefined {
    return this.completedPayloads.get(subjectTag);
  }

  public getActiveTasks(): AnnexationTask[] {
    return Array.from(this.tasks.values()).filter(t => !t.isCompleted);
  }
}
