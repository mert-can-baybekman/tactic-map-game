/**
 * Procedural Branching Mission Tree Contract Engine
 * Implements state-reactive branching, mutual exclusivity locks, deep state validation,
 * and immediate state reward payloads.
 */

export type MissionNodeStatus = 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'MUTUALLY_EXCLUSIVE_LOCKED' | 'HIDDEN';

export interface DeepStateQueries {
  checkOwnsLocationChain: (state: any, locationIds: number[]) => boolean;
  checkTreasuryReserve: (state: any, minTreasury: number) => boolean;
  checkActiveTradeDomination: (state: any, marketNode: string, minShare: number) => boolean;
}

export interface MissionNodeContract {
  nodeId: string;
  treeId: string;
  titleKey: string;
  descriptionKey: string;
  parentNodesArray: string[]; // Prerequisites
  isMutuallyExclusiveWith: string[]; // Competing mission paths
  branchCondition?: (state: any) => boolean; // Determines dynamic reveal/hide
  requirementsEvaluationBlock: (state: any, queries: DeepStateQueries) => boolean;
  immediateRewardsPayload: (state: any) => void;
  status: MissionNodeStatus;
  completedDate?: string;
}

export interface BranchingMissionTree {
  id: string;
  title: string;
  rulerDynastyTarget?: string;
  nodes: Map<string, MissionNodeContract>;
}

export class ProceduralMissionTreeEngine {
  private trees: Map<string, BranchingMissionTree> = new Map();

  public queries: DeepStateQueries = {
    checkOwnsLocationChain: (state: any, locationIds: number[]): boolean => {
      const locations = state.locations || [];
      return locationIds.every(id => locations.some((l: any) => l.id === id && l.country === (state.playerCountry || 'ENG')));
    },
    checkTreasuryReserve: (state: any, minTreasury: number): boolean => {
      return (state.crownTreasury || 0) >= minTreasury;
    },
    checkActiveTradeDomination: (state: any, _marketNode: string, minShare: number): boolean => {
      // Check trade volume or crown power share
      return (state.crownPower || 0) >= minShare;
    }
  };

  constructor() {
    this.registerBranchingHistoricalTrees();
  }

  public registerTree(tree: BranchingMissionTree): void {
    this.trees.set(tree.id, tree);
  }

  public getTree(treeId: string): BranchingMissionTree | undefined {
    return this.trees.get(treeId);
  }

  public getAllTrees(): BranchingMissionTree[] {
    return Array.from(this.trees.values());
  }

  /**
   * State-Reactive Branching Matrix Pass (Monthly Tick):
   * Evaluates branch conditions, mutual exclusivity, prerequisites, and reveals/hides branches dynamically.
   */
  public evaluateMonthlyMissionMatrix(state: any): { newlyAvailable: string[]; branchedChanges: string[] } {
    const newlyAvailable: string[] = [];
    const branchedChanges: string[] = [];

    for (const tree of this.trees.values()) {
      for (const node of tree.nodes.values()) {
        // If already completed or mutually exclusively locked, preserve state
        if (node.status === 'COMPLETED' || node.status === 'MUTUALLY_EXCLUSIVE_LOCKED') {
          continue;
        }

        // 1. Dynamic Branch Condition Check (e.g. England losing Calais hides/locks Continental branch)
        if (node.branchCondition && !node.branchCondition(state)) {
          if (node.status !== 'HIDDEN') {
            node.status = 'HIDDEN';
            branchedChanges.push(`Node ${node.nodeId} hidden due to failed branch condition.`);
          }
          continue;
        }

        // 2. Check Mutual Exclusivity: If any competing node was completed, this node is locked permanently
        const exclusiveNodeCompleted = node.isMutuallyExclusiveWith.some(competingId => {
          const competing = tree.nodes.get(competingId);
          return competing && competing.status === 'COMPLETED';
        });

        if (exclusiveNodeCompleted) {
          node.status = 'MUTUALLY_EXCLUSIVE_LOCKED';
          branchedChanges.push(`Node ${node.nodeId} locked due to mutual exclusivity.`);
          continue;
        }

        // 3. Parent Node Prerequisites Check
        const allParentsCompleted = node.parentNodesArray.every(parentId => {
          const parent = tree.nodes.get(parentId);
          return parent && parent.status === 'COMPLETED';
        });

        if (!allParentsCompleted) {
          node.status = 'LOCKED';
          continue;
        }

        // If locked and parents are completed, unlock to AVAILABLE
        if (node.status === 'LOCKED' || node.status === 'HIDDEN') {
          node.status = 'AVAILABLE';
          newlyAvailable.push(node.nodeId);
        }
      }
    }

    return { newlyAvailable, branchedChanges };
  }

  /**
   * Completes a mission node:
   * 1. Validates requirementsEvaluationBlock
   * 2. Executes immediateRewardsPayload
   * 3. Locks any mutually exclusive rival nodes permanently
   */
  public completeMissionNode(treeId: string, nodeId: string, state: any, dateStr: string = '1350-01-01'): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;

    const node = tree.nodes.get(nodeId);
    if (!node || node.status !== 'AVAILABLE') return false;

    // Deep state requirement validation
    const passed = node.requirementsEvaluationBlock(state, this.queries);
    if (!passed) return false;

    // Execute Immediate Rewards Payload
    node.immediateRewardsPayload(state);
    node.status = 'COMPLETED';
    node.completedDate = dateStr;

    // Lock mutually exclusive competing paths permanently
    for (const rivalId of node.isMutuallyExclusiveWith) {
      const rival = tree.nodes.get(rivalId);
      if (rival && rival.status !== 'COMPLETED') {
        rival.status = 'MUTUALLY_EXCLUSIVE_LOCKED';
      }
    }

    return true;
  }

  /**
   * Registers historical branching tree:
   * Continental Expansion Branch vs. Defensive Home Island Hegemony Branch
   */
  private registerBranchingHistoricalTrees(): void {
    const tree: BranchingMissionTree = {
      id: 'tree_edward_branching_dynasty',
      title: "King Edward III: Continental Hegemony & Dynastic Destinies",
      rulerDynastyTarget: 'Plantagenet',
      nodes: new Map()
    };

    // Node 0: Channel Maritime Outpost (Common Origin)
    const node0: MissionNodeContract = {
      nodeId: 'mission_channel_outpost',
      treeId: tree.id,
      titleKey: "Channel Maritime Outpost",
      descriptionKey: "Ensure royal naval supply route between London and Dover.",
      parentNodesArray: [],
      isMutuallyExclusiveWith: [],
      requirementsEvaluationBlock: (state, q) => q.checkOwnsLocationChain(state, [1, 2]),
      immediateRewardsPayload: (state) => {
        state.crownTreasury = (state.crownTreasury || 0) + 150;
        if (state.estates) {
          const burghers = state.estates.find((e: any) => e.type === 'Burghers');
          if (burghers) burghers.loyalty = Math.min(100, burghers.loyalty + 10);
        }
      },
      status: 'AVAILABLE'
    };

    // BRANCH A (Offensive): Claim the Crown of France
    // Condition: England MUST own Calais. If Calais is lost to France/Rebels, this branch hides/locks!
    const nodeA1: MissionNodeContract = {
      nodeId: 'mission_claim_french_crown',
      treeId: tree.id,
      titleKey: "Claim the French Crown",
      descriptionKey: "Assert Plantagenet sovereignty over the French mainland.",
      parentNodesArray: ['mission_channel_outpost'],
      isMutuallyExclusiveWith: ['mission_fortify_home_ports'], // Mutually exclusive with defensive path
      branchCondition: (state) => {
        // Must own Calais (ID 3)
        const locs = state.locations || [];
        return locs.some((l: any) => (l.id === 3 || l.name === 'Calais') && l.country === (state.playerCountry || 'ENG'));
      },
      requirementsEvaluationBlock: (state, q) => {
        const ownsCalais = q.checkOwnsLocationChain(state, [3]);
        const hasGold = q.checkTreasuryReserve(state, 800);
        return ownsCalais && hasGold;
      },
      immediateRewardsPayload: (state) => {
        if (!state.permanentClaims) state.permanentClaims = [];
        state.permanentClaims.push('FRA_Crown_Of_France');
        state.crownPower = Math.min(1.0, (state.crownPower || 0) + 0.15);
      },
      status: 'LOCKED'
    };

    // BRANCH B (Defensive): Fortify the Home Ports
    // Mutually exclusive with Claim French Crown!
    const nodeB1: MissionNodeContract = {
      nodeId: 'mission_fortify_home_ports',
      treeId: tree.id,
      titleKey: "Fortify the Home Ports & Island Bastion",
      descriptionKey: "Consolidate defensive naval bastions and pacify the domestic estates.",
      parentNodesArray: ['mission_channel_outpost'],
      isMutuallyExclusiveWith: ['mission_claim_french_crown'], // Mutually exclusive with offensive path
      requirementsEvaluationBlock: (state, q) => {
        const ownsDover = q.checkOwnsLocationChain(state, [2]);
        const hasGold = q.checkTreasuryReserve(state, 400);
        return ownsDover && hasGold;
      },
      immediateRewardsPayload: (state) => {
        state.crownTreasury = (state.crownTreasury || 0) - 200;
        state.manpower = (state.manpower || 0) + 3000;
        // Modifies long-term control decay constants and estate loyalty
        if (state.estates) {
          for (const est of state.estates) {
            est.loyalty = Math.min(100, est.loyalty + 12);
          }
        }
      },
      status: 'LOCKED'
    };

    tree.nodes.set(node0.nodeId, node0);
    tree.nodes.set(nodeA1.nodeId, nodeA1);
    tree.nodes.set(nodeB1.nodeId, nodeB1);

    this.registerTree(tree);
  }
}
