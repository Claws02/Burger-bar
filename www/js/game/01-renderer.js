// Burger Bar — 01-renderer. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  RENDERER + SCENE
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// ── WebGL context-loss handling ──
// On mobile, backgrounding the tab can drop the GL context, leaving a black
// screen. Prevent the default (which blocks restoration) and rebuild the
// scene's static geometry when the context comes back.
canvas.addEventListener('webglcontextlost', (e)=>{
  e.preventDefault();
  gamePaused = true;
}, false);
canvas.addEventListener('webglcontextrestored', ()=>{
  try {
    buildWorld(); buildRoom();
    for(const k in stations){
      const s = stations[k];
      if(s.mesh){ stGrp.add(s.mesh); }
    }
    updateStationVisuals();
    // Only auto-resume if we're not sitting on the pause screen
    if(document.getElementById('pause-screen').style.display !== 'flex') gamePaused = false;
  } catch(err){ console.warn('Context restore failed', err); }
}, false);

// Auto-pause an in-progress day when the tab is hidden, so backgrounding the
// game doesn't burn through customer patience while the player can't act.
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && gameState === 'playing' && !gamePaused) togglePause();
});

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87CEEB'); 
scene.fog = new THREE.Fog('#87CEEB', 50, 110);

let frustumSize = 26;
const camera = new THREE.OrthographicCamera(1,1,1,1,1,1000);
camera.position.set(0,38,38); camera.lookAt(0,0,0);

function resize(){
  const a = window.innerWidth/window.innerHeight;
  let f = a<1 ? frustumSize/a : frustumSize;
  camera.left=-f*a/2; camera.right=f*a/2; camera.top=f/2; camera.bottom=-f/2;
  camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(25,50,25); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
sun.shadow.bias=-0.001; scene.add(sun);
const fillLight = new THREE.DirectionalLight(0x88bbff, 0.2);
fillLight.position.set(-15,20,-10); scene.add(fillLight);

// ─────────────────────────────────────────────────────────────
//  MATERIALS
// ─────────────────────────────────────────────────────────────
// ── Shared GPU resources ─────────────────────────────────────────────────────
// Three.js does NOT free GPU buffers when a mesh leaves the scene graph -- only
// an explicit .dispose() does. Rebuilding item/station visuals therefore used to
// allocate a fresh geometry+material set on every call and never release the old
// one, leaking ~183 geometries and ~42 materials per updateStationVisuals() and
// crashing long late-game sessions.
//
// The fix is to make those resources SHARED and immutable: identical colours and
// identical shapes hand back the same object, so throwing away a mesh costs
// nothing and there is nothing to dispose. Anything tagged `_shared` is owned by
// these caches and must never be disposed by disposeObj().
const _matCache = new Map();
const M = (c,o)=>{
  const key = c + '|' + (o===undefined?'':o);
  let m = _matCache.get(key);
  if(!m){
    m = new THREE.MeshLambertMaterial({color:c});
    if(o!==undefined){ m.transparent=true; m.opacity=o; }
    m._shared = true; _matCache.set(key, m);
  }
  return m;
};
const MB = c => {
  const key = 'B|' + c;
  let m = _matCache.get(key);
  if(!m){ m = new THREE.MeshBasicMaterial({color:c}); m._shared = true; _matCache.set(key, m); }
  return m;
};
// A deliberately UNIQUE material, for the few meshes whose colour/opacity is
// mutated in place (the placement ghost, trail particles). Callers own these and
// are responsible for disposing them.
const MU = (c,o)=>{ const m=new THREE.MeshLambertMaterial({color:c});
  if(o!==undefined){ m.transparent=true; m.opacity=o; } return m; };

const _geoCache = new Map();
function cachedGeo(key, make){
  let g = _geoCache.get(key);
  if(!g){ g = make(); g._shared = true; _geoCache.set(key, g); }
  return g;
}
// Free the GPU buffers behind a display object. Skips anything owned by the
// shared caches above -- disposing those would blank every other mesh using them.
function disposeObj(o){
  if(!o) return;
  o.traverse(n=>{
    const g = n.geometry;
    if(g && !g._shared && g.dispose) g.dispose();
    const m = n.material;
    if(m) (Array.isArray(m)?m:[m]).forEach(x=>{ if(x && !x._shared && x.dispose) x.dispose(); });
  });
}
// Detach from the scene graph AND release anything not shared.
function discard(parent, o){ if(!o) return; if(parent) parent.remove(o); disposeObj(o); }

const matGrass      = M('#66cc44'); 
const matSidewalk   = M('#aab5b8');
const matRoad       = M('#4a5a6a');
const matRoadLine   = M('#ffcc00');
const matDFloor     = M('#e6c27a'); 
const matWallOut    = M('#fff0d4'); 
const matWallKitch  = M('#cce0e5'); 
const matWallCap    = M('#c29b57');
const matFrameDark  = M('#5D4037');
const matSilver     = M('#b8c8ce');
const matDark       = M('#2a3a40');
const matBlack      = M('#111');
const matGlowRed    = MB('#ff3300');
const matSkin       = M('#ffccaa');
const matBun        = M('#e6b873');
const matMeat       = M('#6a4220');
const matRaw        = M('#cc4040');
const matCharred    = M('#222222');
const matTray       = M('#eeeeee');
const matCheese     = M('#ffcc00');
const matTomato     = M('#e62030');
const matCup        = M('#e53935');
const matSign       = M('#ff5722'); 
const matSignTxt    = M('#ffffff');
const matPlant      = M('#309030');
const matUmbrella   = M('#e63030');
const matPoleGray   = M('#a0a0a0');
const matWood       = M('#8a6045');
const matTrashBag   = M('#4CAF50');

const custColors = ['#e91e63','#ff9800','#00bcd4','#4caf50','#9c27b0', '#111111'].map(c=>M(c));

// Geometry is immutable here, so identical shapes share one buffer.
const GBox  = (w,h,d)=>cachedGeo('b|'+w+'|'+h+'|'+d, ()=>new THREE.BoxGeometry(w,h,d));
const GCyl  = (r,h,s=12)=>cachedGeo('c|'+r+'|'+h+'|'+s, ()=>new THREE.CylinderGeometry(r,r,h,s));
const GSph  = (r,s=12)=>cachedGeo('s|'+r+'|'+s, ()=>new THREE.SphereGeometry(r,s,s));
// Tapered cylinder (top radius != bottom radius) and explicitly-segmented sphere.
const GCylT = (rt,rb,h,s=12)=>cachedGeo('ct|'+rt+'|'+rb+'|'+h+'|'+s, ()=>new THREE.CylinderGeometry(rt,rb,h,s));
const GSphS = (r,ws,hs)=>cachedGeo('ss|'+r+'|'+ws+'|'+hs, ()=>new THREE.SphereGeometry(r,ws,hs));
const GCone = (r,h,s=8)=>cachedGeo('co|'+r+'|'+h+'|'+s, ()=>new THREE.ConeGeometry(r,h,s));
// Crumbs on a dirty tray: three fixed sizes rather than a random radius per
// crumb, so the geometry cache stays bounded.
const crumbGeo = i => GSphS([0.05,0.07,0.09][i%3], 4, 4);

// ─────────────────────────────────────────────────────────────
//  WORLD GROUPS
// ─────────────────────────────────────────────────────────────
const worldGrp = new THREE.Group(); scene.add(worldGrp);
const roomGrp  = new THREE.Group(); scene.add(roomGrp);
const stGrp    = new THREE.Group(); scene.add(stGrp);

let baseBounds = {l:-10, r:10, t:-10, b:10};
let wings = [];
let collEdges = [];

function computeBounds(){
  let b = {...baseBounds};
  for(const w of wings){
    b.l = Math.min(b.l, w.l); b.r = Math.max(b.r, w.r);
    b.t = Math.min(b.t, w.t); b.b = Math.max(b.b, w.b);
  }
  return b;
}

function updateBoundsFromLevel() {
  let l = -10, r = 10, t = -10, b = 10;
  if (eco.floorLevel >= 1) { l -= 5; r += 5; } // 30w x 20d
  if (eco.floorLevel >= 2) { t -= 10; }        // 30w x 30d
  if (eco.floorLevel >= 3) { l -= 5; r += 5; } // 40w x 30d
  if (eco.floorLevel >= 4) { t -= 10; }        // 40w x 40d
  if (eco.floorLevel >= 5) { l -= 5; r += 5; } // 50w x 40d
  if (eco.floorLevel >= 6) { t -= 10; }        // 50w x 50d
  baseBounds = {l, r, t, b};
  bounds = computeBounds();
}

let bounds = computeBounds();
const WING_SIZE = 10;

function addMesh(parent, geo, mat, x,y,z, rx=0,ry=0,rz=0, castShadow=true){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x,y,z); m.rotation.set(rx,ry,rz);
  m.castShadow=castShadow; m.receiveShadow=true;
  parent.add(m); return m;
}

