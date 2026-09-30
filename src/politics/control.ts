import { LocationRegistry, type LocationData } from '../map/location.ts';
import { EstateGovernanceEngine } from './estates.ts';
import { EstateType } from '../core/types.ts';

export interface ControlPathfindingNode {
  locationId: number;
  accumulatedDistance: number;
}

export class StateControlEngine {
  private capitalLocationId: number;
  private decayConstant: number;

  constructor(capitalLocationId: number = 1, decayConstant: number = 0.018) {
    this.capitalLocationId = capitalLocationId;
    this.decayConstant = decayConstant;
  }

  public setCapital(locationId: number): void {
    this.capitalLocationId = locationId;
  }

  /**
   * Exponential State Control Decay Pathfinding:
   * Control = 1.0 * e^(-Decay_Constant * Logistical_Distance)
   *
   * Utilizes Dijkstra's algorithm to compute shortest logistical paths from the Capital.
   * Incorporates:
   * - Port compression (sea lanes act as administrative corridors with 0.25x distance)
   * - Rough terrain impedance (mountains/marshes 2.2x - 2.8x)
   * - Local devastation exponential scaling: (1 + Devastation^1.5 * 3.0)
   * - Sea blockades (completely severing water lanes)
   */
  public computeRealmControl(
    locationRegistry: LocationRegistry,
    blockadedPorts: Set<number> = new Set()
  ): Map<number, { distance: number; control: number }> {
    const locations = locationRegistry.getAll();
    const distances: Map<number, number> = new Map();
    const visited: Set<number> = new Set();
    const priorityQueue: ControlPathfindingNode[] = [];

    for (const loc of locations) {
      distances.set(loc.id, Infinity);
    }

    distances.set(this.capitalLocationId, 0.0);
    priorityQueue.push({ locationId: this.capitalLocationId, accumulatedDistance: 0.0 });

    while (priorityQueue.length > 0) {
      // Sort by shortest accumulated distance (Dijkstra step)
      priorityQueue.sort((a, b) => a.accumulatedDistance - b.accumulatedDistance);
      const current = priorityQueue.shift()!;

      if (visited.has(current.locationId)) continue;
      visited.add(current.locationId);

      const currentLoc = locationRegistry.get(current.locationId);
      if (!currentLoc) continue;

      // 1. Process overland neighboring locations
      for (const neighborId of currentLoc.neighbors) {
        if (visited.has(neighborId)) continue;
        const neighbor = locationRegistry.get(neighborId);
        if (!neighbor) continue;

        const baseHopDist = 15.0;
        const terrainCost = locationRegistry.getTerrainMovementCost(neighbor.terrain);
        // Devastation scaling: ruined roads and bridges exponentially increase administrative friction
        const devastationScale = 1.0 + (Math.pow(neighbor.devastation, 1.5) * 3.0);
        // Infrastructure mitigating distance
        const infraMitigation = Math.max(0.4, 1.0 - (neighbor.current_infrastructure * 0.005));

        const edgeWeight = baseHopDist * terrainCost * devastationScale * infraMitigation;
        const newDist = current.accumulatedDistance + edgeWeight;

        if (newDist < distances.get(neighborId)!) {
          distances.set(neighborId, newDist);
          priorityQueue.push({ locationId: neighborId, accumulatedDistance: newDist });
        }
      }

      // 2. Process maritime corridors (Port compression)
      if (currentLoc.is_port && !blockadedPorts.has(currentLoc.id)) {
        for (const seaTargetId of currentLoc.sea_connections) {
          if (visited.has(seaTargetId) || blockadedPorts.has(seaTargetId)) continue;
          const targetPort = locationRegistry.get(seaTargetId);
          if (!targetPort) continue;

          // Ports compress effective administrative distance significantly
          const seaDistance = 8.0 * 0.25; // 75% administrative compression over sea corridors
          const newDist = current.accumulatedDistance + seaDistance;

          if (newDist < distances.get(seaTargetId)!) {
            distances.set(seaTargetId, newDist);
            priorityQueue.push({ locationId: seaTargetId, accumulatedDistance: newDist });
          }
        }
      }
    }

    // Phase 2: Compute exact exponential control & apply to location entities
    const results = new Map<number, { distance: number; control: number }>();
    for (const loc of locations) {
      const dist = distances.get(loc.id) ?? 999.0;
      // Formula: Control = 1.0 * e^(-Decay_Constant * Logistical_Distance)
      const rawControl = Math.exp(-this.decayConstant * dist);
      const clampedControl = Math.max(0.01, Math.min(1.0, rawControl));

      loc.control = clampedControl;
      results.set(loc.id, { distance: dist, control: clampedControl });
    }

    return results;
  }

  /**
   * Tax Revenue Skimming Routing:
   * If Control < 1.0, uncollected revenue (1.0 - Control) is NOT deleted.
   * Dynamically split into private estate vaults (Nobility & Burghers).
   */
  public executeTaxCollectionAndSkimming(
    locationRegistry: LocationRegistry,
    estateEngine: EstateGovernanceEngine,
    baseNationalTaxRate: number = 0.15
  ): {
    totalPotentialRevenue: number;
    crownTreasuryCollected: number;
    nobilitySkimmedWealth: number;
    burgherSkimmedWealth: number;
  } {
    let totalPotential = 0.0;
    let crownCollected = 0.0;
    let totalNobilitySkimmed = 0.0;
    let totalBurgherSkimmed = 0.0;

    const globalTaxEfficiency = estateEngine.getGlobalTaxEfficiencyModifier();

    for (const loc of locationRegistry.getAll()) {
      const potentialTax = loc.tax_base * baseNationalTaxRate * globalTaxEfficiency;
      totalPotential += potentialTax;

      // The Crown collects revenue proportional to its direct administrative control
      const stateRevenue = potentialTax * loc.control;
      crownCollected += stateRevenue;

      // Uncollected revenue is skimmed by entrenched local estates
      const skimmedRevenue = potentialTax * (1.0 - loc.control);

      if (skimmedRevenue > 0) {
        // Skim distribution: Nobility claims feudal toll rights (70%), Burghers claim merchant excise (30%)
        const nobilityShare = skimmedRevenue * 0.70;
        const burgherShare = skimmedRevenue * 0.30;

        totalNobilitySkimmed += nobilityShare;
        totalBurgherSkimmed += burgherShare;
      }
    }

    // Deposit skimmed capital into private estate treasuries
    const nobility = estateEngine.getEstate(EstateType.Nobility);
    const burghers = estateEngine.getEstate(EstateType.Burghers);

    nobility.institutional_wealth += totalNobilitySkimmed;
    burghers.institutional_wealth += totalBurgherSkimmed;

    return {
      totalPotentialRevenue: totalPotential,
      crownTreasuryCollected: crownCollected,
      nobilitySkimmedWealth: totalNobilitySkimmed,
      burgherSkimmedWealth: totalBurgherSkimmed
    };
  }
}
