// Burger Bar — 07-progress. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  DAILY FLOW & MENUS
// ─────────────────────────────────────────────────────────────
function getCumRating(){ return gStats.lifeGroups===0?0:(gStats.lifeStars/gStats.lifeGroups).toFixed(1); }
function updateCashUI(){
  document.getElementById('cash-val').textContent='$'+eco.cash.toFixed(2);
  document.getElementById('rating-val').textContent='⭐ '+getCumRating();
}

function showToast(msg, dur=2200){
  const t = document.getElementById('notif-toast');
  t.textContent = msg; t.style.display='block';
  clearTimeout(t._tid);
  t._tid = setTimeout(()=>t.style.display='none', dur);
}

// ─────────────────────────────────────────────────────────────
//  ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────
// Each achievement declares the metric it tracks and a numeric goal, so we can
// (a) test completion uniformly and (b) compute a live progress fraction used
// to order them by "how achievable" they are. The array is authored easy→hard;
// that tier order is the tie-break when two locked goals are equally close.
// (Multi-store "Empire" achievement removed: single-bar mode for now.)
const ACHIEVEMENTS = [
  {id:'first_day', icon:'🌅', name:'Open for Business', desc:'Complete your first day',   metric:'maxDay',     goal:1,    cash:25},
  {id:'serve10',   icon:'🥪', name:'First Rush',        desc:'Serve 10 groups',           metric:'groups',     goal:10,   cash:40},
  {id:'rich250',   icon:'🪙', name:'Petty Cash',        desc:'Hold $250 at once',         metric:'cash',       goal:250,  cash:0},
  {id:'day5',      icon:'📆', name:'Getting the Hang',  desc:'Reach Day 5',               metric:'maxDay',     goal:5,    cash:75},
  {id:'firstbot',  icon:'🔧', name:'New Hire',          desc:'Hire your first robot',     metric:'robots',     goal:1,    cash:60},
  {id:'serve50',   icon:'🍔', name:'Line Cook',         desc:'Serve 50 groups',           metric:'groups',     goal:50,   cash:100},
  {id:'perfectday',icon:'⭐', name:'Flawless Service',  desc:'Finish a day at ~5 stars',  metric:'todayStars', goal:4.5,  cash:150},
  {id:'rich1000',  icon:'💰', name:'Turning a Profit',  desc:'Hold $1,000 at once',       metric:'cash',       goal:1000, cash:0},
  {id:'tables4',   icon:'🪑', name:'Full House',        desc:'Run 4 tables at once',      metric:'tables',     goal:4,    base:1,   cash:120},
  {id:'day10',     icon:'📅', name:'Regular',           desc:'Reach Day 10',              metric:'maxDay',     goal:10,   cash:150},
  {id:'grillmax',  icon:'🔥', name:'Flame On',          desc:'Max out the Turbo Grill',   metric:'grillLv',    goal:3,    base:0.5, cash:200},
  {id:'robots3',   icon:'🤖', name:'Automation',        desc:'Hire 3 robots',             metric:'robots',     goal:3,    cash:200},
  {id:'serve250',  icon:'👨‍🍳', name:'Head Chef',         desc:'Serve 250 groups',          metric:'groups',     goal:250,  cash:400,  skin:'gold'},
  {id:'day30',     icon:'🗓️', name:'Established',        desc:'Reach Day 30',              metric:'maxDay',     goal:30,   cash:500,  skin:'fire'},
  {id:'rich5000',  icon:'🤑', name:'High Roller',       desc:'Hold $5,000 at once',       metric:'cash',       goal:5000, cash:0,    skin:'alien'},
  {id:'serve1000', icon:'🏅', name:'Burger Legend',     desc:'Serve 1,000 groups',        metric:'groups',     goal:1000, cash:1000},
  {id:'day100',    icon:'👑', name:'Centurion',         desc:'Reach Day 100',             metric:'maxDay',     goal:100,  cash:2000},
];

function achvMetrics(){
  let groups=0, robots=0, maxDay=0;
  stores.forEach((s,idx)=>{
    const gs = idx===activeStoreIdx ? gStats : (s.gStats||{});
    const up = idx===activeStoreIdx ? upg   : (s.upg||{});
    const ec = idx===activeStoreIdx ? eco   : (s.eco||{});
    groups += gs.lifeGroups||0;
    robots += up.robotCount||0;
    maxDay  = Math.max(maxDay, ec.day||0);
  });
  return { groups, robots, maxDay, cash:eco.cash, stores:stores.length,
           tables:  upg.tableCount || 1,
           grillLv: upg.grillMult  || 0,
           // Only meaningful while a day is actually being scored; on the Home
           // Screen this used to report yesterday's average as "today".
           todayStars: (gameState==='playing' && stats.groupsServed>0)
             ? stats.totalStars/stats.groupsServed : 0 };
}

// Live progress for an achievement against the current metrics.
function achvProgress(a, m){
  const cur  = m[a.metric] || 0;
  const goal = a.goal;
  const base = a.base || 0;   // starting floor (e.g. you already own 1 table)
  const frac = Math.max(0, Math.min(1, (cur - base) / (goal - base)));
  return { cur, goal, frac, done: cur >= goal };
}

// Human-readable "current / goal" label per metric type.
function achvProgressText(a, m){
  const cur = m[a.metric] || 0, goal = a.goal;
  if(a.metric==='cash')       return `$${Math.floor(Math.min(cur,goal))} / $${goal}`;
  if(a.metric==='todayStars') return `${cur.toFixed(1)} / ${goal}★`;
  if(a.metric==='grillLv')    return `${Math.min(cur,goal).toFixed(2)} / ${goal}`;
  return `${Math.min(Math.floor(cur),goal)} / ${goal}`;
}

// Locked achievements ordered by how close they are to completion (closest
// first); ties fall back to authored easy→hard order. Used for the home
// showcase and the full achievements screen.
function lockedAchvByAchievability(m, done){
  const order = new Map(ACHIEVEMENTS.map((a,i)=>[a.id,i]));
  return ACHIEVEMENTS
    .filter(a => !done.includes(a.id))
    .map(a => ({ a, frac: achvProgress(a, m).frac }))
    .sort((x,y) => (y.frac - x.frac) || (order.get(x.a.id) - order.get(y.a.id)))
    .map(o => o.a);
}

// ─────────────────────────────────────────────────────────────
//  DAILY GOALS  (built on the same metric/goal engine as achievements)
// ─────────────────────────────────────────────────────────────
// Three light, per-day objectives that reset each morning and pay a small cash
// bonus. They scale gently with the day number and only offer combo goals when
// combos are actually on the menu, so a new player is never asked for content
// they haven't unlocked. Persisted in the save so a mid-day reload is stable.
let dailyGoals = [];

// Today-scoped metrics (reset with `stats` each day).
function dailyMetrics(){
  const groups = stats.groupsServed || 0;
  return {
    groups,
    cash:     stats.cashEarned || 0,
    stars:    groups > 0 ? stats.totalStars / groups : 0,
    combos:   stats.combosServed || 0,
    walkouts: stats.walkouts || 0,
    streak:   stats.bestStreak || 0,
  };
}

// The candidate pool. `mode:'reach'` means cur>=goal; `'atMost'` means cur<=goal
// (evaluated at day's end). Each returns a concrete goal for the given day.
// Goals scale with the in-game day AND Kitchen Heat (a daily player gets
// stiffer, better-paid goals), never ask for more than the day can offer, and
// soften on a returning player's ease-in shift.
function dailyGoalPool(day){
  const { heat: h, easing } = projectedHeat(day);
  const groupsToday = plannedGroupCount(day);
  const reach = easing ? 0.7 : 0.78 + h * 0.012;             // share of groups to serve
  const serveGoal = Math.min(groupsToday, Math.max(3, Math.floor(groupsToday * reach)));
  const earnBase = 40 + Math.min(day, 28) * 14 + Math.max(0, day - 28) * 4;
  const earnGoal = Math.round(earnBase * (easing ? 0.8 : 1 + h * 0.04) / 5) * 5;
  const pay = r => Math.round(r * (1 + h * 0.06));
  const starGoal = h >= 5 ? 4.5 : 4;
  const pool = [
    {id:'serve', icon:'🍽️', metric:'groups', goal:serveGoal, mode:'reach',  reward:pay(30+Math.min(day,40)*3), label:g=>`Serve ${g} groups`},
    {id:'earn',  icon:'💵', metric:'cash',   goal:earnGoal,  mode:'reach',  reward:pay(40+Math.min(day,40)*4), label:g=>`Earn $${g} today`},
    {id:'stars', icon:'⭐', metric:'stars',  goal:starGoal,  mode:'reach',  reward:pay(starGoal>4?90:60),      label:g=>`Finish at ${g}★ or better`},
    {id:'nowalk',icon:'🏃', metric:'walkouts',goal:easing?1:0, mode:'atMost', reward:pay(50),
     label:g=>g ? `At most ${g} walkout` : `No customers walk out`},
  ];
  // The combo goal is ALWAYS in the pool, gated by `needs` instead of being
  // conditionally pushed. seededPick shuffles by index, so a pool that changed
  // length when combos were toggled in the Shop handed back a different three
  // goals than the ones already previewed on the Home Screen.
  pool.push({id:'combo', icon:'🥤', metric:'combos', goal:Math.min(groupsToday, Math.max(2, Math.min(Math.ceil(day/2), Math.floor(groupsToday*0.45)))), mode:'reach',
             reward:pay(55), needs:()=>menuComboActive(), label:g=>`Serve ${g} combo meals`});
  // Streak challenge appears once the player has had time to learn the streak.
  pool.push({id:'streak', icon:'🔥', metric:'streak', goal:Math.min(8, 3 + Math.floor(h / 2.5)), mode:'reach',
             reward:pay(45), needs:()=>day >= 6, label:g=>`Build a ${g}-serve streak`});
  return pool;
}

// Deterministic per-day shuffle (mulberry32) so the same day always yields the
// same 3 goals — a reload can't reroll them for a better set.
function seededPick(arr, n, seed){
  let s = seed >>> 0; const rnd = ()=>{ s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a.slice(0, n);
}

function rollDailyGoals(day){
  // Shuffle the whole fixed-length pool deterministically, THEN drop goals the
  // player can't currently attempt, then take three. Order stays stable.
  const shuffled = seededPick(dailyGoalPool(day), 99, day*2654435761);
  const picks = shuffled.filter(p => !p.needs || p.needs()).slice(0, 3);
  dailyGoals = picks.map(p => ({
    id:p.id, icon:p.icon, metric:p.metric, goal:p.goal, mode:p.mode,
    reward:p.reward, desc:p.label(p.goal), done:false
  }));
}

function dailyGoalDone(dg, m){
  const cur = m[dg.metric] || 0;
  return dg.mode==='atMost' ? cur <= dg.goal : cur >= dg.goal;
}
function dailyGoalFrac(dg, m){
  const cur = m[dg.metric] || 0;
  if(dg.mode==='atMost') return dailyGoalDone(dg, m) ? 1 : 0;
  return Math.max(0, Math.min(1, cur / dg.goal));
}
function dailyGoalText(dg, m){
  const cur = m[dg.metric] || 0;
  if(dg.metric==='cash')     return `$${Math.floor(Math.min(cur,dg.goal))} / $${dg.goal}`;
  if(dg.metric==='stars')    return `${cur.toFixed(1)} / ${dg.goal}★`;
  if(dg.metric==='walkouts') return cur===0 ? 'none so far' : `${cur} walked out`;
  return `${Math.min(Math.floor(cur),dg.goal)} / ${dg.goal}`;
}

// ── In-game daily goals panel ───────────────────────────────────────────────
// The day's goals used to be visible only on the Home Screen and the Results
// screen -- i.e. never while you could still do anything about them. This is
// the same data, live, behind a button in the top-left.
let goalsPanelOpen = false;

function toggleGoalsPanel(){
  goalsPanelOpen = !goalsPanelOpen;
  const hud = document.getElementById('goals-hud');
  if(hud) hud.classList.toggle('open', goalsPanelOpen);
  if(goalsPanelOpen) renderGoalsPanel();
  playSound('counter');
}
window.toggleGoalsPanel = toggleGoalsPanel;

function renderGoalsPanel(){
  const list = document.getElementById('goals-panel-list');
  const btn  = document.getElementById('goals-btn');
  const cnt  = document.getElementById('goals-btn-count');
  if(!list) return;
  const m = dailyMetrics();
  const goals = dailyGoals || [];
  let done = 0;
  let html = '';
  for(const dg of goals){
    const hit = dg.done || dailyGoalDone(dg, m);
    if(hit) done++;
    const frac = Math.round(dailyGoalFrac(dg, m) * 100);
    html += `<div class="gp-row${hit?' done':''}">` +
              `<div class="gp-top"><span class="gp-ico">${hit?'✅':dg.icon}</span><span>${dg.desc}</span></div>` +
              `<div class="gp-bar"><div class="gp-fill" style="width:${frac}%"></div></div>` +
              `<div class="gp-meta"><span>${dailyGoalText(dg, m)}</span><span class="gp-rew">+$${dg.reward}</span></div>` +
            `</div>`;
  }
  if(!goals.length) html = '<div class="gp-meta">No goals today.</div>';
  list.innerHTML = html;
  if(cnt) cnt.textContent = `${done}/${goals.length || 0}`;
  if(btn) btn.classList.toggle('done', goals.length > 0 && done === goals.length);
}

// Award any newly-completed goals; called once at day end. Returns cash earned.
function checkDailyGoals(){
  const m = dailyMetrics();
  let earned = 0;
  for(const dg of dailyGoals){
    if(dg.done) continue;
    if(dailyGoalDone(dg, m)){ dg.done = true; earned += dg.reward; }
  }
  if(earned > 0){ eco.cash += earned; }
  stats._dailyEarned = earned;
  return earned;
}

// Achievements unlocked since the last toast flush. When a day ends we award
// the cash immediately (so the results screen math is right) but hold the
// celebratory toast until the player is back on the Home Screen.
let pendingAchvToasts = [];
function flushAchvToasts(){
  if(!pendingAchvToasts.length) return;
  const queue = pendingAchvToasts; pendingAchvToasts = [];
  queue.forEach((a,i)=> setTimeout(()=>{
    playSound('coin');
    showToast(`🏆 ${a.name}!${a.cash?'  +$'+a.cash:''}${a.skin?'  · Skin unlocked!':''}`, 2600);
  }, 450 + i*1400));
}

// Pass deferToasts=true to hold the celebration toast for the Home Screen.
function checkAchievements(deferToasts){
  if(!achievements.unlocked) achievements.unlocked=[];
  const m = achvMetrics();
  const unlockedNow = [];
  for(const a of ACHIEVEMENTS){
    if(achievements.unlocked.includes(a.id)) continue;
    if((m[a.metric] || 0) >= a.goal){
      achievements.unlocked.push(a.id);
      gcReportAchievement(a.id);
      if(a.cash){ eco.cash += a.cash; stats._achvEarned = (stats._achvEarned||0) + a.cash; }
      if(a.skin && !cosm.ownedSkins.includes(a.skin)) cosm.ownedSkins.push(a.skin);
      unlockedNow.push(a);
    }
  }
  if(unlockedNow.length){
    updateCashUI(); saveGame();
    if(deferToasts){
      pendingAchvToasts.push(...unlockedNow);
    } else {
      unlockedNow.forEach((a,i)=> setTimeout(()=>{
        playSound('coin');
        showToast(`🏆 ${a.name}!${a.cash?'  +$'+a.cash:''}${a.skin?'  · Skin unlocked!':''}`, 2600);
      }, i*1300));
    }
  }
}

function showAchievements(){
  stopHomeAnim();
  document.getElementById('home-screen').style.display='none';
  const list = document.getElementById('achievements-list');
  list.innerHTML='';
  // Lifetime records summary banner.
  const rec = document.createElement('div');
  rec.style.cssText='display:flex;justify-content:space-around;gap:8px;background:rgba(255,255,255,.06);border-radius:12px;padding:12px;margin-bottom:12px;text-align:center;';
  rec.innerHTML=`
    <div><div style="font-size:18px;font-weight:900;color:#66BB6A;">$${(records.bestDayCash||0).toFixed(0)}</div><div style="font-size:10px;color:rgba(255,255,255,.5);">BEST DAY</div></div>
    <div><div style="font-size:18px;font-weight:900;color:#ffca28;">${(records.bestDayStars||0).toFixed(1)}★</div><div style="font-size:10px;color:rgba(255,255,255,.5);">BEST RATING</div></div>
    <div><div style="font-size:18px;font-weight:900;color:#90caf9;">${records.totalServed||0}</div><div style="font-size:10px;color:rgba(255,255,255,.5);">SERVED</div></div>`;
  list.appendChild(rec);

  // Today's Goals — live progress mid-day, or a clean preview between days.
  if(dailyGoals && dailyGoals.length){
    const preview = gameState !== 'playing';
    const dm = preview ? {groups:0,cash:0,stars:0,combos:0,walkouts:0} : dailyMetrics();
    const title = preview ? "NEXT DAY'S GOALS" : "TODAY'S GOALS";
    const gwrap = document.createElement('div');
    gwrap.style.cssText='background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.25);border-radius:12px;padding:12px;margin-bottom:12px;';
    gwrap.innerHTML = `<div style="font-size:11px;letter-spacing:1.5px;color:#ffca28;font-weight:900;margin-bottom:8px;">🎯 ${title}</div>` +
      dailyGoals.map(dg=>{
        const done = !preview && (dg.done || dailyGoalDone(dg, dm));
        const frac = preview ? 0 : dailyGoalFrac(dg, dm);
        return `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:800;">
            <span style="color:${done?'#66BB6A':'#fff'};">${done?'✅':dg.icon} ${dg.desc}</span>
            <span style="color:${done?'#66BB6A':'#ffc107'};flex-shrink:0;">${done?'✓ +$'+dg.reward:'+$'+dg.reward}</span>
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:1px;">${dailyGoalText(dg, dm)}</div>
          <div style="height:4px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:3px;overflow:hidden;"><div style="height:100%;width:${(frac*100).toFixed(0)}%;background:linear-gradient(90deg,#FBC02D,#F57F17);border-radius:3px;"></div></div>
        </div>`;
      }).join('');
    list.appendChild(gwrap);
  }

  const done = achievements.unlocked || [];
  const m    = achvMetrics();
  // Organized by how achievable they are: still-locked goals first, ordered
  // closest-to-earn → furthest; completed ones collected at the bottom.
  const locked = lockedAchvByAchievability(m, done);
  const earned = ACHIEVEMENTS.filter(a => done.includes(a.id));
  const renderRow = (a, got) => {
    const div = document.createElement('div');
    div.className = 'upg-item' + (got?'':' locked');
    let reward = (a.cash?`+$${a.cash}`:'') + (a.skin?(a.cash?' · ':'')+'👕 Skin':'');
    const pr = achvProgress(a, m);
    const bar = got ? '' : `<div style="height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:5px;overflow:hidden;"><div style="height:100%;width:${(pr.frac*100).toFixed(0)}%;background:linear-gradient(90deg,#FBC02D,#F57F17);border-radius:3px;"></div></div>`;
    const prog = got ? '' : `<div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px;">${achvProgressText(a, m)}</div>`;
    div.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
        <div style="font-size:30px;flex-shrink:0;">${got?a.icon:'🔒'}</div>
        <div style="flex:1;min-width:0;"><div style="font-weight:900;font-size:14px;">${a.name}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);">${a.desc}</div>${prog}${bar}</div></div>
      <div style="font-size:12px;font-weight:900;color:${got?'#66BB6A':'#ffc107'};flex-shrink:0;margin-left:8px;">${got?'✓ DONE':reward}</div>`;
    list.appendChild(div);
  };
  locked.forEach(a => renderRow(a, false));
  earned.forEach(a => renderRow(a, true));
  document.getElementById('achievements-screen').style.display='flex';
}
function closeAchievements(){
  document.getElementById('achievements-screen').style.display='none';
  showStartMenu();
}

// Showcase 3 achievements on the home screen (under the Shop button).
// Only ACTIVE (not-yet-earned) achievements are shown so players always see
// the next goals to chase. Completed ones drop off the cards — once every
// achievement is earned we celebrate by showcasing the final three instead.
function renderHomeAchievements(){
  const wrap = document.getElementById('home-achv-list');
  if(!wrap) return;
  wrap.innerHTML='';
  const done    = achievements.unlocked || [];
  const m       = achvMetrics();
  // Sorted by how achievable they are — the NEXT most achievable sits on top.
  const locked  = lockedAchvByAchievability(m, done);
  const allDone = locked.length === 0;
  const titleEl = document.getElementById('home-achv-title');
  if(titleEl) titleEl.textContent = allDone ? '🏆 ALL COMPLETE!' : '🏆 NEXT GOALS';
  const picks = allDone ? ACHIEVEMENTS.slice(-3) : locked.slice(0,3);
  picks.forEach((a, i)=>{
    const card = document.createElement('div');
    // First card = the single next most achievable: highlighted as "next".
    card.className = 'home-achv-card' + (allDone ? '' : (i===0 ? ' next' : ' active'));
    if(allDone){
      card.innerHTML = `<div class="ico">${a.icon}</div>
        <div class="txt"><div class="nm">${a.name}</div>
        <div class="st" style="color:#2e9e4f;">✓ Unlocked</div></div>`;
    } else {
      const pr = achvProgress(a, m);
      card.innerHTML = `<div class="ico">${a.icon}</div>
        <div class="txt"><div class="nm">${a.name}</div>
        <div class="st" style="color:#b06a00;">${achvProgressText(a, m)}</div>
        <div class="home-achv-prog"><i style="width:${(pr.frac*100).toFixed(0)}%;"></i></div></div>`;
    }
    wrap.appendChild(card);
  });
}
window.showAchievements=showAchievements; window.closeAchievements=closeAchievements;

