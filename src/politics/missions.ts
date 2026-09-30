/**
 * Dynamic Scripted Mission & Narrative Tree Engine
 * Implements state-reactive mission contracts, progression graphs, and immediate reward payloads.
 */

export type MissionNodeStatus = 'LOCKED' | 'AVAILABLE' | 'COMPLETED';

export interface MissionRequirement {
  type: 'OWNS_LOCATION' | 'LOCATION_CONTROL_MIN' | 'TREASURY_MIN' | 'MANPOWER_MIN' | 'OUTLINER_PROGRESS_MIN' | 'CUSTOM';
  targetLocationId?: number;
  targetLocationName?: string;
  minValue?: number;
  progressKey?: string;
  description: string;
  check: (state: any) => boolean;
}

export interface MissionRewardPayload {
  treasuryGoldDelta?: number;
  manpowerDelta?: number;
  crownPowerDelta?: number;
  estateLoyaltyDeltas?: Record<string, number>;
  addPermanentClaims?: string[];
  addCoreLocations?: number[];
  customEffect?: (state: any) => void;
  description: string;
}

export interface MissionNode {
  id: string;
  treeId: string;
  titleKey: string;
  descriptionKey: string;
  prerequisites: string[]; // Node IDs that must be completed first
  requirements: MissionRequirement[];
  rewards: MissionRewardPayload;
  status: MissionNodeStatus;
  completedDate?: string;
}

export interface MissionTree {
  id: string;
  title: string;
  rulerDynastyTarget?: string;
  nodes: Map<string, MissionNode>;
}

export class MissionTreeEngine {
  private trees: Map<string, MissionTree> = new Map();

  constructor() {
    this.registerHistoricalMissionTrees();
  }

  public registerTree(tree: MissionTree): void {
    this.trees.set(tree.id, tree);
  }

  public getTree(treeId: string): MissionTree | undefined {
    return this.trees.get(treeId);
  }

  public getAllTrees(): MissionTree[] {
    return Array.from(this.trees.values());
  }

  /**
   * Monthly Engine Tick Pass:
   * Evaluates all mission trees, checks prerequisites to unlock nodes,
   * and marks ready nodes as AVAILABLE or auto-completable.
   */
  public evaluateMonthlyMissionTick(state: any): { newlyAvailable: string[]; eligibleForClaim: string[] } {
    const newlyAvailable: string[] = [];
    const eligibleForClaim: string[] = [];

    for (const tree of this.trees.values()) {
      for (const node of tree.nodes.values()) {
        if (node.status === 'COMPLETED') {
          continue;
        }

        // 1. Evaluate Prerequisites
        const allPrereqsMet = node.prerequisites.every(prereqId => {
          const prereqNode = tree.nodes.get(prereqId);
          return prereqNode && prereqNode.status === 'COMPLETED';
        });

        if (!allPrereqsMet) {
          node.status = 'LOCKED';
          continue;
        }

        if (node.status === 'LOCKED') {
          node.status = 'AVAILABLE';
          newlyAvailable.push(node.id);
        }

        // 2. Evaluate Requirements
        const requirementsMet = node.requirements.every(req => req.check(state));
        if (requirementsMet && node.status === 'AVAILABLE') {
          eligibleForClaim.push(node.id);
        }
      }
    }

    return { newlyAvailable, eligibleForClaim };
  }

  /**
   * Completes a mission node and applies its immediate state mutation rewards
   */
  public completeMissionNode(treeId: string, nodeId: string, state: any, currentDateStr: string = '1350-01-01'): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;

    const node = tree.nodes.get(nodeId);
    if (!node || node.status === 'COMPLETED') return false;

    // Verify all requirements
    const canComplete = node.requirements.every(req => req.check(state));
    if (!canComplete) return false;

    // Apply immediate reward payload
    const rewards = node.rewards;

    if (rewards.treasuryGoldDelta) {
      state.crownTreasury = (state.crownTreasury || 0) + rewards.treasuryGoldDelta;
    }

    if (rewards.manpowerDelta) {
      state.manpower = (state.manpower || 0) + rewards.manpowerDelta;
    }

    if (rewards.crownPowerDelta) {
      state.crownPower = Math.min(1.0, Math.max(0.0, (state.crownPower || 0) + rewards.crownPowerDelta));
    }

    if (rewards.estateLoyaltyDeltas && Array.isArray(state.estates)) {
      for (const [estateName, delta] of Object.entries(rewards.estateLoyaltyDeltas)) {
        const est = state.estates.find((e: any) => e.type === estateName);
        if (est) {
          est.loyalty = Math.max(0.0, Math.min(100.0, est.loyalty + delta));
        }
      }
    }

    if (rewards.addPermanentClaims) {
      if (!state.permanentClaims) state.permanentClaims = [];
      for (const claim of rewards.addPermanentClaims) {
        if (!state.permanentClaims.includes(claim)) {
          state.permanentClaims.push(claim);
        }
      }
    }

    if (rewards.customEffect) {
      rewards.customEffect(state);
    }

    node.status = 'COMPLETED';
    node.completedDate = currentDateStr;

    return true;
  }

  /**
   * Initializes King Edward III's Historical Macro-Objective Tree
   */
  private registerHistoricalMissionTrees(): void {
    const tree: MissionTree = {
      id: 'tree_hundred_years_war',
      title: "King Edward III: Crown of France & Continental Hegemony",
      rulerDynastyTarget: 'Plantagenet',
      nodes: new Map()
    };

    // Node 1: Fortify the English Channel
    const node1: MissionNode = {
      id: 'mission_fortify_channel',
      treeId: tree.id,
      titleKey: "Fortify the English Channel",
      descriptionKey: "Secure the naval maritime route between Dover and Calais with coastal garrisons.",
      prerequisites: [],
      status: 'AVAILABLE',
      requirements: [
        {
          type: 'OWNS_LOCATION',
          targetLocationId: 2,
          targetLocationName: 'Dover',
          description: "Controls Dover vertex",
          check: (s) => (s.locations || []).some((l: any) => (l.id === 2 || l.name === 'Dover') && l.country === 'ENG')
        },
        {
          type: 'LOCATION_CONTROL_MIN',
          targetLocationId: 2,
          minValue: 0.80,
          description: "Dover Crown Control >= 80%",
          check: (s) => {
            const loc = (s.locations || []).find((l: any) => l.id === 2 || l.name === 'Dover');
            return loc ? loc.control >= 0.80 : false;
          }
        },
        {
          type: 'TREASURY_MIN',
          minValue: 300,
          description: "Treasury >= 300 Gold",
          check: (s) => (s.crownTreasury || 0) >= 300
        }
      ],
      rewards: {
        estateLoyaltyDeltas: { Burghers: 15.0 },
        manpowerDelta: 1000,
        treasuryGoldDelta: -200,
        description: "+15% Burgher Loyalty, +1,000 Manpower Pool, -200 Fortification Investment."
      }
    };

    // Node 2: Calais Wool Staple Port
    const node2: MissionNode = {
      id: 'mission_calais_staple_port',
      treeId: tree.id,
      titleKey: "Calais Wool Staple Port",
      descriptionKey: "Direct all English continental wool trade exclusively through the Calais harbor hub.",
      prerequisites: ['mission_fortify_channel'],
      status: 'LOCKED',
      requirements: [
        {
          type: 'OWNS_LOCATION',
          targetLocationId: 3,
          targetLocationName: 'Calais',
          description: "Controls Calais vertex",
          check: (s) => (s.locations || []).some((l: any) => (l.id === 3 || l.name === 'Calais') && l.country === 'ENG')
        },
        {
          type: 'LOCATION_CONTROL_MIN',
          targetLocationId: 3,
          minValue: 0.75,
          description: "Calais Crown Control >= 75%",
          check: (s) => {
            const loc = (s.locations || []).find((l: any) => l.id === 3 || l.name === 'Calais');
            return loc ? loc.control >= 0.75 : false;
          }
        }
      ],
      rewards: {
        estateLoyaltyDeltas: { Burghers: 20.0 },
        addPermanentClaims: ['FLA_Flanders'],
        crownPowerDelta: 0.05,
        description: "+20% Burgher Loyalty, +5% Crown Power, Permanent Trade Claim on Flanders."
      }
    };

    // Node 3: Claim the Crown of France
    const node3: MissionNode = {
      id: 'mission_claim_french_crown',
      treeId: tree.id,
      titleKey: "Claim the Crown of France",
      descriptionKey: "Assert the Plantagenet matrilineal right through Queen Isabella to the French throne.",
      prerequisites: ['mission_calais_staple_port'],
      status: 'LOCKED',
      requirements: [
        {
          type: 'TREASURY_MIN',
          minValue: 1000,
          description: "Crown Treasury >= 1,000 Gold",
          check: (s) => (s.crownTreasury || 0) >= 1000
        },
        {
          type: 'MANPOWER_MIN',
          minValue: 15000,
          description: "National Manpower Pool >= 15,000",
          check: (s) => (s.manpower || 0) >= 15000
        }
      ],
      rewards: {
        addPermanentClaims: ['FRA_Crown_Of_France'],
        manpowerDelta: 2000,
        crownPowerDelta: 0.10,
        description: "Permanent Claim: Crown of France, +2,000 Manpower Pool, +10% Crown Power."
      }
    };

    // Node 4: Integrate the Duchy of Normandy
    const node4: MissionNode = {
      id: 'mission_integrate_normandy',
      treeId: tree.id,
      titleKey: "Integrate the Duchy of Normandy",
      descriptionKey: "Complete full institutional assimilation of the Norman enclaves into the Crown Realm.",
      prerequisites: ['mission_claim_french_crown'],
      status: 'LOCKED',
      requirements: [
        {
          type: 'OUTLINER_PROGRESS_MIN',
          progressKey: 'normandyIntegration',
          minValue: 100.0,
          description: "Normandy Integration Progress == 100%",
          check: (s) => (s.outliner?.normandyIntegration || 0) >= 100.0
        }
      ],
      rewards: {
        estateLoyaltyDeltas: { Nobility: 20.0 },
        treasuryGoldDelta: 500,
        description: "+20% Nobility Loyalty, +500 Treasury Ducats, Full Normandy Integration."
      }
    };

    tree.nodes.set(node1.id, node1);
    tree.nodes.set(node2.id, node2);
    tree.nodes.set(node3.id, node3);
    tree.nodes.set(node4.id, node4);

    this.registerTree(tree);
  }
}
