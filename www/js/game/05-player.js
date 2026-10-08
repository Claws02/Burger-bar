// Burger Bar — 05-player. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  PLAYER
// ─────────────────────────────────────────────────────────────
const player={pos:new THREE.Vector3(0,0,0), dir:0, radius:.85, speed:.15, holding:null, wobble:0};
const pMesh=new THREE.Group(); scene.add(pMesh);

// The player mesh is rebuilt from the shared character definition whenever the
// character or skin changes, so what you pick on the Home Screen is exactly
// what you play as. `let` (not const) because rebuildPlayerMesh() reassigns them.
let pBody=null, pHead=null, pHatRim=null, pHatBody=null, pHatTop=null, pCharGroup=null;
function rebuildPlayerMesh(){
  if(pCharGroup){ pMesh.remove(pCharGroup); disposeObj(pCharGroup); pCharGroup = null; }
  const parts = buildCharacter((cosm.character || 'human'), getActiveSkin());
  pCharGroup = parts.group;
  pMesh.add(pCharGroup);
  pBody = parts.body; pHead = parts.head;
  pHatRim  = parts.hat ? parts.hat.rim  : null;
  pHatBody = parts.hat ? parts.hat.body : null;
  pHatTop  = parts.hat ? parts.hat.top  : null;
  if(upg && upg.burgerCrown) applyCrown();
  applySkates();
  // The held item hangs off pMesh, not the character, so it survives a rebuild.
  if(typeof updateHolding === 'function' && player && player.holding) updateHolding();
}

// Roller Skates upgrade, worn on the character's feet; flashier with each level.
let pSkates = null;
function applySkates(){
  if(pSkates){ pMesh.remove(pSkates); pSkates = null; }
  const lv = (upg && upg.speedLv) || 0;
  if(lv <= 0) return;
  const t = lv >= 5 ? 2 : lv >= 3 ? 1 : 0;
  pSkates = bake('skates|'+t, ()=>{
    const g = new THREE.Group();
    const boot = t===2 ? MP('#ffca28',140) : t===1 ? M('#1e88e5') : M('#e53935');
    const wheel = t===0 ? M('#fafafa') : ME(t===2 ? '#fff176' : '#18ffff');
    for(const fx of [-.25,.25]){
      addMesh(g, GRBox(.32,.14,.6,.06), boot, fx,.17,.05);
      addMesh(g, GBox(.08,.04,.56), MP('#9e9e9e',90), fx,.09,.05, 0,0,0,false);
      for(const wz of [-.18,.28]) addMesh(g, GCyl(.075,.09,12), wheel, fx,.075,wz, 0,0,Math.PI/2,false);
    }
    return g;
  });
  pMesh.add(pSkates);
}
function applyCrown(){
  if(!upg.burgerCrown) return;
  if(pHatBody) pHatBody.material = M('#FFD700');
  if(pHatTop)  pHatTop.material  = M('#FFC107');
  if(pHatRim)  pHatRim.material  = M('#FFA000');
}

let heldMesh=null;
function updateHolding(){
  if(heldMesh){ pMesh.remove(heldMesh); heldMesh=null; }
  if(player.holding){ heldMesh=itemMesh(player.holding); heldMesh.position.set(0,1.5,1.1); pMesh.add(heldMesh); }
}

const hlRing=new THREE.Mesh(new THREE.TorusGeometry(1.4,.18,8,24), MB(0xffff00));
hlRing.rotation.x=-Math.PI/2; hlRing.position.y=.12; hlRing.visible=false; scene.add(hlRing);
const placeGhost=new THREE.Mesh(GBox(1,.18,1), new THREE.MeshBasicMaterial({color:0x00ff00,transparent:true,opacity:.55}));
placeGhost.visible=false; scene.add(placeGhost);
const gridH=new THREE.GridHelper(80,40,0x444,0x555);
gridH.position.y=.16; gridH.material.opacity=.14; gridH.material.transparent=true; gridH.visible=false; scene.add(gridH);

// ─────────────────────────────────────────────────────────────
//  COLLISION
// ─────────────────────────────────────────────────────────────
function seg(nx,nz,pR,x1,x2,z1,z2){ return nx>x1-pR&&nx<x2+pR&&nz>z1-pR&&nz<z2+pR; }

function checkColl(nx,nz,skip=null){
  const pR = skip && skip.includes('robot') ? 0.0 : player.radius;
  const wt = .55, b = bounds;

  if(nx<b.l-18||nx>b.r+18||nz<b.t-5||nz>b.b+30) return true;

  for(const e of collEdges) {
    let hw = 2.5; 
    let cx = (e.min + e.max) / 2;
    if(e.axis === 'x') {
       if(seg(nx, nz, pR, e.min, e.max, e.fixed - wt/2, e.fixed + wt/2)) {
          if(e.type === 'solid') return true;
          if(nx < cx - hw + pR || nx > cx + hw - pR) return true;
       }
    } else {
       if(seg(nx, nz, pR, e.fixed - wt/2, e.fixed + wt/2, e.min, e.max)) {
          if(e.type === 'solid') return true;
          if(nz < cx - hw + pR || nz > cx + hw - pR) return true;
       }
    }
  }

  for(const key in stations){
    const s=stations[key]; 
    if(skip&&s.id===skip) continue;
    if(s.type==='robot') continue;
    if(s.type==='table'){
      if(Math.sqrt((nx-s.x)**2+(nz-s.z)**2)<pR+s.r) return true;
    } else {
      if(nx>s.x-s.w/2-pR&&nx<s.x+s.w/2+pR&&nz>s.z-s.d/2-pR&&nz<s.z+s.d/2+pR) return true;
    }
  }
  return false;
}

function validPlacement(st,nx,nz){
  const l=nx-st.w/2, r=nx+st.w/2, t=nz-st.d/2, bt=nz+st.d/2;
  const b=bounds;
  
  if(l < b.l+0.5 || r > b.r-0.5 || t < b.t+0.5 || bt > b.b-0.5) return false;

  for(const key in stations){
    const s2=stations[key]; if(s2.id===st.id) continue;
    if(s2.type==='robot') continue;
    if(s2.type==='table'){
      if(Math.sqrt((nx-s2.x)**2+(nz-s2.z)**2)<s2.r+Math.max(st.w,st.d)/2+.5) return false;
    } else {
      if(!(r<=s2.x-s2.w/2||l>=s2.x+s2.w/2||bt<=s2.z-s2.d/2||t>=s2.z+s2.d/2)) return false;
    }
  }
  return true;
}

function getClosest(){
  const ax=player.pos.x+Math.sin(player.dir)*3.2;
  const az=player.pos.z+Math.cos(player.dir)*3.2;
  let best=null, bestD=5.0;
  for(const key in stations){
    const s=stations[key];
    if(dragStation&&s.id===dragStation.id) continue;
    if(s.type==='robot' && gameState !== 'edit') continue; 
    let d;
    if(s.type==='robot') d=Math.sqrt((ax-s.pos.x)**2+(az-s.pos.z)**2);
    else d=Math.sqrt((ax-s.x)**2+(az-s.z)**2);
    
    if(s.type==='table') d-=s.r*.4;
    if(d<bestD){ bestD=d; best=s; }
  }
  return best;
}

function freeSpot(){
  const b=bounds;
  for(let z=b.t+2;z<b.b-2;z+=2) {
    for(let x=b.l+2;x<b.r-2;x+=2) {
      let ok=true;
      for(const k in stations){ 
         const s=stations[k]; 
         const dist = Math.sqrt((x-(s.pos?s.pos.x:s.x))**2+(z-(s.pos?s.pos.z:s.z))**2);
         if(dist < 3.5) { ok=false; break; } 
      }
      if(ok&&!checkColl(x,z)) return {x,z};
    }
  }
  return null; 
}

function getValidSpawn(){
  const cx=Math.round((baseBounds.l+baseBounds.r)/2);
  const cz=Math.round((baseBounds.t+baseBounds.b)/2);
  for(let r=0;r<20;r+=2) for(let dx=-r;dx<=r;dx+=2) for(let dz=-r;dz<=r;dz+=2){
    const tx=cx+dx, tz=cz+dz;
    let overlap = false;
    for(const k in stations) {
       const s = stations[k];
       if(s.type === 'robot' && s.pos) {
          if(Math.sqrt((tx-s.pos.x)**2 + (tz-s.pos.z)**2) < 2.0) { overlap = true; break; }
       }
    }
    if(!checkColl(tx,tz,null) && !overlap) return new THREE.Vector3(tx,0,tz);
  }
  return new THREE.Vector3(cx,0,cz);
}

