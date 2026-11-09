// Burger Bar — 12c-staff. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  STAFF: training, roles, specialties, the Staff list
// ─────────────────────────────────────────────────────────────
// Each robot keeps, on its station object (and so in the saved layout):
//   role     'chef' | 'waiter' | 'busser'
//   hiredDay the store day it was hired: levels 1-5 come with time
//   trained  paid levels on top of that (up to ROBOT_MAX_LEVEL = 8)
//   spec     a chef's specialty: 'both' | 'grill' | 'fryer'
// upg.robots[i] mirrors these so a store with no saved layout can rebuild.

const ROLE_ICON = { chef: '👨‍🍳', waiter: '🛎️', busser: '🧹' };
const ROLE_NAME = { chef: 'Chef', waiter: 'Waiter', busser: 'Busser' };
const SPEC_NAME = { both: 'Grill + Fryer', grill: 'Grill', fryer: 'Fryer' };

function robotList(){ return Object.values(stations).filter(s => s.type === 'robot').sort((a, b) => parseInt(a.id.slice(5)) - parseInt(b.id.slice(5))); }
function robotIndex(bot){ return parseInt(String(bot.id).replace('robot', '')); }
function robotTrainCost(bot){ const lvl = getRobotLevel(bot); return lvl >= ROBOT_MAX_LEVEL ? 0 : ROBOT_TRAIN_COST[lvl]; }

// Keep upg.robots in step with the robot on the floor.
function syncRobotData(bot){
  const i = robotIndex(bot);
  if(!upg.robots) upg.robots = [];
  const r = upg.robots[i] || (upg.robots[i] = { role: bot.role, hiredDay: bot.hiredDay });
  r.role = bot.role; r.trained = bot.trained || 0; r.spec = bot.spec || 'both';
  if(bot.hiredDay !== undefined) r.hiredDay = bot.hiredDay;
}
function rebuildRobotMesh(bot){
  const y = bot.mesh ? bot.mesh.rotation.y : 0;
  if(bot.mesh) discard(stGrp, bot.mesh);
  bot.mesh = buildRobot(bot.role, getRobotLevel(bot));
  bot.mesh.position.set(bot.pos.x, 0, bot.pos.z); bot.mesh.rotation.y = y;
  stGrp.add(bot.mesh);
}
function setRobotRole(bot, role){
  if(!ROLE_NAME[role] || bot.role === role) return;
  bot.role = role; bot.state = 'idle'; bot.holding = null; bot.target = null; bot.job = null;
  syncRobotData(bot); rebuildRobotMesh(bot); saveGame();
}
function setRobotSpec(bot, spec){
  if(!SPEC_NAME[spec]) return;
  bot.spec = spec; bot.state = 'idle'; bot.target = null; bot.job = null;
  syncRobotData(bot); saveGame();
}
// Pay to raise a robot one level now.
function trainRobot(bot){
  const lvl = getRobotLevel(bot), cost = robotTrainCost(bot);
  if(lvl >= ROBOT_MAX_LEVEL){ showToast('Already at the top level', 1600); return false; }
  if(eco.cash < cost){ playSound('error'); showToast(`Training costs $${cost}`, 1600); return false; }
  eco.cash = Math.round((eco.cash - cost) * 100) / 100;
  bot.trained = (bot.trained || 0) + 1;
  syncRobotData(bot); rebuildRobotMesh(bot);
  updateCashUI(); saveGame();
  playSound('coin');
  spawnFloater(bot.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), `⬆ Lv.${getRobotLevel(bot)}`, '#4FC3F7');
  return true;
}

// ── Edit Mode: robots line up in a grid ──────────────────────────────────────
// Scattered robots were hard to reach to change their jobs. On entering Edit
// Mode they form tidy rows at the front of the dining room (chefs, then
// waiters, then bussers), skipping any spot a station occupies.
function arrangeRobotGrid(){
  const bots = robotList().sort((a, b) => ['chef', 'waiter', 'busser'].indexOf(a.role) - ['chef', 'waiter', 'busser'].indexOf(b.role));
  if(!bots.length) return;
  const b = bounds, gap = 2.4;
  const cols = Math.max(1, Math.floor((b.r - b.l - 3) / gap));
  const spots = [];
  for(let row = 0; spots.length < bots.length && row < 20; row++){
    const z = b.b - 3 - row * gap;
    if(z < b.t + 2) break;
    for(let c = 0; c < cols; c++){
      const x = (c - (cols - 1) / 2) * gap;
      if(Math.abs(x) < 3 && row === 0) continue;   // keep the doorway clear
      if(!navBlockedAt(x, z) && !navBlockedAt(x + .6, z) && !navBlockedAt(x - .6, z)) spots.push({ x, z });
    }
  }
  bots.forEach((bot, i) => {
    const p = spots[i] || freeSpot(1.5, 1.5) || getValidSpawn();
    bot.pos.x = p.x; bot.pos.z = p.z;
    bot.state = 'idle'; bot.target = null; bot.job = null; bot.holding = null;
    bot.mesh.position.set(p.x, 0, p.z); bot.mesh.rotation.y = Math.PI;   // facing the room
  });
}

// ── Staff list (Edit Mode) ───────────────────────────────────────────────────
function showStaff(){
  renderStaff();
  document.getElementById('staff-panel').style.display = 'flex';
}
function closeStaff(){ document.getElementById('staff-panel').style.display = 'none'; }
function renderStaff(){
  const box = document.getElementById('staff-list');
  if(!box) return;
  const bots = robotList(), fryer = Object.values(stations).some(s => s.type === 'fryer');
  document.getElementById('staff-cash').textContent = '$' + eco.cash.toFixed(2);
  if(!bots.length){ box.innerHTML = '<div class="sf-empty">No robots yet. Hire one in the Shop (Automation).</div>'; return; }
  box.innerHTML = bots.map(bot => {
    const lvl = getRobotLevel(bot), cost = robotTrainCost(bot), i = robotIndex(bot);
    const roles = ['chef', 'waiter', 'busser'].map(r =>
      `<button class="sf-seg${bot.role === r ? ' on' : ''}" onclick="staffRole(${i},'${r}')">${ROLE_ICON[r]} ${ROLE_NAME[r]}</button>`).join('');
    const specs = bot.role === 'chef' && fryer ? `<div class="sf-row">` + ['both', 'grill', 'fryer'].map(sp =>
      `<button class="sf-seg small${(bot.spec || 'both') === sp ? ' on' : ''}" onclick="staffSpec(${i},'${sp}')">${SPEC_NAME[sp]}</button>`).join('') + `</div>` : '';
    const w = bot.work || {};
    const today = bot.role === 'chef' ? `${w.patties || 0} 🍔 · ${w.fries || 0} 🍟` : bot.role === 'waiter' ? `${w.served || 0} 🍽️ served` : `${w.washed || 0} 🧽 washed`;
    const train = lvl >= ROBOT_MAX_LEVEL ? `<button class="sf-train max" disabled>MAX</button>`
      : `<button class="sf-train" ${eco.cash >= cost ? '' : 'disabled'} onclick="staffTrain(${i})">⬆ Lv.${lvl + 1}<br><span>$${cost.toLocaleString()}</span></button>`;
    return `<div class="sf-card">
      <div class="sf-head"><span class="sf-icon">${ROLE_ICON[bot.role]}</span>
        <div class="sf-name">Robot ${i + 1}<div class="sf-meta">Level ${lvl}/${ROBOT_MAX_LEVEL} · ${today}</div></div>${train}</div>
      <div class="sf-row">${roles}</div>${specs}
    </div>`;
  }).join('');
}
const _staffBot = i => stations['robot' + i];
function staffRole(i, r){ const b = _staffBot(i); if(b){ setRobotRole(b, r); playSound('coin'); renderStaff(); } }
function staffSpec(i, sp){ const b = _staffBot(i); if(b){ setRobotSpec(b, sp); playSound('coin'); renderStaff(); } }
function staffTrain(i){ const b = _staffBot(i); if(b && trainRobot(b)) renderStaff(); }
window.showStaff = showStaff; window.closeStaff = closeStaff;
window.staffRole = staffRole; window.staffSpec = staffSpec; window.staffTrain = staffTrain;
