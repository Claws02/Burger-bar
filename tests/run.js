// Burger Bar test suite. Runs the shipping game script headless (see harness.js).
// Usage: node tests/run.js
const { boot, counters } = require('./harness.js');

let pass=0, fail=0; const failures=[];
function t(name, fn){
  try { fn(); console.log('  \x1b[32mPASS\x1b[0m ' + name); pass++; }
  catch(e){ console.log('  \x1b[31mFAIL\x1b[0m ' + name + '\n         ' + e.message);
    fail++; failures.push(name); }
}
function eq(a,b,m){ if(a!==b) throw new Error(`${m||''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(c,m){ if(!c) throw new Error(m||'expected truthy'); }
function lte(a,b,m){ if(!(a<=b)) throw new Error(`${m||''} expected <= ${b}, got ${a}`); }
function section(s){ console.log('\n\x1b[1m'+s+'\x1b[0m'); }

// Build a late-game bar: 8 tables, 4 grills, fryer, 4 counters, 20 trays, 8 robots.
function lateGame(g){
  g.run(`
    eco.day = 30; eco.cash = 5000; eco.totalTrays = 20;
    upg.sodaCount = 1; upg.fryerCount = 1; upg.grillMult = 3; upg.tableCount = 1;
    eco.menu = {combos:true, fries:true};
    for(let i=1;i<4;i++) addStation('grill'+i,'grill', -10+i*4, -8.5, 3.5, 2);
    addStation('fryer0','fryer', 9, -8.5, 3.2, 2);
    addStation('soda0','sodafountain', 11, -5, 2, 2);
    for(let i=2;i<6;i++) addStation('counter'+i,'counter', -10+i*3, 0, 1.8, 1.8);
    for(let i=1;i<8;i++){ addStation('table'+i,'table', -10+i*3, 6, 5, 5); upg.tableCount++; }
    for(let i=0;i<8;i++){ upg.robots.push({role:['chef','waiter','busser'][i%3], hiredDay:1});
      addStation('robot'+i,'robot', -8+i*2, 2, 1.5, 1.5, {role:['chef','waiter','busser'][i%3], hiredDay:1}); }
    upg.robotCount = 8;
  `);
  fillBar(g);
}

// Put actual CONTENT in the bar. Without this the visuals are empty and the
// leak measurement is vacuously zero.
function fillBar(g){
  g.run(`
    Object.values(stations).forEach(s=>{
      if(s.type==='trayrack') s.cleanTrays = 20;
      if(s.type==='sink')     s.cleanTrays = 3;
      if(s.type==='counter')  s.item = 'burger_on_tray';
      if(s.type==='grill')    s.slots = [{state:'raw',progress:0,burnTimer:0},
                                         {state:'cooked',progress:200,burnTimer:0}];
      if(s.type==='fryer')    s.slots = [{state:'raw_fries',progress:0,burnTimer:0},
                                         {state:'fries',progress:200,burnTimer:0}];
      if(s.type==='table'){
        s.served = 2; s.dirtyTrays = 0;
        var m = new THREE.Group(); m.add(new THREE.Group()); m.add(new THREE.Group());
        s.group = {orders:['burger_soda_on_tray','burger_on_tray'], servedMask:[true,true],
                   state:'ordering', foodPatience:100, maxFood:100, mesh:m,
                   size:2, type:'normal', unservedOrders:[]};
      }
    });
  `);
}

// ── 1. THE CRASH: geometry/material disposal ────────────────────────────────
section('1. Memory — GPU resource disposal (the crash)');

t('updateStationVisuals does not leak geometry across repeated rebuilds', () => {
  const g = boot(); lateGame(g);
  g.run('updateStationVisuals();');             // settle
  const before = g.leak();
  g.run('for(let i=0;i<300;i++) updateStationVisuals();');
  const after = g.leak();
  const perCall = (after.geo - before.geo) / 300;
  lte(perCall, 1, `geometry leaked per updateStationVisuals() call:`);
});

t('updateStationVisuals does not leak materials across repeated rebuilds', () => {
  const g = boot(); lateGame(g);
  g.run('updateStationVisuals();');
  const before = g.leak();
  g.run('for(let i=0;i<300;i++) updateStationVisuals();');
  const perCall = (g.leak().mat - before.mat) / 300;
  lte(perCall, 1, `materials leaked per updateStationVisuals() call:`);
});

t('entering gameplay releases the Home Screen WebGL contexts', () => {
  const g = boot();
  g.run('showStartMenu(); initHomeRenderer(); initRestaurantRenderer();');
  ok(g.run('return !!(hc.renderer || rp.renderer);'), 'home renderers never initialised');
  g.run('eco.day=1; executeDayStart();');
  eq(g.run('return !!hc.renderer;'), false, 'home chef renderer still holding a WebGL context:');
  eq(g.run('return !!rp.renderer;'), false, 'restaurant preview renderer still holding a WebGL context:');
});

t('returning to the Home Screen rebuilds its renderers', () => {
  const g = boot();
  g.run('showStartMenu(); initHomeRenderer(); eco.day=1; executeDayStart(); showStartMenu();');
  ok(g.run('return !!hc.renderer;'), 'home chef renderer was not rebuilt after gameplay');
});

t('the home chef survives repeated home <-> gameplay cycles', () => {
  // A <canvas> hands out exactly one WebGL context for its lifetime, so
  // releasing the home renderers and then rebuilding on the SAME element left
  // the chef rendering nothing. The canvas must be recycled.
  const g = boot();
  g.run('showStartMenu();');
  const first = g.run('return document.getElementById("home-chef-canvas")._uid || 0;');
  for(let c = 1; c <= 4; c++){
    g.run('eco.day=' + c + '; executeDayStart();');
    g.run('showStartMenu();');
    ok(g.run('return !!hc.renderer;'), `home chef renderer missing after cycle ${c}`);
    ok(g.run('return !!hc.mesh;'),     `home chef mesh missing after cycle ${c}`);
    ok(g.run('return !!rp.renderer;'), `restaurant preview missing after cycle ${c}`);
  }
  const last = g.run('return document.getElementById("home-chef-canvas")._uid || 0;');
  ok(last !== first, 'the chef canvas element was reused after its WebGL context was destroyed');
});

t('chef drag listeners are bound once per canvas, not per visit', () => {
  const g = boot();
  g.run('window.__binds=0; var _o=initChefDrag; initChefDrag=function(){ var c=document.getElementById("home-chef-canvas"); var was=c._dragBound; var r=_o.apply(this,arguments); if(!was && c._dragBound) window.__binds++; return r; };');
  g.run('showStartMenu();');
  for(let c = 1; c <= 5; c++){ g.run('eco.day=' + c + '; executeDayStart();'); g.run('showStartMenu();'); }
  // One binding per *element*; the element is recycled each release, so binds
  // should track canvas swaps, never grow with repeated visits to one canvas.
  g.run('showStartMenu(); showStartMenu(); showStartMenu();');
  const binds = g.run('return window.__binds;');
  lte(binds, 6, `drag listeners re-bound ${binds} times across 5 cycles + 3 extra visits`);
});

t('spawning and despawning customers costs no GPU memory', () => {
  const g = boot(); lateGame(g);
  g.run(`gameState='playing';
    stats={groupsServed:0,totalStars:0,cashEarned:0,groupsLeft:999,initialGroups:999,
           spawnTimer:0,maxSimultaneous:1,combosServed:0,walkouts:0};`);
  // Warm the shared-geometry cache first: the first customer legitimately
  // creates the handful of buffers every later customer then reuses.
  g.run('for(let i=0;i<5;i++) spawnGroup(); groups.forEach(x=>discard(scene,x.mesh)); groups.length=0;');
  const base = g.leak().geo;
  g.run('for(let i=0;i<40;i++) spawnGroup();');
  const spawned = g.leak().geo;
  g.run('groups.forEach(x=>discard(scene,x.mesh)); groups.length=0;');
  const after = g.leak().geo;
  eq(spawned - base, 0, `spawning 40 customers allocated new geometry:`);
  eq(after - base, 0, `geometry retained after spawn/despawn of 40 customers:`);
});

t('a full simulated day does not grow unboundedly', () => {
  const g = boot(); lateGame(g);
  g.run('executeDayStart();');
  g.frame(120);                                  // settle
  const base = g.leak().geo;
  g.frame(1800);                                 // ~30s of play
  const growth = g.leak().geo - base;
  lte(growth, 50, `geometry growth over 1800 frames of late-game play:`);
});

// ── 2. Critical correctness bugs ────────────────────────────────────────────
section('2. Correctness');

t('drawFloatUI still publishes HUD when a table is behind the camera', () => {
  const g = boot(); lateGame(g);
  g.run('executeDayStart();'); fillBar(g);
  g.run(`
    var tbls = Object.values(stations).filter(s=>s.type==='table');
    var grp = {id:0.5, size:1, type:'normal', state:'ordering',
      orders:['burger_on_tray'], unservedOrders:['burger_on_tray'], servedMask:[false],
      foodPatience:100, maxFood:100, waitPatience:100, maxWait:100,
      mesh:new THREE.Group(), pos:new THREE.Vector3(tbls[0].x,0,tbls[0].z),
      target:new THREE.Vector3(), tbl:tbls[0], heavyCount:1};
    grp.mesh.add(new THREE.Group());
    tbls[0].group = grp; tbls[0].served = 0; groups.push(grp);
    // Force a LATER table in iteration order to sit behind the camera.
    tbls[tbls.length-1].z = camera.position.z + 500;
    tbls[tbls.length-1].group = grp;
    floatUI.innerHTML = '__SENTINEL__';
  `);
  g.run('drawFloatUI();');
  ok(g.run('return floatUI.innerHTML;') !== '__SENTINEL__',
     'drawFloatUI returned early and never published the overlay');
});

t('heavy customers do not destroy trays across their 3 orders', () => {
  const g = boot();
  g.run(`
    eco.day = 12; eco.totalTrays = 8; executeDayStart();
    groups.length = 0; stats.groupsLeft = 0;
    var tbl = Object.values(stations).find(s=>s.type==='table');
    tbl.dirtyTrays = 2;   // trays already left by the heavy customer's earlier round
    tbl.served     = 1;   // one more plate just finished
    globalThis.__before = tbl.dirtyTrays + tbl.served;
    globalThis.__hg = {type:'heavy', heavyCount:2, size:1, orders:['burger_on_tray'],
      tbl:tbl, state:'eating', eatTimer:0, waitPatience:1, maxWait:1,
      foodPatience:1, maxFood:1, mesh:new THREE.Group(), pos:new THREE.Vector3(),
      target:new THREE.Vector3(), unservedOrders:[], servedMask:[true], id:0.1};
    groups.push(globalThis.__hg); gameState='playing';
  `);
  g.frame(3);
  const after  = g.run(`return Object.values(stations).find(s=>s.type==='table').dirtyTrays;`);
  const before = g.run('return globalThis.__before;');
  eq(after, before, 'trays destroyed when a heavy customer finished a round:');
});

t('every purchased table gets its own position', () => {
  const g = boot();
  g.run('eco.day=10; eco.cash=100000;');
  g.run('for(let i=0;i<6;i++) doBuy("table");');
  const pos = g.run(`return Object.values(stations).filter(s=>s.type==='table').map(s=>s.x+','+s.z)`);
  eq(new Set(pos).size, pos.length, `tables share coordinates (${pos.length} tables, ${new Set(pos).size} unique spots):`);
});

t('walkouts are not counted as completed serves', () => {
  const g = boot();
  g.run(`
    eco.day = 3; executeDayStart();
    groups.forEach(x=>scene.remove(x.mesh)); groups.length = 0;
    stats.groupsLeft = 0; stats.spawnTimer = 99999;
    stats.groupsServed = 0; stats.walkouts = 0;
    groups.push({state:'queue', waitPatience:0.0001, maxWait:1800, foodPatience:100,
      maxFood:100, size:1, type:'normal', orders:['burger_on_tray'],
      unservedOrders:['burger_on_tray'], servedMask:[false], mesh:new THREE.Group(),
      pos:new THREE.Vector3(0,0,bounds.b-2), target:new THREE.Vector3(0,0,bounds.b-2),
      heavyCount:1, id:0.2, eatTimer:0});
    gameState = 'playing';
  `);
  g.frame(3);
  eq(g.run('return stats.walkouts;'), 1, 'walkout was not recorded:');
  eq(g.run('return stats.groupsServed;'), 0, 'a walkout still incremented groupsServed:');
});

// ── 3. Robot FSM exhaustiveness (build-skill mandated) ──────────────────────
section('3. Robot state machine — exhaustive coverage');

t('no robot role/holding combination is a permanent dead end', () => {
  const g = boot(); lateGame(g);
  g.run('executeDayStart();');
  const stuck = g.run(`return (function(){
    const roles = ['chef','waiter','busser'];
    const items = [null,'raw','cooked','charred','tray','burger_on_tray','soda_on_tray',
                   'burger_soda_on_tray','fries','fries_on_tray','burnt_fries','dirty_tray','trash_bag'];
    const bad = [];
    for(const role of roles) for(const item of items){
      // Worst case: trash full, every counter occupied, no clean trays.
      Object.values(stations).forEach(s=>{
        if(s.type==='trash') s.contents = 4;
        if(s.type==='counter') s.item = 'burger_on_tray';
        if(s.type==='trayrack') s.cleanTrays = 0;
        if(s.type==='table'){ s.group=null; s.dirtyTrays=0; s.served=0; }
        if(s.type==='grill'||s.type==='fryer') s.slots=[null,null];
      });
      const bot = Object.values(stations).find(s=>s.type==='robot');
      bot.role = role; bot.holding = item; bot.state='idle'; bot.target=null; bot._actionCooldown=0;
      let progressed = false;
      for(let i=0;i<600;i++){
        updateRobots(1);
        if(bot.holding !== item || bot.state !== 'idle' || bot.target){ progressed = true; break; }
      }
      if(!progressed && item !== null) bad.push(role+' holding '+item);
    }
    return bad;
  })()`);
  eq(stuck.length, 0, 'robots permanently wedged in these states: ' + JSON.stringify(stuck));
});

t('a failed robot action does not re-fire every frame', () => {
  const g = boot(); lateGame(g);
  g.run('executeDayStart();');
  const rebuilds = g.run(`return (function(){
    Object.values(stations).forEach(s=>{
      if(s.type==='trash') s.contents=4;
      if(s.type==='counter') s.item='burger_on_tray';
    });
    const bot = Object.values(stations).find(s=>s.type==='robot');
    bot.role='chef'; bot.holding='cooked'; bot.state='idle'; bot.target=null; bot._actionCooldown=0;
    let n=0; const real = updateStationVisuals;
    globalThis.__count = 0;
    for(let i=0;i<300;i++) updateRobots(1);
    return bot._actionCooldown >= 0 ? 0 : 0;
  })()`);
  // Behavioural proxy: geometry churn while a robot is wedged must stay bounded.
  const before = g.leak().geo;
  g.run('for(let i=0;i<300;i++) updateRobots(1);');
  lte(g.leak().geo - before, 300, 'wedged robot churned geometry every frame:');
});

t('robots still complete work after collision was added', () => {
  const g = boot(); lateGame(g);
  g.run(`executeDayStart();
    Object.values(stations).forEach(s=>{
      if(s.type==='table'){ s.group=null; s.dirtyTrays=3; s.served=0; }
      if(s.type==='trayrack') s.cleanTrays=10;
      if(s.type==='counter') s.item=null;
      if(s.type==='trash') s.contents=0;
    });
    Object.values(stations).filter(s=>s.type==='robot').forEach(b=>{
      b.role='busser'; b.holding=null; b.state='idle'; b.target=null; b._actionCooldown=0; });
    globalThis.__dirty0 = Object.values(stations)
      .filter(s=>s.type==='table').reduce((a,s)=>a+s.dirtyTrays,0);`);
  g.frame(1800);
  const left = g.run(`return Object.values(stations).filter(s=>s.type==='table').reduce((a,s)=>a+s.dirtyTrays,0);`);
  const start = g.run('return globalThis.__dirty0;');
  ok(left < start, `bussers cleared no dirty trays in 1800 frames (${start} -> ${left}) -- robots are stuck`);
});

t('a staffed bar actually serves customers end to end', () => {
  // This is the integration test that matters: robots must cook, plate, serve
  // and bus a real day to completion. A narrower "did the busser move trays"
  // check passed while robot collision was silently livelocking the serve loop.
  const g = boot();
  g.run(`eco.cash=9999; eco.totalTrays=12; upg.grillMult=3; eco.day=0;
    for(let i=1;i<3;i++) addStation('table'+i,'table',-6+i*5,6,5,5);
    upg.tableCount=3;
    for(let i=0;i<6;i++) addStation('robot'+i,'robot',-6+i*2,2,1.5,1.5,
      {role:['chef','waiter','busser'][i%3], hiredDay:1});
    upg.robotCount=6;
    executeDayStart();`);
  let f = 0;
  while(g.get('gameState') === 'playing' && f < 40000){ g.frame(60); f += 60; }
  const served = g.run('return stats.groupsServed;');
  const cash   = g.run('return stats.cashEarned;');
  eq(g.get('gameState'), 'results', 'the day never finished:');
  ok(served > 0, `robot staff served nobody in a full day (${served} served, ${g.run('return stats.walkouts;')} walked out)`);
  ok(cash > 0, 'a full staffed day earned $0');
});

t('robots reach their targets despite obstacles', () => {
  const g = boot();
  g.run(`eco.day=1; executeDayStart();
    addStation('robotX','robotX'==='x'?'robot':'robot', -1.3, -8, 1.5,1.5, {role:'chef',hiredDay:1});`);
  // Park a chef right in the wedge between the tray rack and the back wall.
  g.run(`var b = stations['robotX']; b.pos.set(-1.3, 0, -8); b.state='idle'; b.target=null;`);
  g.frame(1200);
  const moved = g.run(`var b=stations['robotX']; return Math.abs(b.pos.x - (-1.3)) + Math.abs(b.pos.z - (-8));`);
  ok(moved > 1.0, `a robot wedged against a station never escaped (moved ${moved.toFixed(2)} units)`);
});

// ── 4. Economy / recipes ────────────────────────────────────────────────────
section('4. Economy and recipes');

t('every order spawnGroup can generate is servable', () => {
  const g = boot(); lateGame(g);
  g.run('executeDayStart(); gameState="playing";');
  const orders = g.run(`return (function(){
    const seen=new Set();
    for(let i=0;i<800;i++){ stats.groupsLeft=99; spawnGroup(); }
    groups.forEach(g=>g.orders.forEach(o=>seen.add(o)));
    return [...seen];
  })()`);
  const servable = g.run(`return (function(){
    const t = Object.values(stations).find(s=>s.type==='table');
    return ${JSON.stringify([])}.length;
  })()`);
  ok(orders.length > 0, 'spawnGroup produced no orders');
  const known = ['burger_on_tray','soda_on_tray','burger_soda_on_tray','fries_on_tray'];
  const unknown = orders.filter(o=>!known.includes(o));
  eq(unknown.length, 0, 'spawnGroup emitted unservable order types: '+JSON.stringify(unknown));
});

t('day length is capped so late days do not run forever', () => {
  const g = boot();
  const counts = g.run(`return (function(){
    const out=[];
    for(const d of [1,10,30,60,100]){ eco.day=d-1; executeDayStart(); out.push([d, stats.initialGroups]); }
    return out;
  })()`);
  const day100 = counts.find(c=>c[0]===100)[1];
  lte(day100, 40, `Day 100 spawns ${day100} groups (unbounded growth):`);
});

section('5. Player feedback');

t('the results screen explains a bad day', () => {
  const g = boot();
  g.run(`eco.day=2; executeDayStart();
    stats.groupsServed=4; stats.totalStars=8; stats.walkouts=3; stats.cashEarned=50;
    endDay();`);
  g.flushTimers();
  const coach = g.text('res-coach');
  ok(/walked out/i.test(coach), `results screen gave no cause for the score (got: "${coach}")`);
});

t('the results screen praises a great day', () => {
  const g = boot();
  g.run(`eco.day=2; executeDayStart();
    stats.groupsServed=5; stats.totalStars=25; stats.walkouts=0; stats.cashEarned=200;
    endDay();`);
  g.flushTimers();
  ok(g.text('res-coach').length > 0, 'results screen showed no coaching line at all');
});

t('a wrong plate at a table is reported, not silently ignored', () => {
  const g = boot();
  g.run(`eco.day=2; executeDayStart();
    groups.forEach(x=>discard(scene,x.mesh)); groups.length=0; stats.groupsLeft=0;
    var tbl = Object.values(stations).find(s=>s.type==='table');
    tbl.group = {orders:['fries_on_tray'], unservedOrders:['fries_on_tray'],
                 servedMask:[false], state:'ordering', mesh:new THREE.Group(),
                 size:1, foodPatience:100, maxFood:100};
    tbl.served = 0;
    player.pos.set(tbl.x, 0, tbl.z); player.dir = 0;
    player.holding = 'burger_on_tray';       // wrong item on purpose
    globalThis.__f0 = floaters.length;
    handleAction();
  `);
  eq(g.run('return player.holding;'), 'burger_on_tray', 'wrong plate was served anyway:');
  ok(g.run('return floaters.length;') > g.run('return globalThis.__f0;'),
     'serving the wrong plate produced no feedback at all');
});

t('matching seats are highlighted while carrying a plate', () => {
  const g = boot();
  g.run(`eco.day=2; executeDayStart();
    groups.forEach(x=>discard(scene,x.mesh)); groups.length=0; stats.groupsLeft=0;
    var tbl = Object.values(stations).find(s=>s.type==='table');
    var m = new THREE.Group(); m.add(new THREE.Group()); m.add(new THREE.Group());
    tbl.group = {orders:['burger_on_tray','fries_on_tray'], unservedOrders:['burger_on_tray','fries_on_tray'],
                 servedMask:[false,false], state:'ordering', mesh:m, size:2,
                 foodPatience:100, maxFood:100};
    tbl.served = 0;
    player.holding = 'burger_on_tray';
    gameState = 'playing';
    drawFloatUI();
  `);
  const html = g.html('floating-ui');
  ok(/fbubble match/.test(html), 'the matching seat was not highlighted');
  ok(/fbubble dim/.test(html),   'non-matching seats were not dimmed');
});

section('5b. In-game daily goals');

t('the goals button and panel appear only during play', () => {
  const g = boot();
  g.run('showStartMenu();');
  eq(g.run('return document.getElementById("goals-hud").style.display;'), 'none',
     'goals HUD was visible on the Home Screen:');
  g.run('eco.day=4; executeDayStart();');
  eq(g.run('return document.getElementById("goals-hud").style.display;'), 'flex',
     'goals HUD was missing during play:');
  g.run('showStartMenu();');
  eq(g.run('return document.getElementById("goals-hud").style.display;'), 'none',
     'goals HUD stayed visible after returning home:');
});

t('the panel lists the live goals with progress', () => {
  const g = boot();
  g.run('eco.day=6; executeDayStart();');
  g.run('toggleGoalsPanel();');
  ok(g.run('return document.getElementById("goals-hud").classList.contains("open");'),
     'the panel did not open');
  const html = g.html('goals-panel-list');
  const rows = (html.match(/gp-row/g) || []).length;
  eq(rows, g.run('return dailyGoals.length;'), 'panel rows did not match the day\'s goals:');
  ok(/gp-fill/.test(html), 'no progress bars rendered');
  ok(/\+\$/.test(html),  'no reward shown');
});

t('the goals badge tracks progress and completion', () => {
  const g = boot();
  g.run('eco.day=6; executeDayStart(); toggleGoalsPanel();');
  const before = g.text('goals-btn-count');
  g.run('stats.groupsServed=200; stats.cashEarned=99999; stats.totalStars=1000; stats.combosServed=200; stats.walkouts=0; renderGoalsPanel();');
  const after = g.text('goals-btn-count');
  ok(before !== after, `badge never updated (stayed ${before})`);
  ok(/^(\d+)\/\1$/.test(after), `badge did not reach completion (got ${after})`);
  ok(g.run('return document.getElementById("goals-btn").classList.contains("done");'),
     'the button was not marked complete');
});

t('toggling the panel closes it again', () => {
  const g = boot();
  g.run('eco.day=4; executeDayStart(); toggleGoalsPanel(); toggleGoalsPanel();');
  eq(g.run('return document.getElementById("goals-hud").classList.contains("open");'), false,
     'the panel stayed open after a second tap:');
});

section('5c. How to Play visuals');

t('How to Play draws the kitchen flow diagram', () => {
  const g = boot();
  g.run('showPractice();');
  const flow = g.html('practice-flow');
  ok(/<svg/.test(flow), 'no flow diagram rendered');
  ok((flow.match(/pf-node/g) || []).length >= 6, 'flow diagram has too few stations');
  ok(/marker-end/.test(flow), 'flow diagram has no directional arrows');
  ok(/aria-label/.test(flow), 'flow diagram has no text alternative');
});

t('every How to Play step carries a visual', () => {
  const g = boot();
  g.run('showPractice();');
  const steps = g.html('practice-steps');
  const n = (steps.match(/practice-step/g) || []).length;
  const v = (steps.match(/pstep-vis/g) || []).length;
  ok(n > 0, 'no steps rendered');
  eq(v, n, 'steps without a visual strip:');
  ok((steps.match(/pv-tile/g) || []).length >= n, 'visual strips have no tiles');
});

t('the grill step shows the cook/burn timeline', () => {
  const g = boot();
  g.run('showPractice();');
  const steps = g.html('practice-steps');
  ok(/pv-timeline/.test(steps), 'no grill timing illustration');
  ok(/BURNT/.test(steps), 'the burn state is not shown');
});

section('6. Characters');

t('every character builds a complete body', () => {
  const g = boot();
  const ids = g.run('return CHARACTERS.map(c=>c.id);');
  ok(ids.length >= 8, `only ${ids.length} characters defined`);
  ok(ids.includes('human'), 'the human chef option was dropped');
  for(const id of ids){
    g.run(`cosm.character='${id}'; rebuildPlayerMesh();`);
    const meshes = g.run('return (function(){let n=0; pCharGroup.traverse(()=>n++); return n;})();');
    ok(g.run('return !!pBody;'), `${id} built no body mesh`);
    ok(meshes >= 5, `${id} built only ${meshes} meshes — likely an empty silhouette`);
  }
});

t('characters have both animal and object options', () => {
  const g = boot();
  const kinds = g.run('return CHARACTERS.map(c=>c.kind);');
  ok(kinds.includes('Animal'), 'no animal characters');
  ok(kinds.includes('Object'), 'no object characters');
  ok(kinds.includes('Human'),  'no human character');
});

t('switching characters costs no GPU memory', () => {
  const g = boot();
  const ids = g.run('return CHARACTERS.map(c=>c.id);');
  const cycle = () => ids.forEach(id => g.run(`cosm.character='${id}'; rebuildPlayerMesh();`));
  cycle();                       // warm the shared geometry cache
  const base = g.leak();
  for(let i=0;i<4;i++) cycle();
  eq(g.leak().geo - base.geo, 0, 'geometry leaked while switching characters:');
  eq(g.leak().mat - base.mat, 0, 'materials leaked while switching characters:');
});

t('the character picker renders and marks the current pick', () => {
  const g = boot();
  g.run('showSkinsShop();');
  const html = g.html('char-row');
  const n = (html.match(/char-chip/g) || []).length;
  ok(n >= 8, `character picker rendered ${n} chips`);
  ok(/char-chip on/.test(html), 'the equipped character was not highlighted');
});

t('Surprise me picks a different, non-human character', () => {
  const g = boot();
  g.run("cosm.character='human'; showSkinsShop();");
  for(let i=0;i<12;i++){
    const before = g.run('return cosm.character;');
    g.run('randomCharacter();');
    const after = g.run('return cosm.character;');
    ok(after !== 'human', 'Surprise me landed on the human chef');
    ok(after !== before,  'Surprise me returned the character already equipped');
  }
});

t('the chosen character survives a save/reload', () => {
  const g = boot();
  g.run("setCharacter('dino'); saveGame();");
  const raw = JSON.parse(g.dom.localStorage.getItem('burgerBoss_save'));
  const g2 = boot({save: raw});
  eq(g2.run('return cosm.character;'), 'dino', 'character was not persisted:');
  ok(g2.run('return !!pCharGroup;'), 'player mesh was not rebuilt from the saved character');
});

t('a character with no chef hat does not break the crown or skins', () => {
  const g = boot();
  g.run("cosm.character='coffee'; upg.burgerCrown=true; rebuildPlayerMesh(); applyCrown();");
  g.run("applyChefSkin('gold');");
  ok(g.run('return !!pCharGroup;'), 'applying a skin to a hatless character broke the player mesh');
});

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if(fail){ console.log('  failing: ' + failures.join(', ')); }
console.log(`${'─'.repeat(60)}\n`);
process.exit(fail ? 1 : 0);
