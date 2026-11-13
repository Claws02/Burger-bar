// Burger Bar — 07c-empire. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  THE EMPIRE: store grades, autopilot, the treasury
// ─────────────────────────────────────────────────────────────
// There is no cap on stores. Each one costs twice the last (NEW_STORE_COST x
// 2^(n-1)) and is paid from the whole chain's cash, so opening the next store
// means saving across every register you own.
//
// Only the store you're in and its two neighbours run live (customers, robots
// and grills simulated frame by frame). Stores further along the street run
// on AUTOPILOT: each customer is resolved on the spot from what the store's
// staff could actually handle. A far store with no crew serves nobody, so an
// empire needs every store staffed to run without you.
//
// Grades: a store's grade is its average over the last GRADE_WINDOW shifts
// (eco.shifts), shown as the letter and the score behind it. The day's own
// grade still moves tomorrow's demand (07b-grades.js).

const GRADE_WINDOW = 7;               // shifts in a store's rolling grade
const LIVE_RADIUS = 1;                // stores either side of you that run live

// Autopilot capacity: customer groups one unit of robot power handles in a
// full shift, by role. A robot's power is 0.6 + 0.1 x level (0.7 at Lv.1, 1.4
// at Lv.8), times Overclock. Calibrated against robot-only live shifts
// (docs/BALANCE.md, Empire).
const AUTOPILOT = {
  CHEF: 13, WAITER: 6.3, BUSSER: 14,  // groups per power unit per shift (waiters are the bottleneck)
  TABLE: 4,                           // groups a table turns over per shift
  NO_BUSSER_TRAYS: 1,                 // without a busser each clean tray serves once
  MIN_STARS: 1.5, MAX_STARS: 4.6,     // stars at 0% and 100% of capacity
};

// ── Rolling grade ────────────────────────────────────────────────────────────
// One shift's numbers, recorded at the end of every shift (live or autopilot).
function recordShift(served, walked, stars){
  if(!Array.isArray(eco.shifts)) eco.shifts = [];
  if(served + walked <= 0) return;
  eco.shifts.push({ s: served, w: walked, t: +stars.toFixed(2) });
  while(eco.shifts.length > GRADE_WINDOW) eco.shifts.shift();
}
// The score behind a grade: stars per customer, walkouts as half-weight
// 1-star customers (the rule gradeFor uses).
function serviceScore(served, walked, stars){
  const denom = served + walked * 0.5;
  return denom > 0 ? (stars + walked * 0.5) / denom : null;
}
// A store's grade over its last GRADE_WINDOW shifts: { grade, score, n }.
// e = that store's eco (defaults to the current one).
function storeGrade(e){
  e = e || eco;
  const sh = Array.isArray(e.shifts) ? e.shifts : [];
  let s = 0, w = 0, t = 0;
  for(const x of sh){ s += x.s; w += x.w; t += x.t; }
  if(!sh.length || s + w <= 0) return { grade: null, score: null, n: 0 };
  return { grade: gradeFor(s, w, t), score: serviceScore(s, w, t), n: sh.length };
}
function gradeLabel(gi){ return gi && gi.grade ? `${gi.grade} ${gi.score.toFixed(1)}★` : '–'; }

// Saves from before rolling grades kept only letters: turn each into a shift
// with that grade's typical score so the store keeps its standing.
const GRADE_MID_SCORE = { 'A+': 4.75, 'A': 4.4, 'B': 3.9, 'C': 3.3, 'D': 2.65, 'F': 2.0 };
function migrateShiftsFromGrades(e){
  if(!Array.isArray(e.grades)) return;
  e.shifts = e.grades.slice(-GRADE_WINDOW).filter(g => GRADE_MID_SCORE[g])
    .map(g => ({ s: 10, w: 0, t: GRADE_MID_SCORE[g] * 10 }));
}

// ── Autopilot ────────────────────────────────────────────────────────────────
function isLiveStore(i){ return Math.abs(i - activeStoreIdx) <= LIVE_RADIUS; }

function robotPower(bot){ return 0.6 + 0.1 * getRobotLevel(bot); }
// How many groups the current store's crew can serve in a whole shift.
function autopilotCapacity(){
  const p = { chef: 0, waiter: 0, busser: 0 };
  for(const k in stations){ const s = stations[k]; if(s.type === 'robot' && p[s.role] !== undefined) p[s.role] += robotPower(s); }
  const oc = 1 + 0.12 * (upg.robotOC || 0);
  const grills = Object.values(stations).filter(s => s.type === 'grill').length;
  const grillSpeed = Math.min(1.4, 0.6 + 0.4 * (upg.grillMult || 0.5) / 0.5);   // Turbo Grill
  const chefCap = Math.min(p.chef, grills * 1.5) * AUTOPILOT.CHEF * oc * grillSpeed;
  const waitCap = p.waiter * AUTOPILOT.WAITER * oc;
  const busCap = p.busser > 0 ? p.busser * AUTOPILOT.BUSSER * oc : (eco.totalTrays || 4) * AUTOPILOT.NO_BUSSER_TRAYS;
  const tableCap = (upg.tableCount || 1) * AUTOPILOT.TABLE;
  return Math.max(0, Math.min(chefCap, waitCap, busCap, tableCap));
}
// The share of today's customers the crew can keep up with (0-1).
function autopilotRate(){
  const planned = Math.max(1, stats.initialGroups || 1);
  return Math.max(0, Math.min(1, autopilotCapacity() / planned));
}
// What a 5-star group pays here: the store's own recent average when it has
// one, else an estimate from the menu.
function autopilotCheck(){
  const h = eco.apHist;
  if(h && h.n >= 3 && h.stars > 0) return h.cash / h.n / (h.stars / h.n / 5);
  const extras = (menuComboActive() ? 3.5 : 0) + (menuFriesActive() ? 1 : 0);
  return (1.45 * 16 + extras) * menuPriceMult() * diffPayoutMult() * heatTipMult();
}
// Resolve one customer group without simulating it.
function autopilotResolve(rate){
  rate = rate === undefined ? autopilotRate() : rate;
  stats._apAcc = (stats._apAcc || 0) + rate;
  if(stats._apAcc >= 1){
    stats._apAcc -= 1;
    const stars = AUTOPILOT.MIN_STARS + (AUTOPILOT.MAX_STARS - AUTOPILOT.MIN_STARS) * rate;
    const cash = Math.round(autopilotCheck() * stars / 5 * 100) / 100;
    eco.cash = Math.round((eco.cash + cash) * 100) / 100;
    stats.cashEarned += cash; stats.totalStars += stars; stats.groupsServed++;
  } else stats.walkouts = (stats.walkouts || 0) + 1;
}
// One frame of a store on autopilot (in its own context).
function autopilotTick(){
  stats.autopilot = true;
  if(stats.spawnTimer > 0) stats.spawnTimer -= ds;
  if(stats.groupsLeft > 0 && stats.spawnTimer <= 0){
    const rate = autopilotRate();
    const n = Math.min(stats.groupsLeft, stats.maxSimultaneous || 1);
    for(let i = 0; i < n; i++){ stats.groupsLeft--; autopilotResolve(rate); }
    stats.spawnTimer = nextSpawnDelay();
  }
}
// A store leaving the live window: the customers inside are resolved now.
function toAutopilot(){
  if(!groups.length) return;
  const rate = autopilotRate();
  for(const g of groups){
    if(g.state !== 'leave' && g.state !== 'leaving') autopilotResolve(rate);
    if(g.mesh) discard(actGrp, g.mesh);
    if(g.tbl){ g.tbl.group = null; g.tbl.served = 0; }
  }
  groups.length = 0;
  updateStationVisuals();
}
// Live shifts teach autopilot what this store's customers pay. Shifts the
// player worked count too; the crew's capacity still caps the serve rate.
function recordAutopilotHistory(){
  if(stats.autopilot || !stats.groupsServed) return;
  const h = eco.apHist || (eco.apHist = { n: 0, cash: 0, stars: 0 });
  h.n += stats.groupsServed; h.cash += stats.cashEarned; h.stars += stats.totalStars;
  if(h.n > 200){ const k = 200 / h.n; h.n = 200; h.cash *= k; h.stars *= k; }
}

// ── Treasury ─────────────────────────────────────────────────────────────────
function empireCash(){ let t = 0; for(let i = 0; i < storeCtx.length; i++) t += ctxOf(i).eco.cash; return t; }
// Pay from the chain: richest registers first. Returns false (and takes
// nothing) if the chain can't cover it.
function payFromEmpire(amount){
  if(empireCash() + 1e-6 < amount) return false;
  let left = amount;
  const order = storeCtx.map((_, i) => i).sort((a, b) => ctxOf(b).eco.cash - ctxOf(a).eco.cash);
  for(const i of order){
    if(left <= 0) break;
    const e = ctxOf(i).eco, take = Math.min(e.cash, left);
    e.cash = Math.round((e.cash - take) * 100) / 100; left = Math.round((left - take) * 100) / 100;
  }
  return true;
}
// Short money for HUD pills: $950.25, $12.4k, $3.21M.
function fmtMoney(v){
  const a = Math.abs(v);
  if(a < 10000) return '$' + v.toFixed(2);
  if(a < 1e6) return '$' + (v / 1000).toFixed(a < 1e5 ? 1 : 0) + 'k';
  if(a < 1e9) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + (v / 1e9).toFixed(2) + 'B';
}
