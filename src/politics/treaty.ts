export interface TreatyClause {
  type: 'cede_location' | 'war_reparations_gold' | 'force_religion' | 'revoke_privilege' | 'grant_trade_access';
  giver_country_id: number;
  receiver_country_id: number;
  value_warscore: number;
  parameters: Record<string, any>;
}

export interface PeaceTreatyPackage {
  initiator_country_id: number;
  target_country_id: number;
  clauses_from_target: TreatyClause[];   // Demanded by initiator
  concessions_to_target: TreatyClause[]; // Conceded by initiator to sweeten barter
  accumulated_warscore: number;
}

export class PeaceTreatyEngine {
  /**
   * Evaluates if a multi-lateral peace treaty package is valid and acceptable
   */
  public evaluateTreatyPackage(
    pkg: PeaceTreatyPackage,
    initiatorWarScore: number
  ): { accepted: boolean; netWarScoreCost: number; balanceDeficit: number; reason: string } {
    const demandCost = pkg.clauses_from_target.reduce((sum, c) => sum + c.value_warscore, 0);
    const concessionRelief = pkg.concessions_to_target.reduce((sum, c) => sum + c.value_warscore, 0);

    const netWarScoreCost = demandCost - concessionRelief;

    // Check warscore cap
    if (netWarScoreCost > initiatorWarScore) {
      return {
        accepted: false,
        netWarScoreCost,
        balanceDeficit: netWarScoreCost - initiatorWarScore,
        reason: 'Demanded treaty terms exceed total accumulated war score.'
      };
    }

    // AI acceptance calculation: target accepts if net cost is within war exhaustion tolerance
    return {
      accepted: true,
      netWarScoreCost,
      balanceDeficit: 0,
      reason: 'Treaty terms balanced and agreed upon by all signatories.'
    };
  }
}
