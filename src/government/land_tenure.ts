/**
 * Feudal Vassalage & The Ottoman Tımar Land Mobilization Engine
 * Implements Ottoman localized Tımar cavalry maintenance and Western feudal vassalage obligations.
 */

import type { PopEntity } from '../demographics/pop.ts';
import { EstateType } from '../core/types.ts';

export interface TimarEstate {
  id: string;
  locationId: number;
  locationName: string;
  assignedSipahiOfficer: string;
  sipahiLoyalty: number; // 0 to 100 (high loyalty grants combat buffs)
  landTaxAllocationRatio: number; // e.g. 0.35 (35% of local commoner wealth routed to cavalry)
  sipahiCavalryPool: number; // Manpower of armed cavalry maintained
  monthlyWealthSiphoned: number;
  isActive: boolean;
}

export interface FeudalVassalContract {
  vassalTag: string;
  vassalName: string;
  liegeTag: string;
  liegeFealty: number; // 0 to 100
  scutageTaxFlow: number; // Monthly ducats paid when liege is at peace
  mobilizedLevySize: number;
  isDeployedToLiegeArmy: boolean;
  hasCommittedTreason: boolean;
}

export interface TreasonCasusBelli {
  id: string;
  type: 'Treason_Casus_Belli';
  liegeTag: string;
  vassalTag: string;
  reason: string;
}

export class LandTenureEngine {
  private timars: Map<string, TimarEstate> = new Map();
  private vassals: Map<string, FeudalVassalContract> = new Map();

  public registerTimar(timar: TimarEstate): void {
    this.timars.set(timar.id, timar);
  }

  public getTimar(id: string): TimarEstate | undefined {
    return this.timars.get(id);
  }

  public getAllTimars(): TimarEstate[] {
    return Array.from(this.timars.values());
  }

  public registerVassal(contract: FeudalVassalContract): void {
    this.vassals.set(contract.vassalTag, contract);
  }

  public getVassal(vassalTag: string): FeudalVassalContract | undefined {
    return this.vassals.get(vassalTag);
  }

  public getAllVassals(): FeudalVassalContract[] {
    return Array.from(this.vassals.values());
  }

  /**
   * Monthly Tımar Production Loop:
   * Routes a fixed percentage of local Commoner raw production wealth directly into maintaining
   * the Sipahi_Cavalry_Pool rather than the national treasury.
   */
  public processTimarMonthlyProduction(
    pops: PopEntity[],
    cavalryMaintenanceCostPerHead: number = 0.05
  ): { totalCavalryMaintained: number; totalWealthDiverted: number } {
    let totalCavalry = 0;
    let totalDiverted = 0;

    for (const timar of this.timars.values()) {
      if (!timar.isActive) continue;

      // Find commoner pops in the Timar location
      const commoners = pops.filter(
        p => p.location_id === timar.locationId && p.estate_type === EstateType.Commoners
      );

      const totalCommonerWealth = commoners.reduce((sum, p) => sum + p.wealth, 0);
      const divertedWealth = totalCommonerWealth * timar.landTaxAllocationRatio;

      timar.monthlyWealthSiphoned = divertedWealth;
      totalDiverted += divertedWealth;

      // Drain siphoned wealth from local commoner pops
      for (const p of commoners) {
        p.wealth = Math.max(0.0, p.wealth * (1.0 - timar.landTaxAllocationRatio * 0.1));
      }

      // Convert diverted wealth into maintained Sipahi Cavalry pool
      const loyaltyMultiplier = 0.5 + (timar.sipahiLoyalty / 100.0) * 0.5; // 0.5 to 1.0
      const cavalryCount = Math.round((divertedWealth / cavalryMaintenanceCostPerHead) * loyaltyMultiplier);

      timar.sipahiCavalryPool = cavalryCount;
      totalCavalry += cavalryCount;
    }

    return { totalCavalryMaintained: totalCavalry, totalWealthDiverted: totalDiverted };
  }

  /**
   * Feudal Obligation Ticks:
   * If Liege enters a war state, an automated evaluation tick forces vassal tags to either
   * deploy their local levy stack arrays or face an immediate Treason_Casus_Belli!
   */
  public evaluateFeudalObligationTick(
    liegeTag: string,
    isLiegeAtWar: boolean
  ): { deployedVassals: string[]; treasonCasusBelliList: TreasonCasusBelli[] } {
    const deployed: string[] = [];
    const treasonList: TreasonCasusBelli[] = [];

    for (const contract of this.vassals.values()) {
      if (contract.liegeTag !== liegeTag) continue;

      if (!isLiegeAtWar) {
        // At peace: Vassal pays scutage tax flow to liege treasury
        contract.isDeployedToLiegeArmy = false;
        continue;
      }

      // Liege is at war: Call to arms evaluation
      if (contract.liegeFealty >= 50.0) {
        // Faithful vassal answers the call and deploys local levies
        contract.isDeployedToLiegeArmy = true;
        contract.hasCommittedTreason = false;
        deployed.push(contract.vassalTag);
      } else {
        // Disloyal vassal refuses call to arms -> commits Treason!
        contract.isDeployedToLiegeArmy = false;
        contract.hasCommittedTreason = true;

        const treasonCB: TreasonCasusBelli = {
          id: `cb_treason_${liegeTag}_${contract.vassalTag}_${Date.now()}`,
          type: 'Treason_Casus_Belli',
          liegeTag,
          vassalTag: contract.vassalTag,
          reason: `Vassal ${contract.vassalName} (${contract.vassalTag}) refused military feudal levy summons in wartime.`
        };

        treasonList.push(treasonCB);
      }
    }

    return { deployedVassals: deployed, treasonCasusBelliList: treasonList };
  }
}
