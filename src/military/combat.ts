import { CombatPosition, UnitType } from '../core/types.ts';
import type { Regiment } from './levy.ts';
import { PopDemographicEngine } from '../demographics/pop.ts';

export interface CombatUnitSlot {
  slotIndex: number;
  position: CombatPosition;
  regiment: Regiment | null;
}

export interface TacticalBattleGrid {
  frontRow: (Regiment | null)[]; // e.g. 10 width
  backRow: (Regiment | null)[];  // e.g. 10 width
  leftFlank: (Regiment | null)[]; // e.g. 3 width
  rightFlank: (Regiment | null)[]; // e.g. 3 width
}

export class TacticalCombatEngine {
  private combatWidth: number = 8;

  public createBattleGrid(): TacticalBattleGrid {
    return {
      frontRow: new Array(this.combatWidth).fill(null),
      backRow: new Array(this.combatWidth).fill(null),
      leftFlank: new Array(2).fill(null),
      rightFlank: new Array(2).fill(null)
    };
  }

  /**
   * Automatically deploy army regiments onto tactical grid based on unit doctrine
   */
  public deployRegiments(grid: TacticalBattleGrid, regiments: Regiment[]): void {
    let frontIdx = 0;
    let backIdx = 0;
    let leftIdx = 0;
    let rightIdx = 0;

    for (const reg of regiments) {
      if (reg.unit_type === UnitType.HeavyCavalry || reg.unit_type === UnitType.LightCavalry) {
        if (leftIdx < grid.leftFlank.length) {
          grid.leftFlank[leftIdx++] = reg;
        } else if (rightIdx < grid.rightFlank.length) {
          grid.rightFlank[rightIdx++] = reg;
        } else if (frontIdx < grid.frontRow.length) {
          grid.frontRow[frontIdx++] = reg;
        }
      } else if (reg.unit_type === UnitType.Crossbowmen || reg.unit_type === UnitType.Longbowmen || reg.unit_type === UnitType.BombardArtillery) {
        if (backIdx < grid.backRow.length) {
          grid.backRow[backIdx++] = reg;
        } else if (frontIdx < grid.frontRow.length) {
          grid.frontRow[frontIdx++] = reg;
        }
      } else {
        // Infantry & Pikes
        if (frontIdx < grid.frontRow.length) {
          grid.frontRow[frontIdx++] = reg;
        } else if (backIdx < grid.backRow.length) {
          grid.backRow[backIdx++] = reg;
        }
      }
    }
  }

  /**
   * Execute 1 Tactical Combat Round:
   * Multi-row engagement tactical matrices and flank calculation arrays.
   */
  public executeCombatRound(
    sideAGrid: TacticalBattleGrid,
    sideBGrid: TacticalBattleGrid,
    popEngine: PopDemographicEngine
  ): {
    sideACasualties: number;
    sideBCasualties: number;
    sideAMorale: number;
    sideBMorale: number;
  } {
    let sideALosses = 0;
    let sideBLosses = 0;

    // 1. Front Row Melee Engagement
    for (let i = 0; i < this.combatWidth; i++) {
      const unitA = sideAGrid.frontRow[i];
      const unitB = sideBGrid.frontRow[i];

      if (unitA && unitB && unitA.current_manpower > 0 && unitB.current_manpower > 0) {
        // Exchange damage
        const damageToB = Math.floor(unitA.current_manpower * 0.04 * (unitA.morale / 100.0));
        const damageToA = Math.floor(unitB.current_manpower * 0.04 * (unitB.morale / 100.0));

        unitA.current_manpower = Math.max(0, unitA.current_manpower - damageToA);
        unitB.current_manpower = Math.max(0, unitB.current_manpower - damageToB);

        sideALosses += damageToA;
        sideBLosses += damageToB;

        // Morale shock
        unitA.morale = Math.max(0, unitA.morale - 5.0);
        unitB.morale = Math.max(0, unitB.morale - 5.0);
      }
    }

    // 2. Back Row Missile & Artillery Bombardment
    for (let i = 0; i < this.combatWidth; i++) {
      const backA = sideAGrid.backRow[i];
      const targetB = sideBGrid.frontRow[i] || sideBGrid.backRow[i];

      if (backA && targetB && backA.current_manpower > 0 && targetB.current_manpower > 0) {
        const missileDamage = Math.floor(backA.current_manpower * 0.025);
        targetB.current_manpower = Math.max(0, targetB.current_manpower - missileDamage);
        sideBLosses += missileDamage;
      }

      const backB = sideBGrid.backRow[i];
      const targetA = sideAGrid.frontRow[i] || sideAGrid.backRow[i];

      if (backB && targetA && backB.current_manpower > 0 && targetA.current_manpower > 0) {
        const missileDamage = Math.floor(backB.current_manpower * 0.025);
        targetA.current_manpower = Math.max(0, targetA.current_manpower - missileDamage);
        sideALosses += missileDamage;
      }
    }

    // 3. Flank Cavalry Wraparound Maneuvers
    const hasEnemyLeftFlank = sideBGrid.leftFlank.some(u => u && u.current_manpower > 0);
    for (const flankA of sideAGrid.rightFlank) {
      if (!flankA || flankA.current_manpower <= 0) continue;

      if (!hasEnemyLeftFlank) {
        // Envelopment! Cavalry wraps around to hit enemy front row flank units with 1.8x shock multiplier
        const exposedEnemy = sideBGrid.frontRow[sideBGrid.frontRow.length - 1];
        if (exposedEnemy && exposedEnemy.current_manpower > 0) {
          const flankDamage = Math.floor(flankA.current_manpower * 0.075);
          exposedEnemy.current_manpower = Math.max(0, exposedEnemy.current_manpower - flankDamage);
          sideBLosses += flankDamage;
          exposedEnemy.morale = Math.max(0, exposedEnemy.morale - 12.0);
        }
      }
    }

    // Calculate total remaining morale for each army
    const getAvgMorale = (grid: TacticalBattleGrid) => {
      const units = [...grid.frontRow, ...grid.backRow, ...grid.leftFlank, ...grid.rightFlank].filter(
        (u): u is Regiment => u !== null && u.current_manpower > 0
      );
      if (units.length === 0) return 0.0;
      return units.reduce((s, u) => s + u.morale, 0) / units.length;
    };

    return {
      sideACasualties: sideALosses,
      sideBCasualties: sideBLosses,
      sideAMorale: getAvgMorale(sideAGrid),
      sideBMorale: getAvgMorale(sideBGrid)
    };
  }
}
