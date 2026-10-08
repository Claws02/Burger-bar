// Burger Bar — 09-menus-dayflow. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  SKIN APPLICATION — gameplay chef + SVG home chef
// ─────────────────────────────────────────────────────────────
function applyChefSkinToSVG(skinId){
  const sk = SKIN_DEFS.find(s=>s.id===skinId) || SKIN_DEFS[0];
  const set = (id, attr, val) => { const el=document.getElementById(id); if(el) el.setAttribute(attr,val); };
  set('hcs-hat','fill', sk.hatColor);
  set('hcs-hattop','fill', sk.hatColor);
  set('hcs-hatrim','fill', sk.hatColor==='#ffffff'?'#eeeeee':sk.hatColor);
  set('hcs-body','fill', sk.bodyColor);
  set('hcs-head','fill', sk.headColor);
  set('hcs-arml','fill', sk.bodyColor);
  set('hcs-armr','fill', sk.bodyColor);
}

function applyChefSkin(skinId) {
  const sk = SKIN_DEFS.find(s=>s.id===skinId) || SKIN_DEFS[0];
  // Gameplay 3D chef: rebuilt wholesale, since a character is a body plan and
  // not every one of them has the same parts to recolour.
  try { rebuildPlayerMesh(); } catch(e){ console.warn('Player rebuild failed', e); }
  // Home screen 3D chef — rebuild with new skin
  if(hc.scene) buildHomeChef();
  // Trail color
  window._trailColor = sk.trailColor || null;
}

// ─────────────────────────────────────────────────────────────
//  MOVEMENT TRAIL (particles behind chef)
// ─────────────────────────────────────────────────────────────
const trailParticles = [];
let trailTimer = 0;
function spawnTrailParticle(){
  const sk = getActiveSkin();
  if(!sk.trailColor) return;
  const geo = GSphS(0.18, 6, 6);
  // Unique because updateTrail() fades opacity per particle; disposed on death.
  const mat = new THREE.MeshBasicMaterial({color:sk.trailColor, transparent:true, opacity:0.85});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pMesh.position);
  mesh.position.y += 0.5;
  scene.add(mesh);
  trailParticles.push({mesh, life:1.0, decay:0.06});
}
function updateTrail(ds, moving){
  trailTimer -= ds;
  if(moving && trailTimer <= 0){ spawnTrailParticle(); trailTimer = 3; }
  for(let i=trailParticles.length-1;i>=0;i--){
    const p = trailParticles[i];
    p.life -= p.decay * ds;
    p.mesh.material.opacity = p.life * 0.85;
    p.mesh.scale.setScalar(p.life);
    if(p.life <= 0){ scene.remove(p.mesh); disposeObj(p.mesh); trailParticles.splice(i,1); }
  }
}

// ── HOME SCREEN ──────────────────────────────────────────────
function showStartMenu(){
  ['results-screen','shop-screen','start-screen'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  document.getElementById('top-hud').style.display='none';
  document.getElementById('pause-btn').style.display='none';
  abortTutorial();
  { const th = document.getElementById('touch-hint'); if(th) th.style.display='none'; }
  { const gh = document.getElementById('goals-hud');
    if(gh){ gh.style.display = 'none'; gh.classList.remove('open'); }
    goalsPanelOpen = false; }
  document.getElementById('skins-screen').style.display='none';
  document.getElementById('stores-screen').style.display='none';
  document.getElementById('pause-screen').style.display='none';
  document.getElementById('quit-confirm').style.display='none';
  gameState='start_menu';
  setMusicMood(0);

  document.getElementById('home-cash').textContent='$'+eco.cash.toFixed(2);
  document.getElementById('home-rating').textContent=getCumRating();
  document.getElementById('home-day').textContent=eco.day;
  {
    // Calendar streak chip: only meaningful if the streak is still alive today
    // or yesterday (otherwise the next shift will reset it).
    const chip = document.getElementById('home-streak');
    if(chip){
      const gap = adapt.lastPlayDate ? adaptDayDiff(adapt.lastPlayDate, adaptToday()) : 99;
      const alive = adapt.playStreak >= 2 && gap <= 1;
      chip.style.display = alive ? '' : 'none';
      if(alive) chip.innerHTML = `🔥 <span>${adapt.playStreak}</span>`;
      chip.title = alive ? `${adapt.playStreak}-day streak — play today to keep it going` : '';
    }
  }
  document.getElementById('home-next-day').textContent=eco.day+1;
  document.getElementById('home-nametag').textContent = stores[activeStoreIdx]?.name || 'Burger Bar #1';

  // Sync restaurant preview to current active store
  rp.storeIdx = activeStoreIdx;

  // SINGLE-BAR MODE: the multi-store empire is disabled while we master the
  // first bar, so the Stores button and store-swipe controls stay hidden.
  const storeBtn = document.getElementById('home-stores-btn');
  if(storeBtn) storeBtn.style.display = 'none';

  // Preview the goals for the day you're about to play (deterministic per day,
  // so these are the exact goals that go live when you press PLAY).
  rollDailyGoals(eco.day + 1);
  renderHomeAchievements();

  document.getElementById('home-screen').style.display='flex';

  // Celebrate any achievements unlocked during the day just completed.
  flushAchvToasts();
  // Heads-up about tomorrow (milestones / new shop items) while there's still
  // time to prepare. Slight delay so it lands after the home screen settles.
  setTimeout(flushDayHeadsUp, 400);

  // Init 3D home chef renderer (once) then start anim
  stopHomeAnim();
  if(!hc.renderer) { initHomeRenderer(); }
  else { resizeHomeCanvas(); buildHomeChef(); }
  initChefDrag();          // no-ops unless this canvas element is new
  applyChefSkin(cosm.equippedSkin);
  runHomeAnim();

  // Preview window onto the player's real bar (drawn by the main loop).
  initRestaurantRenderer();
}
window.showStartMenu = showStartMenu;

// ── SOUND TOGGLE ─────────────────────────────────────────────
let soundMuted = false;
function toggleSound(){
  soundMuted = !soundMuted;
  const btn = document.getElementById('sound-toggle-btn');
  if(btn){ btn.textContent = soundMuted ? '🔇 Muted' : '🔊 Sound'; btn.classList.toggle('muted', soundMuted); }
  if(audioCtx){ if(soundMuted) audioCtx.suspend(); else audioCtx.resume(); }
}
// Patch playSound to respect mute
const _origPlaySound = playSound;
window.playSound = function(type, at){ if(!soundMuted) _origPlaySound(type, at); };
window.toggleSound=toggleSound;

// ── SETTINGS PANEL ───────────────────────────────────────────
function refreshSettingsUI(){
  const v = Math.round((settings.volume!=null?settings.volume:0.8)*100);
  const vol = document.getElementById('set-vol'); if(vol) vol.value = v;
  const volv = document.getElementById('set-vol-val'); if(volv) volv.textContent = v+'%';
  const ms = document.getElementById('set-music-state');
  if(ms){ ms.textContent = settings.music!==false?'ON':'OFF'; ms.style.color = settings.music!==false?'#66BB6A':'#888'; }
  const cb = document.getElementById('set-cb-state');
  if(cb){ cb.textContent = settings.colorblind?'ON':'OFF'; cb.style.color = settings.colorblind?'#66BB6A':'#888'; }
  const df = document.getElementById('set-diff-state');
  if(df){ const casual = settings.difficulty==='casual'; df.textContent = casual?'CASUAL':'NORMAL'; df.style.color = casual?'#66BB6A':'#90caf9'; }
  const tg = document.getElementById('set-tag-state');
  if(tg){ tg.textContent = settings.ordertags?'ON':'OFF'; tg.style.color = settings.ordertags?'#66BB6A':'#888'; }
  const hp = document.getElementById('set-hap-state');
  if(hp){ const on = settings.haptics !== false; hp.textContent = on?'ON':'OFF'; hp.style.color = on?'#66BB6A':'#888'; }
  const gf = document.getElementById('set-gfx-state');
  if(gf){ const g = settings.graphics || 'auto';
    gf.textContent = g==='high'?'HIGH':g==='low'?'BATTERY SAVER':'AUTO';
    gf.style.color = g==='high'?'#FFD54F':g==='low'?'#66BB6A':'#90caf9'; }
  const bg = document.getElementById('set-big-state');
  if(bg){ bg.textContent = settings.bigtext?'ON':'OFF'; bg.style.color = settings.bigtext?'#66BB6A':'#888'; }
}
function showSettings(){
  stopHomeAnim();
  document.getElementById('home-screen').style.display='none';
  document.getElementById('pause-screen').style.display='none';
  refreshSettingsUI();
  document.getElementById('settings-screen').style.display='flex';
}
function closeSettings(){
  document.getElementById('settings-screen').style.display='none';
  // Return to wherever makes sense: home if not mid-day, else resume pause.
  if(gameState==='playing'){ document.getElementById('pause-screen').style.display = gamePaused?'flex':'none'; }
  else showStartMenu();
}

// ── Reset progress: type-to-confirm so it can never be a one-tap accident ──
function showResetConfirm(){
  const inp = document.getElementById('reset-confirm-input');
  if(inp) inp.value = '';
  validateResetInput();
  document.getElementById('reset-confirm-screen').style.display='flex';
  if(inp) setTimeout(()=>inp.focus(), 50);
}
function closeResetConfirm(){
  document.getElementById('reset-confirm-screen').style.display='none';
}
function validateResetInput(){
  const inp = document.getElementById('reset-confirm-input');
  const btn = document.getElementById('reset-confirm-btn');
  if(!inp || !btn) return;
  const armed = inp.value.trim().toUpperCase() === 'RESET';
  btn.style.opacity = armed ? '1' : '.45';
  btn.style.pointerEvents = armed ? 'auto' : 'none';
}
function doReset(){
  const inp = document.getElementById('reset-confirm-input');
  if(!inp || inp.value.trim().toUpperCase() !== 'RESET') return; // guard
  // The backup must go too, or loadSave() would faithfully "recover" the run
  // the player just asked to erase.
  ['burgerBoss_save','burgerBoss_save_bak','burgerBoss_save_corrupt','burgerBoss_tutorialSeen']
    .forEach(k=>{ try { localStorage.removeItem(k); } catch(_){} });
  location.reload();
}
window.showResetConfirm=showResetConfirm; window.closeResetConfirm=closeResetConfirm;
window.validateResetInput=validateResetInput; window.doReset=doReset;
function setVolume(val){
  settings.volume = Math.max(0, Math.min(1, val/100));
  document.getElementById('set-vol-val').textContent = Math.round(settings.volume*100)+'%';
  if(masterGain) masterGain.gain.value = settings.volume;
  saveSettings();
}
function toggleMusic(){
  settings.music = !(settings.music!==false);
  if(musicGain) musicGain.gain.value = settings.music?0.42:0;
  if(settings.music){ if(audioCtx) startMusic(); } else { stopMusic(); }
  refreshSettingsUI(); saveSettings();
}
function toggleColorblind(){
  settings.colorblind = !settings.colorblind;
  refreshSettingsUI(); saveSettings();
}
function toggleOrderTags(){
  settings.ordertags = !settings.ordertags;
  refreshSettingsUI(); saveSettings();
}
function toggleBigText(){
  settings.bigtext = !settings.bigtext;
  applyBigText(); refreshSettingsUI(); saveSettings();
}
function applyBigText(){
  if(document.body && document.body.classList)
    document.body.classList.toggle('bigtext', !!settings.bigtext);
}
window.toggleOrderTags = toggleOrderTags;
window.toggleBigText = toggleBigText;
function toggleHaptics(){
  settings.haptics = settings.haptics === false;
  saveSettings(); refreshSettingsUI();
  haptic('medium');
}
window.toggleHaptics = toggleHaptics;
function toggleGraphics(){
  const order = ['auto','high','low'];
  settings.graphics = order[(order.indexOf(settings.graphics||'auto')+1) % order.length];
  // A manual change resets what Auto learned, so Auto gets a fresh look.
  if(settings.graphics === 'auto') delete settings.autoTier;
  saveSettings(); applyQuality(); refreshSettingsUI();
}
window.toggleGraphics = toggleGraphics;
function toggleDifficulty(){
  settings.difficulty = (settings.difficulty==='casual') ? 'normal' : 'casual';
  refreshSettingsUI(); saveSettings();
}
// Difficulty helpers used by gameplay.
function diffPatienceMult(){ return settings.difficulty==='casual' ? 1.4 : 1.0; }
function diffPayoutMult(){ return settings.difficulty==='casual' ? 1.15 : 1.0; }
function diffNoFail(){ return settings.difficulty==='casual'; }
// ── SAVE EXPORT / IMPORT (backup & transfer; no cloud) ───────
function exportSave(){
  try {
    saveGame();
    const raw = localStorage.getItem('burgerBoss_save') || '';
    if(!raw){ showToast('No save to export'); return; }
    const code = btoa(unescape(encodeURIComponent(raw)));
    // Prefill a prompt so the player can copy the backup code.
    window.prompt('Your backup code (copy & keep it safe):', code);
  } catch(e){ showToast('Export failed'); }
}
function importSave(){
  const code = window.prompt('Paste a backup code to restore (this overwrites current progress):', '');
  if(!code) return;
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const obj = JSON.parse(json);          // validate it parses
    if(!obj || typeof obj !== 'object' || !obj.stores) throw new Error('bad');
    localStorage.setItem('burgerBoss_save', json);
    showToast('✅ Save imported! Reloading…');
    setTimeout(()=>location.reload(), 800);
  } catch(e){ showToast('❌ Invalid backup code'); }
}
window.showSettings=showSettings; window.closeSettings=closeSettings;
window.setVolume=setVolume; window.toggleMusic=toggleMusic; window.toggleColorblind=toggleColorblind;
window.toggleDifficulty=toggleDifficulty; window.exportSave=exportSave; window.importSave=importSave;

// ── PAUSE ────────────────────────────────────────────────────
let gamePaused = false;
function togglePause(){
  if(gameState !== 'playing' && !gamePaused) return;
  gamePaused = !gamePaused;
  const ps = document.getElementById('pause-screen');
  ps.style.display = gamePaused ? 'flex' : 'none';
  if(!gamePaused) hideQuitConfirm();
}
function showQuitConfirm(){
  document.getElementById('quit-confirm').style.display='flex';
}
function hideQuitConfirm(){
  document.getElementById('quit-confirm').style.display='none';
}
function quitToMenu(){
  gamePaused = false;
  document.getElementById('pause-screen').style.display='none';
  document.getElementById('quit-confirm').style.display='none';
  gameState = 'start_menu';
  document.getElementById('top-hud').style.display='none';
  document.getElementById('pause-btn').style.display='none';
  hlRing.visible=false;

  // ── Roll back to pre-day state ──
  if(window._daySnapshot){
    eco.day        = window._daySnapshot.day - 1;  // undo the day++ from executeDayStart
    eco.cash       = window._daySnapshot.cash;      // undo any cash earned mid-day
    gStats.lifeStars  = window._daySnapshot.gStars;  // undo partial star progress
    gStats.lifeGroups = window._daySnapshot.gGroups;
    window._daySnapshot = null;
  }

  // Clean up any customers/groups that were spawned
  groups.forEach(g => scene.remove(g.mesh));
  groups = [];

  updateCashUI();
  saveGame();
  showStartMenu();
}
window.togglePause=togglePause; window.quitToMenu=quitToMenu;
window.showQuitConfirm=showQuitConfirm; window.hideQuitConfirm=hideQuitConfirm;

// ── SKINS SHOP ───────────────────────────────────────────────
// Paint the character row. Characters are free body plans -- the paid cosmetic
// is still the skin -- so this is a straight picker with no price gating.
function renderCharacterRow(){
  const row = document.getElementById('char-row');
  if(!row) return;
  row.innerHTML = '';
  const cur = cosm.character || 'human';
  for(const ch of CHARACTERS){
    const chip = document.createElement('div');
    chip.className = 'char-chip' + (ch.id === cur ? ' on' : '');
    chip.innerHTML = `<div class="cc-ico">${ch.icon}</div>` +
                     `<div class="cc-name">${ch.name}</div>` +
                     `<div class="cc-kind">${ch.kind}</div>`;
    chip.onclick = () => setCharacter(ch.id);
    row.appendChild(chip);
  }
}
function setCharacter(id){
  if(!CHARACTERS.some(c => c.id === id)) return;
  cosm.character = id;
  try{ rebuildPlayerMesh(); }catch(e){ console.warn('Player rebuild failed', e); }
  if(hc.scene) buildHomeChef();
  saveGame();
  renderCharacterRow();
  playSound('coin');
}
// "Surprise me" deliberately never lands on the human chef or on who you
// already are -- the point is to get something you didn't pick.
function randomCharacter(){
  const pool = CHARACTERS.filter(c => c.id !== 'human' && c.id !== (cosm.character || 'human'));
  if(!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  setCharacter(pick.id);
  showToast(`${pick.icon} ${pick.name} is on the line!`);
}
window.setCharacter = setCharacter;
window.randomCharacter = randomCharacter;

function showSkinsShop(){
  stopHomeAnim();
  document.getElementById('home-screen').style.display='none';
  document.getElementById('skins-cash').textContent='$'+eco.cash.toFixed(2);
  renderCharacterRow();
  const grid = document.getElementById('skin-grid');
  grid.innerHTML='';
  for(const sk of SKIN_DEFS){
    const owned = cosm.ownedSkins.includes(sk.id);
    const equipped = cosm.equippedSkin === sk.id;
    const canAfford = eco.cash >= sk.price;
    const card = document.createElement('div');
    card.className = 'skin-card' + (owned?' owned':'') + (equipped?' equipped':'');
    card.innerHTML = `
      <div class="skin-icon">${sk.icon}</div>
      <div class="skin-name">${sk.name}</div>
      ${equipped ? '<div class="skin-price" style="color:#ffc107;font-size:13px;">✓ WEARING</div>' :
        owned    ? '<div class="skin-price" style="color:#66BB6A;">TAP TO EQUIP</div>' :
        `<div class="skin-price">${sk.price===0?'FREE':'💰 $'+sk.price}</div>`}
    `;
    card.onclick=()=>{
      if(!owned){
        if(eco.cash < sk.price){ showToast('Not enough cash! 💸'); return; }
        eco.cash -= sk.price;
        cosm.ownedSkins.push(sk.id);
        updateCashUI();
      }
      cosm.equippedSkin = sk.id;
      applyChefSkin(sk.id);
      saveGame();
      showSkinsShop(); // refresh
    };
    grid.appendChild(card);
  }
  document.getElementById('skins-screen').style.display='flex';
}
function closeSkinsShop(){
  document.getElementById('skins-screen').style.display='none';
  showStartMenu();
}
window.showSkinsShop=showSkinsShop; window.closeSkinsShop=closeSkinsShop;

// ── PRACTICE / TUTORIAL ─────────────────────────────────────
const PRACTICE_STEPS = {
  burger: [
    { vis:[{i:'🧊',l:'Fridge'},{a:1},{i:'🥩',l:'Raw patty',h:1}], icon:'🧊', title:`Step 1 — Grab Raw Meat`, desc:`Walk to the Fridge and press ACT to pick up a raw patty.` },
    { vis:[{i:'🥩',l:'Raw',h:1},{a:1},{i:'🔥',l:'Grill'},{a:1},{i:'🍖',l:'Cooked',h:1}], timeline:1, icon:'🔥', title:`Step 2 — Cook on the Grill`, desc:`Carry the patty to the Grill and press ACT to place it. Watch the green progress bar fill up. When it turns orange, it's cooked — pick it up before it burns (turns black)!` },
    { vis:[{i:'🍱',l:'Tray Rack'},{a:1},{i:'🍽️',l:'Clean tray',h:1}], icon:'🍱', title:`Step 3 — Grab a Tray`, desc:`Go to the Tray Rack and press ACT to pick up a clean tray.` },
    { vis:[{i:'🍖',l:'Cooked',h:1},{i:'🍽️',l:'+ Tray',h:1},{a:1},{i:'🍔',l:'Burger',h:1}], icon:'🍔', title:`Step 4 — Assemble on Counter`, desc:`Bring the cooked patty to a Counter while holding a tray — or place the patty on the counter, then grab the tray and come back — the burger auto-assembles on the counter.` },
    { vis:[{i:'🍔',l:'Burger',h:1},{a:1},{i:'🪑',l:'Table'},{a:1},{i:'💰',l:'Paid'}], icon:'🛎️', title:`Step 5 — Serve the Table`, desc:`Carry the burger tray to a table with waiting customers (look for the 🍔 bubble above their head) and press ACT to serve them.` },
    { vis:[{i:'🍽️',l:'Dirty',w:1},{a:1},{i:'🚿',l:'Sink 3s'},{a:1},{i:'🍱',l:'Tray Rack'}], icon:'🍽️', title:`After Eating — Clean Up`, desc:`After customers eat, dirty trays appear on the table. Pick them up, take to the Sink (hold ACT for 3 seconds to wash), then return the clean tray to the Tray Rack.` },
    { vis:[{i:'🍽️',l:'Tray',h:1},{a:1},{i:'🥤',l:'Fountain'},{a:1},{i:'🍔🥤',l:'Combo',h:1}], icon:'🥤', title:`Bonus — Soda Fountain`, desc:`After Day 5 you can unlock a Soda Fountain. Customers may order soda or a burger+soda combo. Use the tray + soda fountain to assemble a combo before serving.` },
    { vis:[{i:'🤖',l:'Chef'},{i:'🛎️',l:'Waiter'},{i:'🧹',l:'Busser'}], icon:'🤖', title:`Robots Help You!`, desc:`Buy robots from the Shop. Set their role in Edit Mode: Chef cooks patties, Waiter serves food, Busser cleans trays. Robots level up each day!` },
  ],
};

// A picture of the line. Text alone never made clear that the loop CLOSES --
// that dirty trays have to come back round to the rack before you can plate
// again -- so the return path is drawn explicitly.
function practiceFlowSVG(){
  const nodes = [['🧊','Fridge'],['🔥','Grill'],['🍱','Trays'],['🍔','Build'],['🛎️','Serve']];
  const xs = [34, 106, 178, 250, 322];
  let n = '';
  nodes.forEach(([ico, lbl], i) => {
    const cls = i === 1 ? 'pf-node pf-node-hot' : i === 2 ? 'pf-node pf-node-cool' : 'pf-node';
    n += `<circle class="${cls}" cx="${xs[i]}" cy="30" r="17"/>` +
         `<text x="${xs[i]}" y="36" text-anchor="middle" font-size="16">${ico}</text>` +
         `<text class="pf-label" x="${xs[i]}" y="59" text-anchor="middle">${lbl}</text>`;
    if(i < nodes.length - 1)
      n += `<path class="pf-arrow" d="M${xs[i]+20} 30 H${xs[i+1]-22}" marker-end="url(#pfArrow)"/>`;
  });
  // Wash loop: Serve -> Sink -> back to the tray rack.
  const wash = 'Wash trays';
  n += `<path class="pf-arrow-loop" d="M322 50 V82 H196" marker-end="url(#pfArrowC)"/>` +
       `<circle class="pf-node pf-node-cool" cx="178" cy="82" r="15"/>` +
       `<text x="178" y="87" text-anchor="middle" font-size="14">🚿</text>` +
       `<text class="pf-label" x="178" y="104" text-anchor="middle">${wash}</text>` +
       `<path class="pf-arrow-loop" d="M178 67 V50" marker-end="url(#pfArrowC)"/>`;
  return `<svg viewBox="0 0 356 112" role="img" aria-label="Kitchen flow: ${nodes.map(x=>x[1]).join(' to ')}, then wash and repeat">
    <defs>
      <marker id="pfArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="rgba(255,255,255,.35)"/></marker>
      <marker id="pfArrowC" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="rgba(79,195,247,.5)"/></marker>
    </defs>
    <text class="pf-cap" x="4" y="10">THE LINE</text>
    ${n}
  </svg>`;
}

// "What you're holding, before and after" for a single step. Green tiles are
// things in your hands; red is something that needs dealing with.
function stepVisual(step){
  let out = '';
  if(step.vis && step.vis.length){
    out += '<div class="pstep-vis">' + step.vis.map(v =>
      v.a ? '<span class="pv-arrow">→</span>'
          : `<span class="pv-tile${v.h?' hold':''}${v.w?' warn':''}">` +
            `<span class="pv-ico">${v.i}</span><span class="pv-lbl">${v.l}</span></span>`
    ).join('') + '</div>';
  }
  if(step.timeline){
    // The grill's three states, in the order you'll meet them.
    out += '<div class="pv-timeline">' +
           '<span class="pv-seg" style="background:#4CAF50;flex:2;">COOKING</span>' +
           '<span class="pv-seg" style="background:#FF9800;flex:1.4;">READY — GRAB IT</span>' +
           '<span class="pv-seg" style="background:#212121;color:rgba(255,255,255,.7);flex:1;">BURNT</span>' +
           '</div>';
  }
  return out;
}

function showPractice(){
  const steps = PRACTICE_STEPS.burger;
  const sub = `Burger Bar — Cooking guide`;
  const container = document.getElementById('practice-steps');
  const subtitleEl = document.getElementById('practice-subtitle-text') || document.getElementById('practice-subtitle');
  if(subtitleEl) subtitleEl.textContent = sub;
  const flow = document.getElementById('practice-flow');
  if(flow) flow.innerHTML = practiceFlowSVG();
  container.innerHTML = '';
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'practice-step';
    div.innerHTML = `
      <div class="pstep-icon">${step.icon}</div>
      <div class="pstep-body">
        <div class="pstep-title">${step.title}</div>
        <div class="pstep-desc">${step.desc}</div>
        ${stepVisual(step)}
      </div>`;
    container.appendChild(div);
  });
  document.getElementById('practice-screen').style.display = 'flex';
}
function closePractice(){
  document.getElementById('practice-screen').style.display = 'none';
}
window.showPractice = showPractice;
window.closePractice = closePractice;

// ── FIRST-RUN INTRO CAROUSEL ─────────────────────────────────
// A paged, screenshot-style walkthrough shown once to new players. Each slide
// is a mocked-up game "screenshot" plus a short caption. Players can tap Next
// to step through, Back to revisit, or Skip to jump straight into Day 1.
const INTRO_SLIDES = [
  { title:'Welcome to Burger Bar!',
    desc:"You're the chef AND the boss. Cook food, serve hungry customers, and grow your restaurant one day at a time.",
    art:`<div class="iscene"><div class="ichip">📅 Day 1 &nbsp;·&nbsp; ⭐ 5.0</div><div class="ibig">🍔<br>👨‍🍳</div></div>` },
  { title:'Move & Act',
    desc:'Drag your thumb on the LEFT side to walk around. Tap the ✋ button on the RIGHT to pick things up and use stations.',
    art:`<div class="iscene"><div class="ibig">🧍</div><div class="ijoy">⊕</div><div class="iact">✋</div></div>` },
  { title:'Cook the Food',
    desc:'Grab a raw patty from the Fridge, cook it on the Grill until golden (don’t let it burn!), then grab a tray and build the burger on the Counter.',
    art:`<div class="iscene"><div class="iflow"><span>🧊</span><span class="arr">→</span><span>🔥</span><span class="arr">→</span><span>🍔</span></div></div>` },
  { title:'Serve Your Customers',
    desc:'Watch for the 🍔 bubble above a table. Carry the finished order over and tap ✋ to serve. Faster service means more stars and bigger tips!',
    art:`<div class="iscene"><div class="ibig">🪑😋</div><div class="ibubble">🍔</div><div class="iact">✋</div></div>` },
  { title:'Keep It Clean',
    desc:'After guests eat, dirty trays pile up. Take them to the Sink, hold ✋ to wash, then return them to the rack so you never run out.',
    art:`<div class="iscene"><div class="ibig">🍽️ 🚿</div></div>` },
  { title:'Grow Your Empire',
    desc:'Spend earnings in the Shop on upgrades and 🤖 robots that cook for you. Hit milestones to unlock 🏆 achievements, new skins and more locations!',
    art:`<div class="iscene"><div class="ichip">🏆 Achievements</div><div class="ibig">🛒 🤖 🏪</div></div>` },
];
let introIdx = 0;
function renderIntro(){
  const s = INTRO_SLIDES[introIdx];
  document.getElementById('intro-shot').innerHTML = s.art;
  document.getElementById('intro-title').textContent = s.title;
  document.getElementById('intro-desc').textContent = s.desc;
  const dots = document.getElementById('intro-dots'); dots.innerHTML='';
  INTRO_SLIDES.forEach((_,i)=>{ const d=document.createElement('span'); if(i===introIdx) d.className='on'; dots.appendChild(d); });
  document.getElementById('intro-back').disabled = (introIdx===0);
  const last = (introIdx===INTRO_SLIDES.length-1);
  document.getElementById('intro-next').textContent = last ? "Let's Cook! ▶" : 'Next →';
}
function showIntro(){ introIdx=0; renderIntro(); document.getElementById('intro-screen').style.display='flex'; }
function introNext(){ if(introIdx>=INTRO_SLIDES.length-1){ endIntro(); return; } introIdx++; renderIntro(); }
function introPrev(){ if(introIdx>0){ introIdx--; renderIntro(); } }
function endIntro(){ document.getElementById('intro-screen').style.display='none'; }
window.showIntro=showIntro; window.introNext=introNext; window.introPrev=introPrev; window.endIntro=endIntro;

// ── MULTI-STORE ──────────────────────────────────────────────
function calcPassiveIncome(store) {
  // Each robot generates $16/day passively at an idle store
  const robotCount = (store.upg && store.upg.robotCount) || 0;
  return Math.round(robotCount * 16 * 100) / 100;
}

function showStores(){
  if(SINGLE_BAR_MODE){ showStartMenu(); return; } // empire disabled for now
  document.getElementById('home-screen').style.display='none';
  const list = document.getElementById('stores-list');
  list.innerHTML='';

  // NOTE: Passive income is accrued exclusively in endDay() (single source of
  // truth). This screen is display-only and must not pay out, to avoid
  // double-counting.

  for(let i=0;i<stores.length;i++){
    const store = stores[i];
    const isActive = i === activeStoreIdx;
    const passive = calcPassiveIncome(store);
    const card = document.createElement('div');
    card.className = 'store-card' + (isActive?' active-store':'');
    card.innerHTML = `
      <div style="font-size:36px;">🏪</div>
      <div style="flex:1;">
        <div style="font-weight:900;font-size:17px;">${store.name}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:3px;">
          Day ${store.eco.day} · $${(store.eco.cash||0).toFixed(2)} · ⭐${store.gStats.lifeGroups?((store.gStats.lifeStars/store.gStats.lifeGroups).toFixed(1)):'0.0'}
        </div>
        <div style="font-size:12px;color:#66BB6A;margin-top:2px;">🤖 Passive: +$${passive}/day (${store.upg.robotCount||0} robots)</div>
      </div>
      <div>
        ${isActive
          ? '<span style="color:#ffc107;font-weight:900;font-size:13px;">ACTIVE</span>'
          : `<button class="buy-btn" onclick="switchToStore(${i})">VISIT</button>`}
      </div>
    `;
    list.appendChild(card);
  }

  // New store unlock
  const canUnlock = eco.day >= 30 && eco.cash >= 3000;
  const newCard = document.createElement('div');
  newCard.className = 'store-card locked-store';
  newCard.innerHTML = `
    <div style="font-size:36px;">🔒</div>
    <div style="flex:1;">
      <div style="font-weight:900;font-size:16px;">Open New Location</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:3px;">Requires Day 30 · Costs $3,000</div>
      <div style="font-size:12px;color:rgba(255,255,255,.4);">Day ${Math.max(0,30-eco.day)} days away</div>
    </div>
    <button class="buy-btn" ${canUnlock?'':'disabled'} onclick="openNewStore()">$3,000</button>
  `;
  list.appendChild(newCard);

  document.getElementById('stores-screen').style.display='flex';
}
function closeStores(){
  document.getElementById('stores-screen').style.display='none';
  showStartMenu();
}
let groups=[];
let wings_obj=[];

function cleanupGameScene(){
  // Remove all customers from scene
  groups.forEach(g => discard(scene, g.mesh));
  groups = [];
  // Remove all station visuals
  for(const k in stations){
    if(stations[k].visuals) stations[k].visuals.forEach(v => discard(scene, v));
    discard(stGrp, stations[k].mesh);
    delete stations[k];
    markStationsDirty();
  }
  // Remove all wings geometry
  wings_obj.forEach(w=>{ discard(scene, w.obj||w); });
  wings_obj = [];
  // Clear any held item
  player.holding = null;
  updateHolding();
  // Reset stats
  stats = {groupsServed:0, totalStars:0, cashEarned:0, groupsLeft:0, spawnTimer:0, initialGroups:1, maxSimultaneous:1};
  // Reset day snapshot
  window._daySnapshot = null;
  // Hide in-game HUD
  document.getElementById('top-hud').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'none';
  hlRing.visible = false;
}

function switchToStore(idx){
  saveGame();
  cleanupGameScene();
  activeStoreIdx = idx;
  loadActiveStore();
  if(stores[idx].layout && stores[idx].layout.length>0){
    stores[idx].layout.forEach(l=>addStation(l.id,l.type,l.x,l.z,l.w,l.d,{role:l.role,hiredDay:l.hiredDay}));
  } else {
    initStations();
  }
  rebuildAll();
  updateCashUI();
  saveGame();
  closeStores();
}
function openNewStore(){
  if(eco.cash < 3000 || eco.day < 30) return;
  eco.cash -= 3000;
  const newId = stores.length;
  const storeTypes = [
    {name:'Downtown Diner',   type:'burger'},
    {name:'Westside Grill',   type:'burger'},
    {name:'East End Kitchen', type:'burger'},
    {name:'Harbor Bites',     type:'burger'},
  ];
  const def = storeTypes[newId-1] || {name:`Location #${newId+1}`, type:'burger'};
  const newStore = defStore(newId, def.name, def.type);
  stores.push(newStore);
  updateCashUI();
  saveGame();
  if(typeof checkAchievements==='function') checkAchievements();
  showToast(`🎉 ${def.name} opened!`);
  closeStores();
  showStores();
}
window.showStores=showStores; window.closeStores=closeStores; window.switchToStore=switchToStore; window.openNewStore=openNewStore;

function startNextDay(){
  // The Soda Fountain is no longer force-introduced mid-transition. It's a
  // normal Shop purchase that unlocks once Day 5 is complete (see SHOP_DEFS),
  // so you can buy and arrange it on the Day 6 prep screen before using it.
  executeDayStart();
}

// How many groups a given day will bring. Day length is CAPPED: it used to be
// `day + 1` forever, so a Day-100 shift was 100+ groups of identical work --
// fatigue, not difficulty. Past the cap the day gets harder instead (more
// simultaneous arrivals, tighter patience, Kitchen Heat). Shared with the daily
// goals so a goal can never ask for more customers than the day will send.
const DAY_LENGTH_CAP = 28;
function plannedGroupCount(day){
  let rating = parseFloat(getCumRating());
  if(day === 1) rating = 3.0;
  const multi = rating >= 4.0 ? 1.3 : rating < 3.0 ? 0.7 : 1.0;
  const baseGroups = Math.min(day + 1, DAY_LENGTH_CAP);
  return Math.max(1, Math.min(DAY_LENGTH_CAP, Math.floor(baseGroups * multi)));
}

function executeDayStart() {
  eco.day++;
  // Advance the calendar streak / heat before anything reads difficulty.
  const heatNote = adaptStartShift();

  // Snapshot state BEFORE the day runs so we can restore on quit
  window._daySnapshot = {
    day: eco.day,
    cash: eco.cash,
    gStars: gStats.lifeStars,
    gGroups: gStats.lifeGroups,
  };
  
  const groupCount = plannedGroupCount(eco.day);

  // Simultaneous arrivals ramp with the day (and with how many tables you own),
  // which is what makes late days demanding now that they're length-capped.
  // Kitchen Heat (calendar streak + recent skill) can add another arrival slot.
  const baseSimultaneous = eco.day >= 10 ? Math.min(2 + Math.floor((eco.day - 10) / 12), 5) : 1;
  const maxSimultaneousGroups = Math.max(1, Math.min(upg.tableCount, baseSimultaneous + heatExtraSimultaneous(), 6));
  
  // First spawn: give player 8 seconds to get ready (longer on early days)
  const firstSpawnDelay = eco.day <= 3 ? 600 : eco.day <= 6 ? 480 : 300;
  stats={groupsServed:0, totalStars:0, cashEarned:0, groupsLeft:groupCount, initialGroups:groupCount,
         spawnTimer: firstSpawnDelay, maxSimultaneous: maxSimultaneousGroups, combosServed:0, walkouts:0,
         heat: effectiveHeat(), rushAt: planRushes(groupCount), rushTimer:0, rushes:0};
  setRushBanner(false);
  serveStreak = 0; streakTimer = 0;
  rollDailyGoals(eco.day); // fresh objectives for the day about to start

  document.getElementById('home-screen').style.display='none';
  document.getElementById('top-hud').style.display='flex';
  { const th = document.getElementById('touch-hint'); if(th) th.style.display = eco.day <= 3 ? '' : 'none'; }
  document.getElementById('pause-btn').style.display='flex';
  {
    const gh = document.getElementById('goals-hud');
    if(gh){ gh.style.display = 'flex'; gh.classList.remove('open'); }
    goalsPanelOpen = false;
    renderGoalsPanel();
  }
  releaseHomeRenderers();   // free the two Home Screen WebGL contexts
  ['start-screen','shop-screen','results-screen'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.style.display='none';
  });
  
  {
    const hl = heatLabel();
    document.getElementById('day-banner').innerHTML=`DAY ${eco.day}<br><span id="day-sub" style="font-size:11px;color:rgba(255,255,255,.45);">Customers: ${groupCount}</span>` +
      (hl ? `<br><span id="day-heat" class="${adapt.easeShifts>0?'ease':''}">${hl}</span>` : '');
  }
  updateCashUI();

  let traysAssigned = false;
  for(const k in stations){
    const s=stations[k];
    if(s.type==='grill') s.slots=[null,null];
    if(s.type==='fryer') s.slots=[null,null];
    if(s.type==='counter') s.item=null;
    if(s.type==='sink')    s.cleanTrays=0;
    if(s.type==='trayrack') { s.cleanTrays = traysAssigned ? 0 : eco.totalTrays; traysAssigned = true; }
    if(s.type==='table')   { s.group=null; s.served=0; s.dirtyTrays=0; }
  }

  player.holding=null; updateHolding();
  groups.forEach(g=>discard(scene, g.mesh)); groups=[];

  for(const k in stations) if(stations[k].type==='robot') { stations[k].state='idle'; stations[k].holding=null; }

  updateStationVisuals();
  // Robots level up overnight; swap their models and call it out.
  refreshUpgradeVisuals().filter(s=>s.type==='robot').forEach(s=>{
    spawnFloater(s.mesh.position.clone().add(new THREE.Vector3(0,3.2,0)), `⬆ Lv.${getRobotLevel(s)} ${s.role.toUpperCase()}`, '#4FC3F7');
  });
  player.pos=getValidSpawn(); pMesh.position.copy(player.pos);
  gameState='playing'; gamePaused=false;
  actionBtn.innerHTML='✋'; actionBtn.style.background='rgba(255,200,30,.8)';
  saveGame();
  if(heatNote) setTimeout(()=>{ try{ showToast(heatNote, 3200); }catch(e){} }, 900);
  if(tutorialShouldStart()) startTutorial();
  setMusicMood(1);
  // NOTE: day-milestone heads-ups (Busy Hours/VIP, new unlocks, etc.) are no
  // longer shown here at the START of a day — they're queued at the END of the
  // previous day (see queueNextDayHeadsUp) so the player can prepare first.
}
window.startNextDay = startNextDay;

function homePlaySelected(){
  // SINGLE-BAR MODE always launches the first bar regardless of preview state.
  const targetIdx = SINGLE_BAR_MODE ? 0 : rp.storeIdx;
  if(targetIdx >= stores.length) return; // shouldn't happen but guard

  if(targetIdx !== activeStoreIdx){
    saveGame();
    cleanupGameScene();
    activeStoreIdx = targetIdx;
    loadActiveStore();
    if(stores[targetIdx].layout && stores[targetIdx].layout.length>0){
      stores[targetIdx].layout.forEach(l=>addStation(l.id,l.type,l.x,l.z,l.w,l.d,{role:l.role,hiredDay:l.hiredDay}));
    } else {
      initStations();
    }
    rebuildAll();
    updateCashUI();
    saveGame();
  }
  startNextDay();
}
window.homePlaySelected = homePlaySelected;

function closeShop(){
  document.getElementById('shop-screen').style.display='none';
  showStartMenu();
}
window.closeShop = closeShop;

function showShop(){
  stopHomeAnim();
  document.getElementById('home-screen').style.display='none';
  document.getElementById('start-screen').style.display='none';
  document.getElementById('shop-cash-display').textContent='$'+eco.cash.toFixed(2);
  updateShop();
  document.getElementById('shop-screen').style.display='flex';
  gameState='shop';
}
window.showShop=showShop;

function endDay(){
  stats._heatBefore = effectiveHeat();
  adaptEndShift(shiftPerformance());
  setRushBanner(false);
  gStats.lifeStars+=stats.totalStars;
  gStats.lifeGroups+=stats.groupsServed;
  hlRing.visible=false;
  document.getElementById('pause-btn').style.display='none';

  // Track a ROLLING rating (today's average, last 3 days) for the fail check so
  // one or two rough days can be recovered from instead of a sticky lifetime
  // average causing an unrecoverable death spiral. Lifetime rating is still
  // shown everywhere via getCumRating().
  if(!gStats.recentDays) gStats.recentDays = [];
  {
    // Walkouts are no longer booked as 0-star serves (they were inflating
    // groupsServed and every achievement keyed off it). They still cost
    // reputation, but at half weight and as a 1-star customer rather than a
    // zero -- a lost sale is its own punishment.
    const served = stats.groupsServed, walked = stats.walkouts || 0;
    const WALKOUT_WEIGHT = 0.5, WALKOUT_STARS = 1.0;
    const denom = served + walked * WALKOUT_WEIGHT;
    if(denom > 0){
      gStats.recentDays.push((stats.totalStars + walked * WALKOUT_WEIGHT * WALKOUT_STARS) / denom);
      if(gStats.recentDays.length > 3) gStats.recentDays.shift();
    }
  }
  const rollAvg = gStats.recentDays.length
    ? gStats.recentDays.reduce((a,b)=>a+b,0) / gStats.recentDays.length
    : 5;
  if(!diffNoFail() && eco.day>=5 && gStats.recentDays.length>=3 && rollAvg<2.0){
    gameState='gameover';
    document.getElementById('fail-days').textContent=eco.day;
    document.getElementById('gameover-screen').style.display='flex';
    saveGame(); return;
  }

  // Passive income from other stores. Disabled in single-bar mode so a dormant
  // map left over in an old multi-map save can't keep paying out invisibly.
  let passiveTotal = 0;
  if(!SINGLE_BAR_MODE) stores.forEach((store, idx) => {
    if(idx !== activeStoreIdx && store.unlocked) {
      const inc = calcPassiveIncome(store);
      passiveTotal += inc;
      store.eco.cash += inc;
    }
  });
  if(passiveTotal > 0) {
    eco.cash += passiveTotal;
    stats._passiveEarned = passiveTotal;
  } else { stats._passiveEarned = 0; }

  // Lifetime records
  records.totalServed += stats.groupsServed;
  const todayStarsAvg = stats.groupsServed>0 ? stats.totalStars/stats.groupsServed : 0;
  stats._newRecord = false;
  if(stats.cashEarned > records.bestDayCash){ records.bestDayCash = stats.cashEarned; stats._newRecord = true; }
  if(todayStarsAvg > records.bestDayStars) records.bestDayStars = todayStarsAvg;

  queueNextDayHeadsUp();   // heads-up about tomorrow, shown on the Home Screen
  checkDailyGoals();       // award daily-goal bonuses before the results math
  checkAchievements(true); // award now; celebrate on the Home Screen
  gameState='results'; saveGame(); playSound('daycomplete'); showResults();
}

// Day-milestone alerts + newly-unlocked shop items are queued at the END of a
// day and shown on the Home Screen, so the player learns what's coming while
// they still have time to buy gear and arrange the bar before pressing PLAY.
let pendingDayHeadsUp = null;
function queueNextDayHeadsUp(){
  const completed = eco.day;        // the day just finished
  const upcoming  = completed + 1;  // the day about to be played
  const parts = [];
  let color = '#4CAF50', title = `📣 HEADS UP · DAY ${upcoming}`;

  // One new mechanic per heads-up, matching when spawnGroup() introduces it.
  if(upcoming === 8){
    color = '#7E57C2'; title = '📣 TOMORROW: VIP GUESTS';
    parts.push("Impatient <b>VIPs</b> (💢) start visiting. They wait half as long but pay <b>3×</b>. Seat and serve them first!");
  }
  if(upcoming === 10){
    color = '#F44336'; title = '📣 TOMORROW: BUSY HOURS';
    parts.push("Day 10 gets busy — <b>multiple groups</b> can arrive at once. Stock trays and keep the grill full!");
  }
  if(upcoming === 12){
    color = '#FF7043'; title = '📣 TOMORROW: BIG APPETITES';
    parts.push("<b>Hungry regulars</b> (the big ones) order <b>three rounds</b> in a row. Keep a plate ready for their next order.");
  }
  if(!SINGLE_BAR_MODE && upcoming === 30){
    color = '#ab47bc'; title = '🏪 TOMORROW: EXPAND';
    parts.push("After Day 30 you can <b>Open a New Store</b> ($3,000) from the Stores menu for passive income.");
  }

  // Items whose unlock day is exactly today have just become buyable.
  const newlyUnlocked = SHOP_DEFS.filter(d => d.unlockDay === completed && !d.max());
  if(newlyUnlocked.length){
    parts.push(`<b>🆕 New in the Shop:</b><br>${newlyUnlocked.map(d=>d.label).join('<br>')}<br><span style="font-size:13px;opacity:.65;">Buy &amp; arrange them before you play.</span>`);
  }

  pendingDayHeadsUp = parts.length ? {color, title, html: parts.join('<br><br>')} : null;
}
function flushDayHeadsUp(){
  if(!pendingDayHeadsUp) return;
  const ev = pendingDayHeadsUp; pendingDayHeadsUp = null;
  const p = document.getElementById('alert-popup');
  if(!p) return;
  document.getElementById('alert-title').style.color = ev.color;
  document.getElementById('alert-title').textContent = ev.title;
  document.getElementById('alert-desc').innerHTML = ev.html;
  p.style.display = 'flex';
}

function showResults(){
  const scr=document.getElementById('results-screen');
  scr.style.display='flex';
  // Highlight a new daily-earnings record in the header.
  const dayLbl=document.getElementById('res-day-lbl');
  if(dayLbl){
    dayLbl.textContent = stats._newRecord ? '🏆 NEW BEST DAY!' : 'Day Complete';
    dayLbl.style.color = stats._newRecord ? '#FFD54F' : 'rgba(255,255,255,.4)';
  }
  // Today's rating as an exact average; light full stars by floor and show a
  // half-star for the .5 remainder so e.g. 4.5 shows 4½ stars, never 5.
  const todayAvg = stats.groupsServed>0 ? stats.totalStars/stats.groupsServed : 0;
  const fullStars = Math.floor(todayAvg);
  const hasHalf = (todayAvg - fullStars) >= 0.5;
  const cum=getCumRating();
  // eco.cash already includes today's serving cash + passive + achievement
  // bonuses, so back all of them out to get the true starting balance.
  const cashBefore=eco.cash-stats.cashEarned-(stats._passiveEarned||0)-(stats._achvEarned||0)-(stats._dailyEarned||0);

  const el=id=>document.getElementById(id);
  el('res-day-lbl').style.opacity='0'; el('res-title').style.opacity='0'; el('res-title').style.transform='scale(.75)';
  el('res-rating-num').style.opacity='0'; el('res-cash-earned').style.opacity='0'; el('res-cash-earned').style.transform='translateY(8px)';
  el('res-total-row').style.opacity='0'; el('res-next-btn').style.opacity='0'; el('res-next-btn').style.transform='translateY(10px)'; el('res-next-btn').style.pointerEvents='none';

  setTimeout(()=>el('res-day-lbl').style.opacity='1', 80);
  setTimeout(()=>{ el('res-title').style.opacity='1'; el('res-title').style.transform='scale(1)'; }, 220);

  const row=el('res-stars-row'); row.innerHTML='';
  for(let i=0;i<5;i++){
    const s=document.createElement('span'); s.className='star-slot'; s.textContent='⭐'; row.appendChild(s);
  }
  for(let i=0;i<5;i++) setTimeout(()=>{
    const sl=row.children[i];
    if(i < fullStars){ sl.classList.add('lit'); }
    else if(i === fullStars && hasHalf){ sl.style.opacity='.5'; } // half star
    else { sl.style.opacity='.18'; }
  }, 540+i*155);

  setTimeout(()=>{ el('res-rating-num').textContent=`⭐ ${todayAvg.toFixed(1)} today · ${cum} overall`; el('res-rating-num').style.opacity='1'; }, 1480);
  // One line of "what actually happened today". The results screen showed the
  // score but never the cause, so there was nothing to act on tomorrow.
  setTimeout(()=>{
    const co = el('res-coach'); if(!co) return;
    const walked = stats.walkouts || 0;
    const served = stats.groupsServed || 0;
    let msg;
    if(walked > 0){
      msg = `🚶 ${walked} ${walked===1?'customer':'groups of customers'} walked out — serve faster or add a table.`;
    } else if(served === 0){
      msg = 'No customers served today.';
    } else if(todayAvg >= 4.5){
      msg = '⭐ Nearly flawless service — keep that streak alive.';
    } else if(todayAvg >= 3.5){
      msg = '👍 Solid day. Shave a few seconds off each order for 5★.';
    } else {
      msg = '⏳ Orders sat too long — cook ahead and keep clean trays stocked.';
    }
    // Kitchen Heat recap: where tomorrow's difficulty is heading and why.
    const before = stats._heatBefore || 0, after = adapt.heat * heatRamp() * (settings.difficulty==='casual'?0.5:1);
    let heat = '';
    if(eco.day >= HEAT.RAMP_FROM_DAY){
      const arrow = after > before + 0.2 ? '▲' : after < before - 0.2 ? '▼' : '•';
      const streak = adapt.playStreak >= 2 ? `${adapt.playStreak}-day streak · ` : '';
      heat = `🔥 ${streak}Heat ${after.toFixed(1)} ${arrow} <span>(+${Math.round(HEAT.TIP_PER_HEAT*after*100)}% tips)</span>`;
    }
    co.textContent = msg; co.style.opacity = '1';
    const rh = el('res-heat'); if(rh) rh.innerHTML = heat;
  }, 1600);
  setTimeout(()=>{ el('res-cash-earned').textContent=`+$${stats.cashEarned.toFixed(2)}`; el('res-cash-earned').style.opacity='1'; el('res-cash-earned').style.transform='translateY(0)'; }, 1700);
  setTimeout(()=>{
    // Show passive + achievement income if any
    const passiveEarned = stats._passiveEarned || 0;
    const achvEarned = stats._achvEarned || 0;
    const dailyEarned = stats._dailyEarned || 0;
    const totalEarned = stats.cashEarned + passiveEarned + achvEarned + dailyEarned;
    el('res-prev').textContent='$'+cashBefore.toFixed(2); el('res-earn-sm').textContent='$'+totalEarned.toFixed(2);
    let extra = '';
    if(passiveEarned > 0) extra += ` (+$${passiveEarned.toFixed(2)} passive 🤖)`;
    if(dailyEarned > 0)   extra += ` (+$${dailyEarned.toFixed(2)} 🎯)`;
    if(achvEarned > 0)    extra += ` (+$${achvEarned.toFixed(2)} 🏆)`;
    if(extra) el('res-cash-earned').textContent=`+$${stats.cashEarned.toFixed(2)}${extra}`;
    el('res-total-row').style.opacity='1';
    const totalEl=el('res-new-total');
    const dur=900, t0=performance.now();
    (function tick(now){
      const t=Math.min((now-t0)/dur,1), e=1-Math.pow(1-t,3);
      totalEl.textContent='$'+(cashBefore+(eco.cash-cashBefore)*e).toFixed(2);
      if(t<1) requestAnimationFrame(tick); else totalEl.style.animation='totalPop .4s ease forwards';
    })(performance.now());
  }, 2100);
  // Daily goals recap (completed vs missed, with earned bonus).
  const gbox = el('res-goals-box'), glist = el('res-goals-list');
  if(gbox && glist){
    if(dailyGoals && dailyGoals.length){
      glist.innerHTML = dailyGoals.map(dg=>{
        const ok = dg.done;
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="font-size:16px;">${ok?'✅':'⬜'}</span>
            <span style="font-size:12px;font-weight:800;color:${ok?'#fff':'rgba(255,255,255,.55)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${dg.desc}</span>
          </div>
          <span style="font-size:12px;font-weight:900;color:${ok?'#66BB6A':'rgba(255,255,255,.3)'};flex-shrink:0;">${ok?'+$'+dg.reward:'+$'+dg.reward}</span>
        </div>`;
      }).join('');
      gbox.style.display='block';
      setTimeout(()=>{ gbox.style.opacity='1'; }, 2450);
    } else {
      gbox.style.display='none';
    }
  }
  setTimeout(()=>{ el('res-next-btn').style.opacity='1'; el('res-next-btn').style.transform='translateY(0)'; el('res-next-btn').style.pointerEvents='auto'; }, 3100);
}

