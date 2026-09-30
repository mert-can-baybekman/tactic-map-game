/**
 * 1350 Historical Scenario Initializer ("Project Caesar" Parity Standard)
 * Sets up global world state in April 1350:
 * - Ottoman-Byzantine Frontier (Orhan Gazi, Söğüt/Bursa capitals, permanent claim on Constantinople)
 * - Hundred Years' War State Machine (England vs France, Calais enclave)
 * - Black Death Epidemic Deployment (Genoa and Sicily plague vectors)
 */

export interface HistoricalCountrySetup {
  tag: string;
  name: string;
  culture: string;
  religion: string;
  ruler: {
    id: number;
    name: string;
    dynasty: string;
    age: number;
    traits: string[];
    attributes: {
      martial: number;
      diplomacy: number;
      stewardship: number;
      learning: number;
      intrigue: number;
    };
  };
  treasury: number;
  manpower: number;
  capitalLocationId: number;
  ownedLocationIds: number[];
}

export interface ActiveWarStateMachine {
  warId: string;
  name: string;
  attackers: string[];
  defenders: string[];
  startDate: string;
  warGoal: string;
  tradeEmbargoActive: boolean;
}

export interface Scenario1350WorldState {
  calendar: {
    year: number;
    month: number;
    day: number;
    dateString: string;
  };
  countries: Record<string, HistoricalCountrySetup>;
  activeWars: ActiveWarStateMachine[];
  permanentClaims: Array<{
    claimantTag: string;
    targetLocationId: number;
    targetTag: string;
    claimType: 'PERMANENT';
  }>;
  plagueSeedLocations: Array<{
    locationId: number;
    name: string;
    initialVirulence: number;
  }>;
}

export class Scenario1350Initializer {
  public static create1350CampaignState(): Scenario1350WorldState {
    const countries: Record<string, HistoricalCountrySetup> = {
      OTT: {
        tag: 'OTT',
        name: 'Ottoman Beylik',
        culture: 'turkish',
        religion: 'sunni',
        ruler: {
          id: 1001,
          name: 'Orhan Gazi',
          dynasty: 'Osmanoglu',
          age: 69,
          traits: ['ghazi_conqueror', 'architect_of_bursa', 'valiant_warrior'],
          attributes: { martial: 92, diplomacy: 74, stewardship: 80, learning: 65, intrigue: 78 }
        },
        treasury: 1450.0,
        manpower: 18500,
        capitalLocationId: 101, // Söğüt (historical cradle)
        ownedLocationIds: [101, 102, 103, 109] // Söğüt, Bursa, Iznik, Angora
      },
      BYZ: {
        tag: 'BYZ',
        name: 'Byzantine Empire',
        culture: 'greek',
        religion: 'orthodox',
        ruler: {
          id: 1002,
          name: 'John VI Kantakouzenos',
          dynasty: 'Kantakouzenos',
          age: 55,
          traits: ['scholarly_monarch', 'weary_regent'],
          attributes: { martial: 68, diplomacy: 82, stewardship: 60, learning: 85, intrigue: 75 }
        },
        treasury: 820.0,
        manpower: 9000,
        capitalLocationId: 104, // Constantinople (Bosphorus Choke-point)
        ownedLocationIds: [104, 105, 110, 111, 118] // Constantinople, Gallipoli, Adrianople, Thessalonica, Morea
      },
      ENG: {
        tag: 'ENG',
        name: 'Kingdom of England',
        culture: 'english',
        religion: 'catholic',
        ruler: {
          id: 1,
          name: 'Edward III',
          dynasty: 'Plantagenet',
          age: 38,
          traits: ['valiant_warrior', 'chivalric_sovereign'],
          attributes: { martial: 88, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 }
        },
        treasury: 2500.0,
        manpower: 28000,
        capitalLocationId: 1, // London
        ownedLocationIds: [1, 2, 3] // London, Dover, Calais (Continental Enclave)
      },
      FRA: {
        tag: 'FRA',
        name: 'Kingdom of France',
        culture: 'francien',
        religion: 'catholic',
        ruler: {
          id: 2,
          name: 'Jean II the Good',
          dynasty: 'Valois',
          age: 31,
          traits: ['chivalric_knight', 'proud_sovereign'],
          attributes: { martial: 75, diplomacy: 70, stewardship: 58, learning: 60, intrigue: 62 }
        },
        treasury: 3100.0,
        manpower: 35000,
        capitalLocationId: 5, // Paris
        ownedLocationIds: [4, 5] // Rouen, Paris
      },
      KAR: {
        tag: 'KAR',
        name: 'Karamanid Beylik',
        culture: 'turkish',
        religion: 'sunni',
        ruler: {
          id: 1003,
          name: 'Alaeddin Ali Bey',
          dynasty: 'Karamanid',
          age: 35,
          traits: ['seljuk_claimant'],
          attributes: { martial: 80, diplomacy: 65, stewardship: 70, learning: 60, intrigue: 72 }
        },
        treasury: 600.0,
        manpower: 12000,
        capitalLocationId: 107, // Iconium (Konya)
        ownedLocationIds: [107]
      },
      VEN: {
        tag: 'VEN',
        name: 'Serenissima Republic of Venice',
        culture: 'venetian',
        religion: 'catholic',
        ruler: {
          id: 1004,
          name: 'Andrea Dandolo',
          dynasty: 'Dandolo',
          age: 44,
          traits: ['merchant_patrician', 'chronicler'],
          attributes: { martial: 60, diplomacy: 92, stewardship: 95, learning: 88, intrigue: 80 }
        },
        treasury: 5500.0,
        manpower: 15000,
        capitalLocationId: 20, // Venice Lagoon
        ownedLocationIds: [20, 52] // Venice, Crete
      },
      GEN: {
        tag: 'GEN',
        name: 'Republic of Genoa',
        culture: 'ligurian',
        religion: 'catholic',
        ruler: {
          id: 1005,
          name: 'Giovanni da Valente',
          dynasty: 'Valente',
          age: 48,
          traits: ['corsair_patrician'],
          attributes: { martial: 72, diplomacy: 80, stewardship: 90, learning: 70, intrigue: 85 }
        },
        treasury: 4200.0,
        manpower: 14000,
        capitalLocationId: 21, // Genoa
        ownedLocationIds: [21]
      }
    };

    // Hundred Years' War state machine
    const activeWars: ActiveWarStateMachine[] = [
      {
        warId: 'war_hundred_years',
        name: "The Hundred Years' War",
        attackers: ['ENG'],
        defenders: ['FRA'],
        startDate: '1337-05-24',
        warGoal: 'Crown of France & Continental Sovereignty',
        tradeEmbargoActive: true
      }
    ];

    // Ottoman permanent claims on the Byzantine remnant capital
    const permanentClaims = [
      {
        claimantTag: 'OTT',
        targetLocationId: 104, // Constantinople
        targetTag: 'BYZ',
        claimType: 'PERMANENT' as const
      },
      {
        claimantTag: 'ENG',
        targetLocationId: 4, // Rouen / Normandy
        targetTag: 'FRA',
        claimType: 'PERMANENT' as const
      }
    ];

    // Black Death deployment: Active plague vectors seeding in Sicily and Genoa
    const plagueSeedLocations = [
      { locationId: 21, name: 'Genoa Ligurian Hub', initialVirulence: 0.85 },
      { locationId: 54, name: 'Palermo Sicily Hub', initialVirulence: 0.90 }
    ];

    return {
      calendar: {
        year: 1350,
        month: 4,
        day: 1,
        dateString: '1350-04-01'
      },
      countries,
      activeWars,
      permanentClaims,
      plagueSeedLocations
    };
  }

  /**
   * Applies the 1350 scenario state into live runtime map and economic instances
   */
  public static applyToLiveState(liveWorldState: any): Scenario1350WorldState {
    const scenario = this.create1350CampaignState();

    liveWorldState.calendar = { ...scenario.calendar };
    liveWorldState.activeWars = scenario.activeWars.map(w => ({ ...w }));
    liveWorldState.permanentClaims = scenario.permanentClaims.map(c => ({ ...c }));

    // Apply plague infection vectors
    if (Array.isArray(liveWorldState.locations)) {
      for (const loc of liveWorldState.locations) {
        const seed = scenario.plagueSeedLocations.find(s => s.locationId === loc.id);
        if (seed) {
          loc.plague_infected = true;
          loc.plague_intensity = seed.initialVirulence;
        }
      }
    }

    // Set Calais (ID 3) as active English enclave with high devastation potential
    if (Array.isArray(liveWorldState.locations)) {
      const calais = liveWorldState.locations.find((l: any) => l.id === 3);
      if (calais) {
        calais.country = 'ENG';
        calais.devastation = 0.40; // Historical siege damage from 1347
      }
    }

    return scenario;
  }
}
