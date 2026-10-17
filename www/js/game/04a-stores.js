// Burger Bar — 04a-stores. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  MULTIPLE LIVE STORES ON ONE STREET
// ─────────────────────────────────────────────────────────────
// Up to MAX_STORES bars stand side by side along the street, STORE_SPACING
// apart. Every store runs live during a shift: its own customers, robots,
// grills and cash register. The player walks out of one front door and into
// the next and can work in any of them.
//
// How it works: the game was written around ONE set of globals (eco, upg,
// stations, groups, stats, bounds, ...). Rather than thread a store parameter
// through every function, each store keeps a context object holding its own
// copy of those globals, and useStore(i) swaps them in. The main loop runs
// simulateStore() once per store per frame inside that store's context.
//
// Coordinates: each store's logic is in its own LOCAL frame (the same frame a
// single bar always used, door at x=0). Its scene groups sit under a root
// offset by `ox` along the street. The player lives in the local frame of the
// store they are standing in (the "active" store); playerRoot carries the
// player's meshes to that store's offset, and crossing the midpoint between
// two stores re-bases the player into the neighbour's frame.

const STORE_SPACING = 80;            // world units between store centres
const MAX_STORES = 3;
const NEW_STORE_DAY = 20;            // calendar day a second store unlocks
const NEW_STORE_COST = 5000;         // paid from the store you're managing
const STORE_NAMES = ['Burger Bar #1', 'Burger Bar #2', 'Burger Bar #3'];
const TRANSFER_STEPS = [100, 500, 1000, 5000];

let storeCtx = [];                   // runtime context per store
let simIdx = 0;                      // whose state the globals currently hold
let parkedStores = [];               // stores from old multi-map saves, kept but not run
const playerRoot = new THREE.Group(); scene.add(playerRoot);
const streetGrp  = new THREE.Group(); scene.add(streetGrp);

function freshStats(){ return {groupsServed:0, totalStars:0, cashEarned:0, groupsLeft:0, spawnTimer:0, initialGroups:1}; }

function makeStoreCtx(i){
  const ox = i * STORE_SPACING;
  const root = new THREE.Group(); root.position.x = ox; scene.add(root);
  let c;
  if(i === 0 && storeCtx.length === 0){
    // The first store adopts the groups the renderer already created.
    root.add(worldGrp, roomGrp, stGrp, stationBatch, actGrp);
    c = { worldGrp, roomGrp, stGrp, stationBatch, actGrp, stations, groups, stats };
  } else {
    const mk = () => { const g = new THREE.Group(); root.add(g); return g; };
    c = { worldGrp:mk(), roomGrp:mk(), stGrp:mk(), stationBatch:mk(), actGrp:mk(),
          stations:{}, groups:[], stats:freshStats() };
  }
  return Object.assign(c, { idx:i, ox, root, eco:defEco(), upg:defUpg(), gStats:defGS(), wings:[],
    bounds:null, baseBounds:null, collEdges:[], batchDirty:true, batchOn:false, decorTier:-1,
    serveStreak:0, streakTimer:0, nav:null, snapshot:null });
}

function stashGlobals(c){
  c.eco = eco; c.upg = upg; c.gStats = gStats; c.wings = wings; c.stats = stats; c.groups = groups;
  c.bounds = bounds; c.baseBounds = baseBounds; c.collEdges = collEdges; c.stations = stations;
  c.batchDirty = _stationBatchDirty; c.batchOn = _stationBatchOn; c.decorTier = _roomDecorTier;
  c.serveStreak = serveStreak; c.streakTimer = streakTimer; c.nav = _nav;
}
function loadGlobals(c){
  eco = c.eco; upg = c.upg; gStats = c.gStats; wings = c.wings; stats = c.stats; groups = c.groups;
  if(c.bounds){ bounds = c.bounds; baseBounds = c.baseBounds; }
  collEdges = c.collEdges; stations = c.stations;
  worldGrp = c.worldGrp; roomGrp = c.roomGrp; stGrp = c.stGrp; stationBatch = c.stationBatch; actGrp = c.actGrp;
  _stationBatchDirty = c.batchDirty; _stationBatchOn = c.batchOn; _roomDecorTier = c.decorTier;
  serveStreak = c.serveStreak; streakTimer = c.streakTimer; _nav = c.nav;
  storeOX = c.ox; simIdx = c.idx;
}
function useStore(i){
  const c = storeCtx[i];
  if(!c || (i === simIdx && storeCtx[simIdx] === c && eco === c.eco)) return;
  if(storeCtx[simIdx]) stashGlobals(storeCtx[simIdx]);
  loadGlobals(c);
}
function withStore(i, fn){
  const prev = simIdx;
  useStore(i);
  try { return fn(); } finally { useStore(prev); }
}
// Read another store's state without switching (the loaded store's lives in globals).
function ctxOf(i){ if(i === simIdx && storeCtx[i]) stashGlobals(storeCtx[i]); return storeCtx[i]; }

// The calendar is the first store's day count. Shop unlocks follow it; each
// store's OWN day count (its age) drives how busy and how demanding it is, so
// a new branch ramps up from a quiet first shift.
function calendarDay(){ return storeCtx.length ? ctxOf(0).eco.day : eco.day; }
function storeName(i){ return (stores[i] && stores[i].name) || STORE_NAMES[i] || ('Burger Bar #' + (i+1)); }
function totalCash(){ let t = 0; for(let i = 0; i < storeCtx.length; i++) t += ctxOf(i).eco.cash; return storeCtx.length ? t : eco.cash; }

// Today's numbers across every store (one store: a copy of its stats).
function dayStats(){
  if(storeCtx.length <= 1) return stats;
  const out = { groupsServed:0, totalStars:0, cashEarned:0, combosServed:0, walkouts:0, bestStreak:0, rushes:0, groupsLeft:0 };
  for(let i = 0; i < storeCtx.length; i++){
    const s = ctxOf(i).stats;
    out.groupsServed += s.groupsServed || 0; out.totalStars += s.totalStars || 0;
    out.cashEarned += s.cashEarned || 0; out.combosServed += s.combosServed || 0;
    out.walkouts += s.walkouts || 0; out.rushes += s.rushes || 0; out.groupsLeft += s.groupsLeft || 0;
    out.bestStreak = Math.max(out.bestStreak, s.bestStreak || 0);
  }
  return out;
}
function allStoresClosed(){
  for(let i = 0; i < storeCtx.length; i++){
    const c = ctxOf(i);
    if(c.stats.groupsLeft > 0 || c.groups.length > 0) return false;
  }
  return true;
}
// Groups the whole chain will see on calendar day `day` (for the daily goals).
function totalPlannedGroups(day){
  if(storeCtx.length <= 1) return plannedGroupCount(day);
  const cal = calendarDay();
  let n = 0;
  for(let i = 0; i < storeCtx.length; i++) n += withStore(i, () => plannedGroupCount(eco.day + (day - cal)));
  return n;
}
// Roller Skates belong to the player, not a building: the best pair you own.
function playerSkatesLv(){
  let lv = upg.speedLv || 0;
  for(let i = 0; i < storeCtx.length; i++) lv = Math.max(lv, ctxOf(i).upg.speedLv || 0);
  return lv;
}

// ── Building the street ──────────────────────────────────────────────────────
// Ground, road and parked cars are shared by every store, so they're built
// once across the whole street rather than per store (overlapping copies
// would z-fight).
function buildStreet(){
  while(streetGrp.children.length) discard(streetGrp, streetGrp.children[0]);
  const n = Math.max(1, storeCtx.length);
  const len = (n - 1) * STORE_SPACING + 170, cx = (n - 1) * STORE_SPACING / 2;
  const roadZ = 10 + 6 + 6;   // the front wall never moves (expansions grow sideways and back)
  addMesh(streetGrp, GPlane(len, 170, 10), MT('grass', TEX.grass, 256), cx, -.5, 0, 0,0,0,false);
  addMesh(streetGrp, GBox(len, .3, .5), M('#d5d9db'), cx, -.2, roadZ - 6.2, 0,0,0,false);   // curb
  addMesh(streetGrp, GPlane(len, 12, 12), MT('asphalt', TEX.asphalt, 256), cx, -.32, roadZ, 0,0,0,false);
  for(let x = -60; x <= len - 110 + 60; x += 9) addMesh(streetGrp, GBox(3.2,.02,.35), M('#ffd54f'), x, -.3, roadZ, 0,0,0,false);
  addMesh(streetGrp, GBox(len, .02, .18), M('#f5f5f5'), cx, -.3, roadZ + 5.2, 0,0,0,false);
  // Parked cars across the street from each store: a little life at the edge of the frame.
  for(let i = 0; i < n; i++){
    [[-22,'#1e88e5'],[19,'#fdd835'],[31,'#e53935']].forEach(([dx,col],k)=>{
      const c = new THREE.Group(); c.position.set(i*STORE_SPACING + dx, 0, roadZ + 3); c.rotation.y = k===1 ? Math.PI : 0;
      addMesh(c, GRBox(5,1.1,2.3,.4), MP(col,90), 0,.95,0);
      addMesh(c, GRBox(2.8,.9,2.0,.35), MP('#cfe8f5',120,.85), -.2,1.8,0);
      addMesh(c, GRBox(2.9,.12,2.1,.06), MP(col,90), -.2,2.28,0);
      for(const wx of [-1.6,1.6]) for(const wz of [-1.1,1.1]) addMesh(c, GCyl(.45,.35,16), M('#1d1f22'), wx,.45,wz, Math.PI/2,0,0);
      addMesh(c, GBox(.1,.25,.5), ME('#fff8e1'), 2.52,1.05,.65, 0,0,0,false);
      addMesh(c, GBox(.1,.25,.5), ME('#fff8e1'), 2.52,1.05,-.65, 0,0,0,false);
      streetGrp.add(c);
    });
  }
  bakeInPlace(streetGrp);
}

// Stations for a store with no saved layout (a brand-new store, or an old save).
function buildStoreStations(st){
  if(st.layout && st.layout.length > 0){
    st.layout.forEach(l => addStation(l.id, l.type, l.x, l.z, l.w, l.d, {role:l.role, hiredDay:l.hiredDay}));
    return;
  }
  initStations();
  for(let i=1;i<=upg.extraGrills;i++)   { const pos=freeSpot(3.5,2); if(pos) addStation('grill'+i,'grill',pos.x,pos.z,3.5,2); }
  for(let i=1;i<=upg.extraSinks;i++)    { const pos=freeSpot(2.2,2.2); if(pos) addStation('sink'+i,'sink',pos.x,pos.z,2.2,2.2); }
  for(let i=1;i<=upg.extraCounters;i++) { const pos=freeSpot(1.8,1.8); if(pos) addStation('counter'+(i+1),'counter',pos.x,pos.z,1.8,1.8); }
  for(let i=1;i<upg.tableCount;i++)     { const pos=freeSpot(5,5); if(pos) addStation('table'+i,'table',pos.x,pos.z,5,5); }
  for(let i=0;i<upg.robotCount;i++){
    const rData = upg.robots[i] || {role: 'busser', hiredDay: 1};
    const pos = freeSpot(1.5,1.5) || getValidSpawn();
    if(pos) addStation('robot'+i,'robot',pos.x,pos.z,1.5,1.5,{role: rData.role, hiredDay: rData.hiredDay});
  }
  for(let i=0;i<upg.sodaCount;i++) { const pos=freeSpot(2,2); if(pos) addStation('soda'+i,'sodafountain',pos.x,pos.z,2,2); }
}

function addStoreContext(i){
  const c = makeStoreCtx(i);
  storeCtx[i] = c;
  if(storeCtx[simIdx] && simIdx !== i) stashGlobals(storeCtx[simIdx]);
  loadGlobals(c);
  loadStoreRecord(stores[i]);
  buildStoreStations(stores[i]);
  rebuildAll();
  stashGlobals(c);
  return c;
}

// Build a live context for every store in the save. Called once at boot.
function initStoreContexts(){
  storeCtx = []; simIdx = 0;
  for(let i = 0; i < stores.length; i++) addStoreContext(i);
  useStore(0);
  activeStoreIdx = 0;
  // The player's meshes travel with whichever store they're standing in.
  for(const o of [pMesh, hlRing, placeGhost, gridH]) playerRoot.add(o);
  playerRoot.position.x = 0;
  buildStreet();
  frustumSize = cameraFrustumSize(); resize();
}

// ── Walking between stores ───────────────────────────────────────────────────
function storeIndexAtWorldX(wx){
  return Math.max(0, Math.min(storeCtx.length - 1, Math.round(wx / STORE_SPACING)));
}
// The player may walk past this store's lot toward a neighbour.
function playerXLimits(){
  const b = bounds;
  const lo = simIdx > 0 ? -STORE_SPACING/2 - 2 : b.l - 18;
  const hi = simIdx < storeCtx.length - 1 ? STORE_SPACING/2 + 2 : b.r + 18;
  return [lo, hi];
}
function switchActiveStore(j){
  if(j === activeStoreIdx || !storeCtx[j]) return;
  const from = storeCtx[activeStoreIdx], to = storeCtx[j];
  player.pos.x += from.ox - to.ox;           // same spot in the world, new local frame
  if(typeof cancelSinkHold === 'function') cancelSinkHold();
  if(dragStation){                           // can't carry a station next door
    dragStation.mesh.position.set(dragOrigPos.x,0,dragOrigPos.z);
    dragStation.x = dragOrigPos.x; dragStation.z = dragOrigPos.z;
    dragStation = null; placeGhost.visible = false;
  }
  activeStoreIdx = j;
  useStore(j);
  playerRoot.position.x = to.ox;
  frustumSize = cameraFrustumSize(); resize();
  updateCashUI();
  const sub = document.getElementById('day-sub');
  if(sub && gameState === 'playing') sub.textContent = `Customers: ${stats.groupsLeft}`;
  const nt = document.getElementById('day-store'); if(nt) nt.textContent = storeName(j);
  if(gameState === 'playing' || gameState === 'edit') showToast(`🏪 ${storeName(j)}`, 1400);
}
// Called after the player moves: re-base into a neighbour when they cross over.
function checkStoreCrossing(){
  if(storeCtx.length < 2) return;
  const j = storeIndexAtWorldX(player.pos.x + storeCtx[activeStoreIdx].ox);
  if(j !== activeStoreIdx) switchActiveStore(j);
}

// ── Stores HUD: how the other stores are doing, at a glance ──────────────────
let _storesHudT = 0;
function updateStoresHud(){
  let el = document.getElementById('stores-hud');
  if(storeCtx.length < 2){ if(el && el.style.display !== 'none') el.style.display = 'none'; return; }
  if((_storesHudT -= ds) > 0) return;
  _storesHudT = 20;
  if(!el){ el = document.createElement('div'); el.id = 'stores-hud'; document.body.appendChild(el); }
  let html = '';
  for(let i = 0; i < storeCtx.length; i++){
    const c = ctxOf(i), here = i === activeStoreIdx;
    const waiting = c.groups.filter(g => g.state === 'queue' || g.state === 'approach_door').length;
    const hungry  = c.groups.filter(g => g.state === 'ordering').length;
    const walked = c.stats.walkouts || 0;
    const warn = walked > 0 || waiting >= 3;
    const dir = here ? '📍' : (i < activeStoreIdx ? '◀' : '▶');
    html += `<div class="sh-chip${here?' here':''}${warn?' warn':''}">${dir} #${i+1} · $${Math.floor(c.eco.cash)}` +
            ` · ⏳${waiting} 🍽️${hungry}${walked?` · 🚶${walked}`:''}</div>`;
  }
  if(el._html !== html){ el._html = html; el.innerHTML = html; }
  if(el.style.display !== 'flex') el.style.display = 'flex';
}
function hideStoresHud(){ const el = document.getElementById('stores-hud'); if(el) el.style.display = 'none'; }

// ── Opening a store & moving money ───────────────────────────────────────────
function canOpenStore(){
  return storeCtx.length < MAX_STORES && calendarDay() >= NEW_STORE_DAY && eco.cash >= NEW_STORE_COST;
}
function openNewStore(){
  if(!canOpenStore()) return false;
  eco.cash -= NEW_STORE_COST;
  const i = storeCtx.length;
  stores[i] = defStore(i, STORE_NAMES[i] || ('Burger Bar #' + (i+1)), 'burger');
  const back = activeStoreIdx;
  addStoreContext(i);
  useStore(back);
  buildStreet();
  saveGame();
  if(typeof checkAchievements === 'function') checkAchievements();
  showToast(`🎉 ${storeName(i)} is open next door! Send it some cash to get started.`, 3200);
  return true;
}
// Move cash between two stores' registers.
function transferCash(from, to, amount){
  if(from === to || !storeCtx[from] || !storeCtx[to]) return 0;
  const a = ctxOf(from), b = ctxOf(to);
  const amt = Math.max(0, Math.min(amount, Math.floor(a.eco.cash * 100) / 100));
  if(amt <= 0) return 0;
  a.eco.cash = Math.round((a.eco.cash - amt) * 100) / 100;
  b.eco.cash = Math.round((b.eco.cash + amt) * 100) / 100;
  saveGame();
  return amt;
}

// Which store the shop / Edit Mode / Stores screen is working on between shifts.
function manageStore(i){
  if(!storeCtx[i]) return;
  if(i !== activeStoreIdx){
    activeStoreIdx = i; useStore(i);
    playerRoot.position.x = storeCtx[i].ox;
    player.pos = getValidSpawn(); pMesh.position.copy(player.pos);
    frustumSize = cameraFrustumSize(); resize();
  }
}

// ── Stores screen ────────────────────────────────────────────────────────────
let transferStep = 500;
function showStores(){
  document.getElementById('home-screen').style.display = 'none';
  if(typeof stopHomeAnim === 'function') stopHomeAnim();
  renderStoresScreen();
  document.getElementById('stores-screen').style.display = 'flex';
}
function renderStoresScreen(){
  const list = document.getElementById('stores-list');
  if(!list) return;
  const cur = activeStoreIdx;
  let html = '';
  if(storeCtx.length > 1){
    html += `<div class="st-transfer">Move cash in steps of ` +
      TRANSFER_STEPS.map(v => `<button class="st-step${v===transferStep?' on':''}" onclick="setTransferStep(${v})">$${v.toLocaleString()}</button>`).join('') +
      `</div>`;
  }
  for(let i = 0; i < storeCtx.length; i++){
    const c = ctxOf(i), here = i === cur;
    const grades = (c.eco.grades || []).slice(-5);
    const g = grades.length ? grades[grades.length-1] : '–';
    const rating = c.gStats.lifeGroups ? (c.gStats.lifeStars / c.gStats.lifeGroups).toFixed(1) : '–';
    const demand = Math.round((typeof c.eco.demand === 'number' ? c.eco.demand : 1) * 100);
    html += `<div class="store-card${here ? ' active-store' : ''}">
      <div class="st-grade" style="color:${GRADE_COLORS[g] || 'rgba(255,255,255,.5)'}">${g}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:900;font-size:16px;">${storeName(i)}</div>
        <div class="st-meta">💰 $${c.eco.cash.toFixed(2)} · ⭐ ${rating} · 👥 ${demand}% demand</div>
        <div class="st-meta">🤖 ${c.upg.robotCount || 0} robots · 🪑 ${c.upg.tableCount || 1} tables · 🏗️ floor ${c.eco.floorLevel || 0} · ${grades.length ? 'last grades ' + grades.join(' ') : 'no shifts yet'}</div>
        ${storeCtx.length > 1 && !here ? `<div class="st-actions">
          <button class="st-btn" onclick="storesTransfer(${cur},${i})">Send $${transferStep.toLocaleString()} ➡</button>
          <button class="st-btn" onclick="storesTransfer(${i},${cur})">⬅ Take $${transferStep.toLocaleString()}</button>
        </div>` : ''}
      </div>
      <div>${here ? '<span class="st-here">MANAGING</span>' : `<button class="buy-btn" onclick="storesManage(${i})">MANAGE</button>`}</div>
    </div>`;
  }
  if(storeCtx.length < MAX_STORES){
    const day = calendarDay(), ready = day >= NEW_STORE_DAY, afford = eco.cash >= NEW_STORE_COST;
    const why = !ready ? `Unlocks on Day ${NEW_STORE_DAY} (${NEW_STORE_DAY - day} to go)` :
                !afford ? `${storeName(cur)} needs $${NEW_STORE_COST.toLocaleString()} in its register` :
                `Paid by ${storeName(cur)}. Built next door; walk over during a shift.`;
    html += `<div class="store-card locked-store">
      <div style="font-size:34px;">${ready ? '🏗️' : '🔒'}</div>
      <div style="flex:1;"><div style="font-weight:900;font-size:16px;">Open ${STORE_NAMES[storeCtx.length]}</div>
        <div class="st-meta">${why}</div></div>
      <button class="buy-btn" ${canOpenStore() ? '' : 'disabled'} onclick="storesOpen()">$${NEW_STORE_COST.toLocaleString()}</button>
    </div>`;
  }
  list.innerHTML = html;
}
function setTransferStep(v){ transferStep = v; renderStoresScreen(); }
function storesTransfer(from, to){
  const moved = transferCash(from, to, transferStep);
  if(moved > 0){ playSound('coin'); showToast(`💸 $${moved.toFixed(2)} → ${storeName(to)}`, 1600); }
  else { playSound('error'); showToast(`${storeName(from)} has no cash to send`, 1600); }
  renderStoresScreen();
}
function storesManage(i){ manageStore(i); playSound('coin'); renderStoresScreen(); }
function storesOpen(){ if(openNewStore()) playSound('daycomplete'); renderStoresScreen(); }
function closeStores(){
  document.getElementById('stores-screen').style.display = 'none';
  showStartMenu();
}
window.showStores = showStores; window.closeStores = closeStores; window.setTransferStep = setTransferStep;
window.storesTransfer = storesTransfer; window.storesManage = storesManage; window.storesOpen = storesOpen;
