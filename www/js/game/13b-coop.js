// Burger Bar — 13b-coop. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ONLINE CO-OP (2 players)
// ─────────────────────────────────────────────────────────────
// One phone HOSTS: it runs the restaurant exactly as in single player. The
// other phone is the GUEST: it loads a copy of the host's stores, moves its
// own chef locally, and sends its position and every ACT press to the host.
// The host runs the guest's actions as if the guest's chef were standing
// there (coopRunAsGuest), then sends the state back ~10 times a second
// (customers, cooking, trays, robots, money, both chefs' hands). The guest
// smooths what it receives and never simulates customers or robots itself,
// so the two screens can't disagree about the restaurant.
//
// The connection is a "link": { send(msg), close(), onmessage, onclose }.
//   • coopGameCenterLink(): Game Center matches (iPhone/iPad, invite-only).
//   • coopTabLink(room): two browser tabs on one computer (development).
//   • tests pass their own in-memory link to coopBegin().
//
// Money: sales go to the host's register. When playing in a FRIEND's bar the
// guest keeps the tips on the plates they served (credited straight into the
// guest's own saved bar). In a shared partnership bar there's no split.

const COOP_SNAP_EVERY = 6;      // frames between snapshots (~10/s)
const COOP_INPUT_EVERY = 4;     // frames between guest position updates (~15/s)
const COOP_PING_MS = 2000;      // keep-alive, in real time (a slow phone still pings)
const COOP_TIMEOUT_MS = 12000;  // silence before the session is dropped
const COOP_WASH_SECS = 3.0;     // same hold as the sink (SINK_HOLD_TIME)

const coop = {
  role: null,          // 'host' | 'guest' | null
  link: null,
  peer: null,          // { name, ch, sk } of the other player
  shared: false,       // a shared partnership bar: no tip split
  remote: null,        // host side: the guest's chef { pos, dir, holding, store, moving, wash }
  hostAv: null,        // guest side: last known host chef state
  avatar: null,        // the partner's chef in the scene
  events: [],          // host side: floaters/sounds to replay on the guest
  gotWorld: false,
  frame: 0, lastRecv: 0, pendingTips: 0, tipsTotal: 0,
};

function coopIsGuest(){ return coop.role === 'guest'; }
function coopIsHost(){ return coop.role === 'host'; }
function coopPartnerHere(){ return !!(coop.role && coop.peer); }
function coopHostSplitsTips(){ return coopIsHost() && !coop.shared && !!coop.peer; }
function coopSend(msg){ if(coop.link){ try { coop.link.send(msg); } catch(e){ console.warn('co-op send failed', e); } } }
function coopMyName(){
  try { if(gcState && gcState.name) return gcState.name; } catch(e){}
  return (SKIN_DEFS.find(s => s.id === cosm.equippedSkin) || {}).name || 'Chef';   // e.g. "Ninja Chef"
}
const _r2 = v => Math.round(v * 100) / 100;

// ── Links ────────────────────────────────────────────────────────────────────
function coopTabLink(room){
  const ch = new BroadcastChannel('burgerbar-coop-' + (room || 'dev'));
  const me = Math.random().toString(36).slice(2);
  const link = { onmessage: null, onclose: null,
    send(m){ ch.postMessage({ from: me, m }); },
    close(){ try { ch.postMessage({ from: me, m: { t: 'bye' } }); } catch(e){} ch.close(); } };
  ch.onmessage = e => { const d = e.data; if(!d || d.from === me) return; if(link.onmessage) link.onmessage(d.m); };
  return link;
}
// Game Center caps one reliable message near 87 KB, and a big three-store
// restaurant can be larger, so long messages travel in numbered pieces.
const COOP_CHUNK = 60000;
function coopGameCenterLink(){
  const P = window.NativeBridge.coop;
  const parts = {};
  let seq = 0;
  const deliver = text => { let m; try { m = JSON.parse(text); } catch(err){ return; } if(link.onmessage) link.onmessage(m); };
  const link = { onmessage: null, onclose: null,
    send(m){
      const text = JSON.stringify(m);
      if(text.length <= COOP_CHUNK){ P.send({ data: text }).catch(()=>{}); return; }
      const id = ++seq, n = Math.ceil(text.length / COOP_CHUNK);
      for(let i = 0; i < n; i++) P.send({ data: '~' + id + ':' + i + ':' + n + ':' + text.slice(i*COOP_CHUNK, (i+1)*COOP_CHUNK) }).catch(()=>{});
    },
    close(){ P.disconnect().catch(()=>{}); (link._subs || []).forEach(h => Promise.resolve(h).then(x => x && x.remove && x.remove())); } };
  link._subs = [
    P.addListener('data', e => {
      const d = e.data || '';
      if(d[0] !== '~'){ deliver(d); return; }
      const [id, i, n] = d.slice(1).split(':', 3), body = d.slice(1 + id.length + i.length + n.length + 3);
      const p = parts[id] || (parts[id] = { got: 0, n: +n, bits: [] });
      if(p.bits[+i] === undefined){ p.bits[+i] = body; p.got++; }
      if(p.got === p.n){ delete parts[id]; deliver(p.bits.join('')); }
    }),
    P.addListener('peerLeft', () => { if(link.onclose) link.onclose('left'); }),
  ];
  return link;
}

// ── Session ──────────────────────────────────────────────────────────────────
function coopBegin(role, link, opts){
  opts = opts || {};
  if(coop.role) coopEnd('');
  Object.assign(coop, { role, link, peer: null, shared: !!opts.shared || sharedBarActive(), remote: null, hostAv: null,
                        events: [], gotWorld: false, frame: 0, lastRecv: performance.now(), tipsTotal: 0 });
  link.onmessage = coopOnMessage;
  link.onclose = why => { if(coop.link === link) coopEnd(why === 'left' ? 'Your partner left.' : 'Lost the connection to your partner.'); };
  if(role === 'host'){
    coop.remote = { pos: new THREE.Vector3(0, 0, 14), dir: Math.PI, holding: null, store: 0, moving: false, wash: null };
  } else {
    coopShowWait('Connecting to your friend…');
  }
  coopSend(coopHello());
  updateCoopHome();
}
function coopHello(){ return { t: 'hello', name: coopMyName(), ch: cosm.character || 'human', sk: cosm.equippedSkin || 'classic' }; }

// Leave the session (either side). A guest goes back to their own bar.
function coopEnd(reason){
  const wasGuest = coopIsGuest();
  const link = coop.link;
  coop.link = null;
  if(link){ try { link.close(); } catch(e){} }
  coopRemoveAvatar();
  coop.role = null; coop.peer = null; coop.remote = null; coop.hostAv = null; coop.events = [];
  coopHideWait();
  if(wasGuest){
    teardownStores();
    loadSave();
    initStoreContexts();
    if(coop.pendingTips > 0){ withStore(0, () => { eco.cash = _r2(eco.cash + coop.pendingTips); }); coop.pendingTips = 0; saveGame(); }
    player.holding = null; updateHolding();
    try { rebuildPlayerMesh(); } catch(e){}
    document.getElementById('top-hud').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'none';
    gamePaused = false; document.getElementById('pause-screen').style.display = 'none';
    gameState = 'start_menu';
    showStartMenu();
  }
  if(reason) showToast(reason, 3000);
  updateCoopHome();
}

function coopOnMessage(m){
  if(!m || !m.t) return;
  coop.lastRecv = performance.now();
  if(m.t === 'bye'){ coopEnd('Your partner left.'); return; }
  if(m.t === 'ping') return;
  if(coopIsHost()) coopHostMessage(m); else if(coopIsGuest()) coopGuestMessage(m);
}

// ── Host side ────────────────────────────────────────────────────────────────
function coopHostMessage(m){
  const r = coop.remote;
  switch(m.t){
    case 'hello': {
      const first = !coop.peer;
      coop.peer = { name: m.name || 'Friend', ch: m.ch, sk: m.sk };
      coopSend(coopHello());
      coopSend(coopWorldMsg());
      if(gameState === 'playing'){ coopSend({ t: 'dayStart' }); r.store = activeStoreIdx; }
      if(first) showToast(`👥 ${coop.peer.name} joined your bar!`, 2600);
      updateCoopHome();
      break;
    }
    case 'in':
      if(storeCtx[m.s]) r.store = m.s;
      r.pos.set(m.x, 0, m.z); r.dir = m.d; r.moving = !!m.mv;
      break;
    case 'act':
      if(gameState === 'playing') coopRunAsGuest(() => handleAction());
      break;
    case 'unhold':
      r.wash = null;
      break;
  }
}

// Run fn as if the guest's chef were the player: same store, position, facing
// and hands. Everything an action touches (stations, serving, sounds) then
// works unchanged, and the guest's hands are written back afterwards.
function coopRunAsGuest(fn){
  const r = coop.remote;
  if(!r || !storeCtx[r.store]) return;
  const prev = simIdx;
  const me = { x: player.pos.x, z: player.pos.z, dir: player.dir, holding: player.holding };
  useStore(r.store);
  player.pos.x = r.pos.x; player.pos.z = r.pos.z; player.dir = r.dir; player.holding = r.holding;
  window._coopActor = 'guest';
  try { fn(); }
  finally {
    window._coopActor = null;
    r.holding = player.holding;
    player.pos.x = me.x; player.pos.z = me.z; player.dir = me.dir; player.holding = me.holding;
    useStore(prev);
    updateHolding();
  }
}

// The guest started washing at a sink: the host keeps its own 3-second timer.
function coopStartGuestWash(t){
  const r = coop.remote;
  if(r) r.wash = { id: t.id, store: r.store, t: 0 };
}
function coopHostWashTick(){
  const r = coop.remote, w = r && r.wash;
  if(!w) return;
  const sink = storeCtx[w.store] && ctxOf(w.store).stations[w.id];
  if(!sink || r.store !== w.store || r.holding !== 'dirty_tray' ||
     Math.hypot(sink.x - r.pos.x, sink.z - r.pos.z) > 6){ r.wash = null; return; }
  w.t += ds / 60;
  if(w.t >= COOP_WASH_SECS){
    r.holding = 'tray'; r.wash = null;
    withStore(w.store, () => { stats.traysWashed = (stats.traysWashed || 0) + 1; });
    coop.events.push({ s: 'washed' });
  }
}

function coopWorldMsg(){
  // Serialise every store exactly as a save would, without touching storage.
  stashGlobals(storeCtx[simIdx]);
  const recs = storeCtx.map((c, i) => { const rec = JSON.parse(JSON.stringify(Object.assign({}, stores[i], { layout: null }))); writeStoreRecord(rec, c); return rec; });
  return { t: 'world', stores: recs, shared: coop.shared, goals: dailyGoals, playing: gameState === 'playing' };
}

function coopSnapshot(){
  const st = [];
  for(let i = 0; i < storeCtx.length; i++){
    const c = ctxOf(i), S = [], R = [], G = [];
    for(const k in c.stations){
      const s = c.stations[k];
      if(s.type === 'robot'){ R.push([s.id, _r2(s.pos.x), _r2(s.pos.z), _r2(s.mesh.rotation.y)]); continue; }
      if(s.type === 'fridge' || s.type === 'dumpster') continue;
      S.push([s.id, s.slots ? s.slots.map(sl => sl ? [sl.state, Math.round(sl.progress), Math.round(sl.burnTimer || 0)] : 0) : 0,
              s.item || 0, s.cleanTrays || 0, s.contents || 0, s.dirtyTrays || 0, s.served || 0, s.group ? s.group.id : 0]);
    }
    for(const g of c.groups){
      G.push([g.id, _r2(g.pos.x), _r2(g.pos.z), _r2(g.mesh.rotation.y), g.state, g.size, g.type, g.looks || [],
              g.orders, g.unservedOrders, g.servedMask || 0,
              _r2(Math.max(0, g.waitPatience / g.maxWait)), _r2(Math.max(0, g.foodPatience / g.maxFood)), _r2(g.mesh.position.y)]);
    }
    const s = c.stats;
    st.push({ c: c.eco.cash, gl: s.groupsLeft, ce: s.cashEarned, gs: s.groupsServed, w: s.walkouts || 0, ts: s.totalStars, S, R, G });
  }
  const r = coop.remote;
  return { t: 'snap', st,
    h: { s: activeStoreIdx, x: _r2(player.pos.x), z: _r2(player.pos.z), d: _r2(player.dir), h: player.holding || 0, mv: coop._hostMoving ? 1 : 0 },
    y: { h: r.holding || 0 }, ev: coop.events.splice(0) };
}

// Things the guest should see or hear that the snapshot doesn't carry.
function coopNoteFloater(f){ if(coopIsHost() && coop.peer) coop.events.push({ f: [_r2(f.pos.x), _r2(f.pos.y), _r2(f.pos.z)], tx: f.text, co: f.color }); }
function coopNoteSound(type){
  if(!coopIsHost() || !coop.peer) return;
  if(window._coopActor === 'guest' || (coop.remote && simIdx === coop.remote.store && type !== 'error')) coop.events.push({ s: type });
}
function coopSendTip(amount, g){
  coopSend({ t: 'tip', a: amount });
  coop.tipsTotal = _r2(coop.tipsTotal + amount);
}

// Day flow hooks (called from 09-menus-dayflow.js).
function coopOnDayStart(){ if(coopIsHost() && coop.peer){ coopSend(coopWorldMsg()); coopSend({ t: 'dayStart' }); coop.remote.store = activeStoreIdx; coop.remote.holding = null; coop.remote.wash = null; } }
function coopOnDayEnd(){ if(coopIsHost() && coop.peer) coopSend({ t: 'dayEnd', shift: lastShift, tips: coop.tipsTotal }); coop.tipsTotal = 0; }
function coopOnQuit(){ if(coopIsHost() && coop.peer) coopSend({ t: 'abort' }); }
function coopOnPause(on){ if(coopIsHost() && coop.peer) coopSend({ t: 'pause', on: !!on }); }

// ── Guest side ───────────────────────────────────────────────────────────────
function coopGuestMessage(m){
  switch(m.t){
    case 'hello':
      coop.peer = { name: m.name || 'Friend', ch: m.ch, sk: m.sk };
      break;
    case 'world':
      coopLoadWorld(m);
      break;
    case 'dayStart':
      coopGuestDayStart();
      break;
    case 'snap':
      if(coop.gotWorld) coopApplySnap(m);
      break;
    case 'dayEnd':
      coopGuestDayEnd(m);
      break;
    case 'abort':
      gameState = 'start_menu';
      document.getElementById('top-hud').style.display = 'none';
      document.getElementById('pause-btn').style.display = 'none';
      coopShowWait(`${coopPeerName()} ended the shift early.`);
      break;
    case 'pause':
      coopShowPaused(m.on);
      break;
    case 'tip':
      coopCreditTip(m.a);
      break;
  }
}
function coopPeerName(){ return (coop.peer && coop.peer.name) || 'Your friend'; }

// Swap in a copy of the host's restaurant. The guest's own save is left
// untouched in storage (saveGame is a no-op while visiting).
function coopLoadWorld(m){
  const playing = gameState === 'playing';
  teardownStores();
  stores = m.stores;
  parkedStores = [];
  initStoreContexts();
  if(Array.isArray(m.goals)) dailyGoals = m.goals;
  coop.shared = !!m.shared;
  coop.gotWorld = true;
  for(let i = 0; i < storeCtx.length; i++) withStore(i, () => { stats = freshStats(); });
  if(!playing){ player.pos = getValidSpawn(); pMesh.position.copy(player.pos); }
  coopRemoveAvatar();
  if(m.playing) coopGuestDayStart();
  else if(gameState !== 'playing') coopShowWait(`${coopPeerName()} is getting the bar ready…`);
}

function coopGuestDayStart(){
  if(!coop.gotWorld) return;
  coopHideWait(); coopShowPaused(false);
  try { stopHomeAnim(); releaseHomeRenderers(); } catch(e){}
  ['home-screen','results-screen','shop-screen','start-screen','stores-screen'].forEach(id => {
    const el = document.getElementById(id); if(el) el.style.display = 'none'; });
  document.getElementById('top-hud').style.display = 'flex';
  document.getElementById('pause-btn').style.display = 'flex';
  { const gh = document.getElementById('goals-hud'); if(gh) gh.style.display = 'none'; }
  document.getElementById('day-banner').innerHTML = `DAY ${calendarDay()}<br>` +
    `<span id="day-store" style="font-size:11px;color:#FFD54F;">👥 ${coopPeerName()}'s ${coop.shared ? 'shared bar' : 'bar'}</span>` +
    `<span id="day-sub" style="font-size:11px;color:rgba(255,255,255,.45);">Customers: ${stats.groupsLeft || 0}</span>`;
  player.holding = null; updateHolding();
  manageStore(0);
  player.pos = getValidSpawn(); player.pos.x += 2; pMesh.position.copy(player.pos);
  gameState = 'playing'; gamePaused = false;
  actionBtn.innerHTML = '✋'; actionBtn.style.background = 'rgba(255,200,30,.8)';
  updateCashUI();
  setMusicMood(1);
}

function coopGuestDayEnd(m){
  lastShift = m.shift;
  hlRing.visible = false;
  hideStoresHud();
  document.getElementById('pause-btn').style.display = 'none';
  gameState = 'results';
  player.holding = null; updateHolding();
  playSound('daycomplete');
  showResults();
  if(m.tips > 0 && !coop.shared) setTimeout(() => showToast(`💵 You kept $${m.tips.toFixed(2)} in tips for your own bar`, 3200), 2400);
}

// Tips earned in a friend's bar go straight into the guest's own saved bar.
function coopCreditTip(amount){
  if(!(amount > 0)) return;
  let done = false;
  try {
    const raw = localStorage.getItem('burgerBoss_save');
    const s = raw && JSON.parse(raw);
    if(s && s.stores && s.stores[0] && s.stores[0].eco){
      s.stores[0].eco.cash = _r2((s.stores[0].eco.cash || 0) + amount);
      s.savedAt = Date.now();
      localStorage.setItem('burgerBoss_save', JSON.stringify(s));
      done = true;
    }
  } catch(e){}
  if(!done) coop.pendingTips = _r2(coop.pendingTips + amount);
  spawnFloater(new THREE.Vector3(player.pos.x, 2.2, player.pos.z), `+$${amount.toFixed(2)} tip 💵`, '#FFD54F');
}

function coopApplySnap(m){
  for(let i = 0; i < m.st.length && i < storeCtx.length; i++){
    const d = m.st[i];
    withStore(i, () => {
      eco.cash = d.c;
      stats.groupsLeft = d.gl; stats.cashEarned = d.ce; stats.groupsServed = d.gs; stats.walkouts = d.w; stats.totalStars = d.ts;
      // Customers
      const byId = new Map(groups.map(g => [g.id, g]));
      const seen = new Set();
      for(const row of d.G){
        const [id, x, z, ry, state, size, type, looks, orders, unserved, mask, wp, fp, y] = row;
        seen.add(id);
        let g = byId.get(id);
        if(!g){
          g = { id, size, type, looks, state, pos: new THREE.Vector3(x, 0, z), target: new THREE.Vector3(x, 0, z), mesh: new THREE.Group(),
                waitPatience: 1, maxWait: 1, foodPatience: 1, maxFood: 1, orders: [], unservedOrders: [], wobble: 0 };
          fillGroupMesh(g);
          g.mesh.position.set(x, 0, z); g.mesh.rotation.y = ry;
          actGrp.add(g.mesh); groups.push(g); byId.set(id, g);
          if(state === 'ordering' || state === 'eating') seatGroupMesh(g);
        } else if(g.state !== state){
          if(state === 'ordering') seatGroupMesh(g);
          else if(state === 'leave' || state === 'leaving') standGroupMesh(g);
        }
        g.state = state; g._nx = x; g._nz = z; g._ry = ry; g._ny = y;
        g.orders = orders; g.unservedOrders = unserved; g.servedMask = mask || orders.map(() => false);
        g.waitPatience = wp; g.foodPatience = fp;
      }
      for(let k = groups.length - 1; k >= 0; k--){
        if(!seen.has(groups[k].id)){ discard(actGrp, groups[k].mesh); groups.splice(k, 1); }
      }
      // Stations
      for(const row of d.S){
        const s = stations[row[0]];
        if(!s) continue;
        const [, slots, item, clean, contents, dirty, served, gid] = row;
        if(slots && s.slots) s.slots = slots.map(x => x ? { state: x[0], progress: x[1], burnTimer: x[2] } : null);
        if(s.type === 'counter') s.item = item || null;
        if(s.type === 'sink' || s.type === 'trayrack') s.cleanTrays = clean;
        if(s.type === 'trash') s.contents = contents;
        if(s.type === 'table'){
          s.dirtyTrays = dirty; s.served = served;
          s.group = gid ? (byId.get(gid) || null) : null;
          if(s.group) s.group.tbl = s;
        }
      }
      for(const row of d.R){
        const b = stations[row[0]];
        if(b){ b._nx = row[1]; b._nz = row[2]; b._ry = row[3]; }
      }
      updateStationVisuals();
    });
  }
  // Hands, the host's chef, and the effects to replay.
  const mine = m.y.h || null;
  if(mine !== player.holding){ player.holding = mine; updateHolding(); }
  coop.hostAv = m.h;
  for(const ev of (m.ev || [])){
    if(ev.f) floaters.push({ pos: new THREE.Vector3(ev.f[0], ev.f[1], ev.f[2]), text: ev.tx, color: ev.co, life: 1.5 });
    if(ev.s) playSound(ev.s);
  }
  if(gameState === 'playing'){
    const sub = document.getElementById('day-sub');
    if(sub) sub.textContent = `Customers: ${stats.groupsLeft}`;
    updateCashUI();
  }
}

// Smooth what the host sent (runs every frame on the guest).
function coopGuestFrame(){
  const k = Math.min(1, 0.3 * ds);
  for(let i = 0; i < storeCtx.length; i++){
    withStore(i, () => {
      for(const g of groups){
        if(g._nx === undefined) continue;
        g.pos.x += (g._nx - g.pos.x) * k; g.pos.z += (g._nz - g.pos.z) * k;
        g.mesh.position.set(g.pos.x, g._ny || 0, g.pos.z);
        g.mesh.rotation.y += (g._ry - g.mesh.rotation.y) * k;
      }
      for(const id in stations){
        const b = stations[id];
        if(b.type !== 'robot' || b._nx === undefined) continue;
        b.pos.x += (b._nx - b.pos.x) * k; b.pos.z += (b._nz - b.pos.z) * k;
        b.mesh.position.x = b.pos.x; b.mesh.position.z = b.pos.z; b.mesh.rotation.y = b._ry;
        b.mesh.position.y = Math.sin(Date.now()/180) * .15;
      }
    });
  }
  updateStoresHud();
}

// ── Every frame, both sides ──────────────────────────────────────────────────
function coopTick(){
  if(!coop.role) return;
  coop.frame++;
  if(performance.now() - coop.lastRecv > COOP_TIMEOUT_MS){ coopEnd('Lost the connection to your partner.'); return; }
  const now = performance.now();
  if(now - (coop.lastPing || 0) > COOP_PING_MS){ coop.lastPing = now; coopSend({ t: 'ping' }); }
  if(coopIsGuest()){
    if(!coop.gotWorld && now - (coop.lastHello || 0) > 1000){ coop.lastHello = now; coopSend(coopHello()); }   // until the host answers
    if(gameState === 'playing' && coop.frame % COOP_INPUT_EVERY === 0){
      const mv = !!(joyVec.x || joyVec.z || keys.w || keys.a || keys.s || keys.d);
      coopSend({ t: 'in', s: activeStoreIdx, x: _r2(player.pos.x), z: _r2(player.pos.z), d: _r2(player.dir), mv: mv ? 1 : 0 });
    }
    if(coop.hostAv && gameState === 'playing') coopDrawAvatar(coop.hostAv.s, coop.hostAv.x, coop.hostAv.z, coop.hostAv.d, coop.hostAv.h || null, coop.hostAv.mv);
    else coopHideAvatar();
  } else {
    const r = coop.remote;
    coop._hostMoving = !!(joyVec.x || joyVec.z || keys.w || keys.a || keys.s || keys.d);
    if(!coop.peer) return;
    if(gameState === 'playing'){
      coopHostWashTick();
      if(coop.frame % COOP_SNAP_EVERY === 0) coopSend(coopSnapshot());
      coopDrawAvatar(r.store, r.pos.x, r.pos.z, r.dir, r.holding, r.moving);
    } else coopHideAvatar();
  }
}

// ── The partner's chef ───────────────────────────────────────────────────────
function coopBuildAvatar(){
  const info = coop.peer || {};
  const skin = SKIN_DEFS.find(s => s.id === info.sk) || SKIN_DEFS[0];
  const parts = buildCharacter(info.ch || 'human', skin, {});
  const root = new THREE.Group();
  root.add(parts.group);
  // A soft ring so you can always pick out your partner.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, .09, 6, 24), MB(0x4fc3f7));
  ring.rotation.x = -Math.PI/2; ring.position.y = .1; root.add(ring);
  coop.avatar = { root, parts, store: -1, held: null, heldMesh: null, wob: 0, x: 0, z: 0, inited: false };
}
function coopDrawAvatar(store, x, z, dir, holding, moving){
  if(!coop.peer || !storeCtx[store]) return coopHideAvatar();
  if(!coop.avatar) coopBuildAvatar();
  const a = coop.avatar;
  if(a.store !== store){ storeCtx[store].root.add(a.root); a.store = store; a.inited = false; }
  a.root.visible = true;
  if(!a.inited){ a.x = x; a.z = z; a.inited = true; }
  const k = Math.min(1, 0.3 * ds);
  a.x += (x - a.x) * k; a.z += (z - a.z) * k;
  a.root.position.set(a.x, 0, a.z);
  let df = dir - a.root.rotation.y;
  while(df < -Math.PI) df += Math.PI*2; while(df > Math.PI) df -= Math.PI*2;
  a.root.rotation.y += df * .3;
  a.wob = moving ? a.wob + .28 * ds : 0;
  const sw = moving ? Math.sin(a.wob) : 0, p = a.parts;
  if(p.legL) p.legL.rotation.x = sw * .7;
  if(p.legR) p.legR.rotation.x = -sw * .7;
  if(p.armL) p.armL.rotation.x = holding ? -1.25 : -sw * .55;
  if(p.armR) p.armR.rotation.x = holding ? -1.25 :  sw * .55;
  if(a.held !== holding){
    if(a.heldMesh){ a.root.remove(a.heldMesh); a.heldMesh = null; }
    if(holding){ a.heldMesh = itemMesh(holding); a.heldMesh.position.set(0, 1.5, 1.1); a.root.add(a.heldMesh); }
    a.held = holding;
  }
  coopDrawLabel(store, a.x, a.z);
}
function coopDrawLabel(store, x, z){
  let el = document.getElementById('coop-label');
  if(!el){ el = document.createElement('div'); el.id = 'coop-label'; document.body.appendChild(el); }
  const p = scr(new THREE.Vector3(x + storeCtx[store].ox, 4.2, z));
  if(p.z >= 1){ el.style.display = 'none'; return; }
  const name = coopPeerName();
  if(el.textContent !== name) el.textContent = name;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  if(el.style.display !== 'block') el.style.display = 'block';
}
function coopHideAvatar(){
  if(coop.avatar) coop.avatar.root.visible = false;
  const el = document.getElementById('coop-label'); if(el) el.style.display = 'none';
}
function coopRemoveAvatar(){
  coopHideAvatar();
  if(coop.avatar){ discard(coop.avatar.root.parent, coop.avatar.root); coop.avatar = null; }
}

// ── Screens ──────────────────────────────────────────────────────────────────
function coopShowWait(text){
  let el = document.getElementById('coop-wait');
  if(!el){
    el = document.createElement('div'); el.id = 'coop-wait';
    el.innerHTML = `<div class="cw-card"><div class="cw-icon">👥</div><div id="cw-text"></div>
      <button class="btn-green" onclick="coopLeave()" style="margin-top:16px;">LEAVE</button></div>`;
    document.body.appendChild(el);
  }
  document.getElementById('cw-text').textContent = text;
  el.style.display = 'flex';
}
function coopHideWait(){ const el = document.getElementById('coop-wait'); if(el) el.style.display = 'none'; }
function coopShowPaused(on){
  let el = document.getElementById('coop-paused');
  if(!el){ el = document.createElement('div'); el.id = 'coop-paused'; el.textContent = '⏸ Your friend paused the game'; document.body.appendChild(el); }
  el.style.display = on ? 'block' : 'none';
}
function coopLeave(){
  coopSend({ t: 'bye' });
  coopEnd('');
  closeCoop();
}

// Play Together screen.
function coopNative(){ return !!(window.NativeBridge && window.NativeBridge.coop); }
function coopDevTabs(){ try { return !coopNative() && /[?&]coop\b/.test(location.search); } catch(e){ return false; } }
function showCoop(){
  document.getElementById('home-screen').style.display = 'none';
  try { stopHomeAnim(); } catch(e){}
  renderCoop();
  document.getElementById('coop-screen').style.display = 'flex';
}
function closeCoop(){
  const el = document.getElementById('coop-screen'); if(el) el.style.display = 'none';
  if(!coopIsGuest()) showStartMenu();
}
function renderCoop(){
  const box = document.getElementById('coop-body');
  if(!box) return;
  let h = '';
  if(coop.role){
    h += `<div class="cp-status">${coopIsHost()
      ? (coop.peer ? `👥 <b>${coopPeerName()}</b> is in your ${coop.shared ? 'shared ' : ''}bar.` : 'Waiting for your friend to join…')
      : `You're helping in <b>${coopPeerName()}</b>'s bar.`}</div>
      <button class="cp-btn danger" onclick="coopLeave()">End session</button>`;
  } else if(coopNative()){
    h += `<div class="cp-text">Invite a Game Center friend to work your bar with you. You both cook, serve and clean; the money goes to your bar and your friend keeps the tips on the plates they serve.</div>
      <button class="cp-btn" onclick="coopInvite()">🎮 Invite a friend</button>
      <div class="cp-note">To join a friend, accept their invite from the Game Center notification.</div>`;
  } else if(coopDevTabs()){
    h += `<div class="cp-text">Developer mode: open this page in two tabs to play together.</div>
      <button class="cp-btn" onclick="coopBegin('host', coopTabLink('dev')); renderCoop();">Host in this tab</button>
      <button class="cp-btn" onclick="closeCoop(); coopBegin('guest', coopTabLink('dev'));">Join from this tab</button>`;
  } else {
    h += `<div class="cp-text">Playing together works in the Burger Bar app on iPhone and iPad, through Game Center. It's free.</div>`;
  }
  h += renderSharedBarSection();
  box.innerHTML = h;
}
function coopInvite(){
  if(!coopNative()) return;
  window.NativeBridge.coop.invite().then(r => { if(r && r.error) showToast(r.error, 3000); }).catch(() => {});
}
// Game Center tells us when a match is ready (we invited, or accepted an invite).
function coopInstallNative(){
  if(!coopNative() || coopInstallNative._done) return;
  coopInstallNative._done = true;
  try { Promise.resolve(window.NativeBridge.coop.addListener('matchStarted', e => {
    const role = e && e.role === 'host' ? 'host' : 'guest';
    if(role === 'guest' && gameState === 'playing'){ showToast('Finish your shift first, then accept the invite again.', 3200); window.NativeBridge.coop.disconnect(); return; }
    ['coop-screen','home-screen'].forEach(id => { const el = document.getElementById(id); if(el && role === 'guest') el.style.display = 'none'; });
    coopBegin(role, coopGameCenterLink());
    if(role === 'host') renderCoop();
  })).catch(e => console.warn('Co-op plugin unavailable', e)); }
  catch(e){ console.warn('Co-op plugin unavailable', e); }   // an app build without it: co-op just stays off
}

// A small "your friend is here" chip on the Home Screen, for the host.
function updateCoopHome(){
  const chip = document.getElementById('home-coop-chip');
  if(chip){
    const on = coopIsHost() && coop.peer;
    chip.style.display = on ? '' : 'none';
    if(on) chip.textContent = `👥 ${coopPeerName()} is here`;
  }
  if(document.getElementById('coop-screen') && document.getElementById('coop-screen').style.display === 'flex') renderCoop();
}

window.showCoop = showCoop; window.closeCoop = closeCoop; window.coopLeave = coopLeave; window.coopInvite = coopInvite;
window.coopBegin = coopBegin; window.coopTabLink = coopTabLink; window.renderCoop = renderCoop;
