// Burger Bar — 11-actions. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ACTION HANDLER
// ─────────────────────────────────────────────────────────────
// Short human-readable description of what ACT will do at the nearest station,
// given what the player is currently holding. Used for the contextual prompt.
function actionPromptFor(t){
  if(!t) return '';
  const h = player.holding, ty = t.type;
  if(isSeafood()){
    if(ty==='cooler')          return !h?'Grab fish':'';
    if(ty==='beachgrill')      return h==='raw_fish'?'Place on grill':(!h?'Take fish':'');
    if(ty==='assembly')        return h==='cooked_fish'?'Make taco':((!h&&t.item)?'Pick up':((h&&!t.item)?'Place down':''));
    if(ty==='chowderpot')      return !h?'Ladle chowder':'';
    if(ty==='lemonadestation') return !h?'Pour lemonade':'';
    if(ty==='basketrack')      return (h&&h!=='basket')?'Put in basket':((!h&&t.cleanBaskets>0)?'Take basket':'');
    if(ty==='sink')            return h==='dirty_basket'?'Hold to wash':'';
    if(ty==='trash')           return (t.contents>=4&&!h)?'Bag trash':(h?'Toss':'');
    if(ty==='dumpster')        return h==='trash_bag'?'Dump bag':'';
    if(ty==='table')           return (h&&t.group&&t.group.state==='ordering')?'Serve!':((!h&&t.dirtyTrays>0)?'Clear table':'');
    return '';
  }
  if(ty==='fridge')        return !h?'Grab patty':'';
  if(ty==='grill')         return h==='raw'?'Place on grill':(!h?'Take burger':((h==='tray'||h==='soda_on_tray')?'Plate burger':''));
  if(ty==='fryer'){
    if(h==='tray') return 'Plate fries';
    if(!h){ const hasDone=t.slots&&t.slots.some(s=>s&&(s.state==='fries'||s.state==='burnt_fries')); return hasDone?'Take fries':'Drop fries'; }
    return '';
  }
  if(ty==='trayrack')      return h==='tray'?'Return tray':((!h&&t.cleanTrays>0)?'Take tray':(h==='cooked'?'Plate burger':(h==='fries'?'Plate fries':'')));
  if(ty==='sodafountain')  return (h==='tray'||h==='burger_on_tray')?'Add soda':'';
  if(ty==='counter')       return (!t.item&&h)?'Place down':((t.item&&!h)?'Pick up':'Combine');
  if(ty==='trash')         return (t.contents>=4&&!h)?'Bag trash':(h?'Toss':'');
  if(ty==='dumpster')      return h==='trash_bag'?'Dump bag':'';
  if(ty==='table')         return (h&&t.group&&t.group.state==='ordering')?'Serve!':((!h&&t.dirtyTrays>0)?'Clear table':'');
  return '';
}

// Serve one held item to a seated group, checking off the CORRECT customer:
// the first not-yet-served seat whose order matches what's being delivered.
// Keeps the per-seat servedMask, the unservedOrders list, and the table's
// served count all in sync. Returns true if an order was actually fulfilled.
// Used by the player and both (burger/seafood) robot-waiter paths so the seat
// that gets the ✔️ is always the one whose order you delivered.
function serveHeldToGroup(t, holding){
  const g = t.group;
  if(!g || g.state!=='ordering' || !holding) return false;
  if(!g.servedMask || g.servedMask.length !== g.orders.length) g.servedMask = g.orders.map(()=>false);
  let seat = -1;
  for(let i=0;i<g.orders.length;i++){ if(!g.servedMask[i] && g.orders[i]===holding){ seat=i; break; } }
  if(seat === -1) return false;            // nobody at this table ordered that
  g.servedMask[seat] = true;
  const ui = g.unservedOrders.indexOf(holding); if(ui !== -1) g.unservedOrders.splice(ui, 1);
  t.served++;
  // Track combo meals served today (for daily goals).
  if(holding==='burger_soda_on_tray' || holding==='taco_chowder_basket' || holding==='taco_lemonade_basket')
    stats.combosServed = (stats.combosServed||0) + 1;
  if(g.unservedOrders.length === 0){ g.eatTimer = 200; g.state = 'eating'; }
  return true;
}

function handleAction(){
  if(gameState==='edit'){
    if(dragStation){
      const fx=Math.round(player.pos.x+Math.sin(player.dir)*4), fz=Math.round(player.pos.z+Math.cos(player.dir)*4);
      if(validPlacement(dragStation,fx,fz)){
        dragStation.x=fx; dragStation.z=fz; dragStation.mesh.position.set(fx,0,fz);
        dragStation=null; placeGhost.visible=false; updateStationVisuals();
      } else {
        playSound('error');
      }
    } else {
      const t=getClosest();
      if(t){ 
          if(t.type === 'robot') {
              const roles=['busser','chef','waiter'];
              const idx=(roles.indexOf(t.role)+1)%roles.length;
              t.role=roles[idx]; t.state='idle'; t.holding=null;
              
              const rIdx = parseInt(t.id.replace('robot', ''));
              if(upg.robots && upg.robots[rIdx]) upg.robots[rIdx].role = t.role;
              saveGame();

              stGrp.remove(t.mesh); t.mesh=buildRobot(t.role); t.mesh.position.set(t.pos.x,0,t.pos.z); stGrp.add(t.mesh);
              const tt=document.getElementById('role-tooltip');
              tt.textContent=`${t.role==='chef'?'👨‍🍳':t.role==='waiter'?'🛎️':'🧹'} Robot set to ${t.role.toUpperCase()}`;
              tt.style.display='block'; setTimeout(()=>tt.style.display='none', 1800);
          } else {
              dragStation=t; dragOrigPos={x:t.x,z:t.z}; placeGhost.scale.set(t.w+.5,1,t.d+.5); 
          }
      }
    }
    return;
  }
  
  if(gameState!=='playing') return;

  const t=getClosest(); if(!t) return;
  const type=t.type; let ok=false;

  // ── SEAFOOD PLAYER ACTIONS ─────────────────────────────────
  if(isSeafood()){
    if(type==='cooler' && !player.holding){
      player.holding='raw_fish'; ok=true;
    }
    else if(type==='beachgrill'){
      if(player.holding==='raw_fish'){
        const i=t.slots.indexOf(null);
        if(i!==-1){ t.slots[i]={state:'raw_fish',progress:0,burnTimer:0}; player.holding=null; ok=true; }
      } else if(!player.holding){
        const ci=t.slots.findIndex(s=>s&&s.state==='charred_fish');
        if(ci!==-1){ player.holding='charred_fish'; t.slots[ci]=null; ok=true; }
        else {
          const ci2=t.slots.findIndex(s=>s&&s.state==='cooked_fish');
          if(ci2!==-1){ player.holding='cooked_fish'; t.slots[ci2]=null; ok=true; }
        }
      }
    }
    else if(type==='assembly'){
      // cooked fish → taco. Also acts as staging counter.
      if(player.holding==='cooked_fish' && !t.item){
        t.item='fish_taco'; player.holding=null; ok=true; playSound('sizzle');
      } else if(!player.holding && t.item){
        player.holding=t.item; t.item=null; ok=true;
      } else if(player.holding && player.holding!=='cooked_fish' && !t.item){
        t.item=player.holding; player.holding=null; ok=true;
      }
    }
    else if(type==='chowderpot'){
      if(!player.holding){ player.holding='chowder'; ok=true; playSound('sizzle'); }
    }
    else if(type==='lemonadestation'){
      if(!player.holding){ player.holding='lemonade'; ok=true; playSound('sizzle'); }
    }
    else if(type==='basketrack'){
      if(player.holding==='basket'){ player.holding=null; t.cleanBaskets++; ok=true; }
      else if(!player.holding && t.cleanBaskets>0){ player.holding='basket'; t.cleanBaskets--; ok=true; }
      // Smart basket assembly: if holding food item, auto-grab a basket and combine
      else if(player.holding==='fish_taco' && t.cleanBaskets>0){ player.holding='taco_in_basket'; t.cleanBaskets--; ok=true; }
      else if(player.holding==='chowder' && t.cleanBaskets>0){ player.holding='chowder_in_basket'; t.cleanBaskets--; ok=true; }
      else if(player.holding==='lemonade' && t.cleanBaskets>0){ player.holding='lemonade_in_basket'; t.cleanBaskets--; ok=true; }
      // Combine two items already in basket
      else if(player.holding==='taco_in_basket' && t.item==='chowder'){ player.holding='taco_chowder_basket'; t.item=null; ok=true; }
      else if(player.holding==='taco_in_basket' && t.item==='lemonade'){ player.holding='taco_lemonade_basket'; t.item=null; ok=true; }
    }
    else if(type==='sink'){
      if(player.holding==='dirty_basket'){ startSinkHold(t); return; }
    }
    else if(type==='trash'){
      const seafoodWaste=['raw_fish','cooked_fish','charred_fish','fish_taco','chowder','lemonade','basket','taco_in_basket','chowder_in_basket','lemonade_in_basket'];
      if(t.contents>=4 && !player.holding){ player.holding='trash_bag'; t.contents=0; ok=true; }
      else if(seafoodWaste.includes(player.holding) && t.contents<4){
        player.holding=player.holding.includes('basket')?'basket':null; t.contents++; ok=true; playSound('error');
      }
    }
    else if(type==='dumpster'){
      if(player.holding==='trash_bag'){ player.holding=null; ok=true; playSound('dump'); }
    }
    if(ok){ updateHolding(); updateStationVisuals(); }
    return;
  }

  // ── BURGER PLAYER ACTIONS ──────────────────────────────────
  if(type==='fridge'&&!player.holding){ player.holding='raw'; ok=true; }
  if(type==='sink'){ 
    if(player.holding==='dirty_tray'){
      // Sink now requires 3-second hold — handled in action-hold logic, not instant
      startSinkHold(t);
      return; // don't set ok=true here; handled async
    }
  }
  else if(type==='trayrack'){
    if(player.holding==='tray'){ player.holding=null; t.cleanTrays++; ok=true; }
    else if(!player.holding && t.cleanTrays > 0){ player.holding='tray'; t.cleanTrays--; ok=true; }
    else if(player.holding==='cooked' && t.cleanTrays > 0){ player.holding='burger_on_tray'; t.cleanTrays--; ok=true; }
    else if(player.holding==='fries' && t.cleanTrays > 0){ player.holding='fries_on_tray'; t.cleanTrays--; ok=true; }
  }
  else if(type==='fryer'){
    if(!player.holding){
      const bi=t.slots.findIndex(s=>s&&s.state==='burnt_fries');
      if(bi!==-1){ player.holding='burnt_fries'; t.slots[bi]=null; ok=true; }
      else {
        const ci=t.slots.findIndex(s=>s&&s.state==='fries');
        if(ci!==-1){ player.holding='fries'; t.slots[ci]=null; ok=true; }
        else { const fi=t.slots.indexOf(null); if(fi!==-1){ t.slots[fi]={state:'raw_fries',progress:0,burnTimer:0}; ok=true; playSound('sizzle'); } }
      }
    }
    else if(player.holding==='tray'){
      const ci=t.slots.findIndex(s=>s&&s.state==='fries');
      if(ci!==-1){ player.holding='fries_on_tray'; t.slots[ci]=null; ok=true; }
    }
  }
  else if(type==='sodafountain'){
    if(player.holding==='tray'){ player.holding='soda_on_tray'; ok=true; playSound('sizzle'); }
    else if(player.holding==='burger_on_tray'){ player.holding='burger_soda_on_tray'; ok=true; playSound('sizzle'); }
  }
  else if(type==='grill'){
    if(player.holding==='raw'){ 
      const i=t.slots.indexOf(null); 
      if(i!==-1){ t.slots[i]={state:'raw',progress:0, burnTimer:0}; player.holding=null; ok=true; } 
    }
    else if(!player.holding){ 
      const cIdx=t.slots.findIndex(s=>s&&(s.state==='charred'));
      if(cIdx !== -1) { player.holding='charred'; t.slots[cIdx]=null; ok=true; }
      else {
        const i=t.slots.findIndex(s=>s&&(s.state==='cooked')); 
        if(i!==-1){ player.holding='cooked'; t.slots[i]=null; ok=true; } 
      }
    }
    else if(player.holding==='tray'){
      const i=t.slots.findIndex(s=>s&&(s.state==='cooked')); 
      if(i!==-1){ player.holding='burger_on_tray'; t.slots[i]=null; ok=true; } 
    }
    else if(player.holding==='soda_on_tray'){
      const i=t.slots.findIndex(s=>s&&(s.state==='cooked')); 
      if(i!==-1){ player.holding='burger_soda_on_tray'; t.slots[i]=null; ok=true; } 
    }
  }
  else if(type==='trash'){
    if(t.contents >= 4 && !player.holding) {
       player.holding = 'trash_bag'; t.contents = 0; ok=true;
    } else if (player.holding==='raw'||player.holding==='cooked'||player.holding==='charred'||player.holding==='burger_on_tray'||player.holding==='burger_soda_on_tray'||player.holding==='soda_on_tray'||player.holding==='raw_fries'||player.holding==='fries'||player.holding==='burnt_fries'||player.holding==='fries_on_tray'){
       if(t.contents < 4) {
          player.holding = (player.holding.includes('tray') ? 'tray' : null);
          t.contents++; ok=true; playSound('error');
       } else {
          playSound('error'); 
       }
    }
  }
  else if(type==='dumpster'){
    if(player.holding==='trash_bag'){ player.holding=null; ok=true; playSound('dump'); }
  }
  else if(type==='counter'){
    if(!t.item && player.holding){ t.item=player.holding; player.holding=null; ok=true; }
    else if(t.item && !player.holding){ player.holding=t.item; t.item=null; ok=true; }
    
    // Quick-Assembly Combos on Counter
    else if(t.item==='tray' && player.holding==='cooked'){ t.item=null; player.holding='burger_on_tray'; ok=true; }
    else if(t.item==='cooked' && player.holding==='tray'){ t.item=null; player.holding='burger_on_tray'; ok=true; }
    
    else if(t.item==='burger_on_tray' && player.holding==='soda_on_tray'){ t.item=null; player.holding='burger_soda_on_tray'; ok=true; }
    else if(t.item==='soda_on_tray' && player.holding==='burger_on_tray'){ t.item=null; player.holding='burger_soda_on_tray'; ok=true; }
    
    else if(t.item==='soda_on_tray' && player.holding==='cooked'){ t.item=null; player.holding='burger_soda_on_tray'; ok=true; }
    else if(t.item==='cooked' && player.holding==='soda_on_tray'){ t.item=null; player.holding='burger_soda_on_tray'; ok=true; }

    // Fries onto a tray
    else if(t.item==='tray' && player.holding==='fries'){ t.item=null; player.holding='fries_on_tray'; ok=true; }
    else if(t.item==='fries' && player.holding==='tray'){ t.item=null; player.holding='fries_on_tray'; ok=true; }
  }
  else if(type==='table'){
    const seafoodItems=['taco_in_basket','chowder_in_basket','lemonade_in_basket','taco_chowder_basket','taco_lemonade_basket'];
    const heldIsFood = isSeafood()
      ? seafoodItems.includes(player.holding)
      : player.holding && (player.holding.includes('burger') || player.holding.includes('soda') || player.holding.includes('fries'));
    if(player.holding && heldIsFood && t.group && t.group.state==='ordering'){
      if(serveHeldToGroup(t, player.holding)){ player.holding=null; ok=true; }
      else {
        // Bringing the wrong plate to a table used to do nothing at all -- no
        // sound, no message -- which is why "why didn't it serve?" was the most
        // common confusion. Say so out loud.
        playSound('error');
        spawnFloater(new THREE.Vector3(t.x, 2.4, t.z), 'Nobody ordered that!', '#EF5350');
      }
    } else if(!player.holding && t.dirtyTrays>0){
      player.holding = isSeafood() ? 'dirty_basket' : 'dirty_tray';
      t.dirtyTrays--; ok=true;
    }
  }

  if(ok){ updateHolding(); updateStationVisuals(); }
}

// ─────────────────────────────────────────────────────────────
//  SINK HOLD-TO-WASH (3 seconds)
// ─────────────────────────────────────────────────────────────
let sinkHoldTarget=null, sinkHoldProgress=0, sinkHoldActive=false;
const SINK_HOLD_TIME = 3.0; // seconds

function startSinkHold(t){
  sinkHoldTarget = t;
  sinkHoldProgress = 0;
  sinkHoldActive = true;
  document.getElementById('sink-hold-ui').style.display='flex';
  document.getElementById('sink-hold-fill').style.width='0%';
}

function cancelSinkHold(){
  sinkHoldActive = false;
  sinkHoldTarget = null;
  sinkHoldProgress = 0;
  document.getElementById('sink-hold-ui').style.display='none';
  document.getElementById('sink-hold-fill').style.width='0%';
}

function updateSinkHold(ds){
  if(!sinkHoldActive) return;
  // Check player is still at the sink
  const t = getClosest();
  if(!t || t !== sinkHoldTarget || (player.holding !== 'dirty_tray' && player.holding !== 'dirty_basket')){
    cancelSinkHold(); return;
  }
  sinkHoldProgress += ds / 60; // ds is in frames; TARGET=1/60
  const pct = Math.min(1, sinkHoldProgress / SINK_HOLD_TIME);
  document.getElementById('sink-hold-fill').style.width=(pct*100)+'%';
  if(pct >= 1){
    if(player.holding==='dirty_basket'){
      player.holding='basket';
      showToast('🧺 Basket cleaned!', 1200);
    } else {
      player.holding='tray';
      showToast('🍽️ Tray washed!', 1200);
    }
    playSound('sizzle');
    updateHolding(); updateStationVisuals();
    cancelSinkHold();
  }
}

