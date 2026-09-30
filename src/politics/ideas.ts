/**
 * Multi-Tier Idea Group Customization Network
 * Non-linear idea progression branches that inject permanent modifiers into core simulation subsystems
 */

export const IdeaCategory = {
  Administrative: 'Administrative',
  Military: 'Military',
  Diplomatic_Maritime: 'Diplomatic_Maritime',
  Innovative: 'Innovative'
} as const;

export type IdeaCategory = typeof IdeaCategory[keyof typeof IdeaCategory];

export interface IdeaNode {
  id: string;
  tier: number; // 1 to 7
  name: string;
  description: string;
  costPrestige: number;
  costCrownPower: number;
  isUnlocked: boolean;
  applyModifier: (mods: EngineIdeaModifiers) => void;
}

export interface EngineIdeaModifiers {
  controlDecayReduction: number;        // e.g. 0.25 (-25% distance decay for distant nodes)
  levyMobilizationBonus: number;        // e.g. 0.10 (+10% pop-to-soldier extraction)
  taxSkimmingEfficiencyBonus: number;   // e.g. 0.15 (+15% national tax efficiency)
  blockadeEfficiencyBonus: number;      // e.g. 0.25 (+25% naval blockade efficiency)
  techCostReduction: number;            // e.g. 0.15 (-15% tech & outliner cost)
  integrationSpeedBonus: number;        // e.g. 0.20 (+20% core integration speed)
}

export interface IdeaGroup {
  id: string;
  name: string;
  category: IdeaCategory;
  unlockReqPrestige: number;
  unlockReqCrownPower: number;
  isAdopted: boolean;
  ideas: IdeaNode[];
  completionBonusPerk: string;
}

export class IdeaNetworkEngine {
  private groups: Map<string, IdeaGroup> = new Map();
  private activeModifiers: EngineIdeaModifiers = {
    controlDecayReduction: 0.0,
    levyMobilizationBonus: 0.0,
    taxSkimmingEfficiencyBonus: 0.0,
    blockadeEfficiencyBonus: 0.0,
    techCostReduction: 0.0,
    integrationSpeedBonus: 0.0
  };

  constructor() {
    this.initializeDefaultIdeaGroups();
  }

  private initializeDefaultIdeaGroups(): void {
    // 1. Administrative Ideas
    this.groups.set('administrative', {
      id: 'administrative',
      name: 'Administrative Ideas',
      category: IdeaCategory.Administrative,
      unlockReqPrestige: 20.0,
      unlockReqCrownPower: 0.30,
      isAdopted: false,
      completionBonusPerk: '+20% State Administrative Capacity',
      ideas: [
        {
          id: 'admin_1_fiscal_clerks',
          tier: 1,
          name: 'Fiscal Chancery Clerks',
          description: '+10% National Tax Skimming Efficiency',
          costPrestige: 15.0,
          costCrownPower: 0.05,
          isUnlocked: false,
          applyModifier: (m) => { m.taxSkimmingEfficiencyBonus += 0.10; }
        },
        {
          id: 'admin_2_cadastral_surveys',
          tier: 2,
          name: 'Cadastral Land Surveys',
          description: '+20% Core Territorial Integration Speed',
          costPrestige: 20.0,
          costCrownPower: 0.05,
          isUnlocked: false,
          applyModifier: (m) => { m.integrationSpeedBonus += 0.20; }
        },
        {
          id: 'admin_3_centralized_tax',
          tier: 3,
          name: 'Centralized Imperial Tax Office',
          description: '-25% Crown Control Distance Decay on Distant Enclaves (Calais, Rouen)',
          costPrestige: 25.0,
          costCrownPower: 0.08,
          isUnlocked: false,
          applyModifier: (m) => { m.controlDecayReduction += 0.25; }
        }
      ]
    });

    // 2. Quantity (Military) Ideas
    this.groups.set('quantity', {
      id: 'quantity',
      name: 'Quantity Ideas',
      category: IdeaCategory.Military,
      unlockReqPrestige: 15.0,
      unlockReqCrownPower: 0.25,
      isAdopted: false,
      completionBonusPerk: '+25% Max National Manpower Pool',
      ideas: [
        {
          id: 'quantity_1_levy_mobilization',
          tier: 1,
          name: 'Feudal Mass Conscription',
          description: '+10% Pop-to-Soldier Extraction when clicking Mobilize Levies',
          costPrestige: 15.0,
          costCrownPower: 0.05,
          isUnlocked: false,
          applyModifier: (m) => { m.levyMobilizationBonus += 0.10; }
        }
      ]
    });

    // 3. Maritime Ideas
    this.groups.set('maritime', {
      id: 'maritime',
      name: 'Maritime Ideas',
      category: IdeaCategory.Diplomatic_Maritime,
      unlockReqPrestige: 20.0,
      unlockReqCrownPower: 0.25,
      isAdopted: false,
      completionBonusPerk: '+50% Light Ship Trade Protection',
      ideas: [
        {
          id: 'maritime_1_merchant_marine',
          tier: 1,
          name: 'Naval Blockade Tactics',
          description: '+25% Naval Blockade Efficiency in Strategic Straits',
          costPrestige: 20.0,
          costCrownPower: 0.05,
          isUnlocked: false,
          applyModifier: (m) => { m.blockadeEfficiencyBonus += 0.25; }
        }
      ]
    });

    // 4. Innovative Ideas
    this.groups.set('innovative', {
      id: 'innovative',
      name: 'Innovative Ideas',
      category: IdeaCategory.Innovative,
      unlockReqPrestige: 25.0,
      unlockReqCrownPower: 0.35,
      isAdopted: false,
      completionBonusPerk: '-5% All All-Category Advance Costs',
      ideas: [
        {
          id: 'innovative_1_scholarly_patronage',
          tier: 1,
          name: 'Scholarly Court Patronage',
          description: '-15% Technology Era Embrace Costs',
          costPrestige: 20.0,
          costCrownPower: 0.05,
          isUnlocked: false,
          applyModifier: (m) => { m.techCostReduction += 0.15; }
        }
      ]
    });
  }

  public getGroup(id: string): IdeaGroup | undefined {
    return this.groups.get(id);
  }

  public getAllGroups(): IdeaGroup[] {
    return Array.from(this.groups.values());
  }

  public getActiveModifiers(): EngineIdeaModifiers {
    return { ...this.activeModifiers };
  }

  /**
   * Adopts an idea group branch if requirements are satisfied
   */
  public adoptIdeaGroup(groupId: string, statePrestige: number, crownPower: number): boolean {
    const group = this.groups.get(groupId);
    if (!group || group.isAdopted) return false;

    if (statePrestige >= group.unlockReqPrestige && crownPower >= group.unlockReqCrownPower) {
      group.isAdopted = true;
      return true;
    }
    return false;
  }

  /**
   * Unlocks a specific idea node within an adopted group
   */
  public unlockIdeaNode(
    groupId: string,
    ideaId: string,
    availablePrestige: number,
    availableCrownPower: number
  ): { success: boolean; prestigeCost: number; crownPowerCost: number; reason?: string } {
    const group = this.groups.get(groupId);
    if (!group) return { success: false, prestigeCost: 0, crownPowerCost: 0, reason: 'Group not found' };
    if (!group.isAdopted) return { success: false, prestigeCost: 0, crownPowerCost: 0, reason: 'Group not adopted' };

    const idea = group.ideas.find(i => i.id === ideaId);
    if (!idea) return { success: false, prestigeCost: 0, crownPowerCost: 0, reason: 'Idea not found' };
    if (idea.isUnlocked) return { success: false, prestigeCost: 0, crownPowerCost: 0, reason: 'Already unlocked' };

    if (availablePrestige < idea.costPrestige || availableCrownPower < idea.costCrownPower) {
      return { 
        success: false, 
        prestigeCost: idea.costPrestige, 
        crownPowerCost: idea.costCrownPower, 
        reason: 'Insufficient State Prestige or Crown Power' 
      };
    }

    idea.isUnlocked = true;
    idea.applyModifier(this.activeModifiers);

    return {
      success: true,
      prestigeCost: idea.costPrestige,
      crownPowerCost: idea.costCrownPower
    };
  }
}
