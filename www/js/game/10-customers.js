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

  const size = type === 'heavy' ? 1 : (Math.random()>.55?2:1);
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
     if(isSeafood()){
       // Seafood Shack orders
       const r = Math.random();
       if(r < 0.35)      orderType = 'taco_in_basket';
       else if(r < 0.55) orderType = 'chowder_in_basket';
       else if(r < 0.70) orderType = 'lemonade_in_basket';
       else if(r < 0.85) orderType = 'taco_chowder_basket';
       else              orderType = 'taco_lemonade_basket';
     } else {
       orderType = 'burger_on_tray';
       if(menuFriesActive() && Math.random() < 0.22) {
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
    const m=new THREE.Group();
    const c = type === 'vip' ? custColors[5] : custColors[Math.floor(Math.random()*(custColors.length-1))];
    addMesh(m, GCyl(.55,1.35,12), c, 0,.68,0);
    addMesh(m, GSph(.48,10), matSkin, 0,1.55,0);
    if(type === 'heavy') m.scale.set(1.4, 1.0, 1.4);
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

// ─────────────────────────────────────────────────────────────
//  STATION VISUALS
// ─────────────────────────────────────────────────────────────
// What a station's item visuals depend on, as a string. Robots and the player
// call updateStationVisuals() on almost every action, and it used to tear down
// and rebuild the items on EVERY station each time; now only stations whose
// signature changed are rebuilt.
function stationVisualSig(s){
  switch(s.type){
    case 'grill': case 'fryer': case 'beachgrill':
      return s.slots ? s.slots.map(sl=>sl?sl.state:'-').join(',') : '';
    case 'counter': case 'assembly': return s.item || '';
    case 'trayrack': case 'sink': return String(Math.min(s.cleanTrays||0, 15));
    case 'basketrack': return String(Math.min(s.cleanBaskets||0, 8));
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
          const itemName = (s.group && s.group.orders[i]) ? s.group.orders[i] : (isSeafood()?'taco_in_basket':'burger_on_tray');
          const m=itemMesh(itemName); m.position.set(s.x-.9+shown*1.8, tY, s.z); scene.add(m); s.visuals.push(m);
          shown++;
        }
      } else if(s.dirtyTrays>0) for(let i=0;i<s.dirtyTrays;i++){
        const m=itemMesh(isSeafood()?'dirty_basket':'dirty_tray'); m.position.set(s.x-.9+i*1.8, tY, s.z); scene.add(m); s.visuals.push(m);
      }
    }
    // Seafood station visuals
    if(s.type==='beachgrill'&&s.slots) s.slots.forEach((sl,i)=>{
      if(!sl) return;
      const m=itemMesh(sl.state==='cooked'?'cooked_fish':sl.state==='charred_fish'?'charred_fish':'raw_fish');
      m.position.set(s.x-0.6+i*1.2, gY, s.z+0.2); scene.add(m); s.visuals.push(m);
    });
    if(s.type==='assembly' && s.item){ const m=itemMesh(s.item); m.position.set(s.x,cY,s.z); scene.add(m); s.visuals.push(m); }
    if(s.type==='basketrack') for(let i=0;i<Math.min(s.cleanBaskets,8);i++){
      const p=itemMesh('basket'); p.position.set(s.x,2.95+i*.1,s.z); scene.add(p); s.visuals.push(p);
    }
  }
}

