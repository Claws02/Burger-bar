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
  frustumSize = 26 + (eco.floorLevel||0) * 2.5;
  resize();
}

const SHOP_DEFS = [
  // Tier 1 (Day 1)
  {id:'trays',     label:'🍱 Buy Trays (+4)',    desc:'Start each day with more trays',       cat:'Building',  cost:()=>60,                     max:()=>eco.totalTrays>=20, unlockDay:1, action:()=>{ eco.totalTrays+=4; }},
  {id:'speed',     label:'⚡ Roller Skates',      desc:'Move faster (stackable)',               cat:'Upgrades',  cost:()=>60+upg.speedLv*40,      max:()=>upg.speedLv>=5, unlockDay:1, action:()=>{ upg.speedLv++; }},
  {id:'grillspd',  label:'🔥 Turbo Grill',        desc:'Cook burgers faster',                   cat:'Upgrades',  cost:()=>55+Math.floor(upg.grillMult*25), max:()=>upg.grillMult>=3, unlockDay:1, action:()=>{ upg.grillMult=Math.min(3,upg.grillMult+.35); }},
  
  // Tier 2 (Day 3)
  {id:'table',     label:'🪑 Add Table',         desc:'Serve more customers at once',          cat:'Building',  cost:()=>80*(upg.tableCount+1),  max:()=>upg.tableCount>=8, unlockDay:3, action:()=>{ const pos=freeSpot()||{x:baseBounds.r-3,z:baseBounds.t+4}; addStation('table'+upg.tableCount,'table', pos.x, pos.z, 5,5); upg.tableCount++; }},
  {id:'decor',     label:'🌸 Fancy Decor',        desc:'Customers wait longer',                 cat:'Upgrades',  cost:()=>45+Math.floor(upg.patienceMult*20), max:()=>upg.patienceMult>=3, unlockDay:3, action:()=>{ upg.patienceMult=Math.min(3,upg.patienceMult+.35); }},
  {id:'xcounter',  label:'🍽️ Extra Counter',      desc:'More clean tray staging space',        cat:'Equipment', cost:()=>70+upg.extraCounters*50,max:()=>upg.extraCounters>=maxEquip()-1, unlockDay:3, action:()=>{ const id='counter'+(upg.extraCounters+2); const pos=freeSpot(); addStation(id,'counter',pos.x,pos.z,1.8,1.8); upg.extraCounters++; }},
  
  // Tier 3 (Day 5)
  {id:'soda',      label:'🥤 Soda Fountain',      desc:'Unlock Combo Meals for higher profit!', cat:'Equipment', cost:()=>150 + upg.sodaCount*100, max:()=>upg.sodaCount>=maxEquip()-1, unlockDay:5, action:()=>{ const pos=freeSpot(); addStation('soda'+upg.sodaCount,'sodafountain',pos.x,pos.z,2,2); upg.sodaCount++; }},
  {id:'expand',    label:'🏗️ Expand Floorplan',  desc:'Push the walls out for more space',     cat:'Building',  cost:()=>200*(eco.floorLevel+1), max:()=>eco.floorLevel>=6,        unlockDay:5, action:()=>{ eco.floorLevel++; updateBoundsFromLevel(); rebuildAll(); }},
  {id:'xgrill',    label:'🍳 Extra Grill',         desc:'Add another grill station',             cat:'Equipment', cost:()=>120+upg.extraGrills*80, max:()=>upg.extraGrills>=maxEquip()-1, unlockDay:5, action:()=>{ const id='grill'+(upg.extraGrills+1); const pos=freeSpot(); addStation(id,'grill',pos.x,pos.z,3.5,2); upg.extraGrills++; }},
  {id:'xsink',     label:'🚿 Extra Sink',          desc:'Wash trays in parallel',               cat:'Equipment', cost:()=>90+upg.extraSinks*60,   max:()=>upg.extraSinks>=maxEquip()-1,  unlockDay:5, action:()=>{ const id='sink'+(upg.extraSinks+1); const pos=freeSpot(); addStation(id,'sink',pos.x,pos.z,2.2,2.2); upg.extraSinks++; }},
  {id:'fryer',     label:'🍟 Fry Station',         desc:'Add fries to your menu — a new item!',  cat:'Equipment', cost:()=>170,                    max:()=>(upg.fryerCount||0)>=1,        unlockDay:11, action:()=>{ const pos=freeSpot(); addStation('fryer0','fryer',pos.x,pos.z,3.2,2); upg.fryerCount=1; if(!eco.menu)eco.menu={}; eco.menu.fries=true; }},
  {id:'robot',     label:'🤖 Hire Robot',          desc:'Enter Edit mode to set role',           cat:'Automation',cost:()=>200+upg.robotCount*120, max:()=>upg.robotCount>=10, unlockDay:5, action:()=>{ 
      const rData = {role:'busser', hiredDay:eco.day};
      upg.robots.push(rData);
      const id='robot'+upg.robotCount; const pos=getValidSpawn(); addStation(id,'robot',pos.x,pos.z,1.5,1.5, rData); 
      if(upg.robotCount === 0) {
         setTimeout(() => {
            const p = document.getElementById('alert-popup');
            document.getElementById('alert-title').style.color = '#4CAF50';
            document.getElementById('alert-title').textContent = 'NEW STAFF';
            document.getElementById('alert-desc').innerHTML = "You hired your first Robot!<br><br>Enter <b>EDIT MODE</b> and face it to switch its job:<br><br>🧹 <b>Busser</b> (Cleans dishes)<br>👨‍🍳 <b>Chef</b> (Cooks patties)<br>🛎️ <b>Waiter</b> (Serves food)<br><br><i>Note: New robots are slow, but level up each day!</i>";
            p.style.display = 'flex';
         }, 100);
      }
      upg.robotCount++; 
  }},
  
  // Day 100 Reward
  {id:'crown',     label:'👑 Golden Burger Crown', desc:'Ultimate reward for 100 Days of service', cat:'Upgrades', cost:()=>10000, max:()=>upg.burgerCrown, unlockDay:100, action:()=>{ upg.burgerCrown=true; applyCrown(); }},
];

function maxEquip(){ return 4; }

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

function updateShop(){
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
    const locked=eco.day < def.unlockDay;
    const canAfford=eco.cash>=cost;

    const div=document.createElement('div');
    div.className='upg-item'+(locked?' locked':'');

    let btnHtml;
    if(isMax)         btnHtml=`<button class="buy-btn max" disabled>MAX</button>`;
    else if(locked)   btnHtml=`<button class="buy-btn" disabled>🔒 DAY ${def.unlockDay}</button>`;
    else              btnHtml=`<button class="buy-btn" ${canAfford?'':'disabled'} onclick="doBuy('${def.id}')">$${cost.toFixed(2)}</button>`;

    div.innerHTML=`<div><div style="font-weight:900;font-size:14px;">${def.label}</div><div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px;">${def.desc}</div></div>${btnHtml}`;
    itemsEl.appendChild(div);
  }
}

function doBuy(id){
  const def=SHOP_DEFS.find(d=>d.id===id);
  if(!def) return;
  const cost=def.cost();
  if(eco.cash<cost||def.max()||eco.day<def.unlockDay) return;

  if(['table','xcounter','xgrill','xsink','robot','soda','fryer'].includes(id)) {
     if(!freeSpot()) {
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

