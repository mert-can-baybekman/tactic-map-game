/**
 * Procedural Imperial Decay & Fall of Constantinople End-Game Suite
 * Manages the dynamic encirclement of remnant imperial capitals,
 * unrest and control decay floors, and the historical transformation into Istanbul.
 */

export interface EncirclementCheckResult {
  isEncircled: boolean;
  adjacentNodesControlled: number[];
  adjacentNodesRequired: number[];
  monthlyUnrestModifier: number;
  controlFloor: number;
  stateTriggered: boolean;
}

export interface EstateLoyaltyState {
  nobilityLoyalty: number;
  nobilityPower: number;
  burgherLoyalty: number;
  burgherWealthRate: number;
  clergyLoyalty: number;
}

export interface LocationState {
  id: number;
  name: string;
  country: string;
  control: number;
  unrest: number;
  isCapital: boolean;
  isWorldMarketHub: boolean;
  religion: string;
  culture: string;
}

export interface NationState {
  tag: string;
  name: string;
  capitalLocationId: number;
  estates: EstateLoyaltyState;
  monthlyTradeIncomeBonus: number;
}

export interface FallOfConstantinoplePayload {
  success: boolean;
  newLocationName: string;
  newCapitalLocationId: number;
  previousOwnerTag: string;
  conquerorTag: string;
  nobilityLoyaltyDelta: number;
  burgherWealthRateMultiplier: number;
  worldMarketHubDesignated: boolean;
  timestamp: string;
}

export class ImperialCollapseEngine {
  // Required adjacent peripheral nodes to surround Constantinople (104):
  // Adrianople (110), Thessalonica (107), Gallipoli (103)
  private readonly constantinopleAdjacentNodeIds = [110, 107, 103];
  private isEncirclementActive: boolean = false;
  private hasConstantinopleFallen: boolean = false;

  /**
   * The Encircle Capital Protocol:
   * Checks if the Ottoman (TUR/OTT) tag successfully conquers or vassals all locations
   * adjacent to Constantinople (Adrianople, Thessalonica, Gallipoli).
   * If fulfilled, triggers Imperial Encirclement State:
   * - Injects permanent +2.0 Monthly Unrest inside Constantinople
   * - Clamps local Crown Control to a fixed 10% floor (0.10).
   */
  public evaluateImperialEncirclement(
    conquerorTag: string, // 'TUR' or 'OTT'
    controlledLocationIds: number[],
    constantinopleLocation: LocationState
  ): EncirclementCheckResult {
    const controlledSet = new Set(controlledLocationIds);
    const adjacentControlled = this.constantinopleAdjacentNodeIds.filter(id => controlledSet.has(id));
    const allSurrounded = adjacentControlled.length === this.constantinopleAdjacentNodeIds.length;

    if (allSurrounded) {
      this.isEncirclementActive = true;
      // Inject +2.0 Monthly Unrest
      constantinopleLocation.unrest = Math.min(10.0, constantinopleLocation.unrest + 2.0);
      // Force Crown Control down to 10% fixed floor
      constantinopleLocation.control = Math.min(constantinopleLocation.control, 0.10);

      return {
        isEncircled: true,
        adjacentNodesControlled: adjacentControlled,
        adjacentNodesRequired: this.constantinopleAdjacentNodeIds,
        monthlyUnrestModifier: 2.0,
        controlFloor: 0.10,
        stateTriggered: true
      };
    }

    return {
      isEncircled: false,
      adjacentNodesControlled: adjacentControlled,
      adjacentNodesRequired: this.constantinopleAdjacentNodeIds,
      monthlyUnrestModifier: 0.0,
      controlFloor: constantinopleLocation.control,
      stateTriggered: false
    };
  }

  /**
   * The Conquest Execution Payload:
   * Executes when the siege tick of Constantinople reaches 100% completion by an Islamic/Ottoman force:
   * 1. Renames location from "Constantinople" to "Istanbul".
   * 2. Transfers Ottoman Primary Capital pointer to this node (104).
   * 3. Triggers Estate Loyalty Realignment:
   *    - Nobility Loyalty drops by 30% (centralized crown authority expansion)
   *    - Burgher Wealth Generation increases by 50% state-wide
   * 4. Designates Istanbul as the absolute World Market Hub Vertex.
   */
  public triggerFallOfConstantinople(
    constantinopleLocation: LocationState,
    ottomanNation: NationState,
    siegeCompletionPercent: number
  ): FallOfConstantinoplePayload {
    if (siegeCompletionPercent < 100.0) {
      throw new Error(`Cannot execute Fall of Constantinople: Siege is only at ${siegeCompletionPercent}%.`);
    }

    if (this.hasConstantinopleFallen) {
      throw new Error('Fall of Constantinople event has already executed.');
    }

    const previousOwner = constantinopleLocation.country;

    // 1. Rename Location to Istanbul and update tags
    constantinopleLocation.name = 'Istanbul';
    constantinopleLocation.country = ottomanNation.tag;
    constantinopleLocation.isCapital = true;
    constantinopleLocation.isWorldMarketHub = true;
    constantinopleLocation.control = 0.90; // High sovereign presence
    constantinopleLocation.unrest = 0.05; // Pacified post-conquest

    // 2. Transfer Ottoman Primary Capital pointer directly to this node
    ottomanNation.capitalLocationId = constantinopleLocation.id; // 104

    // 3. Estate Loyalty Realignment
    // Nobility Loyalty drops by 30% (due to centralized imperial centralization)
    ottomanNation.estates.nobilityLoyalty = Math.max(0.0, ottomanNation.estates.nobilityLoyalty - 30.0);
    // Burgher Wealth Generation increases by 50% state-wide
    ottomanNation.estates.burgherWealthRate = Number((ottomanNation.estates.burgherWealthRate * 1.50).toFixed(2));
    // Global trade income metric in Topbar HUD expanded (+50.0 D / mo)
    ottomanNation.monthlyTradeIncomeBonus += 50.0;

    this.hasConstantinopleFallen = true;

    return {
      success: true,
      newLocationName: 'Istanbul',
      newCapitalLocationId: constantinopleLocation.id,
      previousOwnerTag: previousOwner,
      conquerorTag: ottomanNation.tag,
      nobilityLoyaltyDelta: -30.0,
      burgherWealthRateMultiplier: 1.50,
      worldMarketHubDesignated: true,
      timestamp: new Date().toISOString()
    };
  }

  public isEncircled(): boolean {
    return this.isEncirclementActive;
  }

  public isFallen(): boolean {
    return this.hasConstantinopleFallen;
  }
}
