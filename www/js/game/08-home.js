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


// The Home Screen preview shows the player's REAL bar -- every upgrade, robot
// and decor tier -- drawn by the main renderer through a window in the Home
// Screen overlay, with a slowly orbiting showcase camera. It used to be a
// separate hand-built mock-up in its own WebGL context; one less context matters
// on iOS, where WebKit evicts contexts under memory pressure.
const homeShowcase = { on:false, cam:null, yaw:0, drag:null, vel:0, bound:false };
function initRestaurantRenderer(){
  homeShowcase.on = true;
  if(!homeShowcase.cam) homeShowcase.cam = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
  const wrap = document.getElementById('home-restaurant-wrap');
  if(wrap && !homeShowcase.bound){
    homeShowcase.bound = true;
    wrap.addEventListener('pointerdown', e=>{ homeShowcase.drag = e.clientX; homeShowcase.vel = 0; });
    window.addEventListener('pointermove', e=>{
      if(homeShowcase.drag === null) return;
      const dx = e.clientX - homeShowcase.drag; homeShowcase.drag = e.clientX;
      homeShowcase.yaw = Math.max(-1.1, Math.min(1.1, homeShowcase.yaw - dx * 0.006));
      homeShowcase.vel = -dx * 0.006;
    });
    window.addEventListener('pointerup', ()=>{ homeShowcase.drag = null; });
  }
}
// Draw the showcase into the preview window. Called from the main loop while
// the Home Screen is up; returns false if there is nothing to draw into.
function renderHomeShowcase(){
  const wrap = document.getElementById('home-restaurant-wrap');
  if(!homeShowcase.on || !wrap || !homeShowcase.cam) return false;
  const r = wrap.getBoundingClientRect();
  if(r.width < 2 || r.height < 2) return false;
  // Gentle idle sway; a drag takes over and then eases back.
  if(homeShowcase.drag === null){
    homeShowcase.yaw += homeShowcase.vel; homeShowcase.vel *= 0.92;
    const idle = Math.sin(performance.now() / 4200) * 0.35;
    homeShowcase.yaw += (idle - homeShowcase.yaw) * 0.01;
  }
  const b = bounds, cx = (b.l + b.r) / 2, cz = (b.t + b.b) / 2;
  const span = Math.max(b.r - b.l, b.b - b.t);
  const cam = homeShowcase.cam;
  cam.aspect = r.width / r.height;
  // Fit the bar's width (narrow portrait windows need to back off further).
  const R = span * (cam.aspect < 1 ? 1.9 / cam.aspect : 1.6) + 6;
  cam.position.set(cx + Math.sin(homeShowcase.yaw) * R, R * 0.62, cz + Math.cos(homeShowcase.yaw) * R);
  cam.lookAt(cx, 0, cz + span * 0.06);
  cam.updateProjectionMatrix();
  fitSunToView(cx, cz);
  const H = window.innerHeight;
  renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
  renderer.setScissor(r.left, H - r.bottom, r.width, r.height);
  renderer.setScissorTest(true);
  renderer.render(scene, cam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, H);
  return true;
}

function resizeRestaurantCanvas(){}

// The showcase is drawn by the main loop (renderHomeShowcase); no extra rAF loop.
function runRestaurantAnim(){}

// ── Swipe between stores ──────────────────────────────────────

function stopHomeAnim(){
  if(hc.animId){ cancelAnimationFrame(hc.animId); hc.animId = null; }
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
  homeShowcase.on = false;
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

