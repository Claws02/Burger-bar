// Burger Bar — 04-state-save. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  GAME DATA
// ─────────────────────────────────────────────────────────────
function defEco()  { return {cash:0, day:0, floorLevel:0, totalTrays:4, menu:{combos:true}}; }
function defUpg()  { return {speedLv:0, grillMult:0.5, patienceMult:1, tableCount:1, robotCount:0, robots:[], extraGrills:0, extraSinks:0, extraCounters:0, burgerCrown:false, sodaCount:0, fryerCount:0}; }
function defGS()   { return {lifeStars:0, lifeGroups:0, recentDays:[]}; }

// ─── SKINS ───────────────────────────────────────────────────
const SKIN_DEFS = [
  {id:'classic',  name:'Classic Chef',  icon:'👨‍🍳', price:0,    hatColor:'#ffffff', bodyColor:'#ffffff', headColor:'#FFCC80', trailColor:null},
  {id:'space',    name:'Space Chef',    icon:'🚀',    price:200,  hatColor:'#1a237e', bodyColor:'#283593', headColor:'#FFCC80', trailColor:'#7986CB'},
  {id:'gold',     name:'Gold Chef',     icon:'👑',    price:500,  hatColor:'#FFD700', bodyColor:'#FFC107', headColor:'#FFCC80', trailColor:'#FFD700'},
  {id:'ninja',    name:'Ninja Chef',    icon:'🥷',    price:350,  hatColor:'#212121', bodyColor:'#212121', headColor:'#FFCC80', trailColor:'#B0BEC5'},
  {id:'pirate',   name:'Pirate Chef',   icon:'🏴‍☠️',  price:400,  hatColor:'#1a0000', bodyColor:'#4a0000', headColor:'#FFCC80', trailColor:'#EF5350'},
  {id:'alien',    name:'Alien Chef',    icon:'👽',    price:600,  hatColor:'#1b5e20', bodyColor:'#2e7d32', headColor:'#a5d6a7', trailColor:'#69F0AE'},
  {id:'pink',     name:'Cotton Candy',  icon:'🩷',    price:250,  hatColor:'#f06292', bodyColor:'#ec407a', headColor:'#FFCC80', trailColor:'#F48FB1'},
  {id:'ice',      name:'Ice Chef',      icon:'🧊',    price:300,  hatColor:'#b3e5fc', bodyColor:'#81d4fa', headColor:'#FFCC80', trailColor:'#80DEEA'},
  {id:'fire',     name:'Fire Chef',     icon:'🔥',    price:450,  hatColor:'#bf360c', bodyColor:'#e64a19', headColor:'#FFCC80', trailColor:'#FF6D00'},
  {id:'robot',    name:'Robo Chef',     icon:'🤖',    price:550,  hatColor:'#90a4ae', bodyColor:'#607d8b', headColor:'#cfd8dc', trailColor:'#B0BEC5'},
  {id:'cowboy',   name:'Rodeo Chef',    icon:'🤠',    price:400,  hatColor:'#8d6e63', bodyColor:'#a1887f', headColor:'#FFCC80', trailColor:'#D7CCC8'},
  {id:'wizard',   name:'Wizard Chef',   icon:'🧙',    price:700,  hatColor:'#4527a0', bodyColor:'#5e35b1', headColor:'#FFCC80', trailColor:'#B388FF'},
];

// ─── MULTI-STORE ─────────────────────────────────────────────
// stores = [{id, name, eco, upg, gStats, wings, layout, passivePerDay}]
// activeStoreIdx = index into stores[]
let stores = [];
let activeStoreIdx = 0;

// SINGLE-BAR MODE: while we master the first Burger Bar, the only playable map
// is store 0. This one flag gates every path that could switch/launch another
// map (preview swipe, swipe arrows, PLAY target, Stores screen). Flip to false
// to re-enable the multi-store empire (see ARCHITECTURE.md → Single-bar mode).
const SINGLE_BAR_MODE = true;

function defStore(id, name, type='burger') {
  return {
    id, name, type,            // 'burger' | 'seafood'
    eco: defEco(), upg: defUpg(), gStats: defGS(),
    wings: [], layout: null,
    passivePerDay: 0,
    unlocked: true,
  };
}

// Helper: is the active store a seafood restaurant?
function isSeafood(){ return (stores[activeStoreIdx]?.type === 'seafood'); }

// MENU: which optional item categories the player is currently serving. Combos
// require owning the Soda Fountain AND leaving them switched on in the Menu, so
// players can choose to keep the line simple (burgers only) even after buying
// the fountain. Future menu items slot in here the same way.
function menuComboActive(){ return upg.sodaCount > 0 && (eco.menu?.combos !== false); }
function menuFriesActive(){ return (upg.fryerCount||0) > 0 && (eco.menu?.fries !== false); }
function toggleMenuCombos(){
  if(!eco.menu) eco.menu = {combos:true};
  const currentlyOn = eco.menu.combos !== false;
  eco.menu.combos = !currentlyOn;
  saveGame(); renderMenuPanel(); playSound('coin');
}
function toggleMenuFries(){
  if(!eco.menu) eco.menu = {};
  const currentlyOn = eco.menu.fries !== false;
  eco.menu.fries = !currentlyOn;
  saveGame(); renderMenuPanel(); playSound('coin');
}

// Skin/cosmetic state (global across stores)
let cosm = { ownedSkins: ['classic'], equippedSkin: 'classic', character: 'human' };

// Achievements unlocked (account-wide; persisted in the save).
let achievements = { unlocked: [] };

// Lifetime records (account-wide; persisted in the save).
let records = { bestDayCash: 0, bestDayStars: 0, totalServed: 0 };

function getActiveSkin() {
  return SKIN_DEFS.find(s => s.id === cosm.equippedSkin) || SKIN_DEFS[0];
}

let gameState='boot'; 
let eco=defEco(), upg=defUpg(), gStats=defGS();
let stats={groupsServed:0, totalStars:0, cashEarned:0, groupsLeft:0, spawnTimer:0, initialGroups:1};
let loadedLayout = null; 

let floaters = [];

// Serve-streak: serving groups in quick succession builds a tip multiplier.
let serveStreak = 0, streakTimer = 0;
function spawnFloater(pos, txt, color='#66BB6A'){
  floaters.push({pos:pos.clone().add(new THREE.Vector3(0,2,0)), text:txt, color:color, life:1.5});
}

function getRobotLevel(bot) {
    if(bot.hiredDay === undefined) return 1;
    const d = eco.day - bot.hiredDay;
    if(d < 2) return 1;
    if(d < 5) return 2;
    if(d < 9) return 3;
    if(d < 14) return 4;
    return 5;
}

// ─────────────────────────────────────────────────────────────
//  SAVE / LOAD
// ─────────────────────────────────────────────────────────────
function saveGame(){
  try{
    if(stores.length > 0) {
      stores[activeStoreIdx].eco    = JSON.parse(JSON.stringify(eco));
      stores[activeStoreIdx].upg    = JSON.parse(JSON.stringify(upg));
      stores[activeStoreIdx].gStats = JSON.parse(JSON.stringify(gStats));
      stores[activeStoreIdx].wings  = JSON.parse(JSON.stringify(wings));
      let layout = [];
      for(const k in stations) {
        const s = stations[k];
        let lData = {id: s.id, type: s.type, w: s.w, d: s.d};
        if(s.type === 'robot') { lData.x = s.pos.x; lData.z = s.pos.z; lData.role = s.role; lData.hiredDay = s.hiredDay; }
        else { lData.x = s.x; lData.z = s.z; }
        layout.push(lData);
      }
      stores[activeStoreIdx].layout = layout;
    }
    const data = JSON.stringify({v:6, stores, activeStoreIdx, cosm, achievements, records, dailyGoals, adapt, savedAt:Date.now()});
    // Keep the last good save as a backup. A corrupt or half-written main save
    // used to fall through to bootstrapNewSave(), and the next autosave then
    // overwrote the player's whole run.
    const prev = localStorage.getItem('burgerBoss_save');
    if(prev && prev !== data) { try { localStorage.setItem('burgerBoss_save_bak', prev); } catch(_){} }
    localStorage.setItem('burgerBoss_save', data);
    window._saveWarned = false;
  }catch(e){
    // An empty catch here meant a full localStorage quota (or a private window)
    // lost the player's progress with no indication whatsoever. Warn once, and
    // point at Export Save so the run is recoverable.
    console.warn('Save failed', e);
    if(!window._saveWarned){
      window._saveWarned = true;
      try{ showToast("⚠️ Couldn't save progress — use Export Save in Settings", 4500); }catch(_){}
    }
  }
}

// Parse a save string into a validated object, or null if it is unusable.
function parseSave(raw){
  if(!raw) return null;
  try {
    const s = JSON.parse(raw);
    if(!s || typeof s !== 'object' || !s.v || s.v < 6) return null;
    if(s.stores && (!Array.isArray(s.stores) || !s.stores.length || !s.stores[0] || typeof s.stores[0] !== 'object')) return null;
    return s;
  } catch(e){ return null; }
}
function loadSave(){
  try{
    const raw = localStorage.getItem('burgerBoss_save');
    let s = parseSave(raw);
    if(!s){
      // Unreadable or missing main save: fall back to the last good backup
      // before giving up, and keep the bad copy for support/debugging.
      if(raw){ try { localStorage.setItem('burgerBoss_save_corrupt', raw); } catch(_){} }
      s = parseSave(localStorage.getItem('burgerBoss_save_bak'));
      if(!s){ bootstrapNewSave(); return; }
      window._recoveredFromBackup = true;
      console.warn('Main save unreadable; restored the backup.');
    }

    // If save is from an old version, wipe and start fresh to avoid corrupted state
    if(!s.v || s.v < 6) { bootstrapNewSave(); return; }

    // ── migrate old single-store saves ──
    if(!s.stores) {
      const store0 = defStore(0, 'Burger Bar #1');
      if(s.eco)    store0.eco    = Object.assign(defEco(),  s.eco);
      if(s.upg)    store0.upg    = Object.assign(defUpg(),  s.upg);
      if(s.gStats) store0.gStats = Object.assign(defGS(),   s.gStats);
      if(s.wings)  store0.wings  = s.wings;
      if(s.layout) store0.layout = s.layout;
      stores = [store0];
      activeStoreIdx = 0;
    } else {
      stores = s.stores;
      // SINGLE-BAR MODE: always return the player to the first Burger Bar.
      // Any extra stores from older multi-map saves are preserved in the array
      // (so nothing is lost) but are not reachable until we re-enable the
      // multi-store empire. activeStoreIdx is pinned to the first burger bar.
      activeStoreIdx = 0;
    }
    if(s.cosm) cosm = Object.assign({ownedSkins:['classic'], equippedSkin:'classic', character:'human'}, s.cosm);
    if(s.achievements) achievements = Object.assign({unlocked:[]}, s.achievements);
    if(s.records) records = Object.assign({bestDayCash:0, bestDayStars:0, totalServed:0}, s.records);
    if(Array.isArray(s.dailyGoals)) dailyGoals = s.dailyGoals;
    adapt = Object.assign(defAdapt(), s.adapt || {});

    loadActiveStore();
  }catch(e){ console.warn('Load failed',e); bootstrapNewSave(); }
}

function bootstrapNewSave() {
  // SINGLE-BAR MODE: we focus on mastering the first Burger Bar before adding
  // more locations. The other "maps" (Seafood Shack + franchise reskins) live
  // in archive/index-multimap-backup.html and are intentionally not created
  // here. See ARCHITECTURE.md for the full first-bar design.
  stores = [
    defStore(0, 'Burger Bar #1', 'burger'),
  ];
  activeStoreIdx = 0;
  loadActiveStore();
}

function loadActiveStore() {
  const st = stores[activeStoreIdx];
  eco    = Object.assign(defEco(),  st.eco    || {});
  upg    = Object.assign(defUpg(),  st.upg    || {});
  gStats = Object.assign(defGS(),   st.gStats || {});
  wings  = st.wings || [];
  loadedLayout = st.layout || null;

  // backward compat
  if(typeof upg.sodaFountain === 'boolean') { upg.sodaCount = upg.sodaFountain?1:0; delete upg.sodaFountain; }
  if(upg.robotCount>0 && (!upg.robots||upg.robots.length===0)){
    upg.robots=[];
    for(let i=0;i<upg.robotCount;i++) upg.robots.push({role:'busser',hiredDay:eco.day||1});
  } else if(upg.robots&&upg.robots.length>0) upg.robotCount=upg.robots.length;

  updateBoundsFromLevel();
}

