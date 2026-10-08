// Burger Bar — 10-customers. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  CUSTOMERS
// ─────────────────────────────────────────────────────────────
// groups declared above cleanupGameScene
function doorX(){ return (baseBounds.l+baseBounds.r)/2; }

function spawnGroup(){
  // Staggered so each new customer type is learned on its own. VIPs and heavy
  // groups both used to appear on Day 10, the same day simultaneous arrivals
  // began -- three new mechanics in a single shift.
  let type = 'normal';
  {
    const r = Math.random();
    const vip = heatVipChance();
    if(eco.day >= 8 && r < vip) type = 'vip';
    else if(eco.day >= 12 && r >= vip && r < vip + 0.15) type = 'heavy';
  }

  const lesson = tutorialWantsSimpleGuest();   // the tutorial's one plain-burger guest
  if(lesson) type = 'normal';
  const size = lesson || type === 'heavy' ? 1 : (Math.random()>.55?2:1);
  const sx = doorX()+(Math.random()-.5)*2, sz = bounds.b+12;
  
  // Past the day-length cap, customers get gradually less forgiving. This is
  // what replaces "more groups" as the late-game difficulty lever (floor 0.7x).
  const lateSqueeze = Math.max(0.7, 1 - Math.max(0, eco.day - 28) * 0.005);
  const dpm = diffPatienceMult() * lateSqueeze * heatPatienceMult();
  const g = {
    id:Math.random(), size, type, state:'approach_door', stoodUp: false,
    waitPatience: 1800 * upg.patienceMult * dpm * (type==='vip'?0.5:1.0),
    maxWait: 1800 * upg.patienceMult * dpm * (type==='vip'?0.5:1.0),
    foodPatience: size * 1300 * upg.patienceMult * dpm,
    maxFood: size * 1300 * upg.patienceMult * dpm,
    eatTimer:0, pos:new THREE.Vector3(sx,0,sz), target:new THREE.Vector3(sx,0,sz),
    mesh:new THREE.Group(), wobble:0, 
    orders: [], unservedOrders: [], heavyCount: type === 'heavy' ? 3 : 1
  };

  for(let i=0; i<size; i++) {
     let orderType;
     {
       orderType = 'burger_on_tray';
       if(lesson) {}
       else if(menuFriesActive() && Math.random() < 0.22) {
         orderType = 'fries_on_tray';
       } else if(menuComboActive()) {
         const r = Math.random();
         if(r < 0.25) orderType = 'soda_on_tray';
         else if(r < 0.70) orderType = 'burger_soda_on_tray';
       }
     }
     g.orders.push(orderType);
  }
  g.unservedOrders = [...g.orders];
  g.servedMask = g.orders.map(()=>false); // per-seat served state (aligned to orders)

  for(let i=0;i<size;i++){
    const m=personModel(randomLook(type === 'vip'));
    if(type === 'heavy') m.scale.set(1.3, 1.05, 1.3);
    m.position.set(i*1.7-(size>1?.85:0),0,i*.4); g.mesh.add(m);
  }
  scene.add(g.mesh); groups.push(g);
  stats.groupsLeft--; document.getElementById('day-sub').textContent=`Customers: ${stats.groupsLeft}`;
}

function moveToTarget(g,scale){
  const spd=.08*scale;
  const dx=g.target.x-g.pos.x, dz=g.target.z-g.pos.z;
  const dist=Math.sqrt(dx*dx+dz*dz);
  if(dist<.22){ g.wobble=0; g.mesh.position.y=0; return true; }
  g.pos.x+=dx/dist*spd; g.pos.z+=dz/dist*spd;
  g.mesh.position.set(g.pos.x, Math.abs(Math.sin(g.wobble))*.18, g.pos.z);
  g.wobble+=.18*scale;
  const ta=Math.atan2(dx,dz); let df=ta-g.mesh.rotation.y;
  while(df<-Math.PI)df+=Math.PI*2; while(df>Math.PI)df-=Math.PI*2;
  g.mesh.rotation.y+=df*.2; return false;
}

// ── Customer models ─────────────────────────────────────────────────────────
// Built from a handful of parts and baked per look (shirt, skin, hair), so a
// full dining room costs a few draw calls per guest rather than a dozen.
const CUST_SHIRTS = ['#e91e63','#ff9800','#00acc1','#43a047','#7e57c2','#1e88e5','#f4511e','#00897b'];
const CUST_SKINS  = ['#ffd7b8','#f1c09a','#c98e62','#8d5a3b','#5c3a24'];
const CUST_HAIR   = ['#2b1d14','#5a3a22','#a0522d','#e2b65c','#1c1c1c','#9e9e9e'];
const CUST_PANTS  = ['#37474f','#3949ab','#5d4037','#455a64'];
function personModel(look){
  const key = 'cust|' + [look.shirt, look.skin, look.hair, look.hairC, look.pants, look.vip?1:0].join('|');
  return bake(key, ()=>{
    const g = new THREE.Group();
    const vip = look.vip;
    const shirt = vip ? MP('#1f2227',70) : M(CUST_SHIRTS[look.shirt]);
    const skin  = M(CUST_SKINS[look.skin]);
    const hairM = M(CUST_HAIR[look.hairC]);
    const pants = vip ? M('#1f2227') : M(CUST_PANTS[look.pants]);
    for(const lx of [-.17,.17]){
      addMesh(g, GCap(.15,.45), pants, lx,.38,0);
      addMesh(g, GRBox(.26,.12,.38,.05), M('#2a2a2a'), lx,.06,.06, 0,0,0,false);     // shoes
    }
    addMesh(g, GRBox(.86,.88,.56,.24), shirt, 0,1.12,0);                              // torso
    if(vip){
      addMesh(g, GCone(.2,.42,3), M('#fafafa'), 0,1.38,.27, Math.PI,0,0,false);       // shirt V
      addMesh(g, GRBox(.09,.38,.03,.02), M('#ffca28'), 0,1.25,.3, 0,0,0,false);       // gold tie
    } else {
      addMesh(g, GRBox(.46,.08,.03,.02), M('#ffffff'), 0,1.38,.285, 0,0,0,false);     // collar
    }
    for(const ax of [-.52,.52]){
      addMesh(g, GCap(.12,.5), shirt, ax,1.08,.02, 0,0,ax*.12);
      addMesh(g, GSph(.12,8), skin, ax*1.04,.74,.04, 0,0,0,false);
    }
    addMesh(g, GCyl(.14,.16,10), skin, 0,1.6,0, 0,0,0,false);                         // neck
    addMesh(g, GSph(.42,16), skin, 0,1.95,0).scale.set(.95,1,.95);                    // head
    for(const ex of [-.14,.14]) addMesh(g, GSphS(.055,8,6), M('#1b1b1b'), ex,2.0,.37, 0,0,0,false);
    addMesh(g, GBox(.16,.035,.03), M('#7b3b2e'), 0,1.82,.39, 0,0,0,false);           // smile
    for(const ex of [-.43,.43]) addMesh(g, GSph(.08,6), skin, ex,1.96,0, 0,0,0,false); // ears
    // Hair: 0 short, 1 bun, 2 long, 3 cap
    const cap = cachedGeo('haircap', ()=>new THREE.SphereGeometry(.45,16,8,0,Math.PI*2,0,Math.PI*.52));
    if(look.hair === 3 && !vip){
      addMesh(g, cap, M(CUST_SHIRTS[(look.shirt+3)%CUST_SHIRTS.length]), 0,2.0,0, -.12,0,0);
      addMesh(g, GRBox(.5,.05,.4,.02), M(CUST_SHIRTS[(look.shirt+3)%CUST_SHIRTS.length]), 0,2.12,.42, 0,0,0,false);
    } else {
      addMesh(g, cap, hairM, 0,1.99,-.02, -.18,0,0);
      if(look.hair === 1 && !vip) addMesh(g, GSph(.2,10), hairM, 0,2.25,-.32);
      if(look.hair === 2 && !vip) addMesh(g, GRBox(.78,.75,.24,.12), hairM, 0,1.72,-.28);
    }
    if(vip) addMesh(g, GRBox(.62,.13,.06,.05), MP('#0d0d0d',150), 0,2.02,.38, 0,0,0,false); // shades
    return g;
  });
}
// A fixed, deterministic cast: varied enough to read as a crowd, and it caps the
// bake cache at 27 looks however long the session runs.
const LOOK_POOL = (()=>{
  const r = _rng(2026), pick = n => Math.floor(r()*n), out = [];
  for(let i=0;i<24;i++) out.push({ shirt:i%CUST_SHIRTS.length, skin:pick(CUST_SKINS.length), hair:i%4,
    hairC:pick(CUST_HAIR.length), pants:pick(CUST_PANTS.length), vip:false });
  for(let i=0;i<3;i++) out.push({ shirt:0, skin:(i*2)%CUST_SKINS.length, hair:0, hairC:i, pants:0, vip:true });
  return out;
})();
// Bake every look and item up front (behind the splash screen), so the first
// VIP or first combo of a shift never stalls a frame while it is built.
function prewarmModels(){
  LOOK_POOL.forEach(personModel);
  ['raw','cooked','charred','soda','tray','dirty_tray','soda_on_tray','burger_on_tray','burger_soda_on_tray',
   'trash_bag','raw_fries','fries','burnt_fries','fries_on_tray'].forEach(itemMesh);
}
function randomLook(vip){
  return vip ? LOOK_POOL[24 + Math.floor(Math.random()*3)] : LOOK_POOL[Math.floor(Math.random()*24)];
}

// ─────────────────────────────────────────────────────────────
//  STATION VISUALS
// ─────────────────────────────────────────────────────────────
// What a station's item visuals depend on, as a string. Robots and the player
// call updateStationVisuals() on almost every action, and it used to tear down
// and rebuild the items on EVERY station each time; now only stations whose
// signature changed are rebuilt.
function stationVisualSig(s){
  switch(s.type){
    case 'grill': case 'fryer':
      return s.slots ? s.slots.map(sl=>sl?sl.state:'-').join(',') : '';
    case 'counter': return s.item || '';
    case 'trayrack': case 'sink': return String(Math.min(s.cleanTrays||0, 15));
    case 'table': {
      if(s.served>0){
        const g=s.group;
        return 's'+s.served+'|'+(g ? g.orders.join(',')+'|'+(g.servedMask||[]).join(',') : '');
      }
      return 'd'+(s.dirtyTrays||0);
    }
    default: return '';
  }
}
function updateStationVisuals(force){
  for(const k in stations){
    const s=stations[k];
    // Position is part of the signature: edit mode moves stations.
    const sig = stationVisualSig(s) + '@' + s.x + ',' + s.z;
    if(!force && s._visSig === sig) continue;
    s._visSig = sig;
    s.visuals.forEach(v=>discard(scene, v)); s.visuals=[];
    const gY=3.1, cY=3.0, tY=2.2;
    if(s.type==='grill'&&s.slots) s.slots.forEach((sl,i)=>{
      if(!sl) return;
      const m=itemMesh(sl.state); m.position.set(s.x-0.8+i*1.6, gY, s.z + 0.2); scene.add(m); s.visuals.push(m);
    });
    if(s.type==='fryer'&&s.slots) s.slots.forEach((sl,i)=>{
      if(!sl) return;
      const m=itemMesh(sl.state); m.position.set(s.x-0.8+i*1.6, gY, s.z + 0.2); scene.add(m); s.visuals.push(m);
    });
    if(s.type==='counter' && s.item) {
      const m=itemMesh(s.item); m.position.set(s.x, cY, s.z); scene.add(m); s.visuals.push(m);
    }
    if(s.type==='trayrack') for(let i=0;i<Math.min(s.cleanTrays, 15);i++){
      const p=itemMesh('tray'); p.position.set(s.x, 2.95+i*.12, s.z); scene.add(p); s.visuals.push(p);
    }
    if(s.type==='sink') for(let i=0;i<Math.min(s.cleanTrays, 15);i++){
      const p=itemMesh('tray'); p.position.set(s.x + 0.6, 3.1+i*.12, s.z - 0.6); scene.add(p); s.visuals.push(p);
    }
    if(s.type==='table'){
      if(s.served>0){
        // Show a plate for each SERVED seat (its actual order), so the food on
        // the table matches who has been served — not just a left-to-right count.
        const mask = s.group && s.group.servedMask;
        let shown=0;
        const seats = s.group ? s.group.orders.length : s.served;
        for(let i=0;i<seats;i++){
          const served = mask ? mask[i] : (i < s.served);
          if(!served) continue;
          const itemName = (s.group && s.group.orders[i]) ? s.group.orders[i] : 'burger_on_tray';
          const m=itemMesh(itemName); m.position.set(s.x-.9+shown*1.8, tY, s.z); scene.add(m); s.visuals.push(m);
          shown++;
        }
      } else if(s.dirtyTrays>0) for(let i=0;i<s.dirtyTrays;i++){
        const m=itemMesh('dirty_tray'); m.position.set(s.x-.9+i*1.8, tY, s.z); scene.add(m); s.visuals.push(m);
      }
    }
  }
}

