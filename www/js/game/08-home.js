// Burger Bar — 08-home. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  HOME SCREEN 3D CHEF RENDERER  (dedicated canvas, same mesh as gameplay)
// ─────────────────────────────────────────────────────────────
let hc = {   // home chef state
  renderer:null, scene:null, camera:null,
  mesh:null, animId:null,
  armL:null, armR:null, body:null, hatBody:null
};

function initHomeRenderer(){
  const canvas = document.getElementById('home-chef-canvas');
  if(!canvas || hc.renderer) return;

  hc.renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  hc.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  hc.renderer.setClearColor(0x000000, 0);
  hc.renderer.shadowMap.enabled = true;
  hc.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  hc.scene = new THREE.Scene();

  // Warm 3-point lighting so chef looks the same as in gameplay
  const key = new THREE.DirectionalLight(0xfff5e0, 1.4);
  key.position.set(4, 8, 6); key.castShadow = true; hc.scene.add(key);
  const fill = new THREE.DirectionalLight(0xadd8ff, 0.5);
  fill.position.set(-5, 4, 2); hc.scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd580, 0.7);
  rim.position.set(0, 6, -7); hc.scene.add(rim);
  hc.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // Shadow receiver platform (invisible — just catches shadow)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({opacity: 0.18})
  );
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
  hc.scene.add(ground);

  hc.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  hc.camera.position.set(0, 3.2, 11);
  hc.camera.lookAt(0, 2.5, 0);

  buildHomeChef();
  resizeHomeCanvas();
}

// ── CHARACTERS ───────────────────────────────────────────────────────────────
// A CHARACTER is a body plan; a SKIN is the colour scheme painted onto it. They
// are independent, so any skin works on any character. Every character is built
// from the shared cached geometry helpers (GBox/GCyl/GSph/...), so adding one
// costs nothing at runtime beyond its own distinct shapes.
//
// buildCharacter() is the single source of truth for both the Home Screen chef
// and the in-game player, so the two can never drift apart.
const CHARACTERS = [
  {id:'human',   name:'Chef',        icon:'👨‍🍳', kind:'Human'},
  {id:'cat',     name:'Chef Cat',    icon:'🐱',   kind:'Animal'},
  {id:'bear',    name:'Chef Bear',   icon:'🐻',   kind:'Animal'},
  {id:'penguin', name:'Chef Penguin',icon:'🐧',   kind:'Animal'},
  {id:'frog',    name:'Chef Frog',   icon:'🐸',   kind:'Animal'},
  {id:'dino',    name:'Chef Dino',   icon:'🦖',   kind:'Animal'},
  {id:'bunny',   name:'Chef Bunny',  icon:'🐰',   kind:'Animal'},
  {id:'burger',  name:'Sir Burger',  icon:'🍔',   kind:'Object'},
  {id:'toaster', name:'Toastmaster', icon:'🍞',   kind:'Object'},
  {id:'robot',   name:'Cook-Bot',    icon:'🤖',   kind:'Object'},
  {id:'avocado', name:'Avocado',     icon:'🥑',   kind:'Object'},
  {id:'coffee',  name:'Mug',         icon:'☕',   kind:'Object'},
];
function getActiveCharacter(){
  return CHARACTERS.find(c => c.id === (cosm.character || 'human')) || CHARACTERS[0];
}

// Build a character at gameplay scale: feet on y=0, head around y=2, hat above.
// Returns the group plus the parts callers animate or recolour.
function buildCharacter(charId, sk){
  const def  = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
  const g    = new THREE.Group();
  const P    = { group:g, body:null, head:null, armL:null, armR:null, hat:null };
  const dark = '#263238';

  const add = (geo, m, x=0, y=0, z=0, parent=g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x,y,z); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  const bodyM = M(sk.bodyColor), headM = M(sk.headColor), hatM = M(sk.hatColor);
  const eyeM  = M('#222222'), whiteM = M('#ffffff');

  // Two dot eyes + highlights, used by nearly every character.
  const faceEyes = (y, z, spread=.22, r=.11) => {
    add(GSph(r,8),      eyeM,   -spread, y, z);
    add(GSph(r,8),      eyeM,    spread, y, z);
    add(GSph(r*.42,6),  whiteM, -spread+.05, y+.04, z+.07);
    add(GSph(r*.42,6),  whiteM,  spread+.05, y+.04, z+.07);
  };
  // Classic chef hat. Animals and objects wear a smaller one so it reads as a
  // hat rather than swallowing the silhouette.
  const chefHat = (y, scale=1) => {
    const rim  = add(GCyl(.9*scale,.3*scale,16),        M(sk.hatColor==='#ffffff'?'#eeeeee':sk.hatColor), 0, y, 0);
    const body = add(GCylT(.6*scale,.82*scale,1.55*scale,16), hatM, 0, y+.77*scale, 0);
    const top  = add(GSph(.6*scale,16),                 hatM, 0, y+1.57*scale, 0);
    top.scale.set(1,.55,1);
    P.hat = {rim, body, top};
  };
  // Simple limbs. Arms are groups so the idle animation can swing them.
  const arms = (y, reach=.82, armColor=sk.bodyColor, handColor=sk.headColor) => {
    for(const side of [-1, 1]){
      const arm = new THREE.Group(); g.add(arm);
      add(GBox(.32,.9,.32), M(armColor), 0, -.3, 0, arm);
      add(GSph(.22,10),     M(handColor), 0, -.7, 0, arm);
      arm.position.set(side*reach, y, 0);
      arm.rotation.z = side * -0.3;
      if(side < 0) P.armL = arm; else P.armR = arm;
    }
  };
  const legs = (y=-.52, color='#37474f') => {
    for(const side of [-1, 1]){
      add(GCylT(.28,.24,.9,10), M(color), side*.28, y, 0);
      add(GBox(.42,.18,.58),    M('#212121'), side*.28, y-.5, .1);
    }
  };

  switch(def.id){
    case 'cat': {
      P.body = add(GCylT(.58,.7,1.5,14), bodyM, 0, .78, 0);
      P.head = add(GSph(.62,14),         bodyM, 0, 2.0, 0);
      for(const side of [-1,1]){                                  // ears
        const ear = add(GCone(.26,.46,4), bodyM, side*.34, 2.52, 0);
        ear.rotation.z = side * .18;
        add(GCone(.15,.28,4), M('#f8bbd0'), side*.34, 2.50, .06);
      }
      faceEyes(2.06, .56, .23, .12);
      add(GCone(.09,.12,4), M('#f48fb1'), 0, 1.94, .60).rotation.x = Math.PI/2;
      for(const side of [-1,1]) for(let i=0;i<2;i++)              // whiskers
        add(GBox(.5,.02,.02), M('#eceff1'), side*.42, 1.92+i*.09, .48);
      const tail = add(GCylT(.06,.11,1.3,8), bodyM, 0, 1.0, -.62);
      tail.rotation.x = -0.6;
      arms(1.45); legs(-.5, sk.bodyColor); chefHat(2.55, .72);
      break;
    }
    case 'bear': {
      P.body = add(GCylT(.72,.82,1.55,14), bodyM, 0, .8, 0);
      P.head = add(GSph(.68,14),           bodyM, 0, 2.05, 0);
      for(const side of [-1,1]){
        add(GSph(.22,10), bodyM, side*.46, 2.52, 0);
        add(GSph(.13,8),  M('#8d6e63'), side*.46, 2.54, .08);
      }
      faceEyes(2.12, .60, .24, .11);
      add(GSph(.26,10), M('#d7ccc8'), 0, 1.92, .54).scale.set(1,.75,.7);
      add(GSph(.11,8),  M('#3e2723'), 0, 1.96, .74);
      arms(1.48); legs(-.48, sk.bodyColor); chefHat(2.60, .74);
      break;
    }
    case 'penguin': {
      P.body = add(GSph(.72,14), bodyM, 0, 1.0, 0); P.body.scale.set(1,1.45,.95);
      add(GSph(.55,14), M('#fafafa'), 0, .95, .34).scale.set(1,1.3,.6);
      P.head = add(GSph(.56,14), bodyM, 0, 2.05, 0);
      add(GSph(.42,12), M('#fafafa'), 0, 1.98, .3).scale.set(1,1,.6);
      faceEyes(2.12, .48, .19, .10);
      add(GCone(.17,.42,6), M('#ffb300'), 0, 1.95, .52).rotation.x = Math.PI/2;
      for(const side of [-1,1]){                                  // flippers
        const arm = new THREE.Group(); g.add(arm);
        const f = add(GBox(.2,.85,.42), bodyM, 0, -.35, 0, arm);
        f.scale.set(1,1,1);
        arm.position.set(side*.72, 1.45, 0); arm.rotation.z = side*-.22;
        if(side<0) P.armL = arm; else P.armR = arm;
      }
      for(const side of [-1,1]) add(GBox(.34,.12,.5), M('#ffb300'), side*.24, .06, .12);
      chefHat(2.48, .7);
      break;
    }
    case 'frog': {
      P.body = add(GSph(.75,14), bodyM, 0, .9, 0); P.body.scale.set(1,1.05,.95);
      P.head = add(GSph(.6,14),  bodyM, 0, 1.85, 0);
      for(const side of [-1,1]){                                  // bulging eyes
        add(GSph(.26,10), M('#f5f5f5'), side*.3, 2.32, .12);
        add(GSph(.14,8),  eyeM,         side*.3, 2.36, .28);
      }
      add(GBox(.62,.05,.04), M('#2e7d32'), 0, 1.66, .56);
      arms(1.35, .74, sk.bodyColor, sk.bodyColor);
      for(const side of [-1,1]) add(GBox(.5,.2,.62), bodyM, side*.34, .06, .12);
      chefHat(2.32, .66);
      break;
    }
    case 'dino': {
      P.body = add(GCylT(.66,.8,1.5,14), bodyM, 0, .8, 0);
      P.head = add(GSph(.6,14), bodyM, 0, 2.0, .06); P.head.scale.set(1,.92,1.15);
      add(GBox(.62,.26,.5), bodyM, 0, 1.82, .48);                 // snout
      faceEyes(2.18, .5, .24, .11);
      for(let i=0;i<4;i++)                                        // back plates
        add(GCone(.16,.3,4), M('#ffca28'), 0, 1.5-i*.34, -.55-i*.02);
      const tail = add(GCylT(.1,.3,1.5,8), bodyM, 0, .7, -.8); tail.rotation.x = -.5;
      arms(1.42, .76); legs(-.48, sk.bodyColor);
      chefHat(2.52, .7);
      break;
    }
    case 'bunny': {
      P.body = add(GCylT(.56,.7,1.45,14), bodyM, 0, .76, 0);
      P.head = add(GSph(.58,14),          bodyM, 0, 1.95, 0);
      for(const side of [-1,1]){                                  // long ears
        const ear = add(GCylT(.13,.09,1.0,8), bodyM, side*.24, 2.72, 0);
        ear.rotation.z = side*.12;
        add(GCylT(.07,.05,.8,8), M('#f8bbd0'), side*.24, 2.72, .07).rotation.z = side*.12;
      }
      faceEyes(2.02, .52, .21, .11);
      add(GSph(.09,8), M('#f48fb1'), 0, 1.9, .55);
      add(GSph(.24,10), M('#fafafa'), 0, .8, -.66);               // tail
      arms(1.4); legs(-.5, sk.bodyColor); chefHat(2.5, .66);
      break;
    }
    case 'burger': {
      add(GSphS(.86,12,8), M('#e6b873'), 0, .42, 0).scale.set(1,.62,1);   // bottom bun
      P.body = add(GCyl(.8,.34,14), M('#6a4220'), 0, .86, 0);              // patty
      add(GBox(1.66,.1,1.66), M('#ffcc00'), 0, 1.08, 0);                   // cheese
      add(GCyl(.78,.14,14),  M('#7cb342'), 0, 1.2, 0);                     // lettuce
      add(GCyl(.72,.12,14),  M('#e62030'), 0, 1.32, 0);                    // tomato
      P.head = add(GSphS(.88,14,10), M('#e6b873'), 0, 1.62, 0);            // top bun
      P.head.scale.set(1,.72,1);
      for(let i=0;i<5;i++)                                                 // sesame
        add(GSphS(.07,6,5), whiteM, Math.cos(i*1.26)*.46, 1.94, Math.sin(i*1.26)*.46);
      faceEyes(1.52, .76, .26, .12);
      arms(1.1, .92, sk.bodyColor, sk.headColor); legs(-.3, '#8d6e63');
      chefHat(2.16, .6);
      break;
    }
    case 'toaster': {
      P.body = add(GBox(1.5,1.3,1.0), M('#cfd8dc'), 0, .9, 0);
      add(GBox(1.56,.16,1.06), M('#90a4ae'), 0, 1.56, 0);
      for(const side of [-1,1]) add(GBox(.44,.12,.62), M('#37474f'), side*.32, 1.62, 0);
      P.head = add(GBox(.5,.62,.12), M('#e6b873'), 0, 1.95, 0);            // toast popping up
      add(GBox(.4,.2,.14), M('#8d6e63'), 0, 2.12, .02);
      faceEyes(1.0, .52, .3, .13);
      add(GBox(.44,.06,.06), M('#546e7a'), 0, .72, .52);                   // smile
      add(GCyl(.14,.1,10), M('#ef5350'), .56, .62, .52);                   // dial
      arms(1.15, .88, '#90a4ae', sk.headColor); legs(-.32, '#546e7a');
      chefHat(1.78, .58);
      break;
    }
    case 'robot': {
      P.body = add(GBox(1.15,1.4,.85), M('#b0bec5'), 0, .88, 0);
      add(GBox(.72,.5,.06), M('#37474f'), 0, 1.02, .44);                   // chest panel
      for(let i=0;i<3;i++) add(GSph(.07,6), M(['#ef5350','#ffee58','#66bb6a'][i]), -.2+i*.2, 1.02, .49);
      P.head = add(GBox(.95,.8,.8), M('#cfd8dc'), 0, 2.05, 0);
      add(GBox(.78,.34,.06), M('#263238'), 0, 2.12, .42);                  // visor
      add(GSph(.1,8), M('#4fc3f7'), -.2, 2.12, .47);
      add(GSph(.1,8), M('#4fc3f7'),  .2, 2.12, .47);
      add(GCyl(.05,.36,6), M('#90a4ae'), 0, 2.6, 0);                       // antenna
      add(GSph(.13,8), M('#ef5350'), 0, 2.82, 0);
      arms(1.45, .8, '#90a4ae', '#78909c'); legs(-.5, '#546e7a');
      chefHat(2.5, .62);
      break;
    }
    case 'avocado': {
      P.body = add(GSph(.8,14), M('#33691e'), 0, 1.0, 0); P.body.scale.set(1,1.3,.95);
      add(GSph(.66,14), M('#aed581'), 0, 1.0, .26).scale.set(1,1.25,.55);
      P.head = add(GSph(.34,12), M('#5d4037'), 0, 1.05, .42);              // pit
      faceEyes(1.55, .55, .22, .10);
      add(GBox(.3,.05,.04), M('#33691e'), 0, 1.34, .56);
      arms(1.25, .82, '#33691e', sk.headColor); legs(-.28, '#33691e');
      chefHat(2.1, .6);
      break;
    }
    case 'coffee': {
      P.body = add(GCylT(.72,.62,1.5,16), M('#fafafa'), 0, .85, 0);
      add(GCyl(.74,.12,16), M('#6d4c41'), 0, 1.56, 0);                     // coffee surface
      const handle = add(GCyl(.1,.62,8), M('#fafafa'), .8, .95, 0);        // handle
      handle.rotation.z = Math.PI/2; handle.scale.set(1,1,1);
      add(GBox(.16,.5,.16), M('#fafafa'), .86, 1.2, 0);
      add(GBox(.16,.5,.16), M('#fafafa'), .86, .7, 0);
      P.head = add(GSph(.5,12), M('#fafafa'), 0, 1.8, 0); P.head.visible = false;
      faceEyes(1.05, .62, .25, .12);
      add(GBox(.34,.05,.05), M('#8d6e63'), 0, .8, .63);
      arms(1.15, .86, '#eceff1', sk.headColor); legs(-.3, '#bdbdbd');
      chefHat(1.72, .58);
      break;
    }
    default: {  // 'human' — the original chef, unchanged
      P.body = add(GCyl(.65,1.6,14), bodyM, 0, .8, 0);
      P.head = add(GSph(.55,14),     headM, 0, 1.95, 0);
      faceEyes(2.06, .5, .22, .12);
      const smilePts = [];
      for(let a=-28; a<=28; a+=7){
        const r = a*Math.PI/180;
        smilePts.push(new THREE.Vector3(Math.sin(r)*.28, -Math.cos(r)*.09+1.75, .52));
      }
      const smileGeo = cachedGeo('smile', () =>
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 10, .03, 6, false));
      add(smileGeo, M('#c2185b'), 0, 0, 0);
      const cheekM = M('#ffb3ba', .7);
      add(GSph(.14,8), cheekM, -.38, 1.88, .44);
      add(GSph(.14,8), cheekM,  .38, 1.88, .44);
      arms(1.5); legs(-.52); chefHat(2.38, 1);
      break;
    }
  }
  return P;
}

function buildHomeChef(){
  if(!hc.scene) return;
  if(hc.mesh){ hc.scene.remove(hc.mesh); disposeObj(hc.mesh); hc.mesh = null; }

  const parts = buildCharacter((cosm.character || 'human'), getActiveSkin());
  hc.body = parts.body; hc.armL = parts.armL; hc.armR = parts.armR;
  hc.hatBody = parts.hat ? parts.hat.body : null;

  // Spatula in the right hand, so every character reads as a cook.
  if(parts.armR){
    const sh = new THREE.Mesh(GBox(.1,.9,.1),   M('#9e9e9e')); sh.position.set(0,-.1,0); parts.armR.add(sh);
    const hd = new THREE.Mesh(GBox(.55,.08,.4), M('#bdbdbd')); hd.position.set(0,.45,0);  parts.armR.add(hd);
  }

  parts.group.position.y = 1.05;   // lift so feet meet the shadow plane
  hc.mesh = parts.group;
  hc.scene.add(parts.group);
}

function resizeHomeCanvas(){
  const canvas = document.getElementById('home-chef-canvas');
  if(!canvas || !hc.renderer || !hc.camera) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  // If the Home Screen hasn't been laid out yet the canvas measures 0, and
  // baking in a placeholder aspect here left the chef stretched or off-frame
  // with nothing to correct it. Retry on the next frame instead.
  if(!w || !h){
    if(!hc._resizeRetry){
      hc._resizeRetry = requestAnimationFrame(()=>{ hc._resizeRetry = null; resizeHomeCanvas(); });
    }
    return;
  }
  hc.renderer.setSize(w, h, false);
  hc.camera.aspect = w / h;
  hc.camera.updateProjectionMatrix();
}

function runHomeAnim(){
  hc.animId = requestAnimationFrame(runHomeAnim);
  if(!hc.mesh || !hc.renderer) return;
  const t = Date.now() / 1000;

  // Gentle idle: slow breathing bob only — mostly stationary
  hc.mesh.position.y = 1.05 + Math.sin(t * 1.4) * 0.045;
  if(hc.body) hc.body.scale.y = 1.0 + Math.sin(t * 1.4) * 0.018;

  // Spin: apply drag rotation, decay toward 0 velocity
  hc._spinVel = (hc._spinVel || 0) * 0.88;
  hc._spinY   = (hc._spinY   || 0) + hc._spinVel;
  hc.mesh.rotation.y = hc._spinY;

  // Arms hang naturally — slight idle sway
  if(hc.armL) hc.armL.rotation.z =  0.25 + Math.sin(t * 1.4) * 0.04;
  if(hc.armR) hc.armR.rotation.z = -0.25 - Math.sin(t * 1.4) * 0.04;

  hc.renderer.render(hc.scene, hc.camera);
}

// ── Drag-to-spin on chef canvas ──────────────────────────────
function initChefDrag(){
  const canvas = document.getElementById('home-chef-canvas');
  if(!canvas || canvas._dragBound) return;   // one binding per canvas element
  canvas._dragBound = true;
  let dragX = null;
  const onDown = e => { e.preventDefault(); dragX = (e.touches ? e.touches[0].clientX : e.clientX); };
  const onMove = e => {
    e.preventDefault();
    if(dragX === null) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = x - dragX; dragX = x;
    hc._spinVel = dx * 0.022;
  };
  const onUp = () => { dragX = null; };
  canvas.addEventListener('pointerdown', onDown, {passive:false});
  canvas.addEventListener('pointermove', onMove, {passive:false});
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
}

// ─────────────────────────────────────────────────────────────
//  RESTAURANT PREVIEW RENDERER  (bottom of home screen)
//  Shows the actual in-game exterior using the same colors/materials
// ─────────────────────────────────────────────────────────────
let rp = { renderer:null, scene:null, camera:null, animId:null,
           storeIdx:0, transitionX:0, targetX:0 };

const STORE_COLORS = [
  {wall:'#fff0d4', roof:'#ff5722', sign:'#ff5722', floor:'#e6c27a', name:'Burger Bar #1',    type:'burger'},
  {wall:'#e0f7fa', roof:'#0288d1', sign:'#0277bd', floor:'#b2ebf2', name:'Seafood Shack',    type:'seafood'},
  {wall:'#dceefb', roof:'#1976D2', sign:'#1976D2', floor:'#b0bec5', name:'Downtown Diner',   type:'burger'},
  {wall:'#f3e5f5', roof:'#7B1FA2', sign:'#7B1FA2', floor:'#ce93d8', name:'Westside Grill',   type:'burger'},
  {wall:'#e8f5e9', roof:'#2e7d32', sign:'#388e3c', floor:'#a5d6a7', name:'East End Kitchen', type:'burger'},
];

// RESTAURANT_UNLOCK_DAYS[i] = day required to unlock store slot i (0 = always available)
const RESTAURANT_UNLOCK_DAYS = [0, 0, 30, 30, 30];

function buildRestaurantScene(storeIndex){
  if(!rp.scene) return;
  while(rp.scene.children.length) rp.scene.remove(rp.scene.children[0]);

  const col = STORE_COLORS[storeIndex % STORE_COLORS.length];
  if(col.type === 'seafood') { buildBeachRestaurantScene(); return; }
  const M2 = c => new THREE.MeshLambertMaterial({color:c});
  const add = (geo, mat, x=0, y=0, z=0, rx=0, ry=0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z);
    m.rotation.set(rx,ry,0); m.castShadow=true; m.receiveShadow=true;
    rp.scene.add(m); return m;
  };

  // Lighting
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.2); sun.position.set(8,18,12); sun.castShadow=true; rp.scene.add(sun);
  const fill= new THREE.DirectionalLight(0xadd8ff, 0.4); fill.position.set(-6,8,4); rp.scene.add(fill);
  rp.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  // Sky background
  rp.scene.background = new THREE.Color('#87CEEB');

  // Ground — single flat base avoids ALL z-fighting
  add(new THREE.BoxGeometry(120,0.4,60), M2('#66cc44'), 0,-0.2,4);
  // Road — raised clearly above grass, no overlap
  add(new THREE.BoxGeometry(120,0.22,8), M2('#4a5a6a'), 0,0.11,14);
  // Road dashes — clearly above road
  for(let i=-5;i<=5;i++) add(new THREE.BoxGeometry(3,0.08,0.3), M2('#ffcc00'), i*10,0.34,14);
  // Sidewalk — between grass and road level
  add(new THREE.BoxGeometry(44,0.18,6), M2('#aab5b8'), 0,0.09,8.5);

  // ── Main building ──
  add(new THREE.BoxGeometry(18,8,10), M2(col.wall), 0,4,-3);
  // Roof
  const roofGeo = new THREE.BoxGeometry(19,.8,11.2); add(roofGeo, M2(col.roof), 0,8.4,-3);
  // Roof ridge
  const ridgeGeo = new THREE.CylinderGeometry(.4,.4,20,8); add(ridgeGeo, M2(col.roof), 0,9.4,-3, 0,Math.PI/2);

  // Sign board
  add(new THREE.BoxGeometry(13,1.8,.3), M2(col.sign), 0,8.5,2.1);
  // Sign letters (white blocks)
  for(let i=0;i<8;i++) add(new THREE.BoxGeometry(.5,1,.2), M2('#ffffff'), -2.8+i*.8,8.5,2.3);

  // Awning
  add(new THREE.BoxGeometry(14,.4,2.5), M2(col.roof), 0,5.8,3.7, 0.18,0);

  // Front windows (3)
  const glassMat = new THREE.MeshLambertMaterial({color:'#b2ebf2', transparent:true, opacity:.7});
  [-4.5,0,4.5].forEach(x=>{
    add(new THREE.BoxGeometry(3,2.5,.15), glassMat, x,5,2.2);
    add(new THREE.BoxGeometry(.08,2.5,.2), M2('#888'), x,5,2.2);
    add(new THREE.BoxGeometry(3,.08,.2), M2('#888'), x,5,2.2);
    // Flower box
    add(new THREE.BoxGeometry(3,.4,.4), M2('#8d6e63'), x,3.7,2.2);
    add(new THREE.SphereGeometry(.3,6,6), M2('#e91e63'), x-.6,4.0,2.2);
    add(new THREE.SphereGeometry(.3,6,6), M2('#ff9800'), x,4.0,2.2);
    add(new THREE.SphereGeometry(.3,6,6), M2('#9c27b0'), x+.6,4.0,2.2);
  });

  // Door
  add(new THREE.BoxGeometry(3,5,.15), M2('#8d6e63'), 0,2.5,2.2);
  add(new THREE.BoxGeometry(1.4,4.6,.1), M2(col.wall), -0.75,2.7,2.3);
  add(new THREE.BoxGeometry(1.4,4.6,.1), M2(col.wall),  0.75,2.7,2.3);

  // Outdoor umbrella tables (like the in-game ones)
  [-6.5,6.5].forEach(x=>{
    add(new THREE.CylinderGeometry(.08,0.08,1.8,6), M2('#a0a0a0'), x,.9,5.5);
    add(new THREE.ConeGeometry(2,.6,8), M2(col.roof), x,2.5,5.5);
    add(new THREE.CylinderGeometry(1,.05,16), M2('#eeeeee'), x,1.05,5.5);
  });

  // Trees (same as in-game: brown trunk + green spheres)
  [[-10,0,-1],[10,0,-1],[-10,0,4],[10,0,4]].forEach(([x,y,z])=>{
    add(new THREE.CylinderGeometry(.35,.4,3,8), M2('#8d6e63'), x,1.5,z);
    add(new THREE.SphereGeometry(2,8,6), M2('#4caf50'), x,5,z);
    add(new THREE.SphereGeometry(1.3,8,6), M2('#66bb6a'), x+.6,6,z-.4);
  });

  // Street lamps (like in-game)
  [-7.5,7.5].forEach(x=>{
    add(new THREE.CylinderGeometry(.1,.1,7,6), M2('#455A64'), x,3.5,11);
    add(new THREE.SphereGeometry(.3,8,8), M2('#ffffcc'), x,7.2,11);
  });

  // Small shrubs near entrance
  [-2.5,2.5].forEach(x=>{
    add(new THREE.BoxGeometry(1.4,1,1.4), M2('#8a6045'), x,.5,4.5);
    add(new THREE.SphereGeometry(.8,8,6), M2('#309030'), x,1.4,4.5);
  });
}

function buildBeachRestaurantScene(){
  const M2 = c => new THREE.MeshLambertMaterial({color:c});
  const add = (geo, mat, x=0, y=0, z=0, rx=0, ry=0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z);
    m.rotation.set(rx,ry,0); m.castShadow=true; m.receiveShadow=true;
    rp.scene.add(m); return m;
  };
  // Lighting
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.3); sun.position.set(10,20,14); sun.castShadow=true; rp.scene.add(sun);
  rp.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const fill = new THREE.DirectionalLight(0x80d8ff, 0.4); fill.position.set(-8,8,4); rp.scene.add(fill);

  // Sky + ocean background
  rp.scene.background = new THREE.Color('#87CEEB');

  // Ocean (behind building)
  add(new THREE.PlaneGeometry(120,60), M2('#0288d1'), 0,-0.1,-20, -Math.PI/2);
  // Ocean shimmer strips
  for(let i=0;i<6;i++) add(new THREE.PlaneGeometry(80,.6), M2('#4fc3f7'), 0,0.01,-18+i*3,-Math.PI/2);
  // Sandy beach ground
  add(new THREE.PlaneGeometry(80,30), M2('#f9e4b7'), 0,0,8,-Math.PI/2);
  // Grass/path near building
  add(new THREE.PlaneGeometry(80,6), M2('#aed581'), 0,0.01,2.5,-Math.PI/2);
  // Wooden boardwalk
  add(new THREE.PlaneGeometry(30,5), M2('#8d6e63'), 0,0.02,6,-Math.PI/2);
  for(let i=-3;i<=3;i++) add(new THREE.PlaneGeometry(30,.1), M2('#6d4c41'), i*1.2,0.03,6,-Math.PI/2);

  // ── Main building (beach shack style) ──
  add(new THREE.BoxGeometry(16,6,9), M2('#e0f7fa'), 0,3,-3);
  // Thatched roof (layered cones)
  add(new THREE.CylinderGeometry(0,10,.6,4), M2('#c8a96e'), 0,7.2,-3, 0,Math.PI/4);
  add(new THREE.CylinderGeometry(0,12,.6,4), M2('#d4b483'), 0,6.7,-3, 0,Math.PI/4);
  add(new THREE.CylinderGeometry(0,14,.7,4), M2('#bcaa7e'), 0,6.0,-3, 0,Math.PI/4);
  // Sign
  add(new THREE.BoxGeometry(12,1.6,.3), M2('#0277bd'), 0,7.4,2.2);
  for(let i=0;i<10;i++) add(new THREE.BoxGeometry(.4,1,.2), M2('#ffffff'), -2.2+i*.48,7.4,2.4);
  // Awning (blue & white stripes)
  for(let i=0;i<5;i++) add(new THREE.BoxGeometry(2.4,.3,2.5), M2(i%2===0?'#0288d1':'#fff'), -4.8+i*2.4,5.4,3.8, 0.2,0);
  // Windows
  const glMat = new THREE.MeshLambertMaterial({color:'#b2ebf2',transparent:true,opacity:.7});
  [-4.5,0,4.5].forEach(x=>{
    add(new THREE.BoxGeometry(3,2.5,.15), glMat, x,4.2,2.2);
    add(new THREE.BoxGeometry(.08,2.5,.2), M2('#888'), x,4.2,2.2);
    add(new THREE.BoxGeometry(3,.08,.2), M2('#888'), x,4.2,2.2);
  });
  // Door
  add(new THREE.BoxGeometry(2.8,4.5,.15), M2('#5d4037'), 0,2.25,2.2);
  add(new THREE.BoxGeometry(1.3,4.2,.1), M2('#e0f7fa'), -0.7,2.4,2.3);
  add(new THREE.BoxGeometry(1.3,4.2,.1), M2('#e0f7fa'),  0.7,2.4,2.3);

  // ── Beach details ──
  // Palm trees
  [[-9,0,3],[9,0,3],[-11,0,9],[11,0,9]].forEach(([x,y,z])=>{
    // leaning trunk (slight curve via multiple segments)
    add(new THREE.CylinderGeometry(.25,.35,5,8), M2('#8d6e63'), x,2.5,z, 0, 0.18*(x>0?1:-1));
    // fronds
    for(let a=0;a<5;a++){
      const angle = (a/5)*Math.PI*2;
      add(new THREE.CylinderGeometry(.05,.05,2.8,6), M2('#4caf50'),
        x+Math.cos(angle)*1.4, 5.5, z+Math.sin(angle)*1.4, Math.PI*0.3, angle);
    }
    add(new THREE.SphereGeometry(.5,6,6), M2('#33691e'), x,5.4,z);
  });

  // Beach umbrellas
  [[-6,0,7],[6,0,7],[-3,0,10],[3,0,10]].forEach(([x,y,z])=>{
    const umbCol = ['#ff5722','#ffb300','#e91e63','#00bcd4'][Math.floor(Math.random()*4)];
    add(new THREE.CylinderGeometry(.06,.06,2.8,6), M2('#9e9e9e'), x,1.4,z);
    add(new THREE.ConeGeometry(1.8,.4,8), M2(umbCol), x,3.1,z);
    // Sandy chairs
    add(new THREE.BoxGeometry(1.2,.2,.9), M2('#f9e4b7'), x-.3,.2,z+.6);
    add(new THREE.BoxGeometry(1.2,.2,.9), M2('#f9e4b7'), x+.3,.2,z+.6);
  });

  // Crab decoration on building front
  add(new THREE.SphereGeometry(.5,8,6), M2('#e53935'), 0,1.8,2.4);
  [-0.5,0.5].forEach(side=>{
    add(new THREE.SphereGeometry(.2,6,6), M2('#e53935'), side*.8,2.1,2.4);
    add(new THREE.CylinderGeometry(.06,.06,.6,6), M2('#e53935'), side*1.2,2.0,2.4, 0,0,Math.PI/4*side);
  });

  // Seagulls (simple V shapes in sky)
  [[6,14,-8],[-3,16,-12],[10,15,-6]].forEach(([x,y,z])=>{
    add(new THREE.CylinderGeometry(.06,.06,1.2,4), M2('#fff'), x,y,z, 0,0, 0.4);
    add(new THREE.CylinderGeometry(.06,.06,1.2,4), M2('#fff'), x+.8,y+.2,z, 0,0,-0.4);
  });

  // ── Outdoor seating (driftwood tables) ──
  [-5,5].forEach(x=>{
    add(new THREE.BoxGeometry(2.5,.18,1.5), M2('#8d6e63'), x,.8,5.5);
    add(new THREE.CylinderGeometry(.12,.12,.8,6), M2('#6d4c41'), x,.4,5.5);
    // Shells as decor
    add(new THREE.SphereGeometry(.18,6,6), M2('#f9e4b7'), x-.4,.96,5.5);
    add(new THREE.SphereGeometry(.14,6,6), M2('#ff8a65'), x+.3,.96,5.5);
  });
}

function initRestaurantRenderer(){
  const canvas = document.getElementById('home-restaurant-canvas');
  if(!canvas || rp.renderer) return;

  // Size renderer to match wrap dimensions
  const wrap = document.getElementById('home-restaurant-wrap');
  const pw = (wrap ? wrap.offsetWidth  : 0) || window.innerWidth;
  const ph = (wrap ? wrap.offsetHeight : 0) || Math.round(window.innerHeight * 0.46);

  rp.renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false});
  rp.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  rp.renderer.setSize(pw, ph, false);
  rp.renderer.shadowMap.enabled = true;
  rp.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  rp.scene = new THREE.Scene();

  // Isometric-ish camera angle matching in-game view
  rp.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  rp.camera.position.set(0, 12, 26);
  rp.camera.lookAt(0, 3, 0);

  buildRestaurantScene(rp.storeIdx);
  // Defer resize to after first paint so wrap has real dimensions
  requestAnimationFrame(()=>{ resizeRestaurantCanvas(); });
  initRestaurantSwipe();
  updateStoreDots();
}

function resizeRestaurantCanvas(){
  if(!rp.renderer) return;
  const wrap = document.getElementById('home-restaurant-wrap');
  if(!wrap) return;
  // Use getBoundingClientRect for accurate size after layout
  const rect = wrap.getBoundingClientRect();
  const w = Math.max(Math.round(rect.width),  window.innerWidth);
  const h = Math.max(Math.round(rect.height), Math.round(window.innerHeight * 0.46));
  rp.renderer.setSize(w, h, false);
  rp.camera.aspect = w / h;
  rp.camera.updateProjectionMatrix();
}

function runRestaurantAnim(){
  rp.animId = requestAnimationFrame(runRestaurantAnim);
  if(!rp.renderer || !rp.scene) return;
  // Pan camera slightly left/right for life
  const t = Date.now() / 1000;
  rp.camera.position.x = Math.sin(t * 0.12) * 1.2;
  rp.camera.lookAt(0, 3, 0);
  rp.renderer.render(rp.scene, rp.camera);
}

function stopRestaurantAnim(){
  if(rp.animId){ cancelAnimationFrame(rp.animId); rp.animId = null; }
}

// ── Swipe between stores ──────────────────────────────────────
function initRestaurantSwipe(){
  if(SINGLE_BAR_MODE) return; // no map-switching while locked to the first bar
  const canvas = document.getElementById('home-restaurant-canvas');
  if(!canvas) return;
  let startX = null, moved = false;
  canvas.addEventListener('pointerdown', e=>{ startX = e.clientX; moved=false; });
  canvas.addEventListener('pointermove', e=>{ if(Math.abs(e.clientX-(startX||0))>8) moved=true; });
  canvas.addEventListener('pointerup', e=>{
    if(startX===null) return;
    const dx = e.clientX - startX; startX=null;
    if(moved && Math.abs(dx) > 40) homeSwipeStore(dx < 0 ? 1 : -1);
  });
}

function homeSwipeStore(dir){
  if(SINGLE_BAR_MODE) return; // locked to the first bar — ignore arrows/swipe
  const totalSlots = STORE_COLORS.length;
  const newIdx = (rp.storeIdx + dir + totalSlots) % totalSlots;
  rp.storeIdx = newIdx;
  buildRestaurantScene(rp.storeIdx);
  updateStoreDots();

  const ownedStore = stores[rp.storeIdx];
  const colDef = STORE_COLORS[rp.storeIdx % STORE_COLORS.length];
  const storeName = ownedStore ? ownedStore.name : colDef.name;
  // A slot is locked until you've actually opened that store. The unlock day
  // (when it becomes purchasable) is data-driven via RESTAURANT_UNLOCK_DAYS.
  const unlockDay = RESTAURANT_UNLOCK_DAYS[rp.storeIdx] || 0;
  const locked = !ownedStore;

  const el = document.getElementById('home-store-name');
  if(el) el.textContent = locked ? `🔒 ${storeName} (Day ${unlockDay})` : storeName;

  const playBtn = document.querySelector('.hbtn-play');
  if(playBtn) {
    playBtn.disabled = locked;
    playBtn.style.opacity = locked ? '.5' : '1';
  }

  // Update play button day number to reflect this store's current day
  const storeDay = ownedStore ? (ownedStore.eco?.day ?? 0) : 0;
  const nextDayEl = document.getElementById('home-next-day');
  if(nextDayEl) nextDayEl.textContent = storeDay + 1;
}
window.homeSwipeStore = homeSwipeStore;

function updateStoreDots(){
  const dotsEl = document.getElementById('home-store-dots');
  if(!dotsEl) return;
  dotsEl.innerHTML='';
  STORE_COLORS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'store-dot' + (i === rp.storeIdx ? ' active' : '');
    dotsEl.appendChild(d);
  });
}

function stopHomeAnim(){
  if(hc.animId){ cancelAnimationFrame(hc.animId); hc.animId = null; }
  stopRestaurantAnim();
}

// The Home Screen runs two extra WebGL contexts (the spinning chef and the
// restaurant preview) alongside the main game canvas. Stopping their animation
// loops did NOT release the contexts, and some mobile GPUs evict the oldest
// context once about eight are live -- which shows up as the game canvas
// turning black. Entering gameplay now tears both down; they are rebuilt lazily
// the next time the Home Screen is shown (both init fns already no-op when the
// renderer exists).
// A <canvas> can only ever hand out ONE WebGL context: getContext() returns the
// same object forever, and after forceContextLoss() that context is dead for
// good. Building a new WebGLRenderer on the same element therefore renders
// nothing -- which is exactly the "chef doesn't load on the title screen" bug.
// Swapping in a fresh element gives the next renderer a virgin canvas, and
// discards the old node's event listeners along with it.
function recycleCanvas(id){
  const old = document.getElementById(id);
  if(!old || !old.parentNode) return;
  const fresh = old.cloneNode(false);   // attributes only: no listeners, no context
  old.parentNode.replaceChild(fresh, old);
}

function releaseHomeRenderers(){
  stopHomeAnim();
  let released = false;
  for(const holder of [hc, rp]){
    if(!holder || !holder.renderer) continue;
    try{
      if(holder.scene) disposeObj(holder.scene);
      holder.renderer.dispose();
      if(holder.renderer.forceContextLoss) holder.renderer.forceContextLoss();
    }catch(e){ console.warn('Home renderer teardown failed', e); }
    holder.renderer = null; holder.scene = null; holder.camera = null;
    released = true;
  }
  if(released){
    recycleCanvas('home-chef-canvas');
    recycleCanvas('home-restaurant-canvas');
  }
  // Drop every cached reference into the scene we just disposed, so nothing
  // animates a dead mesh and buildHomeChef() starts from a clean slate.
  hc.chef = null; hc.mesh = null; hc.body = null; hc.armL = null; hc.armR = null;
  hc._spinVel = 0; hc._spinY = 0;
  hc._dragBound = false;
}

function positionHomeChef(){ resizeHomeCanvas(); }

