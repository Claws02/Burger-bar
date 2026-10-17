// Burger Bar — 13c-sharedbar. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  SHARED PARTNERSHIP BAR
// ─────────────────────────────────────────────────────────────
// A restaurant two players own together. It lives in iCloud (CloudKit): the
// owner creates it and shares it with a partner, and either of them can open
// it and play. Only ONE of them runs it at a time: opening it takes a lock
// (renewed every few minutes while it's open, and free again after
// SHARED_LOCK_MINUTES if a phone vanishes), and the other partner is told to
// ask for a co-op invite instead. Playing it together live is ordinary co-op
// with the lock holder as host (and no tip split: it's both of theirs).
//
// While the shared bar is open, saveGame() writes the RESTAURANT to the cloud
// and only the player's own things (skins, achievements, records, Kitchen
// Heat) to the local save, so the player's own bar is never overwritten.
//
// Backends: window.NativeBridge.sharedBar on iPhone/iPad (SharedBarPlugin.swift),
// or a localStorage stand-in in developer mode (?coop) and in tests.

const SHARED_LOCK_MINUTES = 15;     // the native side uses the same value
const SHARED_FLUSH_MS = 10000;      // at most one cloud write per 10 s while playing
const SHARED_HEARTBEAT_MS = 4 * 60000;

const sharedBar = { active: false, info: null, name: '', lastFlush: 0, timer: null, heartbeat: null, busy: false };
function sharedBarActive(){ return sharedBar.active; }

function sbBackend(){
  if(window.NativeBridge && window.NativeBridge.sharedBar) return window.NativeBridge.sharedBar;
  if(coopDevTabs() || window.__sharedBarDev) return sbDevBackend;
  return null;
}

// Developer / test stand-in: one "cloud" record in localStorage, shared by
// every tab on this computer. Each tab is its own "player".
const sbDevBackend = (() => {
  const KEY = 'burgerBoss_devSharedBar';
  const me = 'dev-' + Math.random().toString(36).slice(2, 8);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ return null; } };
  const write = r => localStorage.setItem(KEY, JSON.stringify(r));
  const fresh = r => r.lockOwner && r.lockOwner !== me && Date.now() - r.lockAt < SHARED_LOCK_MINUTES * 60000;
  return {
    me,
    status(){ const r = read(); return Promise.resolve({ available: true, hasBar: !!r, role: r ? (r.owner === me ? 'owner' : 'partner') : null, name: r ? r.name : '' }); },
    create(o){ write({ owner: me, name: o.name, save: o.save, lockOwner: '', lockAt: 0 }); return Promise.resolve({ ok: true }); },
    invite(){ return Promise.resolve({ ok: true }); },
    open(){
      const r = read();
      if(!r) return Promise.resolve({ ok: false, error: 'No shared bar yet.' });
      if(fresh(r)) return Promise.resolve({ ok: false, locked: true, lockedBy: r.lockName || 'Your partner' });
      r.lockOwner = me; r.lockName = 'Dev ' + me.slice(-3); r.lockAt = Date.now(); write(r);
      return Promise.resolve({ ok: true, save: r.save, name: r.name });
    },
    save(o){
      const r = read();
      if(!r || r.lockOwner !== me) return Promise.resolve({ ok: false, lostLock: true });
      r.save = o.save; r.lockAt = Date.now(); write(r);
      return Promise.resolve({ ok: true });
    },
    close(o){
      const r = read();
      if(r && r.lockOwner === me){ if(o && o.save) r.save = o.save; r.lockOwner = ''; r.lockAt = 0; write(r); }
      return Promise.resolve({ ok: true });
    },
  };
})();

function refreshSharedBarInfo(){
  const be = sbBackend();
  if(!be) return Promise.resolve(null);
  return Promise.resolve(be.status()).then(i => { sharedBar.info = i || null; return sharedBar.info; }).catch(() => null);
}

// The Play Together screen's shared-bar section (rendered by renderCoop()).
function renderSharedBarSection(){
  const be = sbBackend();
  // The shared bar needs iCloud, so the web version leaves it out for now.
  if(!be) return '';
  let h = '<div class="cp-sep"></div><div class="cp-title">🤝 Shared bar</div>';
  const i = sharedBar.info;
  if(sharedBar.active){
    return h + `<div class="cp-status">You're running <b>${sharedBar.name || 'the shared bar'}</b>. Invite your partner above to play it together.</div>
      <button class="cp-btn" onclick="closeSharedBar()">⬅ Back to my bar</button>`;
  }
  if(!i){ refreshSharedBarInfo().then(() => renderCoop()); return h + '<div class="cp-note">Checking iCloud…</div>'; }
  if(!i.available) return h + `<div class="cp-text">Sign in to iCloud on this device to use a shared bar.${i.error ? ' (' + i.error + ')' : ''}</div>`;
  if(!i.hasBar){
    return h + `<div class="cp-text">Start a new bar that you and a partner own together. Either of you can run it, one at a time, and play it together with an invite.</div>
      <button class="cp-btn" onclick="createSharedBar()">➕ Create a shared bar</button>
      <div class="cp-note">Joining your partner's? Open the link they send you from Messages.</div>`;
  }
  return h + `<div class="cp-text"><b>${i.name || 'Shared bar'}</b> · ${i.role === 'owner' ? 'you created it' : 'shared with you'}</div>
    <button class="cp-btn" onclick="openSharedBar()">🍔 Open the shared bar</button>
    ${i.role === 'owner' ? '<button class="cp-btn ghost" onclick="inviteSharedPartner()">✉️ Invite / manage partner</button>' : ''}`;
}

function sharedSavePayload(){
  stashGlobals(storeCtx[simIdx]);
  const recs = storeCtx.map((c, i) => { const rec = JSON.parse(JSON.stringify(Object.assign({}, stores[i], { layout: null }))); writeStoreRecord(rec, c); return rec; });
  return JSON.stringify({ v: 6, stores: recs, parkedStores: [], dailyGoals, savedAt: Date.now(), name: sharedBar.name });
}

function createSharedBar(){
  const be = sbBackend();
  if(!be || sharedBar.busy) return;
  const name = 'Our Burger Bar';
  const fresh = { v: 6, stores: [defStore(0, name, 'burger')], parkedStores: [], dailyGoals: [], savedAt: Date.now(), name };
  fresh.stores[0].eco.cash = 100;   // a little float to open with
  sharedBar.busy = true;
  Promise.resolve(be.create({ name, save: JSON.stringify(fresh) })).then(r => {
    sharedBar.busy = false;
    if(!r || !r.ok){ showToast((r && r.error) || "Couldn't create the shared bar", 3000); return; }
    showToast('🤝 Shared bar created. Now invite your partner.', 3000);
    return refreshSharedBarInfo().then(() => { renderCoop(); return be.invite(); });
  }).catch(e => { sharedBar.busy = false; showToast("Couldn't reach iCloud", 3000); });
}
function inviteSharedPartner(){ const be = sbBackend(); if(be) be.invite(); }

function openSharedBar(){
  const be = sbBackend();
  if(!be || sharedBar.busy || coopIsGuest()) return;
  if(coopIsHost() && coop.peer){ showToast('End the co-op session first, then open the shared bar and invite your partner.', 3200); return; }
  sharedBar.busy = true;
  saveGame();   // make sure our own bar is safely stored first
  Promise.resolve(be.open()).then(r => {
    sharedBar.busy = false;
    if(!r || !r.ok){
      if(r && r.locked) showToast(`🔒 ${r.lockedBy || 'Your partner'} is running the shared bar right now. Ask them to invite you to play together!`, 4200);
      else showToast((r && r.error) || "Couldn't open the shared bar", 3000);
      return;
    }
    let s; try { s = JSON.parse(r.save); } catch(e){ s = null; }
    if(!s || !Array.isArray(s.stores) || !s.stores.length){ be.close({}); showToast('The shared bar save looks damaged.', 3000); return; }
    sharedBar.name = r.name || s.name || 'Shared bar';
    teardownStores();
    stores = s.stores.slice(0, MAX_STORES);
    parkedStores = [];
    dailyGoals = Array.isArray(s.dailyGoals) ? s.dailyGoals : [];
    initStoreContexts();
    sharedBar.active = true;
    sharedBar.lastFlush = Date.now();
    clearInterval(sharedBar.heartbeat);
    sharedBar.heartbeat = setInterval(() => sharedBarFlush(true), SHARED_HEARTBEAT_MS);
    closeCoop();
    showToast(`🤝 Welcome to ${sharedBar.name}!`, 2400);
  }).catch(() => { sharedBar.busy = false; showToast("Couldn't reach iCloud", 3000); });
}

// saveGame() while the shared bar is open: the restaurant goes to the cloud
// (throttled), the player's own account data stays in the local save.
function saveSharedBar(){
  try {
    const raw = localStorage.getItem('burgerBoss_save');
    const own = raw ? JSON.parse(raw) : null;
    if(own){
      Object.assign(own, { cosm, achievements, records, adapt, savedAt: Date.now() });
      localStorage.setItem('burgerBoss_save', JSON.stringify(own));
    }
  } catch(e){ console.warn('Own save update failed', e); }
  const wait = SHARED_FLUSH_MS - (Date.now() - sharedBar.lastFlush);
  // End of a shift (or anything off the floor) saves now; mid-shift, batch it.
  if(gameState !== 'playing' || wait <= 0) sharedBarFlush();
  else if(!sharedBar.timer) sharedBar.timer = setTimeout(() => sharedBarFlush(), wait);
}
function sharedBarFlush(){
  const be = sbBackend();
  clearTimeout(sharedBar.timer); sharedBar.timer = null;
  if(!be || !sharedBar.active) return Promise.resolve();
  sharedBar.lastFlush = Date.now();
  return Promise.resolve(be.save({ save: sharedSavePayload() })).then(r => {
    if(r && r.lostLock){
      showToast('⚠️ Your partner took over the shared bar. Taking you back to your bar.', 4000);
      leaveSharedBar(false);
    }
  }).catch(() => {});
}
function leaveSharedBar(save){
  const be = sbBackend();
  clearInterval(sharedBar.heartbeat); sharedBar.heartbeat = null;
  clearTimeout(sharedBar.timer); sharedBar.timer = null;
  const payload = save && sharedBar.active ? sharedSavePayload() : null;
  sharedBar.active = false;
  const done = be ? Promise.resolve(be.close(payload ? { save: payload } : {})).catch(() => {}) : Promise.resolve();
  teardownStores();
  loadSave();
  initStoreContexts();
  try { rebuildPlayerMesh(); } catch(e){}
  if(gameState !== 'playing') showStartMenu();
  return done;
}
function closeSharedBar(){
  if(gameState === 'playing') return;
  if(coopIsHost() && coop.peer) coopLeave();
  leaveSharedBar(true).then(() => { refreshSharedBarInfo(); showToast('Back at your own bar.', 2000); });
  closeCoop();
}
// Tapping a partner's invite link (Messages, Mail…) joins their shared bar.
function sharedBarInstallNative(){
  const be = window.NativeBridge && window.NativeBridge.sharedBar;
  if(!be || sharedBarInstallNative._done) return;
  sharedBarInstallNative._done = true;
  try {
    Promise.resolve(be.addListener('accepted', e => {
      refreshSharedBarInfo().then(() => { if(document.getElementById('coop-screen').style.display === 'flex') renderCoop(); });
      showToast(`🤝 You joined ${(e && e.name) || 'the shared bar'}! Open it from 👥 Together.`, 4000);
    })).catch(e => console.warn('Shared bar plugin unavailable', e));
  } catch(e){ console.warn('Shared bar plugin unavailable', e); }
}

// Leaving the app saves the shared bar promptly.
try { document.addEventListener('visibilitychange', () => { if(document.hidden && sharedBar.active) sharedBarFlush(); }); } catch(e){}

window.createSharedBar = createSharedBar; window.openSharedBar = openSharedBar;
window.closeSharedBar = closeSharedBar; window.inviteSharedPartner = inviteSharedPartner;
