/**
 * Great Power Spheres of Influence & Soft Power Enforcement
 * Subsystem: /src/politics/diplomacy/spheres.ts
 */

export interface GreatPowerEntry {
  countryTag: string;
  rank: number; // 1 to 8
  totalLocations: number;
  netMonthlyIncome: number;
  standingManpower: number;
  hegemonScore: number;
}

export interface SphereNodeRelationship {
  greatPowerTag: string;
  targetMinorTag: string;
  influenceFloat: number; // 0.0 to 100.0
  isLockedInSphere: boolean;
  enforcePeaceAvailable: boolean;
  claimFabricationPenaltyFactor: number; // 3.0x when locked
}

export class SphereOfInfluenceManager {
  private greatPowers: GreatPowerEntry[] = [];
  private sphereRelationships: Map<string, SphereNodeRelationship> = new Map();

  /**
   * Calculates Great Power Score and updates the global top 8 ranking:
   * Great_Power_Rank = Total_Locations_Owned + Net_Monthly_Income + (Total_Standing_Army_Manpower / 1000)
   */
  public updateGreatPowerRankings(
    nations: { countryTag: string; totalLocations: number; netIncome: number; standingManpower: number }[]
  ): GreatPowerEntry[] {
    const scored = nations.map(n => {
      const score = n.totalLocations + n.netIncome + (n.standingManpower / 1000.0);
      return {
        countryTag: n.countryTag,
        rank: 0,
        totalLocations: n.totalLocations,
        netMonthlyIncome: n.netIncome,
        standingManpower: n.standingManpower,
        hegemonScore: Number(score.toFixed(2))
      };
    });

    scored.sort((a, b) => b.hegemonScore - a.hegemonScore);

    this.greatPowers = scored.slice(0, 8).map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));

    return this.greatPowers;
  }

  public isGreatPower(countryTag: string): boolean {
    return this.greatPowers.some(gp => gp.countryTag === countryTag);
  }

  public getGreatPowerRank(countryTag: string): number | null {
    const gp = this.greatPowers.find(g => g.countryTag === countryTag);
    return gp ? gp.rank : null;
  }

  /**
   * Deploys diplomat to build soft power penetration inside a minor tag
   */
  public deployDiplomaticInfluence(
    greatPowerTag: string,
    targetMinorTag: string,
    diplomatSkill: number = 2.0
  ): SphereNodeRelationship {
    const key = `${greatPowerTag}_over_${targetMinorTag}`;
    let relationship = this.sphereRelationships.get(key);

    if (!relationship) {
      relationship = {
        greatPowerTag,
        targetMinorTag,
        influenceFloat: 0.0,
        isLockedInSphere: false,
        enforcePeaceAvailable: false,
        claimFabricationPenaltyFactor: 1.0
      };
      this.sphereRelationships.set(key, relationship);
    }

    const delta = 2.5 * diplomatSkill;
    relationship.influenceFloat = Number(Math.min(100.0, relationship.influenceFloat + delta).toFixed(2));

    // At 100% influence, locks into Great Power Sphere
    if (relationship.influenceFloat >= 100.0) {
      relationship.isLockedInSphere = true;
      relationship.enforcePeaceAvailable = true;
      relationship.claimFabricationPenaltyFactor = 3.0; // 3x spy claim penalty for rival powers
    }

    return relationship;
  }

  /**
   * Enforce Peace: Great power intervenes to protect its sphere node
   */
  public canEnforcePeace(greatPowerTag: string, targetMinorTag: string): boolean {
    const key = `${greatPowerTag}_over_${targetMinorTag}`;
    const rel = this.sphereRelationships.get(key);
    return rel ? rel.isLockedInSphere && rel.enforcePeaceAvailable : false;
  }

  public getRelationship(greatPowerTag: string, targetMinorTag: string): SphereNodeRelationship | undefined {
    return this.sphereRelationships.get(`${greatPowerTag}_over_${targetMinorTag}`);
  }

  public getTop8GreatPowers(): GreatPowerEntry[] {
    return [...this.greatPowers];
  }
}
