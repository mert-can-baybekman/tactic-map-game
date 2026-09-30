/**
 * Interactive Web Application Frontend for Grand Strategy Simulation Engine
 * Project Caesar UI & Systems Pipeline Standard
 */

// SIMULATION & COURT STATE
const state = {
  calendar: { year: 1350, month: 1, day: 1 },
  isRunning: false,
  timer: null,
  speedMs: 1000,
  activeMapMode: 'political',
  selectedLocationId: 1,
  channelBlockaded: false,
  
  // HUD Telemetry
  crownTreasury: 2500.0,
  monthlyTaxIncome: 145.0,
  monthlyMaintenance: 85.0,
  manpower: 28450,
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
    culture: 'Anglo-Norman (English Gothic)',
    religion: 'Catholic',
    attributes: { martial: 85, diplomacy: 70, stewardship: 65, learning: 50, intrigue: 60 },
    traits: ['Valiant Warrior', 'Feudal Sovereign', 'Gout Afflicted'],
    isMarried: false,
    spouseName: null,
    isGeneral: false,
    isCabinetAdvisor: false
  },

  heir: {
    id: 2,
    firstName: 'Edward of Woodstock (Black Prince)',
    age: 20,
    martial: 95,
    claim: 100
  },

  // Outliner State
  outliner: {
    normandyIntegration: 42.5,
    alerts: [
      { id: 'flanders', title: 'Disputed Heir in Flanders', desc: 'Duchess Margaret is unmarried. Royal marriage gives Personal Union claim.' },
      { id: 'burghers', title: 'Burgher Guild Petition', desc: 'Merchant guilds demand monopoly charters over wool exports in Calais.' }
    ]
  },

  locations: [
    { id: 1, name: 'London', country: 'ENG', terrain: 'Farmland', devastation: 0.0, infrastructure: 35.0, control: 1.0, tax_base: 120.0, plague_infected: false },
    { id: 2, name: 'Dover', country: 'ENG', terrain: 'Coast', devastation: 0.05, infrastructure: 20.0, control: 0.93, tax_base: 65.0, plague_infected: false },
    { id: 3, name: 'Calais', country: 'ENG', terrain: 'Marsh', devastation: 0.10, infrastructure: 15.0, control: 0.96, tax_base: 80.0, plague_infected: false },
    { id: 4, name: 'Rouen', country: 'FRA', terrain: 'Farmland', devastation: 0.15, infrastructure: 25.0, control: 0.73, tax_base: 75.0, plague_infected: false },
    { id: 5, name: 'Paris', country: 'FRA', terrain: 'Farmland', devastation: 0.0, infrastructure: 40.0, control: 0.59, tax_base: 150.0, plague_infected: false }
  ],

  pops: [
    { id: 1, location_id: 1, estate: 'Nobility', size: 3500, wealth: 450.0, unrest: 0.05, needs: 1.0 },
    { id: 2, location_id: 1, estate: 'Commoners', size: 28000, wealth: 18.0, unrest: 0.12, needs: 0.90 },
    { id: 3, location_id: 2, estate: 'Burghers', size: 4200, wealth: 85.0, unrest: 0.08, needs: 0.95 },
    { id: 4, location_id: 3, estate: 'Commoners', size: 12000, wealth: 14.0, unrest: 0.18, needs: 0.85 },
    { id: 5, location_id: 4, estate: 'Commoners', size: 15000, wealth: 12.0, unrest: 0.25, needs: 0.80 },
    { id: 6, location_id: 5, estate: 'Nobility', size: 5000, wealth: 600.0, unrest: 0.10, needs: 1.0 }
  ],

  estates: [
    { type: 'Nobility', wealth: 528.0, loyalty: 55.3, power: 45.0 },
    { type: 'Clergy', wealth: 500.0, loyalty: 56.7, power: 22.0 },
    { type: 'Burghers', wealth: 512.0, loyalty: 56.7, power: 20.0 }
  ]
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

// CONTROL RECALCULATION
function recalculateControl() {
  for (const loc of state.locations) {
    if (loc.id === 1) { loc.control = 1.0; continue; }
    let dist = 15.0;
    if (loc.id === 2) dist = 12.0;
    if (loc.id === 3) dist = state.channelBlockaded ? 120.0 : 14.0;
    if (loc.id === 4) dist = state.channelBlockaded ? 140.0 : 35.0;
    if (loc.id === 5) dist = state.channelBlockaded ? 180.0 : 55.0;
    const devastationFactor = 1.0 + Math.pow(loc.devastation, 1.5) * 3.0;
    loc.control = Math.max(0.01, Math.min(1.0, Math.exp(-0.018 * dist * devastationFactor)));
  }
}

// UPDATE HUD METERS
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

  // Selected Location Footer
  const selLoc = state.locations.find(l => l.id === state.selectedLocationId);
  if (selLoc) {
    document.getElementById('selected-loc-name').textContent = `${selLoc.name} (${selLoc.terrain})`;
    const locPops = state.pops.filter(p => p.location_id === selLoc.id);
    const popTotal = locPops.reduce((s, p) => s + p.size, 0);
    document.getElementById('selected-loc-stats').textContent = 
      `Control: ${(selLoc.control * 100).toFixed(1)}% • Devastation: ${(selLoc.devastation * 100).toFixed(1)}% • Pops: ${popTotal.toLocaleString()} • Status: ${selLoc.plague_infected ? '☣️ INFECTED' : 'Clean'}`;
  }

  renderMapModes();
}

// MAP MODE STYLER
function renderMapModes() {
  for (const loc of state.locations) {
    const nodeEl = document.querySelector(`.location-node[data-id="${loc.id}"] circle.loc-core`);
    if (!nodeEl) continue;

    if (state.activeMapMode === 'political') {
      nodeEl.setAttribute('fill', loc.country === 'ENG' ? '#b91c1c' : '#1d4ed8');
      nodeEl.setAttribute('stroke', loc.id === 1 ? '#ffd700' : '#ffffff');
    } else if (state.activeMapMode === 'control') {
      const red = Math.floor(255 * (1 - loc.control));
      const green = Math.floor(255 * loc.control);
      nodeEl.setAttribute('fill', `rgb(${red}, ${green}, 40)`);
      nodeEl.setAttribute('stroke', '#ffffff');
    } else if (state.activeMapMode === 'trade') {
      nodeEl.setAttribute('fill', loc.id === 1 || loc.id === 3 ? '#f59e0b' : '#334155');
      nodeEl.setAttribute('stroke', '#ffd700');
    } else if (state.activeMapMode === 'devastation') {
      const red = Math.floor(100 + 155 * loc.devastation);
      nodeEl.setAttribute('fill', `rgb(${red}, 40, 40)`);
      nodeEl.setAttribute('stroke', '#ff8888');
    } else if (state.activeMapMode === 'plague') {
      nodeEl.setAttribute('fill', loc.plague_infected ? '#ef4444' : '#10b981');
      nodeEl.setAttribute('stroke', loc.plague_infected ? '#ff0000' : '#ffffff');
    }
  }
}

// TICK LOOPS
function executeDayTick() {
  state.calendar.day++;
  if (state.calendar.day > 30) {
    state.calendar.day = 1;
    state.calendar.month++;
    executeMonthTick();

    if (state.calendar.month > 12) {
      state.calendar.month = 1;
      state.calendar.year++;
      showToast(`Happy New Year ${state.calendar.year}! Annual court and diplomatic prestige updated.`);
    }
  }

  // Daily natural devastation decay
  for (const loc of state.locations) {
    if (loc.devastation > 0) loc.devastation = Math.max(0, loc.devastation - 0.001);
  }

  updateHUD();
}

function executeMonthTick() {
  recalculateControl();

  // Monthly Treasury Balance
  const net = state.monthlyTaxIncome - state.monthlyMaintenance;
  state.crownTreasury += net;

  // Monthly Manpower Conscription
  state.manpower = Math.min(state.maxManpower, state.manpower + 350);

  // Government Integration Progress
  state.outliner.normandyIntegration = Math.min(100.0, state.outliner.normandyIntegration + 0.35);

  // Black Death Epidemic Impact
  for (const loc of state.locations) {
    if (loc.plague_infected) {
      loc.devastation = Math.min(1.0, loc.devastation + 0.12);
      const locPops = state.pops.filter(p => p.location_id === loc.id);
      for (const p of locPops) {
        p.size -= Math.floor(p.size * 0.08);
      }
    }
  }

  updateHUD();
}

// EVENT LISTENERS
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

  // Map Modes
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeMapMode = btn.dataset.mode;
      renderMapModes();
    });
  });

  // Location Selection
  document.querySelectorAll('.location-node').forEach(node => {
    node.addEventListener('click', () => {
      document.querySelectorAll('.location-node').forEach(n => n.classList.remove('selected'));
      node.classList.add('selected');
      state.selectedLocationId = parseInt(node.dataset.id, 10);
      updateHUD();
    });
  });

  // Court Actions: Royal Marriage
  document.getElementById('btn-court-marriage').addEventListener('click', () => {
    if (!state.ruler.isMarried) {
      state.ruler.isMarried = true;
      state.ruler.spouseName = 'Duchess Margaret of Flanders';
      state.outliner.alerts = state.outliner.alerts.filter(a => a.id !== 'flanders');
      document.getElementById('alert-item-1').style.display = 'none';
      document.getElementById('alert-count-badge').textContent = '1';
      showToast('💍 Royal Marriage forged with Duchess Margaret! Strong Personal Union claim established.');
    } else {
      showToast('King Edward III is already married to ' + state.ruler.spouseName);
    }
  });

  // Court Actions: Appoint as Field General
  document.getElementById('btn-court-general').addEventListener('click', () => {
    state.ruler.isGeneral = true;
    showToast('⚔️ King Edward III took direct command of the Royal Vanguard (+25% Combat Morale & Shock)!');
  });

  // Court Actions: Appoint Cabinet Advisor
  document.getElementById('btn-court-advisor').addEventListener('click', () => {
    state.ruler.isCabinetAdvisor = true;
    state.monthlyTaxIncome += 20.0;
    showToast('📜 Lord High Chancellor appointed! National Tax Income increased by +20.0 Ducats/mo.');
    updateHUD();
  });

  // Court Actions: Commission Atlantic Explorer
  document.getElementById('btn-court-explorer').addEventListener('click', () => {
    showToast('🧭 Atlantic Expedition chartered under Renaissance patronage! New trade route discovery in progress.');
  });

  // Toggle Blockade
  document.getElementById('btn-toggle-blockade').addEventListener('click', () => {
    state.channelBlockaded = !state.channelBlockaded;
    const seaLine = document.getElementById('sea-trade-line');
    const dcLine = document.getElementById('dover-calais-line');
    const btn = document.getElementById('btn-toggle-blockade');

    if (state.channelBlockaded) {
      seaLine.classList.add('blockaded');
      dcLine.classList.add('blockaded');
      btn.textContent = '⚓ Lift Channel Blockade';
      btn.style.color = '#34d399';
      showToast('⚠️ English Channel blockaded! Trade severed & Rouen arms foundries stalled.');
    } else {
      seaLine.classList.remove('blockaded');
      dcLine.classList.remove('blockaded');
      btn.textContent = '⚓ Toggle Channel Blockade';
      btn.style.color = '#f87171';
      showToast('Maritime trade restored across the English Channel.');
    }
    recalculateControl();
    updateHUD();
  });

  // Toggle Plague
  document.getElementById('btn-toggle-plague').addEventListener('click', () => {
    const loc = state.locations.find(l => l.id === state.selectedLocationId);
    if (!loc) return;
    loc.plague_infected = !loc.plague_infected;
    showToast(loc.plague_infected 
      ? `☣️ Black Death plague broke out in ${loc.name}! High mortality imminent.` 
      : `Plague eradicated in ${loc.name}.`);
    updateHUD();
  });

  // Mobilize Levies
  document.getElementById('btn-raise-levies').addEventListener('click', () => {
    const loc = state.locations.find(l => l.id === state.selectedLocationId);
    if (!loc) return;
    const nobilityPop = state.pops.find(p => p.location_id === loc.id && p.estate === 'Nobility');
    if (nobilityPop && nobilityPop.size > 100) {
      const knights = Math.floor(nobilityPop.size * 0.05);
      nobilityPop.size -= knights;
      showToast(`🚩 Raised ${knights} Heavy Cavalry knights from nobility in ${loc.name}! (Deducted from civilian pop pool).`);
    } else {
      showToast(`Insufficient nobility in ${loc.name} to mobilize heavy cavalry.`);
    }
    updateHUD();
  });
});
