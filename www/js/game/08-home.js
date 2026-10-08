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
  hc.camera.position.set(0, 2.6, 9.6);
  hc.camera.lookAt(0, 2.0, 0);

  buildHomeChef();
  resizeHomeCanvas();
}

// Characters (CHARACTERS, buildCharacter) live in 08a-characters.js.

function buildHomeChef(){
  if(!hc.scene) return;
  if(hc.mesh){ hc.scene.remove(hc.mesh); disposeObj(hc.mesh); hc.mesh = null; }

  const parts = buildCharacter((cosm.character || 'human'), getActiveSkin(), { crown: !!(upg && upg.burgerCrown) });
  hc.body = parts.body; hc.armL = parts.armL; hc.armR = parts.armR; hc.head = parts.head;
  hc.hatBody = parts.hat ? parts.hat.body : null;

  // Spatula in the right hand, so every character reads as a cook.
  if(parts.armR){
    const sp = bake('spatula', ()=>{ const g = new THREE.Group();
      addMesh(g, GCap(.045,.55), M('#5d4037'), 0,-.45,.12, .35,0,0);
      addMesh(g, GRBox(.34,.04,.42,.03), MP('#cfd8dc',140), 0,-.05,.22, .35,0,0);
      return g; });
    sp.position.set(0,-.62,0); parts.armR.add(sp);
  }

  parts.group.position.y = 0;      // feet on the shadow plane
  parts.group.scale.setScalar(1.3);
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
  hc.mesh.position.y = Math.sin(t * 1.4) * 0.03;
  if(hc.body) hc.body.scale.y = 1.0 + Math.sin(t * 1.4) * 0.015;

  // Spin: apply drag rotation, decay toward 0 velocity
  hc._spinVel = (hc._spinVel || 0) * 0.88;
  hc._spinY   = (hc._spinY   || 0) + hc._spinVel;
  hc.mesh.rotation.y = hc._spinY;

  // Arms hang naturally — slight idle sway
  // Idle: left arm sways, right arm waves the spatula now and then.
  if(hc.armL) hc.armL.rotation.z =  0.2 + Math.sin(t * 1.4) * 0.05;
  if(hc.armR){
    const wave = Math.max(0, Math.sin(t * 0.7)) ** 6;
    hc.armR.rotation.z = -0.2 - wave * 2.2;
    hc.armR.rotation.x = -wave * 0.3 + Math.sin(t * 7) * 0.12 * wave;
  }
  if(hc.head) hc.head.rotation.y = Math.sin(t * 0.6) * 0.18;

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

