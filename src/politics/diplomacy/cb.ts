/**
 * Dynamic Claim Generation & Casus Belli Justification Engine
 * Implements legal state machine for territorial claims, espionage fabrication loops,
 * and market hub trade-locking Casus Belli declarations.
 */

export type ClaimTypeEnum = 'Fabricated' | 'Permanent' | 'Dynastic';
export type CasusBelliTypeEnum = 'Conquest' | 'Reconquest' | 'Imperialism' | 'Dynastic_Claim' | 'Hundred_Years_War';

export interface TerritorialClaim {
  id: string;
  claimantCountry: string; // e.g. 'OTT'
  targetCountry: string;   // e.g. 'BYZ'
  targetLocationId: number; // e.g. 104 (Constantinople)
  targetLocationName: string;
  claimType: ClaimTypeEnum;
  createdDate: string;
  expiryDate: string | null; // null for Permanent claims (never expire)
  isValid: boolean;
}

export interface ActiveClaimJustification {
  id: string;
  claimantCountry: string;
  targetCountry: string;
  targetLocationId: number;
  targetLocationName: string;
  agentId: string;
  agentIntrigue: number; // 1 to 100
  targetCounterEspionage: number; // 0.1 to 1.0
  progressPercentage: number; // 0.0 to 100.0%
  baseSpeed: number; // e.g. 5.0% per month
  isCompleted: boolean;
}

export interface CasusBelli {
  id: string;
  type: CasusBelliTypeEnum;
  name: string;
  claimantCountry: string;
  targetCountry: string;
  targetLocationId?: number;
  warGoalDescription: string;
  tradeEmbargoEnforced: boolean;
  prestigeReward: number;
  infamyGenerationModifier: number;
}

export interface WarDeclarationResult {
  warId: string;
  casusBelliUsed: CasusBelli;
  attackerTag: string;
  defenderTag: string;
  tradeActionsLocked: boolean;
  blockadedMarketHubs: number[];
  declarationDate: string;
}

export class CasusBelliEngine {
  private claims: Map<string, TerritorialClaim> = new Map();
  private justifications: Map<string, ActiveClaimJustification> = new Map();
  private availableCasusBelli: Map<string, CasusBelli[]> = new Map();

  public registerClaim(claim: TerritorialClaim): void {
    this.claims.set(claim.id, claim);
  }

  public getClaim(id: string): TerritorialClaim | undefined {
    return this.claims.get(id);
  }

  public getClaimsForCountry(countryTag: string): TerritorialClaim[] {
    return Array.from(this.claims.values()).filter(c => c.claimantCountry === countryTag && c.isValid);
  }

  /**
   * Starts a new diplomatic / espionage claim fabrication assignment
   */
  public startClaimFabrication(
    claimantCountry: string,
    targetCountry: string,
    targetLocationId: number,
    targetLocationName: string,
    agentId: string,
    agentIntrigue: number,
    targetCounterEspionage: number = 0.25,
    baseSpeed: number = 5.0
  ): ActiveClaimJustification {
    const id = `fab_${claimantCountry}_${targetCountry}_${targetLocationId}`;
    const justification: ActiveClaimJustification = {
      id,
      claimantCountry,
      targetCountry,
      targetLocationId,
      targetLocationName,
      agentId,
      agentIntrigue,
      targetCounterEspionage: Math.max(0.1, targetCounterEspionage),
      progressPercentage: 0.0,
      baseSpeed,
      isCompleted: false
    };

    this.justifications.set(id, justification);
    return justification;
  }

  /**
   * Monthly Tick Justification Loop:
   * Equation:
   * Claim_Progress += Base_Speed * (Agent_Intrigue / Target_Counter_Espionage)
   * When Progress >= 100%, generates a formal TerritorialClaim and unlocks a Casus Belli.
   */
  public processMonthlyJustificationTick(currentDateStr: string = '1350-04-01'): CasusBelli[] {
    const unlockedCBs: CasusBelli[] = [];

    for (const just of this.justifications.values()) {
      if (just.isCompleted) continue;

      // Calculate progress increment
      const intrigueFactor = just.agentIntrigue / 50.0; // 1.0 at 50 intrigue, 2.0 at 100 intrigue
      const mitigation = Math.max(0.2, 1.0 - just.targetCounterEspionage);
      const delta = just.baseSpeed * intrigueFactor * mitigation;

      just.progressPercentage = Math.min(100.0, just.progressPercentage + delta);

      if (just.progressPercentage >= 100.0) {
        just.isCompleted = true;

        // 1. Create Territorial Claim (Expires in 25 years = 300 months)
        const claimId = `claim_${just.claimantCountry}_${just.targetLocationId}`;
        const newClaim: TerritorialClaim = {
          id: claimId,
          claimantCountry: just.claimantCountry,
          targetCountry: just.targetCountry,
          targetLocationId: just.targetLocationId,
          targetLocationName: just.targetLocationName,
          claimType: 'Fabricated',
          createdDate: currentDateStr,
          expiryDate: '1375-04-01', // Fabricated claims expire
          isValid: true
        };
        this.registerClaim(newClaim);

        // 2. Unlock Conquest Casus Belli
        const cb: CasusBelli = {
          id: `cb_conquest_${just.claimantCountry}_${just.targetLocationId}`,
          type: 'Conquest',
          name: `Conquest of ${just.targetLocationName}`,
          claimantCountry: just.claimantCountry,
          targetCountry: just.targetCountry,
          targetLocationId: just.targetLocationId,
          warGoalDescription: `Seize legal possession of ${just.targetLocationName}`,
          tradeEmbargoEnforced: true,
          prestigeReward: 25.0,
          infamyGenerationModifier: 0.75
        };

        const existing = this.availableCasusBelli.get(just.claimantCountry) || [];
        existing.push(cb);
        this.availableCasusBelli.set(just.claimantCountry, existing);
        unlockedCBs.push(cb);
      }
    }

    return unlockedCBs;
  }

  /**
   * Executes a formal War Declaration using an active Casus Belli:
   * Locks the targeted nations out of trade actions between their respective market hubs.
   */
  public declareWar(
    cb: CasusBelli,
    currentDateStr: string = '1350-04-01',
    marketHubsToBlockade: number[] = []
  ): WarDeclarationResult {
    const warId = `war_${cb.claimantCountry}_vs_${cb.targetCountry}_${Date.now()}`;

    // Remove Casus Belli after utilization
    const existing = this.availableCasusBelli.get(cb.claimantCountry) || [];
    this.availableCasusBelli.set(
      cb.claimantCountry,
      existing.filter(c => c.id !== cb.id)
    );

    return {
      warId,
      casusBelliUsed: cb,
      attackerTag: cb.claimantCountry,
      defenderTag: cb.targetCountry,
      tradeActionsLocked: true, // Bilateral trade embargo enforced!
      blockadedMarketHubs: marketHubsToBlockade,
      declarationDate: currentDateStr
    };
  }
}
