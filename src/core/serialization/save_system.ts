/**
 * High-Performance State Persistence & Serialization Engine
 * Flushes deep world state into flat-file JSON formats with checksum integrity validation.
 */

import type { SavedWorldState, SaveFileHeader } from './types.ts';

export class SaveLoadEngine {
  public static readonly ENGINE_VERSION: string = '1.0.0-PROD';

  /**
   * Fast 32-bit FNV-1a checksum calculation for save file tamper verification
   */
  public static computeChecksum(dataStr: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < dataStr.length; i++) {
      hash ^= dataStr.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Serializes current live engine state into a complete SavedWorldState object
   */
  public static createSaveSnapshot(state: any): SavedWorldState {
    const calendar = state.calendar || { year: 1350, month: 1, day: 1 };

    // Deep copy locations with micro-pop unit arrays
    const locations = (state.locations || []).map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      country: loc.country,
      terrain: loc.terrain,
      control: loc.control,
      devastation: loc.devastation,
      infrastructure: loc.infrastructure || 20.0,
      tax_base: loc.tax_base || 50.0,
      plague_infected: Boolean(loc.plague_infected),
      nobleDominated: Boolean(loc.nobleDominated),
      buildings: Array.isArray(loc.buildings) ? [...loc.buildings] : [],
      pops: (loc.pops || []).map((p: any) => ({
        estate: p.estate,
        subCulture: p.subCulture,
        size: p.size,
        wealth: p.wealth,
        unrest: p.unrest
      }))
    }));

    // Deep copy character dynastic tree
    const ruler = {
      id: state.ruler?.id || 1,
      firstName: state.ruler?.firstName || 'Edward III',
      dynasty: state.ruler?.dynasty || 'Plantagenet',
      age: state.ruler?.age || 38,
      sex: state.ruler?.sex || 'Male',
      culture: state.ruler?.culture || 'Anglo-Norman',
      religion: state.ruler?.religion || 'Catholic',
      health: state.ruler?.health || 80.0,
      isAlive: state.ruler?.isAlive !== undefined ? state.ruler.isAlive : true,
      attributes: { ...(state.ruler?.attributes || { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 }) },
      traits: Array.isArray(state.ruler?.traits) ? state.ruler.traits.map((t: any) => ({ ...t })) : [],
      isMarried: Boolean(state.ruler?.isMarried),
      spouseName: state.ruler?.spouseName || null,
      isGeneral: Boolean(state.ruler?.isGeneral),
      isCabinetAdvisor: Boolean(state.ruler?.isCabinetAdvisor)
    };

    // Deep copy outliner projects
    const outliner = {
      normandyIntegration: state.outliner?.normandyIntegration || 42.5,
      calaisBastion: state.outliner?.calaisBastion || 68.2,
      alerts: Array.isArray(state.outliner?.alerts) ? state.outliner.alerts.map((a: any) => ({ ...a })) : [],
      armies: Array.isArray(state.outliner?.armies) ? state.outliner.armies.map((a: any) => ({ ...a })) : []
    };

    // Deep copy estates
    const estates = Array.isArray(state.estates) ? state.estates.map((e: any) => ({ ...e })) : [];

    // Deep copy market goods
    const marketGoods: Record<string, any> = {};
    if (state.market?.goods) {
      for (const [key, val] of Object.entries(state.market.goods)) {
        marketGoods[key] = { ...(val as any) };
      }
    }

    const payloadWithoutChecksum = {
      calendar: { ...calendar },
      crownTreasury: state.crownTreasury || 0,
      monthlyTaxIncome: state.monthlyTaxIncome || 0,
      monthlyMaintenance: state.monthlyMaintenance || 0,
      manpower: state.manpower || 0,
      maxManpower: state.maxManpower || 0,
      crownPower: state.crownPower || 0,
      channelBlockaded: Boolean(state.channelBlockaded),
      charters: { ...(state.charters || {}) },
      ruler,
      heir: { ...(state.heir || { id: 2, firstName: 'Edward of Woodstock', dynasty: 'Plantagenet', age: 20, claim: 100 }) },
      estates,
      locations,
      outliner,
      marketGoods
    };

    const checksum = this.computeChecksum(JSON.stringify(payloadWithoutChecksum));

    const header: SaveFileHeader = {
      saveEngineVersion: this.ENGINE_VERSION,
      gameTitle: 'Grand Strategy Engine (Project Caesar Standard)',
      saveTimestamp: Date.now(),
      calendarDate: { ...calendar },
      playerCountryTag: 'ENG',
      checksum
    };

    return {
      header,
      ...payloadWithoutChecksum
    };
  }

  /**
   * Flushes deep state into formatted JSON text
   */
  public static serializeToJson(state: any, prettyPrint: boolean = true): string {
    const snapshot = this.createSaveSnapshot(state);
    return prettyPrint ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot);
  }

  /**
   * Parses and validates save file text, restoring world state into runtime format
   */
  public static deserializeFromJson(jsonStr: string): { success: boolean; state?: SavedWorldState; error?: string } {
    try {
      const parsed = JSON.parse(jsonStr) as SavedWorldState;

      if (!parsed.header || !parsed.header.checksum) {
        return { success: false, error: 'Malformed save file: Missing header metadata.' };
      }

      // Re-verify checksum integrity
      const { header, ...payload } = parsed;
      const expectedChecksum = this.computeChecksum(JSON.stringify(payload));

      if (header.checksum !== expectedChecksum) {
        return {
          success: false,
          error: `Save file integrity check failed: Checksum mismatch. Expected checksum ${header.checksum}, computed ${expectedChecksum}. Possible manual edit or corruption.`
        };
      }

      return {
        success: true,
        state: parsed
      };
    } catch (e: any) {
      return { success: false, error: `JSON Parse error: ${e.message}` };
    }
  }

  /**
   * Applies deserialized save state back into live runtime state
   */
  public static applyRestoredState(liveState: any, savedState: SavedWorldState): void {
    liveState.calendar = { ...savedState.calendar };
    liveState.crownTreasury = savedState.crownTreasury;
    liveState.monthlyTaxIncome = savedState.monthlyTaxIncome;
    liveState.monthlyMaintenance = savedState.monthlyMaintenance;
    liveState.manpower = savedState.manpower;
    liveState.maxManpower = savedState.maxManpower;
    liveState.crownPower = savedState.crownPower;
    liveState.channelBlockaded = savedState.channelBlockaded;
    liveState.charters = { ...savedState.charters };
    liveState.ruler = { ...savedState.ruler };
    liveState.heir = { ...savedState.heir };
    liveState.estates = savedState.estates.map(e => ({ ...e }));
    liveState.locations = savedState.locations.map(l => ({
      ...l,
      buildings: [...l.buildings],
      pops: l.pops.map(p => ({ ...p }))
    }));
    liveState.outliner = {
      ...savedState.outliner,
      alerts: savedState.outliner.alerts.map(a => ({ ...a })),
      armies: savedState.outliner.armies.map(a => ({ ...a }))
    };
    if (liveState.market && savedState.marketGoods) {
      liveState.market.goods = { ...savedState.marketGoods };
    }
  }
}
