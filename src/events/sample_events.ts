/**
 * Paradox / Project Caesar Style Sample Events Registry
 * Includes Black Death Outbreaks, Burgher Petitions, and Baronial Revolts.
 */

import type { GameEvent } from './types.ts';

export const SAMPLE_HISTORICAL_EVENTS: GameEvent[] = [
  // 1. Burgher Guild Petition (Calais Wool Staple)
  {
    id: 'event_burgher_guild_petition',
    titleLocalizationKey: 'event_burgher_petition_title',
    descriptionLocalizationKey: 'event_burgher_petition_desc',
    pictureAssetRef: 'event_merchant_guild.png',
    category: 'ESTATE',
    fireOnce: true,
    triggerConditions: [
      { field: 'control', operator: 'GREATER_THAN', value: 0.50, scope: 'LOCATION', targetId: 3 } // Calais Control > 50%
    ],
    options: [
      {
        id: 'option_grant_wool_monopoly',
        textLocalizationKey: 'Grant Exclusive Staple Charter',
        tooltipText: 'Grants Burgher export monopoly over Calais wool. +10.0 Burgher Loyalty, +25.0 Ducats, but -15% Calais Crown Control.',
        aiWeightBase: 0.55,
        aiModifiers: [
          { rulerTrait: 'feudal_sovereign', weightMultiplier: 0.7 },
          { rulerTrait: 'stewardship', weightMultiplier: 1.4 }
        ],
        mutationPayload: {
          treasuryGoldDelta: 25.0,
          estateLoyaltyDeltas: { Burghers: 10.0 },
          locationControlDeltas: { 3: -0.15 },
          charterToggles: { woolExportMonopoly: true }
        }
      },
      {
        id: 'option_reject_burgher_demands',
        textLocalizationKey: 'Protect Royal Tolls & Suppress',
        tooltipText: 'Denies the merchant petition to preserve sovereign taxation authority. -15.0 Burgher Loyalty.',
        aiWeightBase: 0.45,
        aiModifiers: [
          { rulerTrait: 'valiant_warrior', weightMultiplier: 1.3 }
        ],
        mutationPayload: {
          estateLoyaltyDeltas: { Burghers: -15.0 }
        }
      }
    ]
  },

  // 2. Noble Baronial Revolt Warning
  {
    id: 'event_baronial_unrest',
    titleLocalizationKey: 'event_baronial_unrest_title',
    descriptionLocalizationKey: 'event_baronial_unrest_desc',
    pictureAssetRef: 'event_feudal_knights.png',
    category: 'DOMESTIC',
    fireOnce: true,
    triggerConditions: [
      { field: 'loyalty', operator: 'LESS_THAN', value: 40.0, scope: 'ESTATE', targetId: 'Nobility' }
    ],
    options: [
      {
        id: 'option_concede_barons',
        textLocalizationKey: 'Confirm Magna Carta Feudal Liberties',
        tooltipText: 'Concedes feudal privileges. +25.0 Nobility Loyalty, but locks nobility tithe exemptions.',
        aiWeightBase: 0.70,
        mutationPayload: {
          estateLoyaltyDeltas: { Nobility: 25.0 },
          charterToggles: { feudalTitheExemption: true }
        }
      },
      {
        id: 'option_arrest_barons',
        textLocalizationKey: 'Arrest the Traitors and Seize Estates',
        tooltipText: 'Confiscates baronial manors. +120.0 Ducats, but -20.0 Nobility Loyalty and +10% Devastation in Rouen.',
        aiWeightBase: 0.30,
        mutationPayload: {
          treasuryGoldDelta: 120.0,
          estateLoyaltyDeltas: { Nobility: -20.0 },
          locationDevastationDeltas: { 4: 0.10 }
        }
      }
    ]
  },

  // 3. Black Death Epidemic Outbreak
  {
    id: 'event_black_death_outbreak',
    titleLocalizationKey: 'event_black_death_title',
    descriptionLocalizationKey: 'event_black_death_desc',
    pictureAssetRef: 'event_plague_doctor.png',
    category: 'EPIDEMIC',
    fireOnce: true,
    triggerConditions: [
      { field: 'devastation', operator: 'GREATER_THAN', value: 0.12, scope: 'LOCATION', targetId: 4 } // Rouen devastation > 12%
    ],
    options: [
      {
        id: 'option_strict_cordon_sanitaire',
        textLocalizationKey: 'Impose Strict Cordon Sanitaire',
        tooltipText: 'Seals maritime and land borders. Costs 40.0 Ducats, -10% trade income, but limits epidemic mortality.',
        aiWeightBase: 0.65,
        mutationPayload: {
          treasuryGoldDelta: -40.0,
          locationControlDeltas: { 4: 0.05 }
        }
      },
      {
        id: 'option_church_prayers',
        textLocalizationKey: 'Order National Penance & Processions',
        tooltipText: 'Rely on Church intercession. +15.0 Clergy Loyalty, but plague spreads without restriction.',
        aiWeightBase: 0.35,
        mutationPayload: {
          estateLoyaltyDeltas: { Clergy: 15.0 }
        }
      }
    ]
  }
];
