import { LocationRegistry } from '../map/location.ts';
import { PopDemographicEngine } from '../demographics/pop.ts';
import { EstateGovernanceEngine } from '../politics/estates.ts';
import { StateControlEngine } from '../politics/control.ts';
import { MarketEconomyEngine } from '../economy/market.ts';
import { ProductionEngine } from '../economy/production.ts';
import { FeudalLevyEngine } from '../military/levy.ts';
import { TacticalCombatEngine } from '../military/combat.ts';
import { MilitaryLogisticsEngine, type FieldArmy } from '../military/logistics.ts';
import { PeaceTreatyEngine } from '../politics/treaty.ts';

export interface GameCalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface RealmState {
  id: number;
  name: string;
  treasuryGold: number;
  crownPower: number; // 0.0 to 1.0
  capitalLocationId: number;
}

export class GrandStrategyEngine {
  public calendar: GameCalendarDate = { year: 1350, month: 1, day: 1 };
  public totalTicks: number = 0;

  // Subsystem Engines
  public locations: LocationRegistry = new LocationRegistry();
  public demographics: PopDemographicEngine = new PopDemographicEngine();
  public estates: EstateGovernanceEngine = new EstateGovernanceEngine();
  public control: StateControlEngine;
  public markets: MarketEconomyEngine = new MarketEconomyEngine();
  public production: ProductionEngine = new ProductionEngine();
  public levies: FeudalLevyEngine = new FeudalLevyEngine();
  public combat: TacticalCombatEngine = new TacticalCombatEngine();
  public logistics: MilitaryLogisticsEngine = new MilitaryLogisticsEngine();
  public treaties: PeaceTreatyEngine = new PeaceTreatyEngine();

  public playerRealm: RealmState = {
    id: 1,
    name: 'Kingdom of England',
    treasuryGold: 2500.0,
    crownPower: 0.65,
    capitalLocationId: 1
  };

  public fieldArmies: FieldArmy[] = [];
  public hostileZoCLocations: Set<number> = new Set();
  public enemyOccupiedLocations: Set<number> = new Set();

  constructor(capitalLocationId: number = 1) {
    this.control = new StateControlEngine(capitalLocationId);
    this.playerRealm.capitalLocationId = capitalLocationId;
  }

  /**
   * Advance simulation by 1 Day Tick
   */
  public executeDayTick(): void {
    this.totalTicks++;
    this.calendar.day++;

    // Logistics & Attrition System executed daily
    this.logistics.executeLogisticsTick(
      this.fieldArmies,
      this.locations,
      this.demographics,
      this.hostileZoCLocations,
      this.enemyOccupiedLocations
    );

    // End of Month Check (30 days/month calendar model)
    if (this.calendar.day > 30) {
      this.calendar.day = 1;
      this.calendar.month++;
      this.executeMonthTick();

      if (this.calendar.month > 12) {
        this.calendar.month = 1;
        this.calendar.year++;
        this.executeYearTick();
      }
    }
  }

  /**
   * Advance simulation by 1 Monthly Economic/Demographic Tick
   */
  public executeMonthTick(): void {
    // 1. Compute State Control over all Locations via Logistical Pathfinding
    this.control.computeRealmControl(this.locations);

    // 2. Production Chains: Raw Extraction & Workshop Value Chains
    this.markets.resetTickSupplyDemand();
    this.production.executeProductionTick(this.locations, this.demographics, this.markets);

    // 3. Market Dynamic Trade & Price Clearing
    this.markets.executeMarketClearingTick();

    // 4. Pop Demographic Growth Tick
    this.demographics.executeGrowthTick(this.locations);

    // 5. Pop Migration Flow Calculations
    const allPops = this.demographics.getAllPops();
    const avgWealth = allPops.length > 0 ? allPops.reduce((sum, p) => sum + p.wealth, 0) / allPops.length : 10.0;
    const migrationVectors = this.demographics.calculateMigrationFlows(this.locations, avgWealth);
    this.demographics.applyMigration(migrationVectors);

    // 6. Epidemiological Contagion Tick
    const tradeVolumes = new Map<number, number>();
    for (const route of this.markets.getTradeRoutes()) {
      tradeVolumes.set(route.sourceHubId, (tradeVolumes.get(route.sourceHubId) || 0) + route.active_throughput);
      tradeVolumes.set(route.targetHubId, (tradeVolumes.get(route.targetHubId) || 0) + route.active_throughput);
    }
    this.demographics.executePlagueContagionTick(this.locations, tradeVolumes);

    // 7. Estate Institutional Power & Equilibrium Updates
    this.estates.updateEstatePowerEquilibriums(this.demographics, this.playerRealm.crownPower);

    // 8. Tax Revenue Skimming Routing: Crown Treasury vs Estate Vaults
    const taxResults = this.control.executeTaxCollectionAndSkimming(this.locations, this.estates);
    this.playerRealm.treasuryGold += taxResults.crownTreasuryCollected;

    // 9. Devastation Natural Recovery
    this.locations.applyDevastationDecay();
  }

  /**
   * Yearly Macro/Privilege Tick
   */
  public executeYearTick(): void {
    // Cultural and Religious organic assimilation
    this.demographics.executeAssimilationTick('anglo_norman', 'catholic');
  }
}
