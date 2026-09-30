/**
 * Interactive Web Application Frontend for Grand Strategy Simulation Engine
 * Project Caesar UI & Systems Pipeline Standard
 */

// RELATIONAL SIMULATION STATE
const state = {
  calendar: { year: 1350, month: 4, day: 7 },
  isRunning: false,
  timer: null,
  speedMs: 1000,
  activeMapMode: 'political',
  selectedLocationId: 1,
  channelBlockaded: false,
  
  // HUD Telemetry
  crownTreasury: 3880.0,
  monthlyTaxIncome: 580.0,
  monthlyMaintenance: 120.0,
  manpower: 29500,
  maxManpower: 35000,
  crownPower: 0.65,
  nationalTaxEfficiency: 1.0,
  activeAge: 'Age of Renaissance',

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
      { id: 'gout_afflicted', name: 'Gout Afflicted', healthPenalty: 1.8 }
    ],
    isMarried: false,
    spouseName: null,
    isGeneral: false,
    isCabinetAdvisor: false
  },

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
      { id: 'royal_vanguard', name: 'Royal Vanguard', size: 8500, commander: 'King Edward III', location: 'Calais', morale: 95.0 },
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
      plague_infected: false,
      pops: [
        { estate: 'Nobility', subCulture: 'Francien', size: 6000, wealth: 850.0, unrest: 0.10 },
        { estate: 'Burghers', subCulture: 'Francien', size: 11000, wealth: 260.0, unrest: 0.12 },
        { estate: 'Commoners', subCulture: 'Francien', size: 35000, wealth: 22.0, unrest: 0.20 }
      ],
      buildings: ['Cathedral of Notre-Dame', 'Textile Manufactory']
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

// CONTROL RECALCULATION WITH EXPONENTIAL PATHFINDING
function recalculateControl() {
  for (const loc of state.locations) {
    if (loc.id === 1) { loc.control = 1.0; continue; }
    let dist = 15.0;
    if (loc.id === 2) dist = 12.0;
    if (loc.id === 3) dist = state.channelBlockaded ? 120.0 : 14.0;
    if (loc.id === 4) dist = state.channelBlockaded ? 140.0 : 35.0;
    if (loc.id === 5) dist = state.channelBlockaded ? 180.0 : 55.0;

    const devastationFactor = 1.0 + Math.pow(loc.devastation, 1.5) * 3.0;
    // Base formula: Control = 1.0 * e^(-0.018 * Distance * Devastation)
    loc.control = Math.max(0.01, Math.min(1.0, Math.exp(-0.018 * dist * devastationFactor)));
  }
}

// O(1) MEMORY LOOKUP & FOOTER TEXT REFRESH
function refreshLocationFooter(locationId) {
  const loc = state.locations.find(l => l.id === locationId);
  if (!loc) return;

  const totalPop = loc.pops.reduce((sum, p) => sum + p.size, 0);
  const nameEl = document.getElementById('selected-loc-name');
  const statsEl = document.getElementById('selected-loc-stats');

  if (nameEl) nameEl.textContent = `${loc.name} (${loc.terrain})`;
  if (statsEl) {
    statsEl.textContent = `Control: ${(loc.control * 100).toFixed(1)}% • Devastation: ${(loc.devastation * 100).toFixed(1)}% • Pops: ${totalPop.toLocaleString()}`;
  }
}

// MAP MODE STYLER WITH REAL-TIME COLOR INTERPOLATION
function renderMapModes() {
  for (const loc of state.locations) {
    const nodeEl = document.querySelector(`.location-node[data-id="${loc.id}"] circle.loc-core`);
    if (!nodeEl) continue;

    if (state.activeMapMode === 'political') {
      // Sovereign colors
      nodeEl.setAttribute('fill', loc.country === 'ENG' ? '#b91c1c' : '#1d4ed8');
      nodeEl.setAttribute('stroke', loc.id === 1 ? '#ffd700' : '#ffffff');
    } else if (state.activeMapMode === 'control') {
      // Dynamic spectrum: 100% control = gold/white (#ffd700), reduced = striped/reddish
      if (loc.control >= 0.95) {
        nodeEl.setAttribute('fill', '#ffd700');
        nodeEl.setAttribute('stroke', '#ffffff');
      } else if (loc.control >= 0.70) {
        nodeEl.setAttribute('fill', '#f59e0b');
        nodeEl.setAttribute('stroke', '#b45309');
      } else {
        nodeEl.setAttribute('fill', '#b91c1c');
        nodeEl.setAttribute('stroke', '#fca5a5');
      }
    } else if (state.activeMapMode === 'trade') {
      // Flow lines
      nodeEl.setAttribute('fill', loc.id === 1 || loc.id === 3 ? '#f59e0b' : '#334155');
      nodeEl.setAttribute('stroke', state.channelBlockaded ? '#ef4444' : '#ffd700');
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
  if (seaLine && dcLine) {
    if (state.channelBlockaded) {
      seaLine.classList.add('blockaded');
      dcLine.classList.add('blockaded');
    } else {
      seaLine.classList.remove('blockaded');
      dcLine.classList.remove('blockaded');
    }
  }
}

// UPDATE TOPBAR HUD
function updateHUD() {
  const netMonthly = state.monthlyTaxIncome - state.monthlyMaintenance;
  document.getElementById('hud-treasury').textContent = state.crownTreasury.toFixed(1);
  const deltaEl = document.getElementById('hud-treasury-delta');
  deltaEl.textContent = `(${netMonthly >= 0 ? '+' : ''}${netMonthly.toFixed(1)})`;
  deltaEl.className = netMonthly >= 0 ? 'delta pos' : 'delta neg';

  document.getElementById('hud-manpower').textContent = state.manpower.toLocaleString();
  document.getElementById('hud-crown-power').textContent = `${(state.crownPower * 100).toFixed(1)}%`;
  document.getElementById('date-display').textContent = 
    `${state.calendar.year}-${String(state.calendar.month).padStart(2, '0')}-${String(state.calendar.day).padStart(2, '0')}`;

  // Outliner Updates
  document.getElementById('task-normandy-val').textContent = `${state.outliner.normandyIntegration.toFixed(1)}%`;
  document.getElementById('task-normandy-bar').style.width = `${state.outliner.normandyIntegration}%`;

  // Outliner Estates
  document.getElementById('out-nobility-loyalty').textContent = `Loyalty: ${state.estates[0].loyalty.toFixed(1)}%`;
  document.getElementById('out-nobility-wealth').textContent = `Wealth: ${state.estates[0].wealth.toFixed(1)} D • Power: ${state.estates[0].power.toFixed(1)}%`;

  // Refresh Footer
  refreshLocationFooter(state.selectedLocationId);
  renderMapModes();
}

// SIMULATION TICK CASCADE: DAILY TICK
function executeDayTick() {
  state.calendar.day++;

  // Daily supply line check & health wear
  if (state.ruler.isAlive && Math.random() < 0.005) {
    // Gout check pass
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

  // 2. Fractional Outliner Task Additions
  state.outliner.normandyIntegration = Math.min(100.0, state.outliner.normandyIntegration + (0.35 * speedMultiplier));
  state.outliner.calaisBastion = Math.min(100.0, state.outliner.calaisBastion + (1.20 * speedMultiplier));

  // 3. Tax revenue collection and estate wealth skimming
  let crownTaxSum = 0;
  let nobilitySkimSum = 0;
  let burgherSkimSum = 0;

  for (const loc of state.locations) {
    const potentialTax = loc.tax_base * 0.15 * state.nationalTaxEfficiency;
    const collected = potentialTax * loc.control;
    const skimmed = potentialTax * (1.0 - loc.control);

    crownTaxSum += collected;
    nobilitySkimSum += skimmed * 0.70;
    burgherSkimSum += skimmed * 0.30;

    // Blockade penalty: if Dover or Calais is cut, -50% burgher wealth generation
    if (state.channelBlockaded && (loc.id === 2 || loc.id === 3)) {
      burgherSkimSum *= 0.50;
    }
  }

  state.crownTreasury += crownTaxSum;
  state.estates[0].wealth += nobilitySkimSum;
  state.estates[2].wealth += burgherSkimSum;

  // 4. Manpower Monthly Conscription (+350/mo)
  state.manpower = Math.min(state.maxManpower, state.manpower + 350);

  // 5. Value Chain & Price Updates (Bastion of Calais Supply Lookup)
  if (state.channelBlockaded) {
    // Path to London is severed! Timber and stone input prices scale exponentially:
    // Price = Base * (Demand / Supply)^Elasticity
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
    const goutPenalty = 1.8;
    state.ruler.health -= goutPenalty * 5.0;

    if (state.ruler.health <= 0 || Math.random() < 0.08) {
      // King Edward III dies of gout!
      state.ruler.isAlive = false;
      // Elevate Black Prince
      state.ruler.firstName = state.heir.firstName;
      state.ruler.age = state.heir.age;
      state.ruler.attributes.martial = state.heir.martial;
      state.ruler.attributes.diplomacy = state.heir.diplomacy;
      state.ruler.attributes.stewardship = state.heir.stewardship;
      state.ruler.health = 90.0;
      state.ruler.isAlive = true;

      // Update UI Ruler display
      document.getElementById('ruler-name').textContent = `King Edward IV (The Black Prince)`;
      document.getElementById('attr-martial').textContent = '95';
      document.getElementById('attr-steward').textContent = '60';

      showToast('👑 KING EDWARD III HAS DIED! Edward of Woodstock (Black Prince) ascends the English Throne!');
    }
  }
}

// EVENT LISTENERS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  recalculateControl();
  updateHUD();

  // Play / Pause
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

  document.getElementById('btn-step-day').addEventListener('click', executeDayTick);
  document.getElementById('btn-step-month').addEventListener('click', () => {
    for (let i = 0; i < 30; i++) executeDayTick();
  });

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
      state.outliner.alerts = state.outliner.alerts.filter(a => a.id !== 'flanders');
      document.getElementById('alert-item-1').style.display = 'none';
      document.getElementById('alert-count-badge').textContent = '1';
      showToast('💍 Royal Marriage validated with Duchess Margaret of Flanders! Personal Union claim active.');
    } else {
      showToast('The sovereign is already married to ' + state.ruler.spouseName);
    }
  });

  // Sol Panel: Appoint as Field General (Hooks into Royal Vanguard)
  document.getElementById('btn-court-general').addEventListener('click', () => {
    state.ruler.isGeneral = true;
    const armyRow = document.getElementById('outliner-army-1');
    if (armyRow) {
      armyRow.innerHTML = `
        <div class="outliner-row-main">
          <strong>Royal Vanguard</strong>
          <span style="color: #fbbf24;">8,500 Men (+15% Shock)</span>
        </div>
        <span style="font-size: 10px; color: #34d399;">Commander: King Edward III (Valiant Warrior) • Calais</span>
      `;
    }
    showToast('⚔️ King Edward III unassigned from court and bound as primary general to Royal Vanguard (+15% Shock Damage)!');
  });

  // Sol Panel: Appoint Cabinet Advisor
  document.getElementById('btn-court-advisor').addEventListener('click', () => {
    state.ruler.isCabinetAdvisor = true;
    state.monthlyTaxIncome += 20.0;
    showToast('📜 Lord High Chancellor appointed! Monthly tax extraction expanded.');
    updateHUD();
  });

  // Sol Panel: Commission Atlantic Explorer
  document.getElementById('btn-court-explorer').addEventListener('click', () => {
    showToast('🧭 Atlantic Expedition chartered under Renaissance patronage! Exploration fleet dispatched.');
  });

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
      document.getElementById('alert-count-badge').textContent = '0';

      // Accept: +10% Burgher Loyalty, +25.0 Ducats, -15% Calais Crown Control
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
      document.getElementById('alert-count-badge').textContent = '0';

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
    updateHUD();
  });

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
});
