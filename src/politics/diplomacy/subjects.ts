/**
 * Multi-Tier Subject State & Vassalage Management Ledger
 * Subsystem: /src/politics/diplomacy/subjects.ts
 */

export const SubjectType = {
  Feudal_Vassal: 'Feudal_Vassal',
  March: 'March',
  Thalassocracy_Client: 'Thalassocracy_Client'
} as const;

export type SubjectType = typeof SubjectType[keyof typeof SubjectType];

export interface SubjectState {
  subjectTag: string;
  liegeTag: string;
  subjectType: SubjectType;
  taxSkimmingRate: number; // 0.15 for Feudal Vassal, 0.0 for March
  armyMoraleBonus: number; // +0.25 for March
  fortDefenseBonus: number; // +0.15 for March
  tradeVolumeShare: number; // 0.50 for Thalassocracy Client
  subjectArmySize: number;
  liegeArmySize: number;
  unrestMilitancy: number; // 0.0 to 100.0
  liegePrestige: number; // -100.0 to +100.0
  libertyDesire: number; // 0.0 to 100.0
  refusesOffensiveWars: boolean;
  hasIndependenceCB: boolean;
}

export class SubjectLedgerManager {
  private subjects: Map<string, SubjectState> = new Map();

  public registerSubject(
    subjectTag: string,
    liegeTag: string,
    subjectType: SubjectType,
    subjectArmy: number = 5000,
    liegeArmy: number = 20000,
    liegePrestige: number = 50.0
  ): SubjectState {
    let taxRate = 0.0;
    let moraleBonus = 0.0;
    let fortBonus = 0.0;
    let tradeShare = 0.0;

    switch (subjectType) {
      case SubjectType.Feudal_Vassal:
        taxRate = 0.15; // 15% monthly tax skimming
        break;
      case SubjectType.March:
        taxRate = 0.0; // 0% tax, dedicated frontier defense
        moraleBonus = 0.25; // +25% Army Morale
        fortBonus = 0.15; // +15% Fort Defense
        break;
      case SubjectType.Thalassocracy_Client:
        tradeShare = 0.50; // Routes 50% burgher trade volume
        break;
    }

    const subject: SubjectState = {
      subjectTag,
      liegeTag,
      subjectType,
      taxSkimmingRate: taxRate,
      armyMoraleBonus: moraleBonus,
      fortDefenseBonus: fortBonus,
      tradeVolumeShare: tradeShare,
      subjectArmySize: subjectArmy,
      liegeArmySize: liegeArmy,
      unrestMilitancy: 10.0,
      liegePrestige,
      libertyDesire: 0.0,
      refusesOffensiveWars: false,
      hasIndependenceCB: false
    };

    this.recalculateLibertyDesire(subject);
    this.subjects.set(subjectTag, subject);
    return subject;
  }

  /**
   * Monthly Liberty Desire Evaluation Tick:
   * Liberty_Desire = (Subject_Army_Size / Liege_Army_Size * 50) + Unrest_Militancy - (Liege_Prestige * 0.25)
   * If > 50%: refuses offensive wars
   * If > 80%: unlocks War_Of_Independence Casus Belli
   */
  public recalculateLibertyDesire(subject: SubjectState): number {
    const safeLiege = Math.max(100, subject.liegeArmySize);
    const militaryRatio = (subject.subjectArmySize / safeLiege) * 50.0;
    const prestigeFactor = subject.liegePrestige * 0.25;

    const rawDesire = militaryRatio + subject.unrestMilitancy - prestigeFactor;
    subject.libertyDesire = Number(Math.max(0.0, Math.min(100.0, rawDesire)).toFixed(2));

    // Threshold state triggers
    subject.refusesOffensiveWars = subject.libertyDesire > 50.0;
    subject.hasIndependenceCB = subject.libertyDesire > 80.0;

    return subject.libertyDesire;
  }

  /**
   * Updates state variables on monthly simulation tick
   */
  public processMonthlySubjectTick(
    subjectTag: string,
    subjectArmy: number,
    liegeArmy: number,
    unrest: number,
    liegePrestige: number
  ): SubjectState | undefined {
    const subject = this.subjects.get(subjectTag);
    if (!subject) return undefined;

    subject.subjectArmySize = subjectArmy;
    subject.liegeArmySize = liegeArmy;
    subject.unrestMilitancy = unrest;
    subject.liegePrestige = liegePrestige;

    this.recalculateLibertyDesire(subject);
    return subject;
  }

  public getSubject(subjectTag: string): SubjectState | undefined {
    return this.subjects.get(subjectTag);
  }

  public getLiegeSubjects(liegeTag: string): SubjectState[] {
    return Array.from(this.subjects.values()).filter(s => s.liegeTag === liegeTag);
  }
}
