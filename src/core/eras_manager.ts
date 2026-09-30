/**
 * Global Golden Age & Historical Eras State Machine
 * Subsystem: /src/core/eras_manager.ts
 */

export const HistoricalEra = {
  Age_Of_Feudalism: 'Age_Of_Feudalism',
  Age_Of_Renaissance: 'Age_Of_Renaissance',
  Age_Of_Discovery: 'Age_Of_Discovery',
  Age_Of_Reformation: 'Age_Of_Reformation'
} as const;

export type HistoricalEra = typeof HistoricalEra[keyof typeof HistoricalEra];

export interface GoldenAgePayload {
  countryTag: string;
  isActive: boolean;
  remainingDailyTicks: number; // Exactly 3650 days (10 years)
  hasAlreadyUsedGoldenAge: boolean;
  controlDecayModifier: number; // 0.75 (-25% state-wide control decay)
  burgherWealthModifier: number; // 1.30 (+30% burgher wealth generation)
  siegeSupplyCostModifier: number; // 0.85 (-15% supply line maintenance in sieges)
}

export class ErasManager {
  private currentEra: HistoricalEra = HistoricalEra.Age_Of_Feudalism;
  private completedRenaissanceMarketHubs: number = 0;
  private goldenAgeRegistry: Map<string, GoldenAgePayload> = new Map();

  constructor(initialEra: HistoricalEra = HistoricalEra.Age_Of_Feudalism) {
    this.currentEra = initialEra;
  }

  public getCurrentEra(): HistoricalEra {
    return this.currentEra;
  }

  public getEraDisplayName(): string {
    switch (this.currentEra) {
      case HistoricalEra.Age_Of_Feudalism:
        return 'AGE OF FEUDALISM';
      case HistoricalEra.Age_Of_Renaissance:
        return 'AGE OF RENAISSANCE';
      case HistoricalEra.Age_Of_Discovery:
        return 'AGE OF DISCOVERY';
      case HistoricalEra.Age_Of_Reformation:
        return 'AGE OF REFORMATION';
      default:
        return 'AGE OF FEUDALISM';
    }
  }

  /**
   * Structural Era Transition Trigger:
   * Dynamic transition based on world milestones.
   * Moving from Age of Feudalism to Age of Renaissance triggers once >= 3 major market hubs
   * reach 100% Renaissance presence.
   */
  public evaluateEraProgression(completedRenaissanceHubs: number): {
    eraChanged: boolean;
    newEra: HistoricalEra;
  } {
    this.completedRenaissanceMarketHubs = completedRenaissanceHubs;

    if (
      this.currentEra === HistoricalEra.Age_Of_Feudalism &&
      this.completedRenaissanceMarketHubs >= 3
    ) {
      this.currentEra = HistoricalEra.Age_Of_Renaissance;
      return {
        eraChanged: true,
        newEra: this.currentEra
      };
    }

    return {
      eraChanged: false,
      newEra: this.currentEra
    };
  }

  /**
   * Evaluates if a sovereign tag can trigger their once-per-campaign Golden Age
   * Requires: Prestige > 80.0 and Legitimacy > 90.0
   */
  public canActivateGoldenAge(
    countryTag: string,
    prestige: number,
    legitimacy: number
  ): boolean {
    const existing = this.goldenAgeRegistry.get(countryTag);
    if (existing && existing.hasAlreadyUsedGoldenAge) {
      return false;
    }

    return prestige > 80.0 && legitimacy > 90.0;
  }

  /**
   * Activates Sovereign Golden Age:
   * Duration: exactly 3650 daily engine ticks (10 years)
   * Modifiers:
   * - Control_Decay_Rate reduced by 25% (modifier: 0.75)
   * - Burgher Wealth Generation increased by +30% (modifier: 1.30)
   * - Military Supply Line Maintenance in fort sieges reduced by 15% (modifier: 0.85)
   */
  public activateGoldenAge(
    countryTag: string,
    prestige: number,
    legitimacy: number
  ): GoldenAgePayload | null {
    if (!this.canActivateGoldenAge(countryTag, prestige, legitimacy)) {
      return null;
    }

    const payload: GoldenAgePayload = {
      countryTag,
      isActive: true,
      remainingDailyTicks: 3650,
      hasAlreadyUsedGoldenAge: true,
      controlDecayModifier: 0.75,
      burgherWealthModifier: 1.30,
      siegeSupplyCostModifier: 0.85
    };

    this.goldenAgeRegistry.set(countryTag, payload);
    return payload;
  }

  /**
   * Daily Engine Tick for Golden Age duration countdown
   */
  public processDailyTick(countryTag: string): void {
    const payload = this.goldenAgeRegistry.get(countryTag);
    if (!payload || !payload.isActive) return;

    if (payload.remainingDailyTicks > 0) {
      payload.remainingDailyTicks--;
      if (payload.remainingDailyTicks === 0) {
        payload.isActive = false;
      }
    }
  }

  public getGoldenAgeStatus(countryTag: string): GoldenAgePayload | undefined {
    return this.goldenAgeRegistry.get(countryTag);
  }
}
