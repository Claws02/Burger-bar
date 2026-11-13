// Burger Bar — 06-shop-edit. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  EDIT MODE & SHOP SYSTEM
// ─────────────────────────────────────────────────────────────
let dragStation=null, dragOrigPos={x:0,z:0};

function startEditMode(){
  stopHomeAnim();
  gameState='edit';
  ['start-screen','shop-screen','results-screen'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.style.display='none';
  });
  document.getElementById('home-screen').style.display='none';
  document.getElementById('skins-screen').style.display='none';
  document.getElementById('stores-screen').style.display='none';
  document.getElementById('edit-hud').style.display='block';
  player.pos=getValidSpawn(); pMesh.position.copy(player.pos);
  dragStation=null; gridH.visible=true;
  arrangeRobotGrid();   // robots line up so their jobs are easy to change (12c-staff.js)
  actionBtn.innerHTML='🔧'; actionBtn.style.background='rgba(3,169,244,.8)';
}
function saveEditMode(){
  if(dragStation){
    dragStation.mesh.position.set(dragOrigPos.x,0,dragOrigPos.z);
    dragStation.x=dragOrigPos.x; dragStation.z=dragOrigPos.z;
    dragStation=null; placeGhost.visible=false;
  }
  document.getElementById('edit-hud').style.display='none';
  actionBtn.innerHTML='✋'; actionBtn.style.background='rgba(255,200,30,.8)';
  gridH.visible=false; hlRing.visible=false;
  saveGame();
  showStartMenu();
}
window.startEditMode=startEditMode; window.saveEditMode=saveEditMode;

function openExpandPicker(){
  document.getElementById('exp-left').disabled  = wings.filter(w=>w.dir==='left').length>=3;
  document.getElementById('exp-right').disabled = wings.filter(w=>w.dir==='right').length>=3;
  document.getElementById('exp-back').disabled  = wings.filter(w=>w.dir==='back').length>=3;
  document.getElementById('expand-picker').style.display='flex';
  document.getElementById('shop-screen').style.display='none';
}
function closeExpandPicker(){
  document.getElementById('expand-picker').style.display='none';
  document.getElementById('shop-screen').style.display='flex';
}
function confirmExpand(dir){
  document.getElementById('expand-picker').style.display='none';
  let wing;
  if(dir==='left'){
    const leftCount  = wings.filter(w=>w.dir==='left').length;
    if(leftCount>0){
      const prevWing = wings.filter(w=>w.dir==='left').reduce((a,c)=>c.l<a.l?c:a, wings.find(w=>w.dir==='left'));
      wing = {dir:'left', l:prevWing.l-WING_SIZE, r:prevWing.l, t:baseBounds.t, b:baseBounds.b};
    } else {
      wing = {dir:'left', l:baseBounds.l-WING_SIZE, r:baseBounds.l, t:baseBounds.t, b:baseBounds.b};
    }
  } else if(dir==='right'){
    const rightCount = wings.filter(w=>w.dir==='right').length;
    if(rightCount>0){
      const prevWing = wings.filter(w=>w.dir==='right').reduce((a,c)=>c.r>a.r?c:a, wings.find(w=>w.dir==='right'));
      wing = {dir:'right', l:prevWing.r, r:prevWing.r+WING_SIZE, t:baseBounds.t, b:baseBounds.b};
    } else {
      wing = {dir:'right', l:baseBounds.r, r:baseBounds.r+WING_SIZE, t:baseBounds.t, b:baseBounds.b};
    }
  } else {
    const backCount  = wings.filter(w=>w.dir==='back').length;
    if(backCount>0){
      const prevWing = wings.filter(w=>w.dir==='back').reduce((a,c)=>c.t<a.t?c:a, wings.find(w=>w.dir==='back'));
      wing = {dir:'back', l:baseBounds.l, r:baseBounds.r, t:prevWing.t-WING_SIZE, b:prevWing.t};
    } else {
      wing = {dir:'back', l:baseBounds.l, r:baseBounds.r, t:baseBounds.t-WING_SIZE, b:baseBounds.t};
    }
  }
  wings.push(wing); eco.floorLevel++; bounds = computeBounds(); rebuildAll(); saveGame();
  document.getElementById('shop-cash-display').textContent='$'+eco.cash.toFixed(2);
  updateShop(); document.getElementById('shop-screen').style.display='flex';
}
window.confirmExpand=confirmExpand; window.closeExpandPicker=closeExpandPicker;

function rebuildAll(){
  markStationsDirty();
  updateBoundsFromLevel();
  buildWorld(); buildRoom();
  updateStationVisuals();
  // Zoom the camera out as the floor expands so stations stay on-screen.
  frustumSize = cameraFrustumSize();
  resize();
}

// ── Equipment caps grow with the floor ───────────────────────────────────────
// A flat cap of 4 per station type was fine on Day 8 and crippling on Day 18,
// when a robot crew fights over two or three counters to stage food. Every
// Expand now raises the caps, so floor space is what limits the kitchen (and
// Expand has a reason to buy beyond room to walk). Counters scale fastest:
// they are the staging buffer every chef and waiter shares. All caps count
// the EXTRA stations bought, on top of what the bar starts with.
const EQUIP_CAPS = {
  //            extras at floor 0,  per expansion,  hard ceiling (extras)
  counter: { base:3, perFloor:2.5, max:26 },   // starts with 2 -> up to 28 total
  grill:   { base:3, perFloor:1.5, max:17 },   // starts with 1 -> up to 18
  sink:    { base:3, perFloor:1.2, max:15 },   // starts with 1 -> up to 16
  soda:    { base:3, perFloor:0.7, max:10 },   // starts with 0 -> up to 10
  table:   { base:8, perFloor:2,   max:28 },   // TOTAL tables (starts with 1)
  fryer:   { base:1, perFloor:0.5, max:6  },   // TOTAL fry stations (starts with 0)
};
function equipCap(kind, floor){
  const c = EQUIP_CAPS[kind];
  const f = floor === undefined ? (eco.floorLevel||0) : floor;
  return Math.min(c.max, c.base + Math.ceil(f * c.perFloor));
}
// True when a capped item could be bought again after another Expand.
function capGrowsWithFloor(kind){
  return (eco.floorLevel||0) < MAX_FLOOR_LEVEL && equipCap(kind, MAX_FLOOR_LEVEL) > equipCap(kind);
}
const MAX_FLOOR_LEVEL = 10;   // 1-6 widen and deepen the lot; 7-10 only deepen it

// ── Menu Prices ──────────────────────────────────────────────────────────────
// What a guest pays used to be flat for the whole game ($16 a burger on Day 1
// and on Day 100), while shop prices climbed, so income stalled once the day
// length capped. Each level is +15% on every check; the price of the next level
// rises ~40%, so each one pays for itself in roughly 4-7 shifts at the day it
// becomes affordable (see docs/BALANCE.md).
const MENU_PRICE_STEP = 0.15, MENU_PRICE_MAX = 10;
function menuPriceMult(){ return 1 + MENU_PRICE_STEP * (upg.priceLv||0); }
function menuPriceCost(lv){ return Math.round(150 * Math.pow(1.4, lv) / 5) * 5; }

// ── Robot Overclock ──────────────────────────────────────────────────────────
// The late-game cash sink: robots top out at Lv.5 two weeks after hiring, and
// past Day ~20 there was nothing left worth buying. Each level is +12% robot
// move speed and faster washing.
const OVERCLOCK_MAX = 5, OVERCLOCK_COSTS = [600, 1000, 1600, 2400, 3500];
function robotOverclockMult(){ return 1 + 0.12 * (upg.robotOC||0); }

// Robot hire price. It used to climb $120 per hire ($1,280 for the 10th robot,
// $7,400 for the full crew); a flatter climb keeps a crew within reach of a
// Day-15 bar that also needs counters and tables.
function robotCost(n){ return 200 + n * 60; }
// Crew size grows with the floor: 10 in a small bar, 30 at full size.
const ROBOT_CAP = { base: 10, perFloor: 2, max: 30 };
function robotCap(floor){ const f = floor === undefined ? (eco.floorLevel || 0) : floor; return Math.min(ROBOT_CAP.max, ROBOT_CAP.base + ROBOT_CAP.perFloor * f); }

const SHOP_DEFS = [
  // Tier 1 (Day 1)
  {id:'trays',     label:'🍱 Buy Trays (+4)',    desc:'Start each day with more trays',       cat:'Building',  cost:()=>60,                     max:()=>eco.totalTrays>=20, unlockDay:1, action:()=>{ eco.totalTrays+=4; }},
  {id:'speed',     label:'⚡ Roller Skates',      desc:'Move faster (stackable)',               cat:'Upgrades',  cost:()=>60+upg.speedLv*40,      max:()=>upg.speedLv>=5, unlockDay:1, action:()=>{ upg.speedLv++; }},
  {id:'grillspd',  label:'🔥 Turbo Grill',        desc:'Cook burgers faster',                   cat:'Upgrades',  cost:()=>55+Math.floor(upg.grillMult*25), max:()=>upg.grillMult>=3, unlockDay:1, action:()=>{ upg.grillMult=Math.min(3,upg.grillMult+.35); }},
  
  // Tier 2 (Day 3)
  {id:'table',     label:'🪑 Add Table',         desc:'Serve more customers at once',          cat:'Building',  cost:()=>80*(upg.tableCount+1),  max:()=>upg.tableCount>=equipCap('table'), capKind:'table', size:[5,5], unlockDay:3, action:()=>{ const pos=layoutSpot('table',5,5)||{x:baseBounds.r-3,z:baseBounds.t+4}; addStation('table'+upg.tableCount,'table', pos.x, pos.z, 5,5); upg.tableCount++; }},
  {id:'decor',     label:'🌸 Fancy Decor',        desc:'Customers wait longer',                 cat:'Upgrades',  cost:()=>45+Math.floor(upg.patienceMult*20), max:()=>upg.patienceMult>=3, unlockDay:3, action:()=>{ upg.patienceMult=Math.min(3,upg.patienceMult+.35); }},
  {id:'xcounter',  label:'🍽️ Extra Counter',      desc:'Staging space for you and your robots', cat:'Equipment', cost:()=>70+upg.extraCounters*35,max:()=>upg.extraCounters>=equipCap('counter'), capKind:'counter', size:[1.8,1.8], unlockDay:3, action:()=>{ const id='counter'+(upg.extraCounters+2); const pos=layoutSpot('counter',1.8,1.8); addStation(id,'counter',pos.x,pos.z,1.8,1.8); upg.extraCounters++; }},
  {id:'price',     label:'📈 Menu Prices',        desc:()=>`Every order pays +15% (now ${Math.round(menuPriceMult()*100)}%)`, cat:'Upgrades', cost:()=>menuPriceCost(upg.priceLv||0), max:()=>(upg.priceLv||0)>=MENU_PRICE_MAX, unlockDay:4, action:()=>{ upg.priceLv=(upg.priceLv||0)+1; }},
  
  // Tier 3 (Day 5)
  {id:'soda',      label:'🥤 Soda Fountain',      desc:'Unlock Combo Meals for higher profit!', cat:'Equipment', cost:()=>150 + upg.sodaCount*100, max:()=>upg.sodaCount>=equipCap('soda'), capKind:'soda', size:[2,2], unlockDay:5, action:()=>{ const pos=layoutSpot('sodafountain',2,2); addStation('soda'+upg.sodaCount,'sodafountain',pos.x,pos.z,2,2); upg.sodaCount++; }},
  {id:'expand',    label:'🏗️ Expand Floorplan',  desc:'More space, and room for more equipment', cat:'Building',  cost:()=>200*(eco.floorLevel+1), max:()=>eco.floorLevel>=MAX_FLOOR_LEVEL, unlockDay:5, action:()=>{ const t0=baseBounds.t; eco.floorLevel++; updateBoundsFromLevel(); followBackWall(baseBounds.t-t0); rebuildAll(); }},
  {id:'xgrill',    label:'🍳 Extra Grill',         desc:'Add another grill station',             cat:'Equipment', cost:()=>120+upg.extraGrills*80, max:()=>upg.extraGrills>=equipCap('grill'), capKind:'grill', size:[3.5,2], unlockDay:5, action:()=>{ const id='grill'+(upg.extraGrills+1); const pos=layoutSpot('grill',3.5,2); addStation(id,'grill',pos.x,pos.z,3.5,2); upg.extraGrills++; }},
  {id:'xsink',     label:'🚿 Extra Sink',          desc:'Wash trays in parallel',               cat:'Equipment', cost:()=>90+upg.extraSinks*60,   max:()=>upg.extraSinks>=equipCap('sink'),  capKind:'sink', size:[2.2,2.2], unlockDay:5, action:()=>{ const id='sink'+(upg.extraSinks+1); const pos=layoutSpot('sink',2.2,2.2); addStation(id,'sink',pos.x,pos.z,2.2,2.2); upg.extraSinks++; }},
  {id:'fryer',     label:'🍟 Fry Station',         desc:()=>(upg.fryerCount||0)?'Another fryer: more fries at once':'Add fries to your menu — a new item!', cat:'Equipment', cost:()=>170+(upg.fryerCount||0)*140, max:()=>(upg.fryerCount||0)>=equipCap('fryer'), capKind:'fryer', size:[3.2,2], unlockDay:11, action:()=>{ const n=upg.fryerCount||0; const pos=layoutSpot('fryer',3.2,2); addStation('fryer'+n,'fryer',pos.x,pos.z,3.2,2); upg.fryerCount=n+1; if(!eco.menu)eco.menu={}; if(!n) eco.menu.fries=true; }},
  {id:'robot',     label:'🤖 Hire Robot',          desc:'Enter Edit mode to set role',           cat:'Automation',cost:()=>robotCost(upg.robotCount), max:()=>upg.robotCount>=robotCap(), size:[1.5,1.5], unlockDay:5, action:()=>{ 
      const rData = {role:'busser', hiredDay:eco.day, trained:0, spec:'both'};
      upg.robots.push(rData);
      // Park new robots in an open spot, not stacked in the middle of the floor.
      const id='robot'+upg.robotCount; const pos=freeSpot(1.5,1.5)||getValidSpawn(); addStation(id,'robot',pos.x,pos.z,1.5,1.5, rData); 
      if(upg.robotCount === 0 && achvMetrics().robots === 0) {   // first robot in the whole chain
         setTimeout(() => {
            const p = document.getElementById('alert-popup');
            document.getElementById('alert-title').style.color = '#4CAF50';
            document.getElementById('alert-title').textContent = 'NEW STAFF';
            document.getElementById('alert-desc').innerHTML = "You hired your first Robot!<br><br>In <b>EDIT MODE</b>, tap <b>👥 STAFF</b> (or face a robot and tap ✋) to set its job:<br><br>🧹 <b>Busser</b> (Cleans dishes)<br>👨‍🍳 <b>Chef</b> (Cooks burgers &amp; fries)<br>🛎️ <b>Waiter</b> (Serves food)<br><br><i>New robots are slow but level up with each day on the job, or pay to train them in the Staff list (up to level 8).</i>";
            p.style.display = 'flex';
         }, 100);
      }
      upg.robotCount++; 
  }},
  {id:'overclock', label:'⚙️ Robot Overclock',     desc:()=>`All robots move and wash faster (Lv.${upg.robotOC||0}/${OVERCLOCK_MAX})`, cat:'Automation', cost:()=>OVERCLOCK_COSTS[Math.min(upg.robotOC||0, OVERCLOCK_MAX-1)], max:()=>(upg.robotOC||0)>=OVERCLOCK_MAX, unlockDay:15, action:()=>{ upg.robotOC=(upg.robotOC||0)+1; }},
  
  // Day 100 Reward
  {id:'crown',     label:'👑 Golden Burger Crown', desc:'Ultimate reward for 100 Days of service', cat:'Upgrades', cost:()=>10000, max:()=>upg.burgerCrown, unlockDay:100, action:()=>{ upg.burgerCrown=true; applyCrown(); }},
];

let activeShopTab = 'Upgrades';
// Your Menu: let the player choose which unlocked item categories to serve.
// Burger is always on (the base of the restaurant); optional categories appear
// here as they're unlocked, each with an on/off switch. Customers only order
// from what's switched on, so players control what their bar actually serves.
function renderMenuPanel(){
  const panel = document.getElementById('shop-menu-panel');
  if(!panel) return;
  const rows = [];
  // Base item — always served, shown as a locked-on entry for clarity.
  rows.push(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 2px;">
      <div style="font-size:13px;font-weight:800;">🍔 Burgers <span style="font-size:10px;color:rgba(255,255,255,.4);">· always on</span></div>
      <div style="font-size:12px;font-weight:900;color:#66BB6A;">SERVING</div>
    </div>`);
  // Combos — unlocked by owning the Soda Fountain; toggleable.
  if(upg.sodaCount > 0){
    const on = menuComboActive();
    rows.push(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 2px;border-top:1px solid rgba(255,255,255,.08);">
        <div style="font-size:13px;font-weight:800;">🥤 Soda &amp; Combos <span style="font-size:10px;color:rgba(255,255,255,.4);">· 🍔🥤 higher profit</span></div>
        <button onclick="toggleMenuCombos()" style="cursor:pointer;font-family:inherit;font-weight:900;font-size:12px;border-radius:20px;border:2px solid ${on?'#66BB6A':'rgba(255,255,255,.25)'};background:${on?'rgba(102,187,106,.2)':'transparent'};color:${on?'#66BB6A':'rgba(255,255,255,.5)'};padding:4px 14px;">${on?'ON':'OFF'}</button>
      </div>`);
  }
  // Fries — unlocked by owning the Fry Station; toggleable.
  if((upg.fryerCount||0) > 0){
    const on = menuFriesActive();
    rows.push(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 2px;border-top:1px solid rgba(255,255,255,.08);">
        <div style="font-size:13px;font-weight:800;">🍟 Fries <span style="font-size:10px;color:rgba(255,255,255,.4);">· cook at the fryer</span></div>
        <button onclick="toggleMenuFries()" style="cursor:pointer;font-family:inherit;font-weight:900;font-size:12px;border-radius:20px;border:2px solid ${on?'#66BB6A':'rgba(255,255,255,.25)'};background:${on?'rgba(102,187,106,.2)':'transparent'};color:${on?'#66BB6A':'rgba(255,255,255,.5)'};padding:4px 14px;">${on?'ON':'OFF'}</button>
      </div>`);
  }
  // Only show the panel once there's an actual choice to make.
  const hasMenuChoice = upg.sodaCount > 0 || (upg.fryerCount||0) > 0;
  if(hasMenuChoice){
    panel.innerHTML = `<div style="background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;margin-bottom:12px;">
        <div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.5);font-weight:900;margin-bottom:4px;">📋 YOUR MENU</div>
        ${rows.join('')}
      </div>`;
    panel.style.display='block';
  } else {
    panel.style.display='none';
  }
}

// With more than one store, the shop says which store's register it spends
// from and lets you switch.
function renderShopStoreRow(){
  const row = document.getElementById('shop-store-row');
  if(!row) return;
  if(storeCtx.length < 2){ row.style.display = 'none'; return; }
  const i = activeStoreIdx, n = storeCtx.length;
  row.innerHTML = `<button onclick="shopSwitchStore(-1)">◀</button><span>🏪 Shopping for ${storeName(i)}</span><button onclick="shopSwitchStore(1)">▶</button>`;
  row.style.display = 'flex';
}
function shopSwitchStore(dir){
  const n = storeCtx.length;
  manageStore((activeStoreIdx + dir + n) % n);
  document.getElementById('shop-cash-display').textContent = '$' + eco.cash.toFixed(2);
  updateShop();
}
window.shopSwitchStore = shopSwitchStore;

function updateShop(){
  renderShopStoreRow();
  renderMenuPanel();
  const cats = ['Upgrades', 'Building', 'Equipment', 'Automation'];
  if(!cats.includes(activeShopTab)) activeShopTab=cats[0];

  const tabsEl=document.getElementById('shop-tabs');
  tabsEl.innerHTML='';
  for(const cat of cats){
    const btn=document.createElement('button');
    btn.className='shop-tab'+(activeShopTab===cat?' active':'');
    btn.textContent=cat;
    btn.onclick=()=>{ activeShopTab=cat; updateShop(); };
    tabsEl.appendChild(btn);
  }

  const itemsEl=document.getElementById('shop-items');
  itemsEl.innerHTML='';
  const items=SHOP_DEFS.filter(d=>d.cat===activeShopTab);
  for(const def of items){
    const cost=def.cost();
    const isMax=def.max();
    const locked=calendarDay() < def.unlockDay;   // unlocks follow the calendar, not a branch's age
    const canAfford=eco.cash>=cost;

    const div=document.createElement('div');
    div.className='upg-item'+(locked?' locked':'');

    let btnHtml;
    // At the cap for this floor size but not for good: point at Expand.
    if(isMax && def.capKind && capGrowsWithFloor(def.capKind))
                      btnHtml=`<button class="buy-btn max" disabled>🏗️ EXPAND</button>`;
    else if(isMax)    btnHtml=`<button class="buy-btn max" disabled>MAX</button>`;
    else if(locked)   btnHtml=`<button class="buy-btn" disabled>🔒 DAY ${def.unlockDay}</button>`;
    else              btnHtml=`<button class="buy-btn" ${canAfford?'':'disabled'} onclick="doBuy('${def.id}')">$${cost.toFixed(2)}</button>`;

    div.innerHTML=`<div><div style="font-weight:900;font-size:14px;">${def.label}</div><div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px;">${typeof def.desc==='function'?def.desc():def.desc}</div></div>${btnHtml}`;
    itemsEl.appendChild(div);
  }
}

function doBuy(id){
  const def=SHOP_DEFS.find(d=>d.id===id);
  if(!def) return;
  const cost=def.cost();
  if(eco.cash<cost||def.max()||calendarDay()<def.unlockDay) return;

  if(def.size && id !== 'robot') {
     if(!freeSpot(def.size[0], def.size[1])) {
        const p = document.getElementById('alert-popup');
        document.getElementById('alert-title').style.color = '#F44336';
        document.getElementById('alert-title').textContent = 'NO SPACE!';
        document.getElementById('alert-desc').innerHTML = "Your restaurant is too cluttered.<br><br>Move items around in <b>EDIT MODE</b> or <b>EXPAND</b> your floorplan before buying this.";
        p.style.display = 'flex';
        playSound('error');
        return; 
     }
  }

  playSound('coin');
  eco.cash-=cost;
  const gtBefore = grillTier(), dtBefore = decorTier();
  def.action();
  refreshUpgradeVisuals();
  if(id === 'speed') applySkates();
  // Make tier jumps feel like an event, not a silent number change.
  if(grillTier() > gtBefore) showToast(`🔥 Grill upgraded: ${GRILL_TIER_NAMES[grillTier()]}!`, 2600);
  else if(decorTier() > dtBefore) showToast(['','🪴 Plants added','🖼️ Wall art hung','🎵 Jukebox installed','💡 Neon & string lights on','💐 Fresh flowers on every table','✨ Gold trim — the fanciest diner in town'][decorTier()], 2600);
  else if(id === 'speed') showToast(`🛼 Skates Lv.${upg.speedLv} — ${upg.speedLv>=5?'golden wheels!':upg.speedLv>=3?'glow wheels!':'zoom!'}`, 2200);
  updateCashUI();
  document.getElementById('shop-cash-display').textContent='$'+eco.cash.toFixed(2);
  updateShop(); updateStationVisuals(); saveGame();
  if(typeof checkAchievements==='function') checkAchievements();
}
window.doBuy=doBuy;

