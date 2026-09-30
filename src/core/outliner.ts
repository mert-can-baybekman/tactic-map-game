/**
 * Decoupled Outliner Registry & Live Status Pipeline
 * Standard Project Caesar Collapsible Right-Hand Outliner
 */

export interface OutlinerActionItem {
  id: string;
  category: 'diplomacy' | 'crisis' | 'military' | 'court';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expires_in_days?: number;
}

export interface OutlinerMilitaryItem {
  id: string;
  name: string;
  is_naval: boolean;
  regiment_or_ship_count: number;
  total_manpower: number;
  commander_name?: string;
  status: 'idle' | 'marching' | 'in_combat' | 'besieging' | 'starving';
  current_location_name: string;
  target_location_name?: string;
  morale_percentage: number;
}

export interface OutlinerIntegrationTask {
  id: string;
  name: string;
  category: 'province_integration' | 'dependency_annexation' | 'conversion' | 'colonization';
  progress_percentage: number;
  monthly_growth: number;
  estimated_completion_year: number;
}

export interface OutlinerEstateSummary {
  estateName: string;
  loyalty: number;
  power: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface OutlinerDataPayload {
  urgentActions: OutlinerActionItem[];
  militaryForces: OutlinerMilitaryItem[];
  governmentTasks: OutlinerIntegrationTask[];
  estateSummaries: OutlinerEstateSummary[];
}

export class OutlinerRegistryEngine {
  private activeActions: Map<string, OutlinerActionItem> = new Map();
  private activeTasks: Map<string, OutlinerIntegrationTask> = new Map();

  constructor() {
    this.initializeDefaultOutlinerTasks();
  }

  private initializeDefaultOutlinerTasks(): void {
    this.activeActions.set('act_succession', {
      id: 'act_succession',
      category: 'court',
      urgency: 'high',
      title: 'Disputed Heir in Flanders',
      description: 'The Count of Flanders has no direct male heir. Royal marriage provides Personal Union claim.',
      expires_in_days: 120
    });

    this.activeActions.set('act_privilege_demand', {
      id: 'act_privilege_demand',
      category: 'diplomacy',
      urgency: 'medium',
      title: 'Burgher Guild Petition',
      description: 'Merchant guilds demand monopoly charters over wool exports in Calais.'
    });

    this.activeTasks.set('task_normandy', {
      id: 'task_normandy',
      name: 'Integrating Duchy of Normandy',
      category: 'dependency_annexation',
      progress_percentage: 42.5,
      monthly_growth: 0.35,
      estimated_completion_year: 1358
    });

    this.activeTasks.set('task_calais_walls', {
      id: 'task_calais_walls',
      name: 'Strengthening Bastion of Calais',
      category: 'province_integration',
      progress_percentage: 68.2,
      monthly_growth: 1.2,
      estimated_completion_year: 1352
    });
  }

  public registerAction(action: OutlinerActionItem): void {
    this.activeActions.set(action.id, action);
  }

  public removeAction(actionId: string): void {
    this.activeActions.delete(actionId);
  }

  public registerIntegrationTask(task: OutlinerIntegrationTask): void {
    this.activeTasks.set(task.id, task);
  }

  public updateTaskProgress(taskId: string, delta: number): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.progress_percentage = Math.min(100.0, task.progress_percentage + delta);
    }
  }

  /**
   * Generates decoupled snapshot payload for UI outliner rendering
   */
  public generateOutlinerSnapshot(
    armies: {
      id: string;
      name: string;
      manpower: number;
      regiments: number;
      status: 'idle' | 'marching' | 'in_combat' | 'besieging' | 'starving';
      locationName: string;
      morale: number;
      commander?: string;
    }[],
    estates: { type: string; loyalty: number; power: number }[]
  ): OutlinerDataPayload {
    const militaryForces: OutlinerMilitaryItem[] = armies.map(a => ({
      id: a.id,
      name: a.name,
      is_naval: false,
      regiment_or_ship_count: a.regiments,
      total_manpower: a.manpower,
      commander_name: a.commander || 'Crown Marshal',
      status: a.status,
      current_location_name: a.locationName,
      morale_percentage: a.morale
    }));

    const estateSummaries: OutlinerEstateSummary[] = estates.map(e => ({
      estateName: e.type,
      loyalty: e.loyalty,
      power: e.power,
      trend: e.loyalty > 55 ? 'rising' : (e.loyalty < 45 ? 'falling' : 'stable')
    }));

    return {
      urgentActions: Array.from(this.activeActions.values()),
      militaryForces,
      governmentTasks: Array.from(this.activeTasks.values()),
      estateSummaries
    };
  }
}
