/**
 * Multi-Variable Transactional Peace Treaty Engine
 * Handles bidirectional barter peace treaties, granular concessions, and atomic state mutations
 */

export const TreatyClauseType = {
  Cede_Location: 'Cede_Location',
  Revoke_Privilege: 'Revoke_Privilege',
  War_Indemnities: 'War_Indemnities',
  Dismantle_Fort: 'Dismantle_Fort',
  Enforce_Religious_Concession: 'Enforce_Religious_Concession'
} as const;

export type TreatyClauseType = typeof TreatyClauseType[keyof typeof TreatyClauseType];

export interface CedeLocationPayload {
  locationId: number;
  newSovereignTag: string;
  newControllerTag: string;
  crownControlFloor: number; // e.g. 0.20 (20%)
}

export interface RevokePrivilegePayload {
  targetCountryTag: string;
  targetEstate: string;
  privilegeId: string;
  loyaltyPenalty: number;
  powerReduction: number;
}

export interface WarIndemnitiesPayload {
  payingCountryTag: string;
  receivingCountryTag: string;
  durationMonths: number; // e.g. 60 months (5 years)
  monthlyTaxRate: number;  // 0.10 (10%)
}

export interface TreatyClause {
  type: TreatyClauseType;
  warScoreCost: number;
  giverTag: string;
  receiverTag: string;
  cedePayload?: CedeLocationPayload;
  revokePayload?: RevokePrivilegePayload;
  indemnitiesPayload?: WarIndemnitiesPayload;
}

export interface PeaceDealTransaction {
  id: string;
  initiatorTag: string;
  targetTag: string;
  accumulatedWarScore: number;
  demandedClauses: TreatyClause[];    // Concessions from target to initiator
  concessionClauses: TreatyClause[];  // Sweeteners from initiator to target
  isUnconditionalSurrender?: boolean;
}

export interface ActiveWarIndemnity {
  id: string;
  payerTag: string;
  receiverTag: string;
  remainingMonths: number;
  monthlyTaxRate: number;
}

export class TransactionalPeaceEngine {
  private activeIndemnities: Map<string, ActiveWarIndemnity> = new Map();

  /**
   * Computes the net War Score budget required for the treaty
   * Net Budget = Gross Demands - Concessions Granted
   */
  public calculateWarScoreBudget(deal: PeaceDealTransaction): number {
    const grossDemands = deal.demandedClauses.reduce((sum, c) => sum + c.warScoreCost, 0);
    const concessionsRelief = deal.concessionClauses.reduce((sum, c) => sum + c.warScoreCost, 0);
    return Math.max(0, grossDemands - concessionsRelief);
  }

  /**
   * Validates if the proposed barter package can be ratified under available War Score
   */
  public validatePeaceDeal(deal: PeaceDealTransaction): {
    valid: boolean;
    netCost: number;
    availableScore: number;
    deficit: number;
    reason: string;
  } {
    const netCost = this.calculateWarScoreBudget(deal);
    if (netCost > deal.accumulatedWarScore && !deal.isUnconditionalSurrender) {
      return {
        valid: false,
        netCost,
        availableScore: deal.accumulatedWarScore,
        deficit: netCost - deal.accumulatedWarScore,
        reason: `Demanded treaty terms (${netCost}% WS) exceed accumulated war score (${deal.accumulatedWarScore}% WS).`
      };
    }

    return {
      valid: true,
      netCost,
      availableScore: deal.accumulatedWarScore,
      deficit: 0,
      reason: 'Peace barter terms validated within acceptable War Score budget.'
    };
  }

  /**
   * Safely executes ratified peace deal concessions, mutating world state in memory
   */
  public executePeaceTreaty(
    deal: PeaceDealTransaction,
    context: {
      mutateLocationSovereignty: (locationId: number, newTag: string, controlFloor: number) => void;
      stripEstatePrivilege: (countryTag: string, estate: string, privilegeId: string, loyaltyDelta: number, powerDelta: number) => void;
      recolorMapCallback?: (locationId: number, newTag: string) => void;
    }
  ): {
    success: boolean;
    cededLocations: number[];
    revokedPrivileges: string[];
    scheduledIndemnity?: ActiveWarIndemnity;
  } {
    const validation = this.validatePeaceDeal(deal);
    if (!validation.valid) {
      throw new Error(`Cannot execute invalid peace deal: ${validation.reason}`);
    }

    const cededLocations: number[] = [];
    const revokedPrivileges: string[] = [];
    let scheduledIndemnity: ActiveWarIndemnity | undefined;

    // Process all clauses (both demands and concessions)
    const allClauses = [...deal.demandedClauses, ...deal.concessionClauses];

    for (const clause of allClauses) {
      if (clause.type === TreatyClauseType.Cede_Location && clause.cedePayload) {
        const { locationId, newSovereignTag, crownControlFloor } = clause.cedePayload;
        context.mutateLocationSovereignty(locationId, newSovereignTag, crownControlFloor);
        if (context.recolorMapCallback) {
          context.recolorMapCallback(locationId, newSovereignTag);
        }
        cededLocations.push(locationId);
      } else if (clause.type === TreatyClauseType.Revoke_Privilege && clause.revokePayload) {
        const { targetCountryTag, targetEstate, privilegeId, loyaltyPenalty, powerReduction } = clause.revokePayload;
        context.stripEstatePrivilege(targetCountryTag, targetEstate, privilegeId, loyaltyPenalty, powerReduction);
        revokedPrivileges.push(privilegeId);
      } else if (clause.type === TreatyClauseType.War_Indemnities && clause.indemnitiesPayload) {
        const payload = clause.indemnitiesPayload;
        const indemnityId = `indemnity_${payload.payingCountryTag}_to_${payload.receivingCountryTag}_${Date.now()}`;
        const indemnity: ActiveWarIndemnity = {
          id: indemnityId,
          payerTag: payload.payingCountryTag,
          receiverTag: payload.receivingCountryTag,
          remainingMonths: payload.durationMonths,
          monthlyTaxRate: payload.monthlyTaxRate
        };
        this.activeIndemnities.set(indemnityId, indemnity);
        scheduledIndemnity = indemnity;
      }
    }

    return {
      success: true,
      cededLocations,
      revokedPrivileges,
      scheduledIndemnity
    };
  }

  /**
   * Monthly tick pass: processes multi-year indemnity transfers from defeated to victor
   */
  public processMonthlyIndemnities(
    getMonthlyTaxIncome: (countryTag: string) => number,
    transferFunds: (fromTag: string, toTag: string, amount: number) => void
  ): { totalTransferred: number; completedIndemnities: string[] } {
    let totalTransferred = 0;
    const completedIndemnities: string[] = [];

    for (const [id, ind] of this.activeIndemnities.entries()) {
      if (ind.remainingMonths <= 0) {
        completedIndemnities.push(id);
        continue;
      }

      const baseTax = getMonthlyTaxIncome(ind.payerTag);
      const paymentAmount = baseTax * ind.monthlyTaxRate;

      if (paymentAmount > 0) {
        transferFunds(ind.payerTag, ind.receiverTag, paymentAmount);
        totalTransferred += paymentAmount;
      }

      ind.remainingMonths--;
      if (ind.remainingMonths <= 0) {
        completedIndemnities.push(id);
      }
    }

    for (const id of completedIndemnities) {
      this.activeIndemnities.delete(id);
    }

    return { totalTransferred, completedIndemnities };
  }

  public getActiveIndemnities(): ActiveWarIndemnity[] {
    return Array.from(this.activeIndemnities.values());
  }
}
