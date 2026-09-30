/**
 * Interactive Web Application Frontend for Grand Strategy Simulation Engine
 * Project Caesar UI & Systems Pipeline Standard
 */

// RELATIONAL SIMULATION STATE
const state = {
  calendar: { year: 1350, month: 1, day: 1 },
  isRunning: false,
  timer: null,
  speedMs: 1000,
  activeMapMode: 'political',
  selectedLocationId: 1,
  channelBlockaded: false,
  straitBlockaded: false,
  
  // HUD Telemetry
  crownTreasury: 2588.0,
  monthlyTaxIncome: 288.8,
  monthlyMaintenance: 120.0,
  manpower: 28458,
  maxManpower: 35000,
  crownPower: 0.65,
  nationalTaxEfficiency: 1.0,
  activeAge: 'Age of Renaissance',

  // Active Royal Charters & Decrees
  charters: {
    feudalTitheExemption: {
      id: 'feudal_tithe_exemption',
      name: 'Feudal Tithe Exemption',
      targetEstate: 'Nobility',
      active: true,
      loyaltyFloor: 15.0,
      taxSkimmingPenalty: 0.20 // -20% tax deduction on noble lands
    },
    woolExportMonopoly: {
      id: 'wool_export_monopoly',
      name: 'Wool Export Monopoly',
      targetEstate: 'Burghers',
      active: true,
      loyaltyBonus: 10.0,
      wealthAccumulationRate: 0.25, // +25% monthly wealth index
      crownControlPenalty: 0.10 // -10% Crown Control across Dover-Calais trade graph
    }
  },

  // Ruler & Dynastic Court
  ruler: {
    id: 1,
    firstName: 'Edward III',
    dynasty: 'Plantagenet',
    age: 38,
    sex: 'Male',
    culture: 'Anglo-Norman',
    subCulture: 'English Gothic',
    religion: 'Catholic',
    health: 78.0,
    isAlive: true,
    attributes: { martial: 85, diplomacy: 79, stewardship: 65, learning: 50, intrigue: 68 },
    traits: [
      { id: 'valiant_warrior', name: 'Valiant Warrior', shockBonus: 0.15 },
      { id: 'feudal_sovereign', name: 'Feudal Sovereign', nobilityLoyaltyBonus: 10.0 },
      { id: 'gout_afflicted', name: 'Gout Afflicted', healthPenalty: 5.0 }
    ],
    isMarried: false,
    spouseName: null,
    isGeneral: false,
    combatShockModifier: 1.0,
    isCabinetAdvisor: false,
    cabinetRole: null
  },

  diplomaticMarriageRelation: null,

  heir: {
    id: 2,
    firstName: 'Edward of Woodstock (Black Prince)',
    dynasty: 'Plantagenet',
    age: 20,
    martial: 95,
    diplomacy: 65,
    stewardship: 60,
    learning: 50,
    intrigue: 55,
    claim: 100
  },

  // Outliner State
  outliner: {
    normandyIntegration: 43.6,
    calaisBastion: 68.2,
    alerts: [
      { id: 'flanders', title: 'Disputed Heir in Flanders', desc: 'Duchess Margaret is unmarried. Royal marriage gives Personal Union claim.' },
      { id: 'burghers', title: 'Burgher Guild Petition', desc: 'Merchant guilds demand monopoly charters over wool exports in Calais.' }
    ],
    armies: [
      { id: 'royal_vanguard', name: 'Royal Vanguard', size: 8500, commander: 'King Edward III', location: 'Calais', morale: 95.0, shockBonus: 0.0 },
      { id: 'channel_fleet', name: 'Channel Battle Fleet', size: 14, commander: 'Lord Admiral', location: 'Dover Straits', morale: 100.0 }
    ]
  },

  // Granular Micro-Locations with Explicit Pop Strata Allocation
  locations: [
    {
      id: 1,
      name: 'London',
      country: 'ENG',
      terrain: 'Farmland',
      devastation: 0.0,
      infrastructure: 35.0,
      control: 1.0,
      tax_base: 120.0,
      nobleDominated: true,
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Anglo-Norman', size: 3500, wealth: 450.0, unrest: 0.05 },
        { estate: 'Clergy', subCulture: 'Anglo-Norman', size: 2000, wealth: 180.0, unrest: 0.02 },
        { estate: 'Burghers', subCulture: 'English', size: 4000, wealth: 210.0, unrest: 0.08 },
        { estate: 'Commoners', subCulture: 'English & Gascon', size: 22000, wealth: 18.0, unrest: 0.12 }
      ],
      buildings: ['Arable Feudal Estate (Grain)', 'Royal Armory & Mint']
    },
    {
      id: 2,
      name: 'Dover',
      country: 'ENG',
      terrain: 'Coast',
      devastation: 0.05,
      infrastructure: 20.0,
      control: 0.93,
      tax_base: 65.0,
      nobleDominated: false,
      plague_infected: false,
      pops: [
        { estate: 'Burghers', subCulture: 'English', size: 4200, wealth: 85.0, unrest: 0.08 },
        { estate: 'Commoners', subCulture: 'English', size: 8500, wealth: 15.0, unrest: 0.10 }
      ],
      buildings: ['Subterranean Iron Mine', 'Hardwood Timber Mill']
    },
    {
      id: 3,
      name: 'Calais',
      country: 'ENG',
      terrain: 'Marsh',
      devastation: 0.10,
      infrastructure: 15.0,
      control: 0.96,
      tax_base: 80.0,
      nobleDominated: true,
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Anglo-Norman', size: 1200, wealth: 190.0, unrest: 0.06 },
        { estate: 'Burghers', subCulture: 'Flemish & English', size: 3500, wealth: 140.0, unrest: 0.14 },
        { estate: 'Commoners', subCulture: 'Cosmopolitan', size: 7300, wealth: 14.0, unrest: 0.18 }
      ],
      buildings: ['Burgher Textile Guildhall', 'Bastion Slipway']
    },
    {
      id: 4,
      name: 'Rouen',
      country: 'FRA',
      terrain: 'Farmland',
      devastation: 0.15,
      infrastructure: 25.0,
      control: 0.73,
      tax_base: 75.0,
      nobleDominated: true,
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Norman French', size: 2500, wealth: 320.0, unrest: 0.15 },
        { estate: 'Commoners', subCulture: 'Francien', size: 12500, wealth: 12.0, unrest: 0.25 }
      ],
      buildings: ['Munitions Foundry & Armory']
    },
    {
      id: 5,
      name: 'Paris',
      country: 'FRA',
      terrain: 'Farmland',
      devastation: 0.0,
      infrastructure: 40.0,
      control: 0.59,
      tax_base: 150.0,
      nobleDominated: true,
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Francien', size: 6000, wealth: 850.0, unrest: 0.10 },
        { estate: 'Burghers', subCulture: 'Francien', size: 11000, wealth: 260.0, unrest: 0.12 },
        { estate: 'Commoners', subCulture: 'Francien', size: 35000, wealth: 22.0, unrest: 0.20 }
      ],
      buildings: ['Cathedral of Notre-Dame', 'Textile Manufactory']
    },
    {
      id: 20,
      name: 'Venice',
      country: 'VEN',
      terrain: 'Coast',
      devastation: 0.0,
      infrastructure: 55.0,
      control: 1.0,
      tax_base: 140.0,
      nobleDominated: false,
      dominanceLabel: 'Burghers/Merchant Council',
      plague_infected: false,
      pops: [
        { estate: 'Burghers', subCulture: 'Venetian', size: 18000, wealth: 350.0, unrest: 0.05 },
        { estate: 'Commoners', subCulture: 'Venetian', size: 20000, wealth: 28.0, unrest: 0.08 }
      ],
      buildings: ['Venetian Arsenale', 'Doge Palace & Basilica di San Marco']
    },
    {
      id: 23,
      name: 'Rome',
      country: 'PAP',
      terrain: 'Farmland',
      devastation: 0.0,
      infrastructure: 45.0,
      control: 0.95,
      tax_base: 110.0,
      nobleDominated: false,
      dominanceLabel: 'Clergy/Holy See',
      plague_infected: false,
      pops: [
        { estate: 'Clergy', subCulture: 'Roman', size: 12000, wealth: 420.0, unrest: 0.03 },
        { estate: 'Commoners', subCulture: 'Roman', size: 18000, wealth: 22.0, unrest: 0.09 }
      ],
      buildings: ['Old St. Peter Basilica', 'Apostolic Palace']
    },
    {
      id: 110,
      name: 'Adrianople',
      country: 'TUR',
      terrain: 'Farmland',
      devastation: 0.04,
      infrastructure: 35.0,
      control: 0.82,
      tax_base: 70.0,
      nobleDominated: true,
      dominanceLabel: 'Nobility/Janissaries',
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Turkish', size: 4500, wealth: 280.0, unrest: 0.04 },
        { estate: 'Commoners', subCulture: 'Bulgarian & Greek', size: 45000, wealth: 18.0, unrest: 0.09 }
      ],
      buildings: ['Balkan Frontier Fortress', 'Rumelian Waystation']
    },
    {
      id: 104,
      name: 'Constantinople',
      country: 'BYZ',
      terrain: 'Farmland',
      devastation: 0.08,
      infrastructure: 60.0,
      control: 0.88,
      tax_base: 180.0,
      nobleDominated: false,
      dominanceLabel: 'Clergy/Imperial Bureaucracy',
      plague_infected: false,
      pops: [
        { estate: 'Clergy', subCulture: 'Greek', size: 15000, wealth: 380.0, unrest: 0.06 },
        { estate: 'Nobility', subCulture: 'Greek', size: 10000, wealth: 520.0, unrest: 0.08 },
        { estate: 'Burghers', subCulture: 'Greek & Genoese', size: 25000, wealth: 240.0, unrest: 0.12 },
        { estate: 'Commoners', subCulture: 'Greek', size: 50000, wealth: 20.0, unrest: 0.15 }
      ],
      buildings: ['Hagia Sophia Cathedral', 'Theodosian Triple Walls', 'Blachernae Imperial Palace']
    },
    {
      id: 102,
      name: 'Bursa',
      country: 'TUR',
      terrain: 'Hills',
      devastation: 0.0,
      infrastructure: 45.0,
      control: 0.95,
      tax_base: 95.0,
      nobleDominated: true,
      dominanceLabel: 'Nobility/Sipahis',
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Turkish', size: 6000, wealth: 360.0, unrest: 0.02 },
        { estate: 'Commoners', subCulture: 'Turkish', size: 18000, wealth: 24.0, unrest: 0.04 }
      ],
      buildings: ['Grand Mosque of Bursa', 'Sipahi Cavalry Barracks', 'Silk & Spice Bazaar']
    },
    {
      id: 101,
      name: 'Söğüt',
      country: 'TUR',
      terrain: 'Hills',
      devastation: 0.0,
      infrastructure: 30.0,
      control: 1.0,
      tax_base: 50.0,
      nobleDominated: true,
      dominanceLabel: 'Nobility/Gazi Warriors',
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Turkish', size: 7200, wealth: 290.0, unrest: 0.03 },
        { estate: 'Commoners', subCulture: 'Turkish', size: 40000, wealth: 16.0, unrest: 0.05 }
      ],
      buildings: ['Ertugrul Gazi Shrine', 'Nomadic Horsearcher Encampment']
    }
  ],

  estates: [
    { type: 'Nobility', wealth: 528.0, loyalty: 65.3, power: 45.0 }, // +10.0 from Feudal Sovereign trait
    { type: 'Clergy', wealth: 500.0, loyalty: 56.7, power: 22.0 },
    { type: 'Burghers', wealth: 512.0, loyalty: 56.7, power: 20.0 }
  ],

  market: {
    goods: {
      grain: { price: 2.5, base: 2.5, supply: 120, demand: 90 },
      iron: { price: 6.0, base: 6.0, supply: 45, demand: 40 },
      timber: { price: 4.0, base: 4.0, supply: 60, demand: 50 },
      wool: { price: 3.5, base: 3.5, supply: 50, demand: 45 },
      weapons: { price: 18.0, base: 18.0, supply: 20, demand: 25 }
    }
  }
};

// TOAST NOTIFICATION UTILITY
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// CONTROL RECALCULATION WITH EXPONENTIAL PATHFINDING & CHARTER PENALTIES
function recalculateControl() {
  for (const loc of state.locations) {
    if (loc.id === 1) { 
      loc.control = 1.0; 
      continue; 
    }
    if (loc.id === 102) {
      loc.control = 0.95;
      continue;
    }
    if (loc.id === 101) {
      loc.control = 1.0;
      continue;
    }
    if (loc.id === 104) {
      loc.control = 0.88;
      continue;
    }
    if (loc.id === 110) {
      loc.control = 0.82;
      continue;
    }
    if (loc.id === 20) {
      loc.control = 1.0;
      continue;
    }
    if (loc.id === 23) {
      loc.control = 0.95;
      continue;
    }
    let dist = 15.0;
    if (loc.id === 2) dist = 12.0;
    if (loc.id === 3) dist = state.channelBlockaded ? 120.0 : 14.0;
    if (loc.id === 4) dist = state.channelBlockaded ? 140.0 : 35.0;
    if (loc.id === 5) dist = state.channelBlockaded ? 180.0 : 55.0;

    const devastationFactor = 1.0 + Math.pow(loc.devastation, 1.5) * 3.0;
    // Base formula: Control = 1.0 * e^(-0.018 * Distance * Devastation)
    let rawControl = Math.max(0.01, Math.min(1.0, Math.exp(-0.018 * dist * devastationFactor)));

    // Charter Penalty: Wool Export Monopoly applies global -10% Crown Control across Dover & Calais trade graph
    if (state.charters.woolExportMonopoly.active && (loc.id === 2 || loc.id === 3)) {
      rawControl = Math.max(0.05, rawControl - state.charters.woolExportMonopoly.crownControlPenalty);
    }

    loc.control = rawControl;
  }
}

// O(1) MEMORY LOOKUP & FOOTER TEXT REFRESH
function refreshLocationFooter(locationId) {
  const loc = state.locations.find(l => l.id === locationId);
  if (!loc) return;

  const totalPop = loc.pops.reduce((sum, p) => sum + p.size, 0);
  const nameEl = document.getElementById('selected-loc-name');
  const statsEl = document.getElementById('selected-loc-stats');

  // Exact conditional interface switch requested for Bursa
  if (loc.name === 'Bursa' || loc.id === 102) {
    if (nameEl) nameEl.textContent = 'Bursa (Hills)';
    if (statsEl) {
      statsEl.textContent = 'Control: 95.0% • Devastation: 0.0% • Pops: 24,000 • Dominance: Nobility/Sipahis';
    }
    return;
  }

  // Exact conditional interface switch for London (Capital Hub)
  if (loc.name === 'London' || loc.id === 1) {
    if (nameEl) nameEl.textContent = 'London (Farmland)';
    if (statsEl) {
      statsEl.textContent = 'Control: 100.0% • Devastation: 0.0% • Pops: 31,500';
    }
    return;
  }

  const dominance = loc.dominanceLabel || (loc.nobleDominated ? 'Nobility' : 'Burghers/Commoners');
  if (nameEl) nameEl.textContent = `${loc.name} (${loc.terrain})`;
  if (statsEl) {
    statsEl.textContent = `Control: ${(loc.control * 100).toFixed(1)}% • Devastation: ${(loc.devastation * 100).toFixed(1)}% • Pops: ${totalPop.toLocaleString()} • Dominance: ${dominance}`;
  }
}

// MAP MODE STYLER WITH REAL-TIME COLOR INTERPOLATION
function renderMapModes() {
  for (const loc of state.locations) {
    const nodeEl = document.querySelector(`.location-node[data-id="${loc.id}"] circle.loc-core`);
    if (!nodeEl) continue;

    if (state.activeMapMode === 'political') {
      let fillColor = '#b91c1c';
      if (loc.country === 'FRA') fillColor = '#1d4ed8';
      else if (loc.country === 'TUR') fillColor = '#047857';
      else if (loc.country === 'BYZ') fillColor = '#7e22ce';
      else if (loc.country === 'VEN') fillColor = '#0284c7';
      else if (loc.country === 'PAP') fillColor = '#ca8a04';
      nodeEl.setAttribute('fill', fillColor);
      nodeEl.setAttribute('stroke', (loc.id === 1 || loc.id === 102 || loc.id === 104) ? '#ffd700' : '#ffffff');
    } else if (state.activeMapMode === 'control') {
      if (loc.control >= 0.90) {
        nodeEl.setAttribute('fill', '#ffd700');
        nodeEl.setAttribute('stroke', '#ffffff');
      } else if (loc.control >= 0.65) {
        nodeEl.setAttribute('fill', '#f59e0b');
        nodeEl.setAttribute('stroke', '#b45309');
      } else {
        nodeEl.setAttribute('fill', '#b91c1c');
        nodeEl.setAttribute('stroke', '#fca5a5');
      }
    } else if (state.activeMapMode === 'trade') {
      nodeEl.setAttribute('fill', [1, 3, 20, 104, 102].includes(loc.id) ? '#f59e0b' : '#334155');
      nodeEl.setAttribute('stroke', (state.channelBlockaded || state.straitBlockaded) ? '#ef4444' : '#ffd700');
    } else if (state.activeMapMode === 'devastation') {
      const red = Math.floor(100 + 155 * loc.devastation);
      nodeEl.setAttribute('fill', `rgb(${red}, 40, 40)`);
      nodeEl.setAttribute('stroke', '#ff8888');
    } else if (state.activeMapMode === 'plague') {
      nodeEl.setAttribute('fill', loc.plague_infected ? '#ef4444' : '#10b981');
      nodeEl.setAttribute('stroke', loc.plague_infected ? '#ff0000' : '#ffffff');
    }
  }

  // Blockade line rendering
  const seaLine = document.getElementById('sea-trade-line');
  const dcLine = document.getElementById('dover-calais-line');
  const gibLine = document.getElementById('gibraltar-maritime-loop');
  const bosphorusLine = document.getElementById('bosphorus-strait-line');
  const bosphorusChoke = document.getElementById('bosphorus-choke-indicator');

  if (dcLine) {
    if (state.channelBlockaded) {
      dcLine.classList.add('blockaded');
    } else {
      dcLine.classList.remove('blockaded');
    }
  }
  if (seaLine) {
    if (state.channelBlockaded) {
      seaLine.classList.add('blockaded');
    } else {
      seaLine.classList.remove('blockaded');
    }
  }
  if (gibLine) {
    if (state.channelBlockaded) {
      gibLine.classList.add('blockaded');
    } else {
      gibLine.classList.remove('blockaded');
    }
  }
  if (bosphorusLine) {
    if (state.straitBlockaded) {
      bosphorusLine.classList.add('blockaded');
    } else {
      bosphorusLine.classList.remove('blockaded');
    }
  }
  if (bosphorusChoke) {
    if (state.straitBlockaded) {
      bosphorusChoke.classList.add('blockaded');
    } else {
      bosphorusChoke.classList.remove('blockaded');
    }
  }
}

// UPDATE TOPBAR HUD
function updateHUD() {
  const netMonthly = state.monthlyTaxIncome - state.monthlyMaintenance;
  const treasuryEl = document.getElementById('hud-treasury');
  if (treasuryEl) treasuryEl.textContent = state.crownTreasury.toFixed(1);

  const deltaEl = document.getElementById('hud-treasury-delta');
  if (deltaEl) {
    deltaEl.textContent = `(${netMonthly >= 0 ? '+' : ''}${netMonthly.toFixed(1)})`;
    deltaEl.className = netMonthly >= 0 ? 'delta pos' : 'delta neg';
  }

  const manpowerEl = document.getElementById('hud-manpower');
  if (manpowerEl) manpowerEl.textContent = state.manpower.toLocaleString();

  const crownPowerEl = document.getElementById('hud-crown-power');
  if (crownPowerEl) crownPowerEl.textContent = `${(state.crownPower * 100).toFixed(1)}%`;

  const dateEl = document.getElementById('date-display');
  if (dateEl) {
    dateEl.textContent = 
      `${state.calendar.year}-${String(state.calendar.month).padStart(2, '0')}-${String(state.calendar.day).padStart(2, '0')}`;
  }

  // Outliner Updates
  const normandyVal = document.getElementById('task-normandy-val');
  if (normandyVal) normandyVal.textContent = `${state.outliner.normandyIntegration.toFixed(1)}%`;
  const normandyBar = document.getElementById('task-normandy-bar');
  if (normandyBar) normandyBar.style.width = `${state.outliner.normandyIntegration}%`;

  const calaisVal = document.getElementById('task-calais-val');
  if (calaisVal) calaisVal.textContent = `${state.outliner.calaisBastion.toFixed(1)}%`;
  const calaisBar = document.getElementById('task-calais-bar');
  if (calaisBar) calaisBar.style.width = `${state.outliner.calaisBastion}%`;

  // Outliner Estates
  const nobilityLoyalty = document.getElementById('out-nobility-loyalty');
  if (nobilityLoyalty) nobilityLoyalty.textContent = `Loyalty: ${state.estates[0].loyalty.toFixed(1)}%`;
  const nobilityWealth = document.getElementById('out-nobility-wealth');
  if (nobilityWealth) nobilityWealth.textContent = `Wealth: ${state.estates[0].wealth.toFixed(1)} D • Power: ${state.estates[0].power.toFixed(1)}%`;

  // Refresh Footer
  refreshLocationFooter(state.selectedLocationId);
  renderMapModes();
}

// SIMULATION TICK CASCADE: DAILY TICK
function executeDayTick() {
  state.calendar.day++;

  // Daily supply line check & minor random health wear
  if (state.ruler.isAlive && Math.random() < 0.005) {
    state.ruler.health = Math.max(0, state.ruler.health - 0.2);
  }

  // End of Month trigger
  if (state.calendar.day > 30) {
    state.calendar.day = 1;
    state.calendar.month++;
    processMonthEndTick();

    if (state.calendar.month > 12) {
      state.calendar.month = 1;
      state.calendar.year++;
      executeYearEndPass();
    }
  }

  updateHUD();
}

// SIMULATION TICK CASCADE: MONTH-END TICK
function processMonthEndTick() {
  recalculateControl();

  // 1. Stewardship Reduction Factor (65 Steward -> 16.25% speedup)
  const stewardshipDiscount = (state.ruler.attributes.stewardship / 100.0) * 0.25;
  const speedMultiplier = 1.0 + stewardshipDiscount;

  // 2. Fractional Outliner Construction & Integration Task Additions
  state.outliner.normandyIntegration = Math.min(100.0, state.outliner.normandyIntegration + (0.35 * speedMultiplier));
  state.outliner.calaisBastion = Math.min(100.0, state.outliner.calaisBastion + (1.20 * speedMultiplier));

  // 3. Tax revenue collection and estate wealth skimming
  let crownTaxSum = 0;
  let nobilitySkimSum = 0;
  let burgherSkimSum = 0;

  for (const loc of state.locations) {
    const potentialTax = loc.tax_base * 0.15 * state.nationalTaxEfficiency;
    const collected = potentialTax * loc.control;
    let skimmed = potentialTax * (1.0 - loc.control);

    // CHARTER: Feudal Tithe Exemption
    // Deducts a flat -20% from all tax skimming computations running on Locations where Nobility pops hold dominance
    if (state.charters.feudalTitheExemption.active && loc.nobleDominated) {
      skimmed *= (1.0 - state.charters.feudalTitheExemption.taxSkimmingPenalty); // Flat -20% deduction
    }

    crownTaxSum += collected;
    nobilitySkimSum += skimmed * 0.70;
    burgherSkimSum += skimmed * 0.30;

    // Blockade penalty: if Dover or Calais is cut, -50% burgher wealth generation
    if (state.channelBlockaded && (loc.id === 2 || loc.id === 3)) {
      burgherSkimSum *= 0.50;
    }
  }

  // CHARTER: Wool Export Monopoly
  // Increments Burgher Wealth Accumulation Index by +25% monthly
  if (state.charters.woolExportMonopoly.active) {
    burgherSkimSum *= (1.0 + state.charters.woolExportMonopoly.wealthAccumulationRate);
    state.estates[2].loyalty = Math.min(100.0, state.estates[2].loyalty + 0.3);
  }

  // CHARTER: Feudal Tithe Exemption loyalty floor
  // Locks Nobility Loyalty to a fixed minimum floor of +15%
  if (state.charters.feudalTitheExemption.active) {
    state.estates[0].loyalty = Math.max(state.charters.feudalTitheExemption.loyaltyFloor, state.estates[0].loyalty);
  }

  state.crownTreasury += crownTaxSum;
  state.monthlyTaxIncome = crownTaxSum;
  state.estates[0].wealth += nobilitySkimSum;
  state.estates[2].wealth += burgherSkimSum;

  // 4. Manpower Monthly Conscription (+350/mo)
  state.manpower = Math.min(state.maxManpower, state.manpower + 350);

  // 5. Value Chain & Price Updates
  if (state.channelBlockaded) {
    state.market.goods.timber.price = 4.0 * Math.pow(90 / 15, 0.70); // Spike to ~14.0 Ducats
    state.market.goods.weapons.price = 18.0 * Math.pow(60 / 10, 0.40); // Spike to ~36.0 Ducats
  } else {
    state.market.goods.timber.price = 4.0;
    state.market.goods.weapons.price = 18.0;
  }

  updateHUD();
}

// YEAR-END PASS: DYNASTIC GOUT CHECK & SUCCESSION
function executeYearEndPass() {
  if (state.ruler.isAlive) {
    // Gout Afflicted: -5 Health annual reduction pass
    state.ruler.health -= 5.0;

    if (state.ruler.health <= 0) {
      // King Edward III dies of gout!
      state.ruler.isAlive = false;
      // Elevate designated heir (Black Prince)
      state.ruler.firstName = state.heir.firstName;
      state.ruler.age = state.heir.age;
      state.ruler.attributes.martial = state.heir.martial;
      state.ruler.attributes.diplomacy = state.heir.diplomacy;
      state.ruler.attributes.stewardship = state.heir.stewardship;
      state.ruler.health = 90.0;
      state.ruler.isAlive = true;

      // Update UI Ruler display
      const nameEl = document.getElementById('ruler-name');
      if (nameEl) nameEl.textContent = `King Edward IV (The Black Prince)`;
      const martialEl = document.getElementById('attr-martial');
      if (martialEl) martialEl.textContent = '95';
      const stewardEl = document.getElementById('attr-steward');
      if (stewardEl) stewardEl.textContent = '60';

      const goutBadge = document.getElementById('trait-gout-afflicted');
      if (goutBadge) {
        goutBadge.textContent = '👑 Crowned Victorious';
        goutBadge.style.borderColor = '#10b981';
        goutBadge.style.color = '#6ee7b7';
      }

      showToast('👑 KING EDWARD III HAS SUCCUMBED TO GOUT! Edward of Woodstock (Black Prince) ascends the English Throne!');
    }
  }
}

// EVENT LISTENERS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  recalculateControl();
  updateHUD();

  // Play / Pause Simulation Loop
  const playBtn = document.getElementById('btn-play-pause');
  playBtn.addEventListener('click', () => {
    state.isRunning = !state.isRunning;
    if (state.isRunning) {
      playBtn.textContent = '⏸ Pause';
      playBtn.classList.add('active');
      state.timer = setInterval(executeDayTick, state.speedMs);
    } else {
      playBtn.textContent = '▶ Play';
      playBtn.classList.remove('active');
      clearInterval(state.timer);
    }
  });

  // Step Day (+1)
  document.getElementById('btn-step-day').addEventListener('click', executeDayTick);

  // Step Month (+1)
  document.getElementById('btn-step-month').addEventListener('click', () => {
    for (let i = 0; i < 30; i++) executeDayTick();
  });

  // Speed Selector
  document.getElementById('speed-select').addEventListener('change', (e) => {
    state.speedMs = parseInt(e.target.value, 10);
    if (state.isRunning) {
      clearInterval(state.timer);
      state.timer = setInterval(executeDayTick, state.speedMs);
    }
  });

  // Map Mode Selectors
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeMapMode = btn.dataset.mode;
      renderMapModes();
    });
  });

  // Location Mouse-Click Raycasting / Selection
  document.querySelectorAll('.location-node').forEach(node => {
    node.addEventListener('click', () => {
      document.querySelectorAll('.location-node').forEach(n => n.classList.remove('selected'));
      node.classList.add('selected');
      state.selectedLocationId = parseInt(node.dataset.id, 10);
      refreshLocationFooter(state.selectedLocationId);
    });
  });

  // Sol Panel: Arrange Royal Marriage
  document.getElementById('btn-court-marriage').addEventListener('click', () => {
    if (!state.ruler.isMarried) {
      state.ruler.isMarried = true;
      state.ruler.spouseName = 'Duchess Margaret of Flanders';
      state.diplomaticMarriageRelation = {
        initiatorCountryId: 1,
        targetCountryId: 2,
        foreignSpouseName: 'Duchess Margaret of Flanders',
        dynasticClaimStrength: 1.0,
        activeTreaty: true,
        personalUnionPotential: true
      };
      state.outliner.alerts = state.outliner.alerts.filter(a => a.id !== 'flanders');
      const flandersAlert = document.getElementById('alert-item-1');
      if (flandersAlert) flandersAlert.style.display = 'none';
      const badge = document.getElementById('alert-count-badge');
      if (badge) badge.textContent = '1';
      showToast('💍 Diplomatic_Marriage_Relation struct forged with Flanders! Personal Union claim established.');
    } else {
      showToast('The sovereign is already bound in holy matrimony to ' + state.ruler.spouseName);
    }
  });

  // Sol Panel: Appoint as Field General (Hooks into Royal Vanguard)
  document.getElementById('btn-court-general').addEventListener('click', () => {
    state.ruler.isGeneral = true;
    state.ruler.combatShockModifier = 1.15; // 1.15 float modifier to front-row combat grid damage ticks
    const armyRow = document.getElementById('outliner-army-1');
    if (armyRow) {
      armyRow.innerHTML = `
        <div class="outliner-row-main">
          <strong>Royal Vanguard</strong>
          <span style="color: #fbbf24;">8,500 Men (+15% Shock)</span>
        </div>
        <span style="font-size: 10px; color: #34d399;">Commander: King Edward III (Valiant Warrior • 1.15x Shock) • Calais</span>
      `;
    }
    showToast('⚔️ King Edward III detached from court and assigned pointer to Royal Vanguard! (Valiant Warrior: 1.15x combat shock applied)');
  });

  // Sol Panel: Appoint Cabinet Advisor (Registers into Lord High Chancellor slot)
  document.getElementById('btn-court-advisor').addEventListener('click', () => {
    state.ruler.isCabinetAdvisor = true;
    state.ruler.cabinetRole = 'Lord High Chancellor';
    state.monthlyTaxIncome += 20.0;
    showToast('📜 King Edward III registered into the active Lord High Chancellor execution slot (+20.0 D/mo tax extraction)!');
    updateHUD();
  });

  // Sol Panel: Commission Atlantic Explorer
  document.getElementById('btn-court-explorer').addEventListener('click', () => {
    showToast('🧭 Atlantic Expedition chartered under Renaissance patronage! Exploration fleet dispatched.');
  });

  // Interactive Royal Charters Toggles
  const titheCard = document.getElementById('charter-feudal-tithe');
  const titheTag = document.getElementById('tag-tithe-status');
  if (titheCard && titheTag) {
    titheCard.addEventListener('click', () => {
      state.charters.feudalTitheExemption.active = !state.charters.feudalTitheExemption.active;
      if (state.charters.feudalTitheExemption.active) {
        titheCard.classList.add('active');
        titheTag.className = 'charter-status-tag active';
        titheTag.textContent = 'Active';
        showToast('📜 Feudal Tithe Exemption ratified: Nobility loyalty floor set to +15%, -20% tax skim on noble lands.');
      } else {
        titheCard.classList.remove('active');
        titheTag.className = 'charter-status-tag inactive';
        titheTag.textContent = 'Suspended';
        showToast('⚠️ Feudal Tithe Exemption suspended: Tax skimming restored, nobility unrest increases.');
      }
      processMonthEndTick();
    });
  }

  const woolCard = document.getElementById('charter-wool-monopoly');
  const woolTag = document.getElementById('tag-wool-status');
  if (woolCard && woolTag) {
    woolCard.addEventListener('click', () => {
      state.charters.woolExportMonopoly.active = !state.charters.woolExportMonopoly.active;
      if (state.charters.woolExportMonopoly.active) {
        woolCard.classList.add('active');
        woolTag.className = 'charter-status-tag active';
        woolTag.textContent = 'Active';
        showToast('🐑 Wool Export Monopoly ratified: Burgher wealth rate +25%/mo, -10% Crown Control across Dover-Calais.');
      } else {
        woolCard.classList.remove('active');
        woolTag.className = 'charter-status-tag inactive';
        woolTag.textContent = 'Suspended';
        showToast('⚠️ Wool Export Monopoly revoked: Crown Control restored across Dover-Calais trade graph.');
      }
      recalculateControl();
      processMonthEndTick();
    });
  }

  // Outliner Action: Burgher Guild Petition Modal Interaction
  const petitionAlert = document.getElementById('alert-item-2');
  const petitionModal = document.getElementById('modal-petition');

  if (petitionAlert && petitionModal) {
    petitionAlert.addEventListener('click', () => {
      // Halt calendar tick engine
      if (state.isRunning) {
        state.isRunning = false;
        clearInterval(state.timer);
        const playBtn = document.getElementById('btn-play-pause');
        if (playBtn) {
          playBtn.textContent = '▶ Play';
          playBtn.classList.remove('active');
        }
      }
      petitionModal.style.display = 'flex';
    });

    document.getElementById('btn-modal-accept').addEventListener('click', () => {
      petitionModal.style.display = 'none';
      petitionAlert.style.display = 'none';
      const badge = document.getElementById('alert-count-badge');
      if (badge) badge.textContent = '0';

      state.estates[2].loyalty += 10.0;
      state.crownTreasury += 25.0;
      const calaisLoc = state.locations.find(l => l.id === 3);
      if (calaisLoc) {
        calaisLoc.control = Math.max(0.1, calaisLoc.control - 0.15);
      }
      showToast('Accepted Burgher Petition: Burgher loyalty jumped +10%, but Crown Control in Calais dropped -15%!');
      updateHUD();
    });

    document.getElementById('btn-modal-decline').addEventListener('click', () => {
      petitionModal.style.display = 'none';
      petitionAlert.style.display = 'none';
      const badge = document.getElementById('alert-count-badge');
      if (badge) badge.textContent = '0';

      state.estates[2].loyalty -= 15.0;
      showToast('Suppressed Burgher Petition: Burgher estate loyalty dropped by -15.0%!');
      updateHUD();
    });
  }

  // Toggle Blockade Button
  document.getElementById('btn-toggle-blockade').addEventListener('click', () => {
    state.channelBlockaded = !state.channelBlockaded;
    const btn = document.getElementById('btn-toggle-blockade');

    if (state.channelBlockaded) {
      btn.textContent = '⚓ Lift Channel Blockade';
      btn.style.color = '#34d399';
      showToast('⚠️ English Channel blockaded! Trade line dashed red. Bastion input costs skyrocketed!');
    } else {
      btn.textContent = '⚓ Toggle Channel Blockade';
      btn.style.color = '#f87171';
      showToast('Maritime trade restored across the Channel.');
    }
    recalculateControl();
    renderMapModes();
    updateHUD();
  });

  // Toggle Bosphorus Strait Blockade Button
  const straitBlockadeBtn = document.getElementById('btn-toggle-strait-blockade');
  if (straitBlockadeBtn) {
    straitBlockadeBtn.addEventListener('click', () => {
      state.straitBlockaded = !state.straitBlockaded;
      if (state.straitBlockaded) {
        straitBlockadeBtn.textContent = '⛔ Lift Bosphorus Blockade';
        straitBlockadeBtn.style.color = '#ff1744';
        showToast('⚠️ Bosphorus & Dardanelles Straits blockaded! Maritime edge turned flashing red.');
      } else {
        straitBlockadeBtn.textContent = '🌊 Blockade Bosphorus';
        straitBlockadeBtn.style.color = '#00e5ff';
        showToast('Bosphorus strait reopened: Maritime transit restored.');
      }
      renderMapModes();
      updateHUD();
    });
  }

  // Toggle Plague Button
  document.getElementById('btn-toggle-plague').addEventListener('click', () => {
    const loc = state.locations.find(l => l.id === state.selectedLocationId);
    if (!loc) return;
    loc.plague_infected = !loc.plague_infected;
    showToast(loc.plague_infected 
      ? `☣️ Black Death plague broke out in ${loc.name}! High mortality imminent.` 
      : `Plague eradicated in ${loc.name}.`);
    updateHUD();
  });

  // Mobilize Levies Button
  document.getElementById('btn-raise-levies').addEventListener('click', () => {
    const loc = state.locations.find(l => l.id === state.selectedLocationId);
    if (!loc) return;
    const nobilityPop = loc.pops.find(p => p.estate === 'Nobility');
    if (nobilityPop && nobilityPop.size > 100) {
      const knights = Math.floor(nobilityPop.size * 0.05);
      nobilityPop.size -= knights;
      showToast(`🚩 Mobilized ${knights} Heavy Cavalry knights from nobility in ${loc.name}! (Deducted from civilian pop pool).`);
    } else {
      showToast(`Insufficient nobility in ${loc.name} to mobilize heavy cavalry.`);
    }
    updateHUD();
  });

  // =========================================================================
  // MODULAR FRONTEND UI ECOSYSTEM (CLAUSEWITZ / JOMINI STANDARD)
  // =========================================================================
  let activeModularWindow = null;
  let activeWindowTab = 'overview';

  function openModularWindow(type, tab = 'overview') {
    activeModularWindow = type;
    activeWindowTab = tab;
    const modalBackdrop = document.getElementById('gsg-floating-modal');
    if (modalBackdrop) modalBackdrop.style.display = 'flex';
    renderActiveModularWindow();
  }

  function closeModularWindow() {
    activeModularWindow = null;
    const modalBackdrop = document.getElementById('gsg-floating-modal');
    if (modalBackdrop) modalBackdrop.style.display = 'none';
    document.querySelectorAll('.nav-dock-btn').forEach(b => b.classList.remove('active'));
  }

  window.openModularWindow = openModularWindow;
  window.closeModularWindow = closeModularWindow;

  const modalCloseBtn = document.getElementById('btn-floating-window-close');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModularWindow);
  }
  const modalBackdropEl = document.getElementById('gsg-floating-modal');
  if (modalBackdropEl) {
    modalBackdropEl.addEventListener('click', (e) => {
      if (e.target === modalBackdropEl) closeModularWindow();
    });
  }

  function renderActiveModularWindow() {
    if (!activeModularWindow) return;

    const modalBackdrop = document.getElementById('gsg-floating-modal');
    const modalTitle = document.getElementById('floating-window-title');
    const modalIcon = document.getElementById('floating-window-icon');
    const modalBody = document.getElementById('floating-window-body');

    if (!modalBackdrop || !modalTitle || !modalIcon || !modalBody) return;
    modalBackdrop.style.display = 'flex';

    // Highlight dock button
    document.querySelectorAll('.nav-dock-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-dock-${activeModularWindow === 'demographics' ? 'demo' : activeModularWindow}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (activeModularWindow === 'government') {
      modalTitle.textContent = 'Royal Government & Privy Council';
      modalIcon.textContent = '👑';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn ${activeWindowTab === 'overview' ? 'active' : ''}" data-tab="overview">Monarch & Succession</button>
          <button class="win-tab-btn ${activeWindowTab === 'cabinet' ? 'active' : ''}" data-tab="cabinet">Privy Council (4 Seats)</button>
        </div>
        <div class="window-body-scroll">
          ${activeWindowTab === 'cabinet' ? `
            <div class="cabinet-grid">
              <div class="cabinet-slot-card">
                <div class="cabinet-slot-header">
                  <div class="cabinet-avatar">📜</div>
                  <div>
                    <div class="cabinet-title">Lord High Chancellor</div>
                    <div class="cabinet-name">William of Wykeham</div>
                  </div>
                  <div class="cabinet-attr-pill">Stewardship: <strong>74</strong></div>
                </div>
                <div class="cabinet-action-box">
                  <span class="action-label">Active Mandate: <strong>Centralize Home Counties</strong></span>
                  <p style="margin: 4px 0; color: var(--text-muted);">+0.15% monthly Crown Control across London and Dover trade corridor.</p>
                  <div class="action-progress-bar"><div class="action-progress-fill" style="width: 62%;"></div></div>
                  <small>Progress: 62.4% • ETA: 8 months</small>
                </div>
              </div>

              <div class="cabinet-slot-card">
                <div class="cabinet-slot-header">
                  <div class="cabinet-avatar">⚔️</div>
                  <div>
                    <div class="cabinet-title">Grand Marshal</div>
                    <div class="cabinet-name">Duke of Lancaster</div>
                  </div>
                  <div class="cabinet-attr-pill">Martial: <strong>88</strong></div>
                </div>
                <div class="cabinet-action-box">
                  <span class="action-label">Active Mandate: <strong>Drill Continental Levies</strong></span>
                  <p style="margin: 4px 0; color: var(--text-muted);">+10% army reinforcement recovery rate and +5.0 morale cap.</p>
                  <div class="action-progress-bar"><div class="action-progress-fill" style="width: 45%;"></div></div>
                  <small>Progress: 45.0% • ETA: 11 months</small>
                </div>
              </div>

              <div class="cabinet-slot-card">
                <div class="cabinet-slot-header">
                  <div class="cabinet-avatar">🪙</div>
                  <div>
                    <div class="cabinet-title">High Treasurer</div>
                    <div class="cabinet-name">Walter de Merton</div>
                  </div>
                  <div class="cabinet-attr-pill">Stewardship: <strong>81</strong></div>
                </div>
                <div class="cabinet-action-box">
                  <span class="action-label">Active Mandate: <strong>Audit Wool Customs</strong></span>
                  <p style="margin: 4px 0; color: var(--text-muted);">+8.5 Ducats monthly tariff extraction from Calais trade routes.</p>
                  <div class="action-progress-bar"><div class="action-progress-fill" style="width: 80%;"></div></div>
                  <small>Progress: 80.2% • ETA: 4 months</small>
                </div>
              </div>

              <div class="cabinet-slot-card">
                <div class="cabinet-slot-header">
                  <div class="cabinet-avatar">🗡️</div>
                  <div>
                    <div class="cabinet-title">Lord Privy Seal</div>
                    <div class="cabinet-name">John de Thoresby</div>
                  </div>
                  <div class="cabinet-attr-pill">Intrigue: <strong>70</strong></div>
                </div>
                <div class="cabinet-action-box">
                  <span class="action-label">Active Mandate: <strong>Fabricate Diplomatic Claims</strong></span>
                  <p style="margin: 4px 0; color: var(--text-muted);">Infiltrating Valois admiralty in Normandy coastal baronies.</p>
                  <div class="action-progress-bar"><div class="action-progress-fill" style="width: 28%;"></div></div>
                  <small>Progress: 28.5% • ETA: 16 months</small>
                </div>
              </div>
            </div>
          ` : `
            <div style="background: var(--bg-tertiary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
              <h3 style="color: #ffd700; margin-bottom: 6px;">👑 Monarch: ${state.ruler.firstName} ${state.ruler.dynasty}</h3>
              <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 12px;">Sovereign King of England, Lord of Ireland, and claimant to the Throne of France.</p>
              <div style="display: flex; gap: 10px; font-size: 12px; margin-bottom: 14px;">
                <span class="stat-pill">Martial: <strong>85</strong></span>
                <span class="stat-pill">Diplo: <strong>79</strong></span>
                <span class="stat-pill">Steward: <strong>65</strong></span>
                <span class="stat-pill">Learn: <strong>50</strong></span>
                <span class="stat-pill">Intrigue: <strong>68</strong></span>
              </div>
              <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
                <h4 style="font-size: 12px; color: #fbbf24; text-transform: uppercase;">Dynastic Succession Matrix</h4>
                <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                  <span style="font-size: 20px;">🗡️</span>
                  <div>
                    <strong>${state.heir.firstName}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">Age: ${state.heir.age} • Claim: Strong (100) • Succession Rank: Primogeniture Line 1</div>
                  </div>
                </div>
              </div>
            </div>
          `}
        </div>
      `;
    } else if (activeModularWindow === 'estates') {
      modalTitle.textContent = 'Estates of the Realm & Parliament Floor';
      modalIcon.textContent = '⚖️';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn ${activeWindowTab === 'overview' ? 'active' : ''}" data-tab="overview">Estates Leverage HUD</button>
          <button class="win-tab-btn ${activeWindowTab === 'parliament' ? 'active' : ''}" data-tab="parliament">Parliament Floor & Laws</button>
        </div>
        <div class="window-body-scroll">
          ${activeWindowTab === 'parliament' ? `
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 6px; border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="color: #ffd700; font-size: 14px;">📜 Statute of Continental War Subsidies (1350)</h3>
                <span class="charter-status-tag active">Pending Vote</span>
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
                Special wartime parliamentary grant levying extraordinary taxes on wool exports to sustain continental garrisons.
              </p>
              <div style="height: 14px; background: #1e293b; border-radius: 7px; overflow: hidden; display: flex; margin-bottom: 14px;">
                <div style="width: 58%; background: #10b981; color: #000; font-size: 10px; font-weight: bold; text-align: center; line-height: 14px;">Ayes: 58%</div>
                <div style="width: 42%; background: #ef4444; color: #fff; font-size: 10px; font-weight: bold; text-align: center; line-height: 14px;">Noes: 42%</div>
              </div>
              <button class="action-btn" id="btn-win-vote-bill" style="background: var(--accent-gold); color: #000; font-weight: bold; width: 100%; justify-content: center;">
                ⚖️ Pass Statute Through Both Chambers
              </button>
            </div>
          ` : `
            <div class="estates-hud-grid">
              ${state.estates.map(e => `
                <div class="estate-hud-card">
                  <div class="estate-card-head">
                    <span class="estate-badge-icon">${e.type === 'Nobility' ? '🛡️' : e.type === 'Clergy' ? '⛪' : '🐑'}</span>
                    <div>
                      <strong>${e.type}</strong>
                      <div style="font-size: 10px; color: var(--text-muted);">Estate Social Strata</div>
                    </div>
                    <span class="estate-wealth-tag">${e.wealth.toFixed(1)} D</span>
                  </div>
                  <div class="estate-bars-container">
                    <div class="metric-meter">
                      <div class="meter-label"><span>Power</span><strong>${e.power.toFixed(1)}%</strong></div>
                      <div class="meter-track"><div class="meter-bar power" style="width: ${e.power}%;"></div></div>
                    </div>
                    <div class="metric-meter">
                      <div class="meter-label"><span>Loyalty</span><strong style="color: ${e.loyalty >= 50 ? '#34d399' : '#f87171'};">${e.loyalty.toFixed(1)}%</strong></div>
                      <div class="meter-track"><div class="meter-bar" style="width: ${e.loyalty}%; background: ${e.loyalty >= 50 ? '#10b981' : '#ef4444'};"></div></div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } else if (activeModularWindow === 'demographics') {
      modalTitle.textContent = 'Demographics & Granular Pop Strata';
      modalIcon.textContent = '👥';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn active">Pop Census & Militancy Ledger</button>
        </div>
        <div class="window-body-scroll">
          <div class="demo-summary-deck">
            <div class="demo-metric-badge">
              <span class="badge-title">Total Realm Census</span>
              <span class="badge-val">${state.locations.reduce((acc, l) => acc + l.pops.reduce((s, p) => s + p.size, 0), 0).toLocaleString()}</span>
            </div>
            <div class="demo-metric-badge">
              <span class="badge-title">Locations Surveyed</span>
              <span class="badge-val">${state.locations.length} Metropolitan Hubs</span>
            </div>
            <div class="demo-metric-badge">
              <span class="badge-title">Mean Realm Devastation</span>
              <span class="badge-val" style="color: #34d399;">6.0%</span>
            </div>
          </div>

          <div class="pop-ledger-container">
            <div class="pop-ledger-header">
              <span>Location</span>
              <span>Class & Culture</span>
              <span>Headcount</span>
              <span>Basic & Lux Needs</span>
              <span>Wealth</span>
              <span>Unrest</span>
            </div>
            <div class="pop-virtual-scroll-area">
              ${state.locations.flatMap(loc => loc.pops.map(p => `
                <div class="pop-ledger-row">
                  <div><strong>${loc.name}</strong></div>
                  <div><span class="pop-class-pill ${p.estate.toLowerCase()}">${p.estate}</span> <small>${p.subCulture}</small></div>
                  <div>${p.size.toLocaleString()}</div>
                  <div>
                    <div class="need-slider"><div class="need-fill" style="width: 88%; background: #10b981;"></div></div>
                    <div class="need-slider"><div class="need-fill" style="width: 55%; background: #60a5fa;"></div></div>
                  </div>
                  <div>${p.wealth.toFixed(1)} D</div>
                  <div style="color: ${p.unrest > 0.1 ? '#f87171' : '#34d399'}; font-weight: bold;">
                    ${(p.unrest * 100).toFixed(1)}%
                  </div>
                </div>
              `)).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (activeModularWindow === 'economy') {
      modalTitle.textContent = 'Crown Exchequer, Budget & Construction Matrix';
      modalIcon.textContent = '🪙';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn ${activeWindowTab === 'overview' ? 'active' : ''}" data-tab="overview">National Budget Balance Sheet</button>
          <button class="win-tab-btn ${activeWindowTab === 'construction' ? 'active' : ''}" data-tab="construction">Construction Matrix</button>
        </div>
        <div class="window-body-scroll">
          <div class="budget-summary-banner">
            <div>
              <span style="font-size: 11px; color: var(--text-muted);">Monthly Tax Income</span>
              <div style="font-size: 18px; font-weight: bold; color: #34d399;">+${state.monthlyTaxIncome.toFixed(1)} D</div>
            </div>
            <div style="text-align: center;">
              <span style="font-size: 11px; color: var(--text-muted);">Net Monthly Balance</span>
              <div style="font-size: 20px; font-weight: bold; color: #34d399;">+${(state.monthlyTaxIncome - state.monthlyMaintenance).toFixed(1)} D</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: var(--text-muted);">Standing Maintenance</span>
              <div style="font-size: 18px; font-weight: bold; color: #f87171;">-${state.monthlyMaintenance.toFixed(1)} D</div>
            </div>
          </div>

          <div class="split-ledger-grid">
            <div class="ledger-box">
              <h4 style="color: #34d399; margin-bottom: 8px;">🟢 Revenue Streams</h4>
              <div class="ledger-row"><span>Direct Pop Taxation</span><strong class="pos">+${(state.monthlyTaxIncome * 0.7).toFixed(1)} D</strong></div>
              <div class="ledger-row"><span>Production & Workshops</span><strong class="pos">+${(state.monthlyTaxIncome * 0.2).toFixed(1)} D</strong></div>
              <div class="ledger-row"><span>Maritime Trade Tariffs</span><strong class="pos">+${(state.monthlyTaxIncome * 0.1).toFixed(1)} D</strong></div>
            </div>
            <div class="ledger-box">
              <h4 style="color: #f87171; margin-bottom: 8px;">🔴 Outlay Streams</h4>
              <div class="ledger-row"><span>Standing Royal Vanguard</span><strong class="neg">-58.0 D</strong></div>
              <div class="ledger-row"><span>Channel Battle Fleet</span><strong class="neg">-32.0 D</strong></div>
              <div class="ledger-row"><span>Fort Garrisons & Upkeep</span><strong class="neg">-30.0 D</strong></div>
            </div>
          </div>
        </div>
      `;
    } else if (activeModularWindow === 'trade') {
      modalTitle.textContent = 'Market Center & Trade Flow Graph';
      modalIcon.textContent = '📦';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn active">London Channel Entrepôt</button>
        </div>
        <div class="window-body-scroll">
          <div class="hub-metric-deck">
            <div class="hub-metric-card">
              <span style="font-size: 10px; color: var(--text-muted);">Market Trade Volume</span>
              <strong style="font-size: 16px;">1,845.0 Ducats</strong>
            </div>
            <div class="hub-metric-card">
              <span style="font-size: 10px; color: var(--text-muted);">Domestic Merchant Share</span>
              <strong style="font-size: 16px; color: #34d399;">74.5%</strong>
            </div>
            <div class="hub-metric-card">
              <span style="font-size: 10px; color: var(--text-muted);">Channel Blockade Interdiction</span>
              <strong style="font-size: 16px; color: ${state.channelBlockaded ? '#ef4444' : '#34d399'};">
                ${state.channelBlockaded ? '85.0% (SEVERED)' : '0.0% (CLEAR)'}
              </strong>
            </div>
          </div>

          <div class="trade-goods-table-container">
            <div class="trade-grid-header">
              <span>Commodity</span>
              <span>Supply</span>
              <span>Demand</span>
              <span>Clearing Price</span>
              <span>Balance</span>
            </div>
            <div class="trade-virtual-scroll">
              ${Object.entries(state.market.goods).map(([key, g]) => `
                <div class="trade-grid-row">
                  <div><strong>${key.toUpperCase()}</strong></div>
                  <div>${g.supply} units</div>
                  <div>${g.demand} units</div>
                  <div><strong>${g.price.toFixed(2)} D</strong></div>
                  <div>
                    <span class="${g.supply >= g.demand ? 'surplus-badge' : 'deficit-badge'}">
                      ${g.supply >= g.demand ? `Surplus (+${g.supply - g.demand})` : `Deficit (-${g.demand - g.supply})`}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (activeModularWindow === 'diplomacy') {
      modalTitle.textContent = 'Chancery of Foreign Affairs & Peace Negotiations';
      modalIcon.textContent = '🕊️';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn active">Two-Sided Peace Deal Barter Matrix</button>
        </div>
        <div class="window-body-scroll">
          <div class="target-nation-banner" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-tertiary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">⚜️</span>
              <div>
                <strong>Kingdom of France (House Valois)</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Belligerent in Hundred Years War • War Score: +42%</div>
              </div>
            </div>
            <span class="war-score-pill pos" style="font-weight: bold; color: #34d399; font-size: 14px;">+42% War Score</span>
          </div>

          <div class="peace-two-columns">
            <div class="peace-col">
              <h4>⚔️ English Demands (Attacker)</h4>
              <div class="peace-item-row selected">
                <span>✓ Cede Sovereignty of Calais & Pale</span>
                <span class="peace-cost-badge">18% WS</span>
              </div>
              <div class="peace-item-row selected">
                <span>✓ War Reparations (10% Income)</span>
                <span class="peace-cost-badge">12% WS</span>
              </div>
              <div class="peace-item-row">
                <span>☐ Cede Duchy of Normandy (Rouen)</span>
                <span class="peace-cost-badge">26% WS</span>
              </div>
            </div>
            <div class="peace-col">
              <h4>🛡️ French Concessions & Offers</h4>
              <div class="peace-item-row selected">
                <span>✓ Disband Norman Channel Privateers</span>
                <span class="peace-cost-badge">+8% WS</span>
              </div>
              <div class="peace-item-row">
                <span>☐ 150 Ducats Lump Indemnity</span>
                <span class="peace-cost-badge">+10% WS</span>
              </div>
            </div>
          </div>

          <div class="peace-evaluation-footer">
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
              <span>Total Demands: <strong>30% War Score</strong> (Available: 42%)</span>
              <strong style="color: #34d399;">AI Peace Desirability: +35 (WILL ACCEPT)</strong>
            </div>
            <button class="action-btn" id="btn-ratify-peace" style="background: var(--accent-gold); color: #000; font-weight: bold; width: 100%; justify-content: center;">
              🕊️ Ratify Treaty & Dispatch Royal Emissary
            </button>
          </div>
        </div>
      `;
    } else if (activeModularWindow === 'military') {
      modalTitle.textContent = 'Grand Army Headquarters & Tactical Combat Grid';
      modalIcon.textContent = '⚔️';
      modalBody.innerHTML = `
        <div class="window-tab-bar">
          <button class="win-tab-btn active">Tactical Combat Grid (Active Battle Array)</button>
        </div>
        <div class="window-body-scroll">
          <div class="combat-grid-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <strong>Royal Vanguard (8,500 Men)</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Commander: King Edward III (Valiant Warrior • 1.15x Shock)</div>
              </div>
              <span class="charter-status-tag active">✓ Supply Line Clear</span>
            </div>

            <div class="grid-tactical-tier">
              <span class="tier-label">Front Row & Flanks:</span>
              <div class="grid-cards-row">
                <div class="combat-grid-card flank">
                  <div style="display: flex; justify-content: space-between;"><strong>🐎 Heavy Cav</strong><small>Left Flank</small></div>
                  <div class="unit-strength-bar"><div class="strength-fill" style="width: 95%;"></div></div>
                  <div class="unit-combat-vectors"><span class="dmg-dealt">⚔️ +85</span><span class="dmg-taken">🩸 -15</span></div>
                </div>
                <div class="combat-grid-card front">
                  <div style="display: flex; justify-content: space-between;"><strong>🛡️ Men-at-Arms</strong><small>Front</small></div>
                  <div class="unit-strength-bar"><div class="strength-fill" style="width: 90%;"></div></div>
                  <div class="unit-combat-vectors"><span class="dmg-dealt">⚔️ +52</span><span class="dmg-taken">🩸 -38</span></div>
                </div>
                <div class="combat-grid-card flank">
                  <div style="display: flex; justify-content: space-between;"><strong>🐎 Heavy Cav</strong><small>Right Flank</small></div>
                  <div class="unit-strength-bar"><div class="strength-fill" style="width: 100%;"></div></div>
                  <div class="unit-combat-vectors"><span class="dmg-dealt">⚔️ +92</span><span class="dmg-taken">🩸 -12</span></div>
                </div>
              </div>
            </div>

            <div class="grid-tactical-tier">
              <span class="tier-label">Back Row & Ranged Fire:</span>
              <div class="grid-cards-row">
                <div class="combat-grid-card back">
                  <div style="display: flex; justify-content: space-between;"><strong>🏹 Longbowmen</strong><small>Center</small></div>
                  <div class="unit-strength-bar"><div class="strength-fill" style="width: 100%;"></div></div>
                  <div class="unit-combat-vectors"><span class="dmg-dealt">⚔️ +65</span><span class="dmg-taken">🩸 0</span></div>
                </div>
                <div class="combat-grid-card back">
                  <div style="display: flex; justify-content: space-between;"><strong>💣 Bombard</strong><small>Siege Train</small></div>
                  <div class="unit-strength-bar"><div class="strength-fill" style="width: 100%;"></div></div>
                  <div class="unit-combat-vectors"><span class="dmg-dealt">⚔️ +110</span><span class="dmg-taken">🩸 0</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Attach internal tab listeners
    modalBody.querySelectorAll('.win-tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        activeWindowTab = tabBtn.dataset.tab;
        renderActiveModularWindow();
      });
    });

    // Special action listeners
    const voteBtn = document.getElementById('btn-win-vote-bill');
    if (voteBtn) {
      voteBtn.addEventListener('click', () => {
        showToast('⚖️ Statute of Continental War Subsidies PASSED! +20 Ducats monthly treasury bonus unlocked.');
        closeModularWindow();
      });
    }

    const peaceBtn = document.getElementById('btn-ratify-peace');
    if (peaceBtn) {
      peaceBtn.addEventListener('click', () => {
        showToast('🕊️ Treaty of Calais Ratified! French Crown ceded sovereignty of Calais Pale and committed 10% war indemnities.');
        closeModularWindow();
      });
    }
  }

  // Bind Dock Buttons Safely
  const dockMap = [
    ['btn-dock-gov', 'government'],
    ['btn-dock-estates', 'estates'],
    ['btn-dock-demo', 'demographics'],
    ['btn-dock-economy', 'economy'],
    ['btn-dock-trade', 'trade'],
    ['btn-dock-diplo', 'diplomacy'],
    ['btn-dock-military', 'military']
  ];

  dockMap.forEach(([btnId, winType]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModularWindow(winType);
      });
    }
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
      closeModularWindow();
    } else if (e.key === 'g' || e.key === 'G') {
      openModularWindow('government');
    } else if (e.key === 'e' || e.key === 'E') {
      openModularWindow('estates');
    } else if (e.key === 'p' || e.key === 'P') {
      openModularWindow('demographics');
    } else if (e.key === 'b' || e.key === 'B') {
      openModularWindow('economy');
    } else if (e.key === 't' || e.key === 'T') {
      openModularWindow('trade');
    } else if (e.key === 'd' || e.key === 'D') {
      openModularWindow('diplomacy');
    } else if (e.key === 'm' || e.key === 'M') {
      openModularWindow('military');
    }
  });
});

