/**
 * Ultra-Dense Multi-Regional Country Tag Registry
 * Subsystem: /src/politics/tags/tag_registry.ts
 */

export const GovernmentForm = {
  Feudal_Monarchy: 'Feudal_Monarchy',
  Anatolian_Beylik: 'Anatolian_Beylik',
  Free_Imperial_City: 'Free_Imperial_City',
  Ecclesiastical_Bishopric: 'Ecclesiastical_Bishopric',
  Maritime_Thalassocracy: 'Maritime_Thalassocracy',
  Balkan_Tsardom: 'Balkan_Tsardom'
} as const;

export type GovernmentForm = typeof GovernmentForm[keyof typeof GovernmentForm];

export interface CountryTagEntity {
  numericId: number;
  tag: string;
  name: string;
  government: GovernmentForm;
  primaryCulture: string;
  stateReligion: string;
  capitalLocationId: number;
  ownedLocationIds: number[];
  colorHex: string;
  isHREMember: boolean;
  regionalCluster: 'Anatolia' | 'HRE' | 'Balkans' | 'Western_Europe' | 'Levant' | 'Italy';
}

export class TagRegistryManager {
  private tagMap: Map<string, CountryTagEntity> = new Map();
  private numericIdMap: Map<number, CountryTagEntity> = new Map();
  private clusterIndex: Map<string, CountryTagEntity[]> = new Map();

  constructor() {
    this.populateHistorical1350Tags();
  }

  public registerTag(entity: CountryTagEntity): void {
    this.tagMap.set(entity.tag, entity);
    this.numericIdMap.set(entity.numericId, entity);

    const clusterList = this.clusterIndex.get(entity.regionalCluster) ?? [];
    clusterList.push(entity);
    this.clusterIndex.set(entity.regionalCluster, clusterList);
  }

  public getTag(tag: string): CountryTagEntity | undefined {
    return this.tagMap.get(tag);
  }

  public getByNumericId(numericId: number): CountryTagEntity | undefined {
    return this.numericIdMap.get(numericId);
  }

  public getClusterTags(cluster: string): CountryTagEntity[] {
    return this.clusterIndex.get(cluster) ?? [];
  }

  public getAllTags(): CountryTagEntity[] {
    return Array.from(this.tagMap.values());
  }

  public getTotalTagCount(): number {
    return this.tagMap.size;
  }

  /**
   * Bulk population supporting 1,500+ state actors across Europe & the Near East
   */
  public bulkRegisterProceduralTags(additionalCount: number = 1500): void {
    let nextId = this.numericIdMap.size + 1;
    for (let i = 1; i <= additionalCount; i++) {
      const generatedTag = `T${String(nextId).padStart(4, '0')}`;
      const entity: CountryTagEntity = {
        numericId: nextId,
        tag: generatedTag,
        name: `Barony of ${generatedTag}`,
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Germanic',
        stateReligion: 'Catholic',
        capitalLocationId: 1000 + nextId,
        ownedLocationIds: [1000 + nextId],
        colorHex: '#556677',
        isHREMember: true,
        regionalCluster: 'HRE'
      };
      this.registerTag(entity);
      nextId++;
    }
  }

  /**
   * Hardcoded historical 1350 sovereign entities
   */
  public populateHistorical1350Tags(): void {
    const historicalEntities: CountryTagEntity[] = [
      // --- ANATOLIAN BEYLIKS & NEAR EAST ---
      {
        numericId: 1,
        tag: 'OTT',
        name: 'Ottoman Beylik',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 102, // Bursa
        ownedLocationIds: [101, 102, 103], // Söğüt, Bursa, Iznik
        colorHex: '#2B5329',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 2,
        tag: 'KRM',
        name: 'Karamanid Beylik',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 110, // Konya
        ownedLocationIds: [110, 111],
        colorHex: '#8B0000',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 3,
        tag: 'CND',
        name: 'Candaroğulları Beylik',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 108, // Kastamonu
        ownedLocationIds: [108, 109], // Kastamonu, Sinope
        colorHex: '#3D59AB',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 4,
        tag: 'GER',
        name: 'Germiyanids',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 112, // Kütahya
        ownedLocationIds: [112],
        colorHex: '#CD853F',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 5,
        tag: 'AYD',
        name: 'Aydınoğulları Beylik',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 113, // Birgi / Smyrna
        ownedLocationIds: [113],
        colorHex: '#4682B4',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 6,
        tag: 'SAR',
        name: 'Saruhanoğulları Beylik',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 114, // Manisa
        ownedLocationIds: [114],
        colorHex: '#DAA520',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 7,
        tag: 'MEN',
        name: 'Menteşeoğulları Beylik',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 115, // Milas / Muğla
        ownedLocationIds: [115],
        colorHex: '#2E8B57',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 8,
        tag: 'ERT',
        name: 'Eretnid Sultanate',
        government: GovernmentForm.Anatolian_Beylik,
        primaryCulture: 'Turkish',
        stateReligion: 'Sunni',
        capitalLocationId: 116, // Sivas
        ownedLocationIds: [116, 117], // Sivas, Amasya
        colorHex: '#9932CC',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },
      {
        numericId: 9,
        tag: 'BYZ',
        name: 'Byzantine Empire',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Greek',
        stateReligion: 'Orthodox',
        capitalLocationId: 104, // Constantinople
        ownedLocationIds: [104, 105, 106, 107], // Constantinople, Adrianople, Gallipoli, Philadelphia
        colorHex: '#800080',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },
      {
        numericId: 10,
        tag: 'TRE',
        name: 'Empire of Trebizond',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Pontic_Greek',
        stateReligion: 'Orthodox',
        capitalLocationId: 118, // Trebizond
        ownedLocationIds: [118],
        colorHex: '#4B0082',
        isHREMember: false,
        regionalCluster: 'Anatolia'
      },

      // --- BALKAN CONFLICT CLUSTER ---
      {
        numericId: 11,
        tag: 'SER',
        name: 'Serbian Empire (Stefan Dušan)',
        government: GovernmentForm.Balkan_Tsardom,
        primaryCulture: 'Serbian',
        stateReligion: 'Orthodox',
        capitalLocationId: 120, // Skopje
        ownedLocationIds: [120, 121, 122],
        colorHex: '#C0392B',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },
      {
        numericId: 12,
        tag: 'TAR',
        name: 'Bulgarian Tsardom of Tarnovo',
        government: GovernmentForm.Balkan_Tsardom,
        primaryCulture: 'Bulgarian',
        stateReligion: 'Orthodox',
        capitalLocationId: 123, // Veliko Tarnovo
        ownedLocationIds: [123],
        colorHex: '#27AE60',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },
      {
        numericId: 13,
        tag: 'VID',
        name: 'Bulgarian Tsardom of Vidin',
        government: GovernmentForm.Balkan_Tsardom,
        primaryCulture: 'Bulgarian',
        stateReligion: 'Orthodox',
        capitalLocationId: 124, // Vidin
        ownedLocationIds: [124],
        colorHex: '#2ECC71',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },
      {
        numericId: 14,
        tag: 'WAL',
        name: 'Principality of Wallachia',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Romanian',
        stateReligion: 'Orthodox',
        capitalLocationId: 125, // Câmpulung
        ownedLocationIds: [125],
        colorHex: '#F39C12',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },
      {
        numericId: 15,
        tag: 'MOL',
        name: 'Principality of Moldavia',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Romanian',
        stateReligion: 'Orthodox',
        capitalLocationId: 126, // Baia
        ownedLocationIds: [126],
        colorHex: '#E67E22',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },
      {
        numericId: 16,
        tag: 'BOS',
        name: 'Banate of Bosnia',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Bosnian',
        stateReligion: 'Catholic',
        capitalLocationId: 127, // Visoko
        ownedLocationIds: [127],
        colorHex: '#16A085',
        isHREMember: false,
        regionalCluster: 'Balkans'
      },

      // --- HOLY ROMAN EMPIRE (HRE) FRACTURED GRID ---
      {
        numericId: 17,
        tag: 'HAB',
        name: 'Duchy of Austria',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Austrian',
        stateReligion: 'Catholic',
        capitalLocationId: 201, // Vienna
        ownedLocationIds: [201, 202],
        colorHex: '#FFFFFF',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 18,
        tag: 'BOH',
        name: 'Kingdom of Bohemia',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Czech',
        stateReligion: 'Catholic',
        capitalLocationId: 53, // Prague
        ownedLocationIds: [53, 203],
        colorHex: '#D35400',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 19,
        tag: 'BAV',
        name: 'Duchy of Bavaria',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Bavarian',
        stateReligion: 'Catholic',
        capitalLocationId: 204, // Munich
        ownedLocationIds: [204],
        colorHex: '#3498DB',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 20,
        tag: 'PAL',
        name: 'Electorate of the Palatinate',
        government: GovernmentForm.Feudal_Monarchy,
        primaryCulture: 'Rhenish',
        stateReligion: 'Catholic',
        capitalLocationId: 205, // Heidelberg
        ownedLocationIds: [205],
        colorHex: '#F1C40F',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 21,
        tag: 'COL',
        name: 'Archbishopric of Cologne',
        government: GovernmentForm.Ecclesiastical_Bishopric,
        primaryCulture: 'Rhenish',
        stateReligion: 'Catholic',
        capitalLocationId: 206, // Cologne
        ownedLocationIds: [206],
        colorHex: '#95A5A6',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 22,
        tag: 'MAI',
        name: 'Archbishopric of Mainz',
        government: GovernmentForm.Ecclesiastical_Bishopric,
        primaryCulture: 'Rhenish',
        stateReligion: 'Catholic',
        capitalLocationId: 207, // Mainz
        ownedLocationIds: [207],
        colorHex: '#BDC3C7',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 23,
        tag: 'HAM',
        name: 'Free Imperial City of Hamburg',
        government: GovernmentForm.Free_Imperial_City,
        primaryCulture: 'Lower_Saxon',
        stateReligion: 'Catholic',
        capitalLocationId: 208, // Hamburg
        ownedLocationIds: [208],
        colorHex: '#E74C3C',
        isHREMember: true,
        regionalCluster: 'HRE'
      },
      {
        numericId: 24,
        tag: 'LUB',
        name: 'Free Imperial City of Lübeck',
        government: GovernmentForm.Free_Imperial_City,
        primaryCulture: 'Lower_Saxon',
        stateReligion: 'Catholic',
        capitalLocationId: 209, // Lübeck
        ownedLocationIds: [209],
        colorHex: '#C0392B',
        isHREMember: true,
        regionalCluster: 'HRE'
      }
    ];

    for (const ent of historicalEntities) {
      this.registerTag(ent);
    }
  }
}
