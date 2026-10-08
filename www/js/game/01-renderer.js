// Burger Bar — 01-renderer. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  RENDERER + SCENE
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
// Colour pipeline: lighting is computed in linear space, tone-mapped with ACES
// (soft highlight roll-off, richer mid-tones) and output as sRGB. Material
// factories below convert authored sRGB hex colours to linear to match.
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// ── Graphics quality ─────────────────────────────────────────────────────────
// settings.graphics: 'auto' (default) | 'high' | 'low'. Auto starts at 'med' and
// steps down -- never up -- when sustained gameplay frame time says the device is
// struggling; the learned tier is remembered so it doesn't re-learn every launch.
const QUALITY_TIERS = {
  high: { pr: 2,   shadows: true,  shadowSize: 2048 },
  med:  { pr: 1.5, shadows: true,  shadowSize: 1024 },
  low:  { pr: 1,   shadows: false, shadowSize: 512  },
};
let qualityTier = null;
function wantedQualityTier(){
  const g = settings.graphics || 'auto';
  if(g === 'high' || g === 'low') return g;
  return QUALITY_TIERS[settings.autoTier] ? settings.autoTier : 'med';
}
function applyQuality(tier){
  tier = tier || wantedQualityTier();
  if(tier === qualityTier) return;
  const q = QUALITY_TIERS[tier];
  const shadowChange = !qualityTier || QUALITY_TIERS[qualityTier].shadows !== q.shadows;
  qualityTier = tier;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  renderer.shadowMap.enabled = q.shadows;
  if(typeof sun !== 'undefined'){
    sun.castShadow = q.shadows;
    if(sun.shadow.mapSize.x !== q.shadowSize){
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
  }
  // Toggling shadows changes shader programs; flag every material to recompile.
  if(shadowChange) scene.traverse(o=>{ const m=o.material; if(m) (Array.isArray(m)?m:[m]).forEach(x=>x.needsUpdate=true); });
  if(typeof resize === 'function') resize();
}
// Frame-time watchdog for 'auto'. Fed from the main loop during gameplay only.
const perfWatch = { acc:0, n:0 };
function perfSample(ms){
  if((settings.graphics || 'auto') !== 'auto' || ms > 100) return; // ignore hitches/tab switches
  perfWatch.acc += ms; perfWatch.n++;
  if(perfWatch.n < 240) return;
  const avg = perfWatch.acc / perfWatch.n; perfWatch.acc = 0; perfWatch.n = 0;
  if(avg > 24 && qualityTier !== 'low'){
    const down = qualityTier === 'high' ? 'med' : 'low';
    settings.autoTier = down; saveSettings(); applyQuality(down);
    console.info('Graphics auto-lowered to', down, '(avg frame', avg.toFixed(1), 'ms)');
  }
}

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
// Background is a clear colour (not tone-mapped/encoded); fog is shaded, so it
// takes the linear version of the same colour to blend into it seamlessly.
const SKY = '#8fd3f4';
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(new THREE.Color(SKY).convertSRGBToLinear(), 60, 130);

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

// Warm afternoon key light, cool sky fill, warm bounce from the ground.
const hemi = new THREE.HemisphereLight(new THREE.Color('#d8ecff').convertSRGBToLinear(), new THREE.Color('#8a6d4a').convertSRGBToLinear(), 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(new THREE.Color('#ffe9c9').convertSRGBToLinear(), 1.75);
sun.position.set(22,50,30); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
// The shadow frustum follows the camera (see fitSunToView) instead of covering
// the whole 120x120 world, so the same map gives ~3x sharper shadows.
sun.shadow.camera.left=-36; sun.shadow.camera.right=36;
sun.shadow.camera.top=36; sun.shadow.camera.bottom=-36;
sun.shadow.camera.near=1; sun.shadow.camera.far=140;
sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.02; scene.add(sun); scene.add(sun.target);
const fillLight = new THREE.DirectionalLight(new THREE.Color('#9ec9ff').convertSRGBToLinear(), 0.3);
fillLight.position.set(-20,18,-12); scene.add(fillLight);
const SUN_OFFSET = new THREE.Vector3(22,50,30);
function fitSunToView(x, z){
  // Cover what the camera can see: its width, and its height stretched by the
  // 45° tilt onto the ground, plus margin for tall objects' shadows.
  const sc = sun.shadow.camera;
  const half = Math.ceil(Math.max(camera.right - camera.left, (camera.top - camera.bottom) * 1.45) / 2 + 8);
  if(sc.right !== half){ sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
  // Snap to shadow texels so moving the camera doesn't make edges shimmer.
  const q = (half * 2) / sun.shadow.mapSize.x;
  x = Math.round(x/q)*q; z = Math.round(z/q)*q;
  sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
  sun.target.position.set(x, 0, z);
}

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
    m = new THREE.MeshLambertMaterial({color:new THREE.Color(c).convertSRGBToLinear()});
    if(o!==undefined){ m.transparent=true; m.opacity=o; }
    m._shared = true; _matCache.set(key, m);
  }
  return m;
};
const MB = c => {
  const key = 'B|' + c;
  let m = _matCache.get(key);
  if(!m){ m = new THREE.MeshBasicMaterial({color:new THREE.Color(c).convertSRGBToLinear()}); m._shared = true; _matCache.set(key, m); }
  return m;
};
// A deliberately UNIQUE material, for the few meshes whose colour/opacity is
// mutated in place (the placement ghost, trail particles). Callers own these and
// are responsible for disposing them.
const MU = (c,o)=>{ const m=new THREE.MeshLambertMaterial({color:new THREE.Color(c).convertSRGBToLinear()});
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

