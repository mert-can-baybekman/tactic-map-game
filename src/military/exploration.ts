/**
 * Terra Incognita Exploration & Naval Charting Matrix
 * Subsystem: /src/military/exploration.ts
 */

export interface ExplorerCharacter {
  id: string;
  name: string;
  intrigue: number; // 1.0 to 10.0
  fleetSpeed: number; // 1.0 to 5.0
}

export interface ExplorationExpedition {
  expeditionId: string;
  countryTag: string;
  fleetId: number;
  currentLocationId: number;
  targetTerraIncognitaNodeId: number;
  explorer: ExplorerCharacter;
  distanceFromNearestPort: number;
  chartingProgress: number; // 0.0 to 100.0
  isCompleted: boolean;
  prestigeGenerated: number;
}

export interface TerraIncognitaNode {
  nodeId: number;
  name: string;
  isTerraIncognita: boolean;
  adjacentNodeIds: number[];
  revealedByTag?: string;
}

export class ExplorationExpeditionManager {
  private terraIncognitaNodes: Map<number, TerraIncognitaNode> = new Map();
  private expeditions: Map<string, ExplorationExpedition> = new Map();
  private prestigePool: Map<string, number> = new Map();

  public registerTerraIncognitaNode(
    nodeId: number,
    name: string,
    adjacentNodeIds: number[]
  ): void {
    this.terraIncognitaNodes.set(nodeId, {
      nodeId,
      name,
      isTerraIncognita: true,
      adjacentNodeIds
    });
  }

  public isTerraIncognita(nodeId: number): boolean {
    const node = this.terraIncognitaNodes.get(nodeId);
    return node ? node.isTerraIncognita : false;
  }

  public createExpedition(
    countryTag: string,
    fleetId: number,
    startLocationId: number,
    targetNodeId: number,
    explorer: ExplorerCharacter,
    distanceFromNearestPort: number = 50.0
  ): ExplorationExpedition {
    const expeditionId = `expedition_${countryTag}_${fleetId}_target_${targetNodeId}`;
    const expedition: ExplorationExpedition = {
      expeditionId,
      countryTag,
      fleetId,
      currentLocationId: startLocationId,
      targetTerraIncognitaNodeId: targetNodeId,
      explorer,
      distanceFromNearestPort,
      chartingProgress: 0.0,
      isCompleted: false,
      prestigeGenerated: 0.0
    };

    this.expeditions.set(expeditionId, expedition);
    return expedition;
  }

  /**
   * Daily Exploration & Charting Progression Tick:
   * Exploration_Progress_Delta = Base_Speed * (Explorer_Intrigue + Fleet_Speed) * e^(-Distance_From_Nearest_Port / 100)
   */
  public processDailyChartTick(
    expeditionId: string,
    baseSpeed: number = 2.0
  ): {
    progressDelta: number;
    currentProgress: number;
    completed: boolean;
    revealedNodeIds: number[];
    prestigeAward: number;
  } {
    const expedition = this.expeditions.get(expeditionId);
    if (!expedition || expedition.isCompleted) {
      return {
        progressDelta: 0,
        currentProgress: expedition?.chartingProgress ?? 100,
        completed: expedition?.isCompleted ?? false,
        revealedNodeIds: [],
        prestigeAward: 0
      };
    }

    // Decay factor based on distance from friendly harbor
    const decay = Math.exp(-expedition.distanceFromNearestPort / 100.0);
    const progressDelta = Number((baseSpeed * (expedition.explorer.intrigue + expedition.explorer.fleetSpeed) * decay).toFixed(2));

    expedition.chartingProgress = Math.min(100.0, expedition.chartingProgress + progressDelta);

    const revealedNodeIds: number[] = [];
    let prestigeAward = 0;

    if (expedition.chartingProgress >= 100.0) {
      expedition.isCompleted = true;
      prestigeAward = 25.0; // Significant prestige for unlocking terra incognita

      // Reveal target node
      const targetNode = this.terraIncognitaNodes.get(expedition.targetTerraIncognitaNodeId);
      if (targetNode) {
        targetNode.isTerraIncognita = false;
        targetNode.revealedByTag = expedition.countryTag;
        revealedNodeIds.push(targetNode.nodeId);

        // Also reveal adjacent coastal/ocean nodes
        for (const adjId of targetNode.adjacentNodeIds) {
          const adjNode = this.terraIncognitaNodes.get(adjId);
          if (adjNode && adjNode.isTerraIncognita) {
            adjNode.isTerraIncognita = false;
            adjNode.revealedByTag = expedition.countryTag;
            revealedNodeIds.push(adjNode.nodeId);
          }
        }
      }

      expedition.prestigeGenerated += prestigeAward;
      const currentPrestige = this.prestigePool.get(expedition.countryTag) ?? 0;
      this.prestigePool.set(expedition.countryTag, currentPrestige + prestigeAward);
    }

    return {
      progressDelta,
      currentProgress: expedition.chartingProgress,
      completed: expedition.isCompleted,
      revealedNodeIds,
      prestigeAward
    };
  }

  public getAccumulatedPrestige(countryTag: string): number {
    return this.prestigePool.get(countryTag) ?? 0;
  }

  public getExpedition(expeditionId: string): ExplorationExpedition | undefined {
    return this.expeditions.get(expeditionId);
  }
}
