/**
 * Dynamic Trade Embargos & Global Naval Blockade Manager
 * Handles graph-edge embargo routing penalties, fleet-driven port blockades, and workshop starvation
 */

export interface TradeEmbargo {
  sourceTag: string; // The country enforcing the embargo
  targetTag: string; // The country being embargoed
  dateEnacted: string;
  isActive: boolean;
}

export interface NavalBlockade {
  id: string;
  blockadingTag: string;
  targetTag: string;
  maritimeNodeId: number;        // Strait / Sea zone where fleet is stationed
  targetPortLocationId: number;   // Coastal port being blockaded
  fleetNavalPower: number;
  portInfrastructureLevel: number;
  blockadeEfficiency: number;     // Clamped 0.0 to 1.0
  dailyDevastationRate: number;   // Base rate per day (e.g. 0.002 = +0.2%/day)
  isActive: boolean;
}

export class TradeInterdictionManager {
  private embargos: Map<string, TradeEmbargo> = new Map();
  private blockades: Map<string, NavalBlockade> = new Map();

  /**
   * Enacts an embargo from source tag against target tag
   */
  public enactEmbargo(sourceTag: string, targetTag: string, dateEnacted: string = '1350-01-01'): void {
    const key = `${sourceTag}_against_${targetTag}`;
    this.embargos.set(key, {
      sourceTag,
      targetTag,
      dateEnacted,
      isActive: true
    });
  }

  /**
   * Lifts an active embargo
   */
  public liftEmbargo(sourceTag: string, targetTag: string): boolean {
    const key = `${sourceTag}_against_${targetTag}`;
    return this.embargos.delete(key);
  }

  /**
   * Checks whether a bilateral embargo is in effect between two tags
   */
  public isEmbargoActive(sourceTag: string, targetTag: string): boolean {
    const key = `${sourceTag}_against_${targetTag}`;
    const emb = this.embargos.get(key);
    return emb ? emb.isActive : false;
  }

  /**
   * Computes the transport cost multiplier for a trade edge between two country vertices
   * If an embargo is in effect, returns infinite cost (999,999.0)
   */
  public evaluateEdgeTransportCost(sourceTag: string, targetTag: string, baseCost: number = 1.0): number {
    if (sourceTag === targetTag) return baseCost;

    if (this.isEmbargoActive(sourceTag, targetTag) || this.isEmbargoActive(targetTag, sourceTag)) {
      return 999999.0; // Infinite transport cost penalty blocking trade
    }

    return baseCost;
  }

  /**
   * Toggles or registers a naval blockade operation in a maritime location
   */
  public registerNavalBlockade(params: {
    blockadingTag: string;
    targetTag: string;
    maritimeNodeId: number;
    targetPortLocationId: number;
    fleetNavalPower: number;
    portInfrastructureLevel: number;
  }): NavalBlockade {
    const infra = Math.max(1.0, params.portInfrastructureLevel);
    const efficiency = Math.min(1.0, Math.max(0.0, params.fleetNavalPower / infra));

    const id = `blockade_${params.blockadingTag}_${params.targetPortLocationId}`;
    const blockade: NavalBlockade = {
      id,
      blockadingTag: params.blockadingTag,
      targetTag: params.targetTag,
      maritimeNodeId: params.maritimeNodeId,
      targetPortLocationId: params.targetPortLocationId,
      fleetNavalPower: params.fleetNavalPower,
      portInfrastructureLevel: infra,
      blockadeEfficiency: efficiency,
      dailyDevastationRate: 0.002, // +0.2% daily devastation base
      isActive: true
    };

    this.blockades.set(id, blockade);
    return blockade;
  }

  public liftNavalBlockade(blockadeId: string): boolean {
    return this.blockades.delete(blockadeId);
  }

  public getBlockadesForPort(portLocationId: number): NavalBlockade[] {
    return Array.from(this.blockades.values()).filter(
      b => b.targetPortLocationId === portLocationId && b.isActive
    );
  }

  /**
   * Daily Simulation Tick: applies devastation, burgher wealth drain, and workshop starvation
   */
  public executeDailyBlockadeTick(
    applyDevastation: (locationId: number, delta: number) => void,
    reduceBurgherWealth: (locationId: number, penaltyFactor: number) => void,
    setWorkshopStarvation: (locationId: number, isStarved: boolean) => void
  ): { totalLocationsAffected: number } {
    let affected = 0;

    for (const b of this.blockades.values()) {
      if (!b.isActive) continue;

      // 1. Accumulate daily devastation on the coastal node
      const dailyDev = b.dailyDevastationRate * b.blockadeEfficiency;
      applyDevastation(b.targetPortLocationId, dailyDev);

      // 2. Reduce Burgher Wealth generation by the exact blockade percentage
      reduceBurgherWealth(b.targetPortLocationId, b.blockadeEfficiency);

      // 3. Raw materials workshop starvation (iron, timber) if blockade efficiency >= 70%
      const isStarved = b.blockadeEfficiency >= 0.70;
      setWorkshopStarvation(b.targetPortLocationId, isStarved);

      affected++;
    }

    return { totalLocationsAffected: affected };
  }

  public getAllActiveEmbargos(): TradeEmbargo[] {
    return Array.from(this.embargos.values()).filter(e => e.isActive);
  }

  public getAllActiveBlockades(): NavalBlockade[] {
    return Array.from(this.blockades.values()).filter(b => b.isActive);
  }
}
