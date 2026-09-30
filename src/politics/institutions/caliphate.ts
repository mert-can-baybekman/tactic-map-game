/**
 * Islamic Caliphate & Piety/Legitimacy Engine
 * Manages Caliphate Authority based on Holy Sites control (Mecca, Medina, Jerusalem)
 * and grants instant Jihad Casus Belli bypassing spy networks.
 */

export interface CaliphateState {
  caliphTag: string; // e.g. 'MAM' (Mamluk Cairo) or 'OTT'
  caliphateAuthority: number; // 0.0 to 100.0
  holySitesControl: Map<string, string>; // HolySiteName -> Controlling CountryTag
}

export interface JihadCasusBelli {
  id: string;
  type: 'Jihad_Casus_Belli';
  name: string;
  claimantCountry: string;
  targetCountry: string;
  holyWarPrestigeBonus: number;
  bypassedClaimTimers: boolean;
}

export class CaliphateSubsystem {
  private state: CaliphateState;

  constructor(initialCaliph: string = 'MAM') {
    this.state = {
      caliphTag: initialCaliph,
      caliphateAuthority: 80.0,
      holySitesControl: new Map([
        ['Jerusalem', 'MAM'],
        ['Mecca', 'MAM'],
        ['Medina', 'MAM']
      ])
    };
  }

  public getCaliph(): string {
    return this.state.caliphTag;
  }

  public getCaliphateAuthority(): number {
    return this.state.caliphateAuthority;
  }

  public setHolySiteController(siteName: string, countryTag: string): void {
    this.state.holySitesControl.set(siteName, countryTag);
    this.recalculateAuthority();
  }

  /**
   * Recalculates Caliphate Authority based on Holy Sites held by the Caliph tag
   * Each Holy Site held (Mecca, Medina, Jerusalem) contributes +25 to 30 Authority
   */
  public recalculateAuthority(): number {
    let sitesHeld = 0;
    for (const controller of this.state.holySitesControl.values()) {
      if (controller === this.state.caliphTag) {
        sitesHeld++;
      }
    }

    this.state.caliphateAuthority = Math.min(100.0, sitesHeld * 30.0 + 10.0);
    return this.state.caliphateAuthority;
  }

  /**
   * Declares a Holy Jihad Casus Belli:
   * Bypasses standard espionage claim fabrication timers entirely if Caliphate Authority >= 70.0.
   */
  public declareJihadCasusBelli(claimantTag: string, targetHeathenTag: string): JihadCasusBelli | null {
    // Only valid if Caliphate Authority is strong or claimant is the Caliph
    if (this.state.caliphateAuthority < 70.0 && claimantTag !== this.state.caliphTag) {
      return null;
    }

    return {
      id: `cb_jihad_${claimantTag}_${targetHeathenTag}_${Date.now()}`,
      type: 'Jihad_Casus_Belli',
      name: `Holy Jihad against ${targetHeathenTag}`,
      claimantCountry: claimantTag,
      targetCountry: targetHeathenTag,
      holyWarPrestigeBonus: 35.0,
      bypassedClaimTimers: true
    };
  }
}
