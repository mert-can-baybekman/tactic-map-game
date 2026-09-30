/**
 * Mediterranean Condottieri & Corsair Privateer Contract Network
 * Implements landless mercenary retainer contracts, mutiny pillaging on unpaid deficit,
 * and Letters of Marque corsair privateering across trade graph edges.
 */

import type { RebelFaction } from '../politics/rebellion.ts';
import { EstateType } from '../core/types.ts';

export interface CondottieriCompany {
  id: string;
  name: string;
  captainName: string;
  manpowerSize: number;
  cavalryShare: number; // 0.0 to 1.0
  monthlyRetainerCost: number; // ducats per month
  employerCountryTag: string | null;
  currentLocationId: number;
  isContractActive: boolean;
  consecutiveUnpaidMonths: number;
  morale: number;
}

export interface CorsairFleet {
  id: string;
  networkName: string;
  sponsoringCountryTag: string;
  patrolLocationId: number;
  patrolLocationName: string;
  hasLetterOfMarque: boolean;
  skimmingEfficiency: number; // up to 0.40 (40% of trade volume)
  totalGoldPlundered: number;
}

export interface PrivateerRaidResult {
  fleetId: string;
  targetLocationId: number;
  goldSkimmed: number;
  sponsoringTag: string;
  portDevastationInflicted: number;
  description: string;
}

export class MercenaryContractNetwork {
  private companies: Map<string, CondottieriCompany> = new Map();
  private corsairs: Map<string, CorsairFleet> = new Map();

  constructor() {
    this.initializeDefaultCompanies();
    this.initializeDefaultCorsairs();
  }

  public registerCompany(company: CondottieriCompany): void {
    this.companies.set(company.id, company);
  }

  public getCompany(id: string): CondottieriCompany | undefined {
    return this.companies.get(id);
  }

  public getAllCompanies(): CondottieriCompany[] {
    return Array.from(this.companies.values());
  }

  public registerCorsair(corsair: CorsairFleet): void {
    this.corsairs.set(corsair.id, corsair);
  }

  public getCorsair(id: string): CorsairFleet | undefined {
    return this.corsairs.get(id);
  }

  public getAllCorsairs(): CorsairFleet[] {
    return Array.from(this.corsairs.values());
  }

  /**
   * Hires a Condottieri mercenary company
   */
  public hireCondottieri(companyId: string, employerTag: string, locationId: number): boolean {
    const company = this.companies.get(companyId);
    if (!company || company.isContractActive) return false;

    company.employerCountryTag = employerTag;
    company.currentLocationId = locationId;
    company.isContractActive = true;
    company.consecutiveUnpaidMonths = 0;
    return true;
  }

  /**
   * Monthly Retainer Pass:
   * If a state running a high budget deficit fails to pay the retainer:
   * Company breaks contract, turns into a hostile Rebel_Faction, and begins pillaging adjacent burgher locations!
   */
  public processMonthlyRetainerTick(
    employerTag: string,
    employerTreasury: { crownTreasury: number },
    onMutinyRebellion?: (rebelFaction: RebelFaction) => void
  ): { totalRetainerPaid: number; mutiniedCompanies: CondottieriCompany[] } {
    let totalPaid = 0;
    const mutinied: CondottieriCompany[] = [];

    for (const comp of this.companies.values()) {
      if (!comp.isContractActive || comp.employerCountryTag !== employerTag) {
        continue;
      }

      if (employerTreasury.crownTreasury >= comp.monthlyRetainerCost) {
        // Retainer paid successfully
        employerTreasury.crownTreasury -= comp.monthlyRetainerCost;
        totalPaid += comp.monthlyRetainerCost;
        comp.consecutiveUnpaidMonths = 0;
      } else {
        // Deficit! Retainer unpaid
        comp.consecutiveUnpaidMonths++;

        if (comp.consecutiveUnpaidMonths >= 2) {
          // Unpaid for 2 consecutive months -> BREAKS CONTRACT & MUTINIES
          comp.isContractActive = false;
          comp.employerCountryTag = null;
          mutinied.push(comp);

          // Convert into hostile Rebel_Faction
          const mutinyFaction: RebelFaction = {
            factionId: `rebel_condottieri_${comp.id}`,
            name: `${comp.name} Mutineer Host`,
            factionType: 'Nobles_Coup',
            totalEnlistedPopsCount: comp.manpowerSize * 5,
            accumulatedRadicalism: 1.0, // Instantly armed!
            financierEstatePointer: EstateType.Nobility,
            targetLocationIds: [comp.currentLocationId],
            spawnedArmyStacks: [
              {
                id: `army_${comp.id}_mutineers`,
                name: `${comp.name} Pillaging Army`,
                countryTag: 'REB_ENG',
                locationId: comp.currentLocationId,
                locationName: `Location_${comp.currentLocationId}`,
                size: comp.manpowerSize,
                isRebelStack: true,
                morale: 80
              }
            ],
            isActive: true
          };

          if (onMutinyRebellion) {
            onMutinyRebellion(mutinyFaction);
          }
        }
      }
    }

    return { totalRetainerPaid: totalPaid, mutiniedCompanies: mutinied };
  }

  /**
   * Issues Letter of Marque to a Corsair Privateer Fleet
   */
  public issueLetterOfMarque(corsairId: string, sponsoringTag: string, targetLocationId: number): boolean {
    const corsair = this.corsairs.get(corsairId);
    if (!corsair) return false;

    corsair.sponsoringCountryTag = sponsoringTag;
    corsair.patrolLocationId = targetLocationId;
    corsair.hasLetterOfMarque = true;
    return true;
  }

  /**
   * Monthly Corsair Privateer Skimming Pass:
   * Does NOT trigger a formal war state.
   * Skims up to 40% of Trade_Throughput_Volume, funnels gold to sponsor,
   * and inflicts +0.15 Devastation on target coastal ports!
   */
  public executeCorsairPrivateeringTick(
    targetLocation: { id: number; name: string; devastation: number },
    tradeThroughputVolume: number,
    sponsoringTreasury: { crownTreasury: number }
  ): PrivateerRaidResult[] {
    const raids: PrivateerRaidResult[] = [];

    for (const corsair of this.corsairs.values()) {
      if (!corsair.hasLetterOfMarque || corsair.patrolLocationId !== targetLocation.id) {
        continue;
      }

      // Skim up to 40% of trade throughput volume
      const skimmedGold = tradeThroughputVolume * corsair.skimmingEfficiency;
      corsair.totalGoldPlundered += skimmedGold;
      sponsoringTreasury.crownTreasury += skimmedGold;

      // Inflict coastal port devastation
      targetLocation.devastation = Math.min(1.0, targetLocation.devastation + 0.15);

      raids.push({
        fleetId: corsair.id,
        targetLocationId: targetLocation.id,
        goldSkimmed: skimmedGold,
        sponsoringTag: corsair.sponsoringCountryTag,
        portDevastationInflicted: 0.15,
        description: `${corsair.networkName} raided ${targetLocation.name} under Letter of Marque! Siphoned ${skimmedGold.toFixed(1)} ducats to ${corsair.sponsoringCountryTag} and inflicted +15% port devastation.`
      });
    }

    return raids;
  }

  private initializeDefaultCompanies(): void {
    this.registerCompany({
      id: 'white_company',
      name: 'The Great White Company',
      captainName: 'Sir John Hawkwood',
      manpowerSize: 3500,
      cavalryShare: 0.60,
      monthlyRetainerCost: 45.0,
      employerCountryTag: null,
      currentLocationId: 20, // Venice / Northern Italy
      isContractActive: false,
      consecutiveUnpaidMonths: 0,
      morale: 95
    });

    this.registerCompany({
      id: 'catalan_company',
      name: 'The Great Catalan Company',
      captainName: 'Bernat de Rocafort',
      manpowerSize: 4000,
      cavalryShare: 0.35,
      monthlyRetainerCost: 50.0,
      employerCountryTag: null,
      currentLocationId: 117, // Athens / Morea
      isContractActive: false,
      consecutiveUnpaidMonths: 0,
      morale: 90
    });
  }

  private initializeDefaultCorsairs(): void {
    this.registerCorsair({
      id: 'barbary_corsairs',
      networkName: 'Barbary Corsair Brotherhood',
      sponsoringCountryTag: 'GRA', // Granada / Maghreb
      patrolLocationId: 34, // Straits of Gibraltar / Alboran Sea
      patrolLocationName: 'Gibraltar Maritime Approach',
      hasLetterOfMarque: false,
      skimmingEfficiency: 0.40, // 40% trade skimming
      totalGoldPlundered: 0.0
    });

    this.registerCorsair({
      id: 'aegean_ghazis',
      networkName: 'Aegean Ghazi Corsairs',
      sponsoringCountryTag: 'OTT', // Ottoman Beylik
      patrolLocationId: 106, // Smyrna / Aegean Sea
      patrolLocationName: 'Smyrna & Cyclades Archipelago',
      hasLetterOfMarque: false,
      skimmingEfficiency: 0.35,
      totalGoldPlundered: 0.0
    });
  }
}
