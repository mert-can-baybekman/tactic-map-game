/**
 * Hardware-Accelerated Entity Array Optimization (ECS)
 * Subsystem: /src/core/optimization/entity_ecs.ts
 */

export class EntityECSManager {
  private capacity: number;
  private entityCount: number = 0;

  // Flat continuous primitive TypedArrays for L1/L2 cache locality
  public numericIds: Uint16Array;
  public locationCounts: Uint16Array;
  public threatIndices: Float32Array;
  public taxSkimmingRates: Float32Array;
  public armyManpowerPools: Uint32Array;
  public culledBitset: Uint8Array; // 1 = culled from heavy AI calculations, 0 = active

  constructor(initialCapacity: number = 2000) {
    this.capacity = initialCapacity;
    this.numericIds = new Uint16Array(this.capacity);
    this.locationCounts = new Uint16Array(this.capacity);
    this.threatIndices = new Float32Array(this.capacity);
    this.taxSkimmingRates = new Float32Array(this.capacity);
    this.armyManpowerPools = new Uint32Array(this.capacity);
    this.culledBitset = new Uint8Array(this.capacity);
  }

  public insertEntity(
    numericId: number,
    locationCount: number,
    threatIndex: number,
    taxRate: number,
    armyManpower: number
  ): number {
    if (this.entityCount >= this.capacity) {
      this.reallocate(this.capacity * 2);
    }

    const idx = this.entityCount;
    this.numericIds[idx] = numericId;
    this.locationCounts[idx] = locationCount;
    this.threatIndices[idx] = threatIndex;
    this.taxSkimmingRates[idx] = taxRate;
    this.armyManpowerPools[idx] = armyManpower;
    this.culledBitset[idx] = 0;

    this.entityCount++;
    return idx;
  }

  private reallocate(newCapacity: number): void {
    const oldCapacity = this.capacity;
    this.capacity = newCapacity;

    const newIds = new Uint16Array(newCapacity);
    const newLocCounts = new Uint16Array(newCapacity);
    const newThreats = new Float32Array(newCapacity);
    const newTaxes = new Float32Array(newCapacity);
    const newArmies = new Uint32Array(newCapacity);
    const newCulled = new Uint8Array(newCapacity);

    newIds.set(this.numericIds.subarray(0, oldCapacity));
    newLocCounts.set(this.locationCounts.subarray(0, oldCapacity));
    newThreats.set(this.threatIndices.subarray(0, oldCapacity));
    newTaxes.set(this.taxSkimmingRates.subarray(0, oldCapacity));
    newArmies.set(this.armyManpowerPools.subarray(0, oldCapacity));
    newCulled.set(this.culledBitset.subarray(0, oldCapacity));

    this.numericIds = newIds;
    this.locationCounts = newLocCounts;
    this.threatIndices = newThreats;
    this.taxSkimmingRates = newTaxes;
    this.armyManpowerPools = newArmies;
    this.culledBitset = newCulled;
  }

  /**
   * Active Query Culling Pass:
   * During daily and monthly simulation ticks, automatically culls countries from
   * heavy AI calculation loops if locationCount == 1 and local threatIndex == 0.
   */
  public executeActiveQueryCulling(): {
    activeCount: number;
    culledCount: number;
    cullingRatio: number;
  } {
    let active = 0;
    let culled = 0;

    for (let i = 0; i < this.entityCount; i++) {
      if (this.locationCounts[i] <= 1 && this.threatIndices[i] <= 0.0) {
        this.culledBitset[i] = 1; // Culled from heavy AI
        culled++;
      } else {
        this.culledBitset[i] = 0; // Active
        active++;
      }
    }

    const cullingRatio = this.entityCount > 0 ? culled / this.entityCount : 0.0;
    return {
      activeCount: active,
      culledCount: culled,
      cullingRatio: Number(cullingRatio.toFixed(3))
    };
  }

  public isEntityCulled(index: number): boolean {
    return this.culledBitset[index] === 1;
  }

  public getEntityCount(): number {
    return this.entityCount;
  }

  /**
   * Processes active non-culled entities in a cache-friendly tight loop
   */
  public executeOptimizedSimulationPass(
    onActiveEntity: (numericId: number, army: number, tax: number) => void
  ): number {
    let processed = 0;
    for (let i = 0; i < this.entityCount; i++) {
      if (this.culledBitset[i] === 0) {
        onActiveEntity(
          this.numericIds[i],
          this.armyManpowerPools[i],
          this.taxSkimmingRates[i]
        );
        processed++;
      }
    }
    return processed;
  }
}
