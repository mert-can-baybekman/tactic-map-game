import { EstateType } from '../core/types.ts';
import { PopDemographicEngine, type PopEntity } from '../demographics/pop.ts';
import type { EstateGovernanceEngine } from './estates.ts';

export type AssemblyType =
  | 'English_Parliament'
  | 'Ottoman_Divan'
  | 'Polish_Sejm'
  | 'Castilian_Cortes'
  | 'Imperial_Diet'
  | 'General_Estates';

export type EstateDemandType =
  | 'Demand_Tax_Exemption'
  | 'Demand_Trade_Monopoly'
  | 'Demand_Clergy_Endowment'
  | 'Demand_Military_Autonomy'
  | 'Demand_Crown_Land_Concession';

export interface ProceduralEstateDemand {
  id: string;
  originatingEstate: EstateType;
  demandType: EstateDemandType;
  title: string;
  description: string;
  prestigeCost: number;
  crownPowerDrain: number;
  loyaltyReward: number;
  unrestPenaltyIfRejected: number;
  isFulfilled: boolean;
}

export interface ProposedBill {
  id: string;
  name: string;
  category: 'Peacetime_Tax' | 'Land_Reform' | 'Secularization' | 'Army_Reform' | 'Privilege_Revocation';
  targetEstatePrivilegeToRevoke?: string;
  displeasedEstate?: EstateType;
  expectedCrownPowerGain: number;
  stabilityHitOnFailure: number;
}

export interface EstateVoteBreakdown {
  estateType: EstateType;
  loyalty: number;
  powerRatio: number;
  rulerDiplomacyModifier: number;
  approvalWeight: number;
  votedInFavor: boolean;
}

export interface LegislativeVoteResult {
  billId: string;
  passed: boolean;
  netApprovalWeight: number;
  breakdown: EstateVoteBreakdown[];
  stabilityDelta: number;
  rebelFactionSpawnTriggered: boolean;
  disgruntledEstates: EstateType[];
}

export class DietAssemblyEngine {
  private assemblyType: AssemblyType;
  private countryTag: string;
  private sessionCounter: number = 0;
  private activeDemands: ProceduralEstateDemand[] = [];

  constructor(countryTag: string, assemblyType: AssemblyType = 'General_Estates') {
    this.countryTag = countryTag;
    this.assemblyType = assemblyType;
  }

  public getAssemblyType(): AssemblyType {
    return this.assemblyType;
  }

  public setAssemblyType(type: AssemblyType): void {
    this.assemblyType = type;
  }

  /**
   * Convenes the Diet / Parliamentary Session.
   * Aggregates active estate parameters and generates procedural demands based on power and grievances.
   */
  public conveneAssemblySession(estateEngine: EstateGovernanceEngine): ProceduralEstateDemand[] {
    this.sessionCounter += 1;
    this.activeDemands = [];

    const estates = estateEngine.getAllEstates();
    const sortedByPower = [...estates].sort((a, b) => b.raw_power - a.raw_power);

    for (const est of sortedByPower) {
      // If estate has meaningful power (> 15%) and loyalty < 70, they present demands
      if (est.raw_power >= 0.15 && est.loyalty < 70.0) {
        let demandType: EstateDemandType = 'Demand_Tax_Exemption';
        let title = `${est.type} Demands Tax Relief`;

        if (est.type === EstateType.Burghers) {
          demandType = 'Demand_Trade_Monopoly';
          title = 'Burghers Demand Guild Charters & Market Monopolies';
        } else if (est.type === EstateType.Clergy) {
          demandType = 'Demand_Clergy_Endowment';
          title = 'Clergy Demands Ecclesiastical Tithes & Sacred Lands';
        } else if (est.type === EstateType.Nobility) {
          demandType = 'Demand_Crown_Land_Concession';
          title = 'Nobility Demands Feudal Land Concessions';
        }

        const demand: ProceduralEstateDemand = {
          id: `demand_${this.countryTag}_${this.sessionCounter}_${est.type}`,
          originatingEstate: est.type,
          demandType,
          title,
          description: `The ${est.type} assembly caucus uses their ${Math.round(est.raw_power * 100)}% realm influence to lobby the crown.`,
          prestigeCost: 5.0,
          crownPowerDrain: 0.04,
          loyaltyReward: 15.0,
          unrestPenaltyIfRejected: 0.20,
          isFulfilled: false
        };

        this.activeDemands.push(demand);
      }
    }

    return this.activeDemands;
  }

  /**
   * Legislative Voting Matrix:
   * Approval_Weight = (Estate_Loyalty - 50.0) * (Estate_Power_Ratio) * Ruler_Diplomacy_Modifier
   */
  public calculateEstateApprovalWeight(
    loyalty: number,
    powerRatio: number,
    rulerDiplomacy: number
  ): { weight: number; diplomacyMod: number } {
    // Ruler diplomacy normalized (0 to 100 scale, 50 is neutral 1.0x)
    const clampedDiplomacy = Math.max(0, Math.min(100, rulerDiplomacy));
    const diplomacyMod = 1.0 + ((clampedDiplomacy - 50.0) / 100.0);
    const weight = (loyalty - 50.0) * powerRatio * diplomacyMod;
    return { weight, diplomacyMod };
  }

  /**
   * Evaluates the vote across all estates for a proposed peacetime bill or privilege revocation.
   * If net approval < 0, law fails, drops stability by -1.0, increases militancy in pop arrays,
   * and flags disgruntled estates for rebel faction generation.
   */
  public voteOnLegislativeBill(
    bill: ProposedBill,
    estateEngine: EstateGovernanceEngine,
    rulerDiplomacy: number,
    popEngine?: PopDemographicEngine,
    currentStability: number = 2.0
  ): { result: LegislativeVoteResult; updatedStability: number } {
    const estates = estateEngine.getAllEstates();
    const totalPower = estates.reduce((sum, e) => sum + e.raw_power, 0) || 1.0;

    let netApproval = 0.0;
    const breakdowns: EstateVoteBreakdown[] = [];
    const disgruntled: EstateType[] = [];

    for (const est of estates) {
      const powerRatio = est.raw_power / totalPower;
      let effectiveLoyalty = est.loyalty;

      // If the bill targets this estate's privileges, loyalty in the vote plummets by 30
      if (bill.displeasedEstate === est.type) {
        effectiveLoyalty = Math.max(0, effectiveLoyalty - 30.0);
      }

      const { weight, diplomacyMod } = this.calculateEstateApprovalWeight(
        effectiveLoyalty,
        powerRatio,
        rulerDiplomacy
      );

      netApproval += weight;
      const inFavor = weight >= 0.0;

      if (!inFavor) {
        disgruntled.push(est.type);
      }

      breakdowns.push({
        estateType: est.type,
        loyalty: est.loyalty,
        powerRatio,
        rulerDiplomacyModifier: diplomacyMod,
        approvalWeight: weight,
        votedInFavor: inFavor
      });
    }

    const passed = netApproval >= 0.0;
    const stabilityDelta = passed ? 0.0 : bill.stabilityHitOnFailure;
    const updatedStability = Math.max(-3.0, Math.min(3.0, currentStability + stabilityDelta));
    const severeCrisis = !passed && (netApproval < -10.0);

    // If law failed, scale up Militancy_Unrest across disgruntled estate pop arrays
    if (!passed && popEngine) {
      const allPops = popEngine.getAllPops();
      for (const pop of allPops) {
        if (disgruntled.includes(pop.estate_type)) {
          // Disgruntled estate pops turn militant
          pop.militancy_unrest = Math.min(1.0, pop.militancy_unrest + 0.25);
        }
      }
    }

    const result: LegislativeVoteResult = {
      billId: bill.id,
      passed,
      netApprovalWeight: netApproval,
      breakdown: breakdowns,
      stabilityDelta,
      rebelFactionSpawnTriggered: severeCrisis,
      disgruntledEstates: disgruntled
    };

    return { result, updatedStability };
  }

  public getActiveDemands(): ProceduralEstateDemand[] {
    return this.activeDemands;
  }
}
