/**
 * Topbar HUD Telemetry Framework & Dynamic Historical Age Engine
 * Inspired by Project Caesar Visual Reference Standard
 */

export const HistoricalAge = {
  AgeOfTraditions: 'AgeOfTraditions',
  AgeOfRenaissance: 'AgeOfRenaissance',
  AgeOfDiscovery: 'AgeOfDiscovery',
  AgeOfReformation: 'AgeOfReformation',
  AgeOfAbsolutism: 'AgeOfAbsolutism',
  AgeOfRevolutions: 'AgeOfRevolutions'
} as const;
export type HistoricalAge = typeof HistoricalAge[keyof typeof HistoricalAge];

export interface TreasuryBalanceSheet {
  storedDucats: number;
  monthlyTaxIncome: number;
  monthlyProductionIncome: number;
  monthlyTradeTariffs: number;
  monthlyArmyMaintenance: number;
  monthlyFleetMaintenance: number;
  monthlyFortMaintenance: number;
  monthlyCourtExpenses: number;
  netMonthlyBalance: number;
}

export interface ManpowerTelemetry {
  currentPool: number;
  maxCapacity: number;
  monthlyRecovery: number;
  conscriptionLaw: string;
}

export interface StateStabilityHeader {
  stabilityValue: number;    // -3 to +3
  stabilityProgress: number; // 0.0 to 100.0%
  legitimacy: number;        // 0 to 100
  crownPower: number;        // 0.0 to 1.0 (Centralization)
  prestige: number;          // -100 to +100
  powerProjection: number;   // 0 to 100
  merchantsAvailable: number;
  diplomatsAvailable: number;
}

export interface AgeModifierPackage {
  age: HistoricalAge;
  name: string;
  startYear: number;
  endYear: number;
  globalTradeEfficiency: number;
  techCostModifier: number;
  religiousEstateFervorMultiplier: number;
  navalDoctrineUnlocked: string[];
}

export class HudTelemetryEngine {
  public activeAge: HistoricalAge = HistoricalAge.AgeOfRenaissance;

  private ageDefinitions: Map<HistoricalAge, AgeModifierPackage> = new Map([
    [
      HistoricalAge.AgeOfTraditions,
      {
        age: HistoricalAge.AgeOfTraditions,
        name: 'Age of Feudal Traditions',
        startYear: 1337,
        endYear: 1450,
        globalTradeEfficiency: 0.85,
        techCostModifier: 1.15,
        religiousEstateFervorMultiplier: 1.25,
        navalDoctrineUnlocked: ['coastal_galleys']
      }
    ],
    [
      HistoricalAge.AgeOfRenaissance,
      {
        age: HistoricalAge.AgeOfRenaissance,
        name: 'Age of Renaissance',
        startYear: 1450,
        endYear: 1530,
        globalTradeEfficiency: 1.10,
        techCostModifier: 0.90,
        religiousEstateFervorMultiplier: 1.0,
        navalDoctrineUnlocked: ['caravel_exploration', 'print_patronage']
      }
    ],
    [
      HistoricalAge.AgeOfDiscovery,
      {
        age: HistoricalAge.AgeOfDiscovery,
        name: 'Age of Discovery',
        startYear: 1530,
        endYear: 1610,
        globalTradeEfficiency: 1.25,
        techCostModifier: 0.85,
        religiousEstateFervorMultiplier: 0.90,
        navalDoctrineUnlocked: ['transatlantic_galleons', 'chartered_companies']
      }
    ]
  ]);

  public getActiveAgePackage(): AgeModifierPackage {
    return this.ageDefinitions.get(this.activeAge)!;
  }

  public setHistoricalAge(age: HistoricalAge): void {
    if (this.ageDefinitions.has(age)) {
      this.activeAge = age;
    }
  }

  /**
   * Generates complete HUD telemetry payload for topbar rendering
   */
  public generateTelemetryPayload(
    treasuryDucats: number,
    taxIncome: number,
    productionIncome: number,
    maintenanceCost: number,
    commonerPopTotal: number,
    stabilityVal: number = 2,
    legitimacyVal: number = 88,
    crownPowerVal: number = 0.65
  ): {
    balanceSheet: TreasuryBalanceSheet;
    manpower: ManpowerTelemetry;
    stability: StateStabilityHeader;
    agePackage: AgeModifierPackage;
  } {
    const agePkg = this.getActiveAgePackage();

    const net = (taxIncome + productionIncome) * agePkg.globalTradeEfficiency - maintenanceCost;
    const balanceSheet: TreasuryBalanceSheet = {
      storedDucats: treasuryDucats,
      monthlyTaxIncome: taxIncome,
      monthlyProductionIncome: productionIncome,
      monthlyTradeTariffs: (taxIncome + productionIncome) * (agePkg.globalTradeEfficiency - 1.0),
      monthlyArmyMaintenance: maintenanceCost * 0.7,
      monthlyFleetMaintenance: maintenanceCost * 0.2,
      monthlyFortMaintenance: maintenanceCost * 0.1,
      monthlyCourtExpenses: 15.0,
      netMonthlyBalance: net
    };

    const maxManpower = Math.floor(commonerPopTotal * 0.25);
    const monthlyRecovery = Math.floor(maxManpower / 120); // 10-year full recovery

    const manpower: ManpowerTelemetry = {
      currentPool: Math.floor(maxManpower * 0.78),
      maxCapacity: maxManpower,
      monthlyRecovery,
      conscriptionLaw: 'Feudal Obligation Service'
    };

    const stability: StateStabilityHeader = {
      stabilityValue: Math.max(-3, Math.min(3, stabilityVal)),
      stabilityProgress: 72.5,
      legitimacy: legitimacyVal,
      crownPower: crownPowerVal,
      prestige: 42.0,
      powerProjection: 68.0,
      merchantsAvailable: 3,
      diplomatsAvailable: 2
    };

    return {
      balanceSheet,
      manpower,
      stability,
      agePackage: agePkg
    };
  }
}
