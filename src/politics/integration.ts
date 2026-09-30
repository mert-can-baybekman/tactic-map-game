/**
 * Local Autonomy, Core Justification & Integration Loop Engine
 * Tracks territorial autonomy, scales state extraction vs estate diversion,
 * and advances core integration tasks until full territorial absorption.
 */

export interface LocationAutonomyRecord {
  locationId: number;
  locationName: string;
  countryTag: string;
  isCore: boolean;
  localAutonomy: number; // 0.0 to 100.0%
  autonomyFloor: number; // e.g. 20.0% for newly conquered territory
}

export interface CoreIntegrationTask {
  taskId: string;
  locationId: number;
  territoryName: string;
  countryTag: string;
  progressPct: number;    // 0.0 to 100.0%
  baseSpeedPct: number;   // e.g. 0.50% base per month
  isCompleted: boolean;
  startDate: string;
}

export class TerritorialIntegrationManager {
  private locations: Map<number, LocationAutonomyRecord> = new Map();
  private activeTasks: Map<string, CoreIntegrationTask> = new Map();

  constructor() {
    this.initializeDefaultTerritories();
  }

  private initializeDefaultTerritories(): void {
    // English Core Locations
    this.registerLocation({
      locationId: 1,
      locationName: 'London',
      countryTag: 'ENG',
      isCore: true,
      localAutonomy: 0.0,
      autonomyFloor: 0.0
    });

    this.registerLocation({
      locationId: 2,
      locationName: 'Dover',
      countryTag: 'ENG',
      isCore: true,
      localAutonomy: 5.0,
      autonomyFloor: 0.0
    });

    // English Non-Core Continental Enclave (Calais Pale)
    this.registerLocation({
      locationId: 3,
      locationName: 'Calais',
      countryTag: 'ENG',
      isCore: false,
      localAutonomy: 35.0,
      autonomyFloor: 15.0
    });

    // Disputed Normandy (Rouen)
    this.registerLocation({
      locationId: 4,
      locationName: 'Rouen (Normandy)',
      countryTag: 'FRA',
      isCore: true,
      localAutonomy: 25.0,
      autonomyFloor: 0.0
    });
  }

  public registerLocation(rec: LocationAutonomyRecord): void {
    this.locations.set(rec.locationId, rec);
  }

  public getLocation(locationId: number): LocationAutonomyRecord | undefined {
    return this.locations.get(locationId);
  }

  /**
   * Starts a territorial integration task for a non-core territory (e.g. Integrating Normandy)
   */
  public startIntegrationTask(params: {
    locationId: number;
    territoryName: string;
    countryTag: string;
    startDate?: string;
  }): CoreIntegrationTask {
    const taskId = `integration_${params.locationId}_${params.countryTag}`;
    const task: CoreIntegrationTask = {
      taskId,
      locationId: params.locationId,
      territoryName: params.territoryName,
      countryTag: params.countryTag,
      progressPct: 0.0,
      baseSpeedPct: 0.50,
      isCompleted: false,
      startDate: params.startDate ?? '1350-01-01'
    };

    this.activeTasks.set(taskId, task);
    return task;
  }

  public getTask(taskId: string): CoreIntegrationTask | undefined {
    return this.activeTasks.get(taskId);
  }

  public getAllActiveTasks(): CoreIntegrationTask[] {
    return Array.from(this.activeTasks.values()).filter(t => !t.isCompleted);
  }

  /**
   * Calculates monthly integration advancement:
   * Delta = Base_Speed * (Ruler_Stewardship_Factor + Idea_Modifiers) / (Local_Autonomy_Level)
   */
  public advanceMonthlyIntegrationPass(
    rulerStewardship: number,
    ideaModifiers: number = 0.0,
    onCompleted?: (locId: number, task: CoreIntegrationTask) => void
  ): { advancedTasks: { taskId: string; progress: number; delta: number }[]; completedCount: number } {
    const advancedTasks: { taskId: string; progress: number; delta: number }[] = [];
    let completedCount = 0;

    const stewardshipFactor = Math.max(0.5, rulerStewardship / 50.0);
    const speedMultiplier = stewardshipFactor + ideaModifiers;

    for (const task of this.activeTasks.values()) {
      if (task.isCompleted) continue;

      const loc = this.locations.get(task.locationId);
      const autonomy = loc ? Math.max(15.0, loc.localAutonomy) : 30.0;

      // Integration progress formula
      const delta = (task.baseSpeedPct * speedMultiplier * 100.0) / autonomy;
      task.progressPct = Math.min(100.0, task.progressPct + delta);

      advancedTasks.push({
        taskId: task.taskId,
        progress: task.progressPct,
        delta
      });

      if (task.progressPct >= 100.0) {
        task.isCompleted = true;
        completedCount++;

        // Mark as core territory and drop autonomy floor
        if (loc) {
          loc.isCore = true;
          loc.autonomyFloor = 0.0;
          loc.localAutonomy = Math.max(0.0, loc.localAutonomy - 25.0);
        }

        if (onCompleted) {
          onCompleted(task.locationId, task);
        }
      }
    }

    return { advancedTasks, completedCount };
  }

  /**
   * Calculates state tax extraction vs local estate wealth diversion based on autonomy
   */
  public computeAutonomyTaxSplits(locationId: number, grossTax: number): {
    stateExtractedTax: number;
    estateDivertedTax: number;
  } {
    const loc = this.locations.get(locationId);
    const autonomy = loc ? loc.localAutonomy : 0.0;

    const autonomyFraction = Math.max(0.0, Math.min(1.0, autonomy / 100.0));
    const stateExtractedTax = grossTax * (1.0 - autonomyFraction);
    const estateDivertedTax = grossTax * autonomyFraction;

    return { stateExtractedTax, estateDivertedTax };
  }

  /**
   * Scales manpower recruitment pool by non-autonomy fraction
   */
  public computeAutonomyManpowerExtraction(locationId: number, baseManpower: number): number {
    const loc = this.locations.get(locationId);
    const autonomy = loc ? loc.localAutonomy : 0.0;
    const autonomyFraction = Math.max(0.0, Math.min(1.0, autonomy / 100.0));
    return Math.floor(baseManpower * (1.0 - autonomyFraction));
  }
}
