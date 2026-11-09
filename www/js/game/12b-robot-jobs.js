// Burger Bar — 12b-robot-jobs. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ROBOT JOBS: what each robot does next
// ─────────────────────────────────────────────────────────────
// Robots used to decide where to walk with one set of rules and what to do on
// arrival with another. When the two disagreed the robot looped forever: a
// waiter holding an empty tray walked to a counter with a plated burger, had
// no rule for "tray + plated burger", went idle, and picked the same counter
// again, while customers walked out next to finished food.
//
// Now every job is one object with two halves that can't drift apart:
//   ok(bot, s)   can this robot do this job at station s right now?
//   act(bot, s)  do it.
// The planner only sends a robot to a station whose ok() passes, and on
// arrival ok() is checked again: if the job vanished on the way (someone else
// took the burger), the robot avoids that station for that job for a moment
// and plans again at once, instead of standing still.
//
// Jobs are scored; distance is subtracted, so a robot takes the most useful
// thing nearby. Claims (12a-robot-nav.js) keep two robots off one counter.

const ROBOT_MAX_LEVEL = 8;   // 1-5 come with time; training adds levels on top (to 8)
// Price to train a robot FROM level n to n+1.
const ROBOT_TRAIN_COST = { 1: 150, 2: 300, 3: 500, 4: 800, 5: 1200, 6: 1800, 7: 2600 };

function robotSpeed(lvl){ return (0.02 + Math.min(lvl, 5) * 0.025 + Math.max(0, lvl - 5) * 0.02) * robotOverclockMult(); }
function robotWashFrames(lvl){ return Math.max(10, 100 - Math.min(lvl, 5) * 15 - Math.max(0, lvl - 5) * 5) / robotOverclockMult(); }
function robotTier(lvl){ return lvl >= 7 ? 3 : lvl >= 5 ? 2 : lvl >= 3 ? 1 : 0; }

const DELIVERABLE = ['burger_on_tray', 'soda_on_tray', 'burger_soda_on_tray', 'fries_on_tray'];
const WASTE = ['charred', 'burnt_fries'];

// ── What the room needs right now ────────────────────────────────────────────
// Answers are cached for the rest of the frame (and dropped whenever a robot
// changes something), because every robot asks them for every station.
let _rmemo = {};
function rmemo(key, fn){ return key in _rmemo ? _rmemo[key] : (_rmemo[key] = fn()); }
function tableWants(item, s){
  const want = t => t.type === 'table' && t.group && t.group.state === 'ordering' && t.group.unservedOrders.includes(item);
  if(s) return want(s);
  return rmemo('want:' + item, () => { for(const k in stations) if(want(stations[k])) return true; return false; });
}
function anyStation(pred){ for(const k in stations){ const s = stations[k]; if(s.type !== 'robot' && pred(s)) return s; } return null; }
const slotOf = (s, state) => s.slots ? s.slots.findIndex(x => x && x.state === state) : -1;
const wantsBurger = () => tableWants('burger_on_tray') || tableWants('burger_soda_on_tray');
const wantsCombo = () => tableWants('burger_soda_on_tray');
const cookedAvailable = () => rmemo('cooked', () => !!anyStation(s => (s.type === 'counter' && s.item === 'cooked') || (s.type === 'grill' && slotOf(s, 'cooked') !== -1)));
const friesAvailable = () => rmemo('fries', () => !!anyStation(s => (s.type === 'counter' && s.item === 'fries') || (s.type === 'fryer' && slotOf(s, 'fries') !== -1)));
const hasType = type => rmemo('has:' + type, () => !!anyStation(s => s.type === type));
const burgerNeed = () => rmemo('bd', burgerDemand);
const friesNeed = () => rmemo('fd', friesDemand);

// Orders still waiting for an item, minus that item already on its way (in a
// robot's or a player's hands, or ready on a counter). Two waiters used to
// pour two sodas for one soda order, and plates for customers who'd left piled
// up until the counters and the clean trays ran out.
// Counts customers already in line as well as seated ones: their orders are
// known, and having their food ready when they sit down is the whole point.
function wantCount(item){
  return rmemo('wc:' + item, () => {
    let n = 0;
    for(const g of groups){
      if(g.state === 'eating' || g.state === 'leave' || g.state === 'leaving') continue;
      n += (g.unservedOrders || []).filter(o => o === item).length;
    }
    return n;
  });
}
function inFlight(item){
  return rmemo('if:' + item, () => {
    let n = 0;
    for(const k in stations){ const s = stations[k];
      if((s.type === 'robot' && s.holding === item) || (s.type === 'counter' && s.item === item)) n++; }
    if(player && !window._remoteSim && player.holding === item) n++;
    if(coopIsHost() && coop.remote && coop.remote.store === simIdx && coop.remote.holding === item) n++;
    return n;
  });
}
const comboNeed  = () => wantCount('burger_soda_on_tray') - inFlight('burger_soda_on_tray');
const sodaNeed   = () => wantCount('soda_on_tray') + comboNeed() - inFlight('soda_on_tray');
const plateNeed  = () => wantCount('burger_on_tray') + comboNeed() - inFlight('burger_on_tray');
const friesPlateNeed = () => wantCount('fries_on_tray') - inFlight('fries_on_tray');
const robotsWithRole = role => Object.values(stations).filter(s => s.type === 'robot' && s.role === role).length;

// Would a clean tray let a waiter make progress on some order right now?
function trayUseful(){
  if(sodaNeed() > 0 && hasType('sodafountain')) return true;
  if(plateNeed() > 0 && cookedAvailable()) return true;
  if(friesPlateNeed() > 0 && friesAvailable()) return true;
  return false;
}

// A patty on a grill that would burn before this chef could walk to the
// fridge and back: stay and mind the grill instead.
function grillNeedsMinding(bot, grill){
  const fridge = anyStation(s => s.type === 'fridge');
  if(!fridge) return false;
  const trip = (Math.hypot(bot.pos.x - fridge.x, bot.pos.z - fridge.z) + Math.hypot(fridge.x - grill.x, fridge.z - grill.z)) / robotSpeed(getRobotLevel(bot)) + 45;
  for(const k in stations){
    const g = stations[k];
    if(g.type !== 'grill' || !g.slots) continue;
    for(const sl of g.slots) if(sl && sl.state === 'raw' && (200 - sl.progress) / Math.max(0.05, upg.grillMult) + 300 < trip) return true;
  }
  return false;
}

// ── Job building blocks ──────────────────────────────────────────────────────
// put(item): station-side changes are made by each job's act.
function job(kind, score, type, ok, act){ return { kind, score, type, ok, act }; }

const J = {
  // Kitchen
  takeCooked:  job('takeCooked', 100, 'grill', (b, s) => !b.holding && slotOf(s, 'cooked') !== -1,
                   (b, s) => { s.slots[slotOf(s, 'cooked')] = null; b.holding = 'cooked'; b.stat('patties'); }),
  takeFries:   job('takeFries', 98, 'fryer', (b, s) => !b.holding && slotOf(s, 'fries') !== -1,
                   (b, s) => { s.slots[slotOf(s, 'fries')] = null; b.holding = 'fries'; b.stat('fries'); }),
  binCharred:  job('binCharred', 78, 'grill', (b, s) => !b.holding && slotOf(s, 'charred') !== -1,
                   (b, s) => { s.slots[slotOf(s, 'charred')] = null; b.holding = 'charred'; }),
  binBurnt:    job('binBurnt', 80, 'fryer', (b, s) => !b.holding && slotOf(s, 'burnt_fries') !== -1,
                   (b, s) => { s.slots[slotOf(s, 'burnt_fries')] = null; b.holding = 'burnt_fries'; }),
  dropBasket:  job('dropBasket', 70, 'fryer', (b, s) => !b.holding && s.slots.includes(null) && friesNeed() > 0,
                   (b, s) => { s.slots[s.slots.indexOf(null)] = { state: 'raw_fries', progress: 0, burnTimer: 0 }; playSound('sizzle'); }),
  fetchPatty:  job('fetchPatty', 60, 'fridge', (b, s) => {
                   if(b.holding || burgerNeed() <= 0) return false;
                   const g = anyStation(x => x.type === 'grill' && x.slots.includes(null));
                   return !!g && !grillNeedsMinding(b, g);
                 }, (b, s) => { b.holding = 'raw'; }),
  grillRaw:    job('grillRaw', 100, 'grill', (b, s) => b.holding === 'raw' && s.slots.includes(null),
                   (b, s) => { s.slots[s.slots.indexOf(null)] = { state: 'raw', progress: 0, burnTimer: 0 }; b.holding = null; playSound('grillplace'); }),
  // Plating at the tray rack puts finished food straight onto a tray, so the
  // counters hold ready-to-serve plates instead of loose patties.
  // Only plate when the plate has somewhere to go (a seated table, or a free
  // counter); otherwise a chef stood holding it instead of cooking.
  plateBurger: job('plateBurger', 90, 'trayrack', (b, s) => b.holding === 'cooked' && s.cleanTrays > 0 && plateNeed() > 0 &&
                   (wantCount('burger_on_tray') > 0 && tableWants('burger_on_tray') || !!stageCounter(b)),
                   (b, s) => { s.cleanTrays--; b.holding = 'burger_on_tray'; }),
  plateFries:  job('plateFries', 90, 'trayrack', (b, s) => b.holding === 'fries' && s.cleanTrays > 0 && friesPlateNeed() > 0 &&
                   (tableWants('fries_on_tray') || !!stageCounter(b)),
                   (b, s) => { s.cleanTrays--; b.holding = 'fries_on_tray'; }),
  onCounterTray: job('onCounterTray', 88, 'counter', (b, s) => (b.holding === 'cooked' || b.holding === 'fries') && s.item === 'tray',
                   (b, s) => { s.item = b.holding === 'cooked' ? 'burger_on_tray' : 'fries_on_tray'; b.holding = null; }),

  // Front of house
  deliver:     job('deliver', 100, 'table', (b, s) => DELIVERABLE.includes(b.holding) && tableWants(b.holding, s),
                   (b, s) => { if(serveHeldToGroup(s, b.holding)){ b.holding = null; b.stat('served'); } }),
  pickPlate:   job('pickPlate', 100, 'counter', (b, s) => !b.holding && DELIVERABLE.includes(s.item) && tableWants(s.item),
                   (b, s) => { b.holding = s.item; s.item = null; }),
  // Hands full of a plate nobody wants yet, and the plate a table IS waiting
  // for is on a counter: put ours down there and take theirs, in one move.
  // Without this, full hands plus full counters could stall the whole crew.
  swapForPlate: job('swapForPlate', 99, 'counter', (b, s) => DELIVERABLE.includes(b.holding) && !tableWants(b.holding) &&
                   DELIVERABLE.includes(s.item) && s.item !== b.holding && tableWants(s.item),
                   (b, s) => { const mine = b.holding; b.holding = s.item; s.item = mine; }),
  pickForCombo: job('pickForCombo', 92, 'counter', (b, s) => !b.holding && comboNeed() > 0 &&
                   ((s.item === 'burger_on_tray' && hasType('sodafountain')) || (s.item === 'soda_on_tray' && cookedAvailable())),
                   (b, s) => { b.holding = s.item; s.item = null; }),
  fetchTray:   job('fetchTray', 70, 'trayrack', (b, s) => !b.holding && s.cleanTrays > 0 && trayUseful(),
                   (b, s) => { s.cleanTrays--; b.holding = 'tray'; }),
  trayOnCooked: job('trayOnCooked', 95, 'counter', (b, s) => b.holding === 'tray' && s.item === 'cooked' && plateNeed() > 0,
                   (b, s) => { s.item = null; b.holding = 'burger_on_tray'; }),
  trayAtGrill: job('trayAtGrill', 93, 'grill', (b, s) => (b.holding === 'tray' || b.holding === 'soda_on_tray') && slotOf(s, 'cooked') !== -1 &&
                   (b.holding === 'tray' ? plateNeed() > 0 : comboNeed() > 0),
                   (b, s) => { s.slots[slotOf(s, 'cooked')] = null; b.holding = b.holding === 'tray' ? 'burger_on_tray' : 'burger_soda_on_tray'; }),
  trayOnFries: job('trayOnFries', 95, 'counter', (b, s) => b.holding === 'tray' && s.item === 'fries' && friesPlateNeed() > 0,
                   (b, s) => { s.item = null; b.holding = 'fries_on_tray'; }),
  trayAtFryer: job('trayAtFryer', 93, 'fryer', (b, s) => b.holding === 'tray' && slotOf(s, 'fries') !== -1 && friesPlateNeed() > 0,
                   (b, s) => { s.slots[slotOf(s, 'fries')] = null; b.holding = 'fries_on_tray'; }),
  pourSoda:    job('pourSoda', 90, 'sodafountain', (b, s) => (b.holding === 'tray' && sodaNeed() > 0) ||
                   (b.holding === 'burger_on_tray' && comboNeed() > 0 && !tableWants('burger_on_tray')),
                   (b, s) => { b.holding = b.holding === 'tray' ? 'soda_on_tray' : 'burger_soda_on_tray'; playSound('pour'); }),
  comboOnCounter: job('comboOnCounter', 96, 'counter', (b, s) => wantsCombo() &&
                   ((b.holding === 'burger_on_tray' && s.item === 'soda_on_tray') ||
                    (b.holding === 'soda_on_tray' && (s.item === 'burger_on_tray' || s.item === 'cooked'))),
                   (b, s) => { s.item = null; b.holding = 'burger_soda_on_tray'; }),
  returnTray:  job('returnTray', 20, 'trayrack', (b, s) => b.holding === 'tray',
                   (b, s) => { s.cleanTrays++; b.holding = null; }),

  // Cleaning
  clearTable:  job('clearTable', 100, 'table', (b, s) => !b.holding && s.dirtyTrays > 0,
                   (b, s) => { s.dirtyTrays--; b.holding = 'dirty_tray'; }),
  wash:        job('wash', 90, 'sink', (b, s) => b.holding === 'dirty_tray',
                   (b, s) => { b.holding = 'tray'; b.timer = robotWashFrames(getRobotLevel(b)); b.state = 'washing'; b.stat('washed'); }),
  strayTray:   job('strayTray', 50, 'counter', (b, s) => !b.holding && (s.item === 'tray' || s.item === 'dirty_tray'),
                   (b, s) => { b.holding = s.item; s.item = null; }),
  bagTrash:    job('bagTrash', 70, 'trash', (b, s) => !b.holding && s.contents >= 4,
                   (b, s) => { s.contents = 0; b.holding = 'trash_bag'; }),
  dump:        job('dump', 100, 'dumpster', (b, s) => b.holding === 'trash_bag',
                   (b, s) => { b.holding = null; playSound('dump'); }),
  // Waste goes in the bin; a full bin gets bagged with it (never a dead end).
  binWaste:    job('binWaste', 100, 'trash', (b, s) => WASTE.includes(b.holding),
                   (b, s) => { if(s.contents < 4){ s.contents++; b.holding = null; } else { s.contents = 0; b.holding = 'trash_bag'; } }),

  // Last resorts for anything in hand
  stage:       job('stage', 15, 'counter', (b, s) => !!b.holding && !['tray', 'dirty_tray', 'trash_bag', 'raw'].includes(b.holding) &&
                   !WASTE.includes(b.holding) && !s.item && stageCounter(b) === s,
                   (b, s) => { s.item = b.holding; b.holding = null; }),
  binFood:     job('binFood', 1, 'trash', (b, s) => !!b.holding && b.holding !== 'trash_bag' && (b._stuck || 0) > 200,
                   (b, s) => { if(s.contents < 4){ s.contents++; b.holding = b.holding.includes('_on_tray') ? 'tray' : null; }
                               else { s.contents = 0; b.holding = 'trash_bag'; } }),
};

// Which jobs a robot considers, by role (and a chef's specialty).
function robotJobs(bot){
  const spec = bot.spec || 'both';
  const fryer = hasType('fryer');
  const grillWork = !fryer || spec !== 'fryer', fryWork = fryer && spec !== 'grill';
  const list = [];
  if(bot.role === 'chef'){
    if(grillWork) list.push(J.takeCooked, J.binCharred, J.fetchPatty, J.grillRaw);
    if(fryWork) list.push(J.takeFries, J.binBurnt, J.dropBasket);
    list.push(J.plateBurger, J.plateFries, J.onCounterTray, J.deliver, J.pourSoda);
  } else if(bot.role === 'waiter'){
    list.push(J.deliver, J.pickPlate, J.pickForCombo, J.fetchTray, J.trayOnCooked, J.trayAtGrill,
              J.trayOnFries, J.trayAtFryer, J.pourSoda, J.comboOnCounter, J.returnTray);
    // Idle helping: lower scores than any serving job, so they only happen
    // when nobody is waiting on this waiter.
    list.push(Object.assign({}, J.clearTable, { score: 30 }), Object.assign({}, J.bagTrash, { score: 25 }),
              Object.assign({}, J.strayTray, { score: 20 }));
  } else {
    list.push(J.clearTable, J.bagTrash, J.strayTray);
  }
  // Everyone can finish what's in their hands.
  list.push(J.wash, J.dump, J.binWaste, J.returnTray, J.deliver, J.swapForPlate, J.grillRaw, J.plateBurger, J.plateFries, J.stage, J.binFood);
  return list;
}

// Pick the best (job, station) pair for this robot, or null.
function robotPlan(bot){
  const now = bot._clock || 0;
  const avoid = bot._avoid || (bot._avoid = {});
  let best = null, bestScore = -Infinity;
  const seen = new Set();
  for(const j of robotJobs(bot)){
    if(seen.has(j.kind + j.score)) continue; seen.add(j.kind + j.score);
    for(const k in stations){
      const s = stations[k];
      if(s.type !== j.type) continue;
      if((avoid[j.kind + '@' + s.id] || 0) > now) continue;
      if(claimedByOther(bot, s)) continue;
      if(!j.ok(bot, s)) continue;
      const score = j.score - Math.hypot(s.x - bot.pos.x, s.z - bot.pos.z) * 0.8;
      if(score > bestScore){ bestScore = score; best = { j, s }; }
    }
  }
  return best;
}

// Small per-robot work tally for the staff list.
function robotStatFn(bot){
  return key => { const w = bot.work || (bot.work = {}); w[key] = (w[key] || 0) + 1; };
}
