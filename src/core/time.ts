/**
 * Asynchronous Tick Scheduler & Calendar Progression Engine
 * Manages decoupled Daily and Monthly simulation execution cascades
 */

import { GrandStrategyEngine } from './engine.ts';

export interface CalendarTelemetryHeader {
  calendarDateString: string;
  treasuryGold: number;
  monthlyGoldDelta: number;
  manpowerCurrent: number;
  manpowerMax: number;
  manpowerMonthlyRecovery: number;
  stabilityLevel: number;
  crownPowerPercentage: number;
  prestigeScore: number;
  powerProjection: number;
}

export class CalendarProgressionEngine {
  private engine: GrandStrategyEngine;
  private isRunning: boolean = false;
  private tickIntervalHandle: any = null;
  private tickSpeedMs: number = 1000;

  constructor(engine: GrandStrategyEngine) {
    this.engine = engine;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public setTickSpeed(speedMs: number): void {
    this.tickSpeedMs = speedMs;
    if (this.isRunning) {
      this.pause();
      this.play();
    }
  }

  public play(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tickIntervalHandle = setInterval(() => {
      this.processDailyTick();
    }, this.tickSpeedMs);
  }

  public pause(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tickIntervalHandle) {
      clearInterval(this.tickIntervalHandle);
      this.tickIntervalHandle = null;
    }
  }

  /**
   * Daily Loop Tick:
   * - Processes map node updates
   * - Updates positional vectors for traveling armies
   * - Traces logistical supply paths to nearest depots
   * - Flags supply starvation if route edge is broken
   */
  public processDailyTick(): void {
    this.engine.executeDayTick();
  }

  /**
   * Monthly Loop Tick:
   * - Resource value production engine
   * - Supply/demand price clearing across market graphs
   * - Mutates estate loyalty values based on wealth accumulation
   * - Advances outliner project completion metrics
   * - Flushes topbar tokens
   */
  public processMonthlyTick(): CalendarTelemetryHeader {
    const monthResult = this.engine.processMonthEndTick();

    const dateStr = `${this.engine.calendar.year}-${String(this.engine.calendar.month).padStart(2, '0')}-${String(this.engine.calendar.day).padStart(2, '0')}`;

    return {
      calendarDateString: dateStr,
      treasuryGold: this.engine.playerRealm.treasuryGold,
      monthlyGoldDelta: monthResult.netIncome - 120.0, // After 120 D maintenance
      manpowerCurrent: 28458,
      manpowerMax: 35000,
      manpowerMonthlyRecovery: 350,
      stabilityLevel: 2,
      crownPowerPercentage: this.engine.playerRealm.crownPower * 100.0,
      prestigeScore: 42.0,
      powerProjection: 68.0
    };
  }
}
