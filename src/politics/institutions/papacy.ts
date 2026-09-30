/**
 * Papacy & Curia Control Loop
 * Manages Papal Influence investments, Curia Controller election, Excommunication, and Crusades.
 */

import type { PopEntity } from '../../demographics/pop.ts';
import { EstateType } from '../../core/types.ts';

export interface PapalState {
  curiaControllerTag: string | null;
  papalInfluenceLedger: Map<string, number>; // CountryTag -> Available Papal Influence
  curiaInvestmentBids: Map<string, number>;  // CountryTag -> Invested Influence for Curia election
  excommunicatedRulers: Set<string>;        // CountryTags of excommunicated monarchs
  activeCrusadeTarget: string | null;       // Target Heathen CountryTag
}

export interface ExcommunicationResult {
  targetCountryTag: string;
  success: boolean;
  legitimacyReducedToZero: boolean;
  nobilityUnrestAdded: number;
  popsAffected: number;
  description: string;
}

export class PapacySubsystem {
  private state: PapalState;

  constructor(initialController: string | null = 'FRA') {
    this.state = {
      curiaControllerTag: initialController,
      papalInfluenceLedger: new Map(),
      curiaInvestmentBids: new Map(),
      excommunicatedRulers: new Set(),
      activeCrusadeTarget: null
    };
  }

  public getCuriaController(): string | null {
    return this.state.curiaControllerTag;
  }

  public getPapalInfluence(countryTag: string): number {
    return this.state.papalInfluenceLedger.get(countryTag) || 0.0;
  }

  public addPapalInfluence(countryTag: string, amount: number): void {
    const curr = this.getPapalInfluence(countryTag);
    this.state.papalInfluenceLedger.set(countryTag, Math.min(100.0, Math.max(0.0, curr + amount)));
  }

  /**
   * Catholic nations invest influence to increase chance of becoming Curia Controller
   */
  public investInCuria(countryTag: string, amount: number): boolean {
    const available = this.getPapalInfluence(countryTag);
    if (available < amount) return false;

    this.state.papalInfluenceLedger.set(countryTag, available - amount);
    const currBid = this.state.curiaInvestmentBids.get(countryTag) || 0;
    this.state.curiaInvestmentBids.set(countryTag, currBid + amount);
    return true;
  }

  /**
   * Conclave election pass: Candidate with highest invested bids becomes Curia Controller
   */
  public electCuriaController(): string | null {
    let winningTag: string | null = null;
    let highestBid = -1;

    for (const [tag, bid] of this.state.curiaInvestmentBids.entries()) {
      if (bid > highestBid) {
        highestBid = bid;
        winningTag = tag;
      }
    }

    if (winningTag) {
      this.state.curiaControllerTag = winningTag;
      this.state.curiaInvestmentBids.clear(); // Reset conclave bids
    }

    return winningTag;
  }

  /**
   * Curia Controller Action: Excommunicate Ruler
   * 1. Drops the target's Legitimacy / Stability to 0.0
   * 2. Raises Nobility unrest globally (+0.35) across all target realm pops
   */
  public excommunicateRuler(
    callerTag: string,
    targetCountryTag: string,
    targetRealmState: { crownPower?: number; legitimacy?: number },
    targetPops: PopEntity[]
  ): ExcommunicationResult {
    if (this.state.curiaControllerTag !== callerTag) {
      return {
        targetCountryTag,
        success: false,
        legitimacyReducedToZero: false,
        nobilityUnrestAdded: 0,
        popsAffected: 0,
        description: 'Only the active Curia Controller can petition the Pope to excommunicate a monarch.'
      };
    }

    this.state.excommunicatedRulers.add(targetCountryTag);

    // 1. Drop legitimacy & crown stability to 0
    if (targetRealmState.legitimacy !== undefined) {
      targetRealmState.legitimacy = 0.0;
    }
    if (targetRealmState.crownPower !== undefined) {
      targetRealmState.crownPower = 0.0;
    }

    // 2. Raise Nobility unrest globally by +0.35
    let affectedPopsCount = 0;
    for (const pop of targetPops) {
      if (pop.estate_type === EstateType.Nobility) {
        pop.militancy_unrest = Math.min(1.0, pop.militancy_unrest + 0.35);
        affectedPopsCount++;
      }
    }

    return {
      targetCountryTag,
      success: true,
      legitimacyReducedToZero: true,
      nobilityUnrestAdded: 0.35,
      popsAffected: affectedPopsCount,
      description: `Papal Bull issued! Monarch of ${targetCountryTag} is excommunicated. Legitimacy collapsed to 0; Nobility unrest escalated.`
    };
  }

  /**
   * Curia Controller Action: Sanction Holy Crusade against a heathen state
   */
  public sanctionCrusade(callerTag: string, targetHeathenTag: string): boolean {
    if (this.state.curiaControllerTag !== callerTag) return false;
    this.state.activeCrusadeTarget = targetHeathenTag;
    return true;
  }

  public isExcommunicated(countryTag: string): boolean {
    return this.state.excommunicatedRulers.has(countryTag);
  }
}
