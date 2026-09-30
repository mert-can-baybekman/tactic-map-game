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
import { CourtAndDynastyEngine, CharacterSex, CharacterRole, type RulerCharacter } from '../politics/court.ts';
import { HudTelemetryEngine, HistoricalAge } from './hud.ts';
import { OutlinerRegistryEngine } from './outliner.ts';
import { GlobalSpatialMapEngine } from '../map/spatial.ts';

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
  activeRulerId: number;
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
  public court: CourtAndDynastyEngine = new CourtAndDynastyEngine();
  public hud: HudTelemetryEngine = new HudTelemetryEngine();
  public outliner: OutlinerRegistryEngine = new OutlinerRegistryEngine();
  public spatial: GlobalSpatialMapEngine = new GlobalSpatialMapEngine();

  public playerRealm: RealmState = {
    id: 1,
    name: 'Kingdom of England',
    treasuryGold: 2500.0,
    crownPower: 0.65,
    capitalLocationId: 1,
    activeRulerId: 1
  };

  public fieldArmies: FieldArmy[] = [];
  public hostileZoCLocations: Set<number> = new Set();
  public enemyOccupiedLocations: Set<number> = new Set();

  constructor(capitalLocationId: number = 1) {
    this.control = new StateControlEngine(capitalLocationId);
    this.playerRealm.capitalLocationId = capitalLocationId;
    this.initializeDefaultCourt();
  }

  private initializeDefaultCourt(): void {
    const kingEdward = this.court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward III',
      country_id: 1,
      age: 38,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'ruler_edward_iii.png',
      current_role: CharacterRole.Ruler,
      attributes: { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 },
      traits: [
        {
          id: 'valiant_warrior',
          name: 'Valiant Warrior',
          category: 'personality',
          modifiers: { combat_shock_bonus: 0.15 }
        },
        {
          id: 'feudal_sovereign',
          name: 'Feudal Sovereign',
          category: 'lifestyle',
          modifiers: { estate_loyalty_impact: { Nobility: 10.0 } }
        },
        {
          id: 'gout_afflicted',
          name: 'Gout Afflicted',
          category: 'personality',
          modifiers: { health_degradation_penalty: 1.8 }
        }
      ],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 50.0
    });

    this.playerRealm.activeRulerId = kingEdward.id;

    // Heir: Edward of Woodstock (Black Prince)
    this.court.createCharacter({
      dynasty_id: 1,
      dynasty_name: 'Plantagenet',
      first_name: 'Edward of Woodstock (Black Prince)',
      country_id: 1,
      age: 20,
      sex: CharacterSex.Male,
      portrait_asset_ref: 'black_prince.png',
      current_role: CharacterRole.Heir,
      attributes: { martial: 95, diplomacy: 60, stewardship: 55, learning: 45, intrigue: 50 },
      traits: [{
        id: 'valiant_warrior',
        name: 'Valiant Warrior',
        category: 'commander',
        modifiers: { combat_shock_bonus: 0.20 }
      }],
      culture_id: 'anglo_norman',
      sub_culture_variant: 'english_gothic',
      religion_id: 'catholic',
      is_alive: true,
      children_ids: [],
      dynastic_prestige: 75.0
    });
  }

  /**
   * Advance simulation by 1 Day Tick
   */
  public executeDayTick(): void {
    this.totalTicks++;
    this.calendar.day++;

    // 1. Military logistics & supply lines verification
    this.logistics.executeLogisticsTick(
      this.fieldArmies,
      this.locations,
      this.demographics,
      this.hostileZoCLocations,
      this.enemyOccupiedLocations
    );

    // 2. Health & mortality check pass
    this.court.executeHealthAndMortalityTick();

    // End of Month Check (30 days/month calendar model)
    if (this.calendar.day > 30) {
      this.calendar.day = 1;
      this.calendar.month++;
      this.processMonthEndTick();

      if (this.calendar.month > 12) {
        this.calendar.month = 1;
        this.calendar.year++;
        this.executeYearTick();
      }
    }
  }

  /**
   * Month-End Tick Execution:
   * ProcessMonthEndTick() coordinates:
   * 1. State Control Decay Pathfinding
   * 2. Production value chains & market price balancing
   * 3. Demographic pop growth & migration flow fields
   * 4. Outliner task progression scaled by Ruler Stewardship
   * 5. Estate power equilibrium & tax skimming routing
   * 6. Flushing telemetry directly to topbar HUD
   */
  public processMonthEndTick(): {
    netIncome: number;
    taxesCollected: number;
    manpowerGrowth: number;
    normandyProgress: number;
    calaisProgress: number;
  } {
    // 1. Compute State Control over all Locations
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
    
    // Ruler stewardship bonus modifier on tax collection
    const activeRuler = this.court.getCharacter(this.playerRealm.activeRulerId);
    const taxMultiplier = activeRuler ? activeRuler.active_modifiers.monthly_tax_multiplier : 1.0;
    const effectiveCrownRevenue = taxResults.crownTreasuryCollected * taxMultiplier;
    this.playerRealm.treasuryGold += effectiveCrownRevenue;

    // 9. Outliner Government Task Progression
    // Stewardship reduction factor accelerates task progress
    const stewardshipDiscount = activeRuler ? activeRuler.active_modifiers.stewardship_construction_discount : 0.0;
    const speedMultiplier = 1.0 + stewardshipDiscount;

    this.outliner.updateTaskProgress('task_normandy', 0.35 * speedMultiplier);
    this.outliner.updateTaskProgress('task_calais_walls', 1.20 * speedMultiplier);

    // 10. Devastation Natural Recovery
    this.locations.applyDevastationDecay();

    return {
      netIncome: effectiveCrownRevenue,
      taxesCollected: taxResults.crownTreasuryCollected,
      manpowerGrowth: 350,
      normandyProgress: 0.35 * speedMultiplier,
      calaisProgress: 1.20 * speedMultiplier
    };
  }

  public executeMonthTick(): void {
    this.processMonthEndTick();
  }

  /**
   * Yearly Macro/Privilege Tick
   */
  public executeYearTick(): void {
    this.demographics.executeAssimilationTick('anglo_norman', 'catholic');
  }
}
