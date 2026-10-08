// Burger Bar — 13a-tutorial. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  FIRST-SHIFT TUTORIAL
// ─────────────────────────────────────────────────────────────
// A hands-on walkthrough of the whole loop during the player's first shift:
// fridge → grill → tray → plate → serve → clear → wash → return.
//
// Steps advance by WATCHING GAME STATE, not by counting button presses, so a
// player who does things in a different order (plates at the rack, grabs the
// tray first) is never stuck: every step whose outcome already exists is
// skipped. While it runs, arrivals are held until there is food on the grill,
// the first guest orders a plain burger, and nobody walks out.
//
// Runs automatically on Day 1 for new players; Settings → "Replay tutorial"
// queues it for the next shift. Skippable at any time.

const TUT_KEY = 'burgerBoss_firstShiftDone';
const tut = { active:false, step:0, marker:null, ring:null, t:0, guestSpawned:false, startRack:0, startWashed:0, doneShown:false };

function _st(type){ for(const k in stations){ const s = stations[k]; if(s.type === type) return s; } return null; }
function _grillHas(pred){ for(const k in stations){ const s = stations[k]; if(s.type === 'grill' && s.slots && s.slots.some(sl => sl && pred(sl))) return true; } return false; }
function _tutTable(){
  for(const k in stations){ const s = stations[k]; if(s.type === 'table' && (s.group || s.dirtyTrays > 0)) return s; }
  return _st('table');
}
function _served(){ return (stats.groupsServed || 0) > 0 || (()=>{ for(const k in stations){ const s = stations[k]; if(s.type === 'table' && (s.served > 0 || s.dirtyTrays > 0)) return true; } return false; })(); }

const TUT_STEPS = [
  { icon:'🧊', title:'Grab a patty', text:'Drag your LEFT thumb to walk to the glowing Fridge, then tap the RIGHT side to grab a raw patty.',
    target:()=>_st('fridge'),
    done:()=> player.holding === 'raw' || _grillHas(()=>true) || ['cooked','burger_on_tray'].includes(player.holding) },
  { icon:'🔥', title:'Grill it', text:'Carry it to the Grill and tap to start cooking. The green bar shows it cooking.',
    target:()=>_st('grill'),
    done:()=> _grillHas(()=>true) || ['cooked','burger_on_tray'].includes(player.holding) || _served() },
  { icon:'🍱', title:'Grab a clean tray', text:'A customer is coming! While the patty cooks, take a clean tray from the Tray Rack.',
    target:()=>_st('trayrack'),
    done:()=> ['tray','burger_on_tray'].includes(player.holding) || _served() },
  { icon:'🍔', title:'Plate the burger', text:'When the bar turns ORANGE it\'s cooked. Tap the Grill with your tray to plate it. Don\'t wait too long or it burns!',
    target:()=>_st('grill'),
    done:()=> player.holding === 'burger_on_tray' || _served() },
  { icon:'🛎️', title:'Serve the guest', text:'Bring it to the table. The guest whose bubble glows GREEN ordered what you\'re carrying.',
    target:()=>_tutTable(),
    done:()=> _served() },
  { icon:'🍽️', title:'Clear the table', text:'Nice! When they finish eating they leave a dirty tray. Pick it up.',
    target:()=>_tutTable(),
    done:()=> player.holding === 'dirty_tray' || (stats.traysWashed || 0) > tut.startWashed },
  { icon:'🚿', title:'Wash it', text:'Take it to the Sink and HOLD the right side for 3 seconds to wash it.',
    target:()=>_st('sink'),
    done:()=> (stats.traysWashed || 0) > tut.startWashed },
  { icon:'🔁', title:'Back on the rack', text:'Return the clean tray to the Tray Rack. Trays go round and round, so keep the loop moving!',
    target:()=>_st('trayrack'),
    done:()=> (stats.traysReturned || 0) > 0 },
];

// Runs on a new player's Day 1, or on the next shift after "Replay tutorial".
// (A returning player who updates mid-career never gets it unasked.)
function tutorialShouldStart(){
  try {
    if(localStorage.getItem(TUT_KEY) === '1') return false;
    return eco.day === 1 || localStorage.getItem('burgerBoss_tutReplay') === '1';
  } catch(e){ return false; }
}
function tutorialActive(){ return tut.active; }
// Arrivals are held while the tutorial runs, except for the one lesson guest.
function tutorialHoldsSpawns(){ return tut.active; }
// The lesson guest: one person, a plain burger, no surprises.
function tutorialWantsSimpleGuest(){ return tut.active && !tut.guestSpawned; }

function startTutorial(){
  tut.active = true; tut.step = 0; tut.t = 0; tut.guestSpawned = false; tut.doneShown = false;
  tut.startWashed = stats.traysWashed || 0;
  stats.spawnTimer = Infinity;
  if(!tut.marker){
    tut.marker = bake('tutMarker', ()=>{ const g = new THREE.Group();
      addMesh(g, GCone(.42, .8, 16), ME('#ffd54f'), 0, 0, 0, Math.PI, 0, 0, false);
      addMesh(g, GCyl(.17, .5, 12), ME('#ffd54f'), 0, .6, 0, 0, 0, 0, false);
      return g; });
    tut.ring = bake('tutRing', ()=>{ const g = new THREE.Group();
      addMesh(g, GTor(1.0, .09, 8, 40), ME('#ffd54f'), 0, 0, 0, Math.PI/2, 0, 0, false);
      return g; });
  }
  scene.add(tut.marker); scene.add(tut.ring);
  const card = document.getElementById('tut-card'); if(card) card.classList.add('show');
  document.body.classList.add('tutorial');
  renderTutorialCard();
}
function endTutorial(completed){
  tut.active = false;
  if(tut.marker) scene.remove(tut.marker);
  if(tut.ring) scene.remove(tut.ring);
  try { localStorage.setItem(TUT_KEY, '1'); localStorage.removeItem('burgerBoss_tutReplay'); } catch(e){}
  const card = document.getElementById('tut-card'); if(card) card.classList.remove('show');
  document.body.classList.remove('tutorial');
  const edge = document.getElementById('tut-edge'); if(edge) edge.style.display = 'none';
  // Release the rest of the day's customers.
  if(gameState === 'playing') stats.spawnTimer = Math.min(stats.spawnTimer, completed ? 240 : 120);
  if(completed){
    try { playSound('daycomplete'); } catch(e){}
    showToast("👨‍🍳 You've got it! Serve the rest of today's guests.", 3200);
  }
}
function skipTutorial(){ endTutorial(false); }
// Leaving the shift mid-lesson (quit to menu) doesn't count as finishing it.
function abortTutorial(){
  if(!tut.active) return;
  tut.active = false;
  if(tut.marker) scene.remove(tut.marker);
  if(tut.ring) scene.remove(tut.ring);
  const card = document.getElementById('tut-card'); if(card) card.classList.remove('show');
  document.body.classList.remove('tutorial');
  const edge = document.getElementById('tut-edge'); if(edge) edge.style.display = 'none';
}
function replayTutorial(){
  try { localStorage.removeItem(TUT_KEY); localStorage.setItem('burgerBoss_tutReplay', '1'); } catch(e){}
  showToast('🎓 The tutorial will run on your next shift.', 2400);
}
window.skipTutorial = skipTutorial; window.replayTutorial = replayTutorial;

function renderTutorialCard(){
  const s = TUT_STEPS[tut.step]; if(!s) return;
  const el = id => document.getElementById(id);
  if(el('tut-icon')) el('tut-icon').textContent = s.icon;
  if(el('tut-title')) el('tut-title').textContent = s.title;
  if(el('tut-text')) el('tut-text').textContent = s.text;
  if(el('tut-step')) el('tut-step').textContent = `Step ${tut.step + 1} of ${TUT_STEPS.length}`;
  const dots = el('tut-dots');
  if(dots){ dots.innerHTML = ''; TUT_STEPS.forEach((_, i) => { const d = document.createElement('i');
    if(i < tut.step) d.className = 'done'; else if(i === tut.step) d.className = 'on'; dots.appendChild(d); }); }
  const card = el('tut-card'); if(card){ card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
}

// Per-frame: advance steps, release the lesson guest, move the marker.
function updateTutorial(dsF){
  if(!tut.active || gameState !== 'playing') return;
  tut.t += dsF;
  let advanced = false;
  while(tut.step < TUT_STEPS.length && TUT_STEPS[tut.step].done()){ tut.step++; advanced = true; }
  // Send the lesson guest once there is food on the way.
  if(!tut.guestSpawned && tut.step >= 2 && stats.groupsLeft > 0){ spawnGroup(); tut.guestSpawned = true; }
  if(tut.step >= TUT_STEPS.length){ endTutorial(true); return; }
  if(advanced){ renderTutorialCard(); try { playSound('serve'); } catch(e){} }

  const tgt = TUT_STEPS[tut.step].target();
  if(!tgt){ tut.marker.visible = tut.ring.visible = false; return; }
  const bob = Math.sin(tut.t * .12) * .35;
  tut.marker.visible = tut.ring.visible = true;
  tut.marker.position.set(tgt.x, 6.6 + bob, tgt.z);
  tut.marker.rotation.y += .04 * dsF;
  tut.ring.position.set(tgt.x, .16, tgt.z);
  const pulse = 1 + Math.sin(tut.t * .15) * .08, r = Math.max(tgt.w || 2, tgt.d || 2) * .62;
  tut.ring.scale.set(r * pulse, 1, r * pulse);

  // Off-screen? Point at it from the screen edge.
  const edge = document.getElementById('tut-edge');
  if(edge){
    const p = scrXYZ(tgt.x, 2, tgt.z), W = window.innerWidth, H = window.innerHeight, m = 44;
    const off = p.x < m || p.x > W - m || p.y < 120 || p.y > H - m;
    if(off){
      const cx = W/2, cy = H/2, dx = p.x - cx, dy = p.y - cy;
      const k = Math.min((W/2 - m) / Math.abs(dx || 1e-6), (H/2 - m) / Math.abs(dy || 1e-6));
      edge.style.display = 'flex';
      edge.style.left = (cx + dx * k) + 'px'; edge.style.top = Math.max(130, cy + dy * k) + 'px';
      edge.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(dy, dx)}rad)`;
    } else edge.style.display = 'none';
  }
}
