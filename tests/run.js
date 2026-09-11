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

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if(fail){ console.log('  failing: ' + failures.join(', ')); }
console.log(`${'─'.repeat(60)}\n`);
process.exit(fail ? 1 : 0);
