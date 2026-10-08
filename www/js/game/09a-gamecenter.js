// Burger Bar — 09a-gamecenter. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  GAME CENTER (iOS app only; inert in the browser)
// ─────────────────────────────────────────────────────────────
// Native side: ios/App/App/GameCenterPlugin.swift, exposed as
// NativeBridge.gameCenter by js/native.js.
//
// Scores are synced, not fire-and-forget: we remember the best value Apple has
// CONFIRMED per leaderboard (burgerBoss_gc, mirrored to native storage like the
// save) and resubmit anything better on sign-in and at the end of each shift.
// So a run played offline or before signing in still reaches the board.
//
// The leaderboard IDs below must exist in App Store Connect (docs/APP_STORE.md).

const GC_BOARDS = [
  { id:'bb.best_day_earnings', name:"Best Day's Earnings", value:()=>Math.floor(records.bestDayCash || 0) },
  { id:'bb.days_in_business',  name:'Days in Business',    value:()=>eco.day || 0 },
  { id:'bb.longest_streak',    name:'Longest Daily Streak', value:()=>adapt.bestStreak || 0 },
  { id:'bb.guests_served',     name:'Guests Served',       value:()=>records.totalServed || 0 },
];
// Achievements must each be created (with artwork) in App Store Connect before
// they can be reported. Flip this on once they exist; IDs are 'bb.ach.<id>'.
const GC_ACHIEVEMENTS_ENABLED = false;

const gcState = { signedIn:false, name:'', inFlight:{} };
function gcAvailable(){ return !!(window.NativeBridge && window.NativeBridge.gameCenter); }
function gcConfirmed(){ try { return JSON.parse(localStorage.getItem('burgerBoss_gc') || '{}') || {}; } catch(e){ return {}; } }
function gcConfirm(id, v){
  const c = gcConfirmed(); c[id] = Math.max(c[id] || 0, v);
  try { localStorage.setItem('burgerBoss_gc', JSON.stringify(c)); } catch(e){}
}

// Submit every board whose current value beats what Apple has confirmed.
function gcSync(){
  if(!gcAvailable() || !gcState.signedIn) return;
  const conf = gcConfirmed();
  for(const b of GC_BOARDS){
    const v = b.value();
    if(!(v > 0) || v <= (conf[b.id] || 0) || gcState.inFlight[b.id] >= v) continue;
    gcState.inFlight[b.id] = v;
    Promise.resolve(window.NativeBridge.gameCenter.submitScore({ leaderboardId: b.id, score: v }))
      .then(r => { if(r && r.submitted) gcConfirm(b.id, v); })
      .catch(() => {})
      .then(() => { if(gcState.inFlight[b.id] === v) delete gcState.inFlight[b.id]; });
  }
}
function gcSignIn(){
  if(!gcAvailable()) return Promise.resolve(false);
  return Promise.resolve(window.NativeBridge.gameCenter.signIn())
    .then(r => { gcState.signedIn = !!(r && r.authenticated); gcState.name = (r && r.playerName) || '';
                 updateGcButton(); gcSync(); return gcState.signedIn; })
    .catch(() => false);
}
function showLeaderboards(){
  if(!gcAvailable()) return;
  if(!gcState.signedIn){
    gcSignIn().then(ok => { if(ok) window.NativeBridge.gameCenter.showLeaderboard({});
      else showToast('🏆 Sign in to Game Center (iOS Settings › Game Center) to see the leaderboards.', 3600); });
    return;
  }
  window.NativeBridge.gameCenter.showLeaderboard({});
}
window.showLeaderboards = showLeaderboards;
function gcReportAchievement(id){
  if(!GC_ACHIEVEMENTS_ENABLED || !gcAvailable() || !gcState.signedIn) return;
  Promise.resolve(window.NativeBridge.gameCenter.reportAchievement({ achievementId: 'bb.ach.' + id, percent: 100 })).catch(()=>{});
}
function updateGcButton(){
  const b = document.getElementById('home-btn-ranks');
  if(b) b.style.display = gcAvailable() ? '' : 'none';
}
