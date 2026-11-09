// Burger Bar — 12-robots. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ROBOT AI
// ─────────────────────────────────────────────────────────────
// How many fries orders are outstanding versus how many are already in flight
// (frying, staged on a counter, or in someone's hands). Robot chefs only start
// a basket when this is positive: fries cook on a fixed timer and burn whether
// or not anyone wants them, so frying speculatively just fills the slots with
// charcoal and blocks the station.
function friesDemand(){
  if(!menuFriesActive()) return 0;
  let want = 0, have = 0;
  for(const k in stations){
    const s = stations[k];
    if(s.type === 'table' && s.group && s.group.state === 'ordering')
      want += (s.group.unservedOrders || []).filter(o => o === 'fries_on_tray').length;
    else if(s.type === 'fryer' && s.slots)
      have += s.slots.filter(sl => sl && (sl.state === 'raw_fries' || sl.state === 'fries')).length;
    else if(s.type === 'counter' && (s.item === 'fries' || s.item === 'fries_on_tray')) have++;
    else if(s.type === 'robot' && (s.holding === 'fries' || s.holding === 'fries_on_tray')) have++;
  }
  if(player && !window._remoteSim && (player.holding === 'fries' || player.holding === 'fries_on_tray')) have++;
  if(coopIsHost() && coop.remote && coop.remote.store === simIdx && (coop.remote.holding === 'fries' || coop.remote.holding === 'fries_on_tray')) have++;
  return want - have;
}

function updateRobots(ds){
  _rmemo = {};
  for(const k in stations){
    const bot=stations[k]; if(bot.type!=='robot') continue;
    bot.mesh.position.y=Math.sin(Date.now()/180)*.15;

    const lvl = getRobotLevel(bot);
    const botSpeed = robotSpeed(lvl);
    bot._clock = (bot._clock || 0) + ds;

    // Cooldown after each action to prevent thrashing
    if(bot._actionCooldown > 0) { bot._actionCooldown -= ds; }

    if(bot.state === 'washing') {
        bot.timer -= ds;
        if(bot.timer <= 0) bot.state = 'idle';
        continue;
    }

    // Validate target still exists and is a valid station
    if(bot.state === 'moving' && bot.target) {
        const targetId = Object.keys(stations).find(id => stations[id] === bot.target);
        if(!targetId) { bot.target = null; bot.state = 'idle';
          bot._bestProg = undefined; bot._stall = 0; bot._ghost = 0; bot._path = null; bot._pathFor = null; }
    }

    // Plan: the best job this robot can do right now (12b-robot-jobs.js).
    if(bot.state==='idle' && !(bot._actionCooldown > 0)){
      const plan = robotPlan(bot);
      // (_stuck is only cleared when an action completes: clearing it here let
      // the reserved-counter rule flip on and off and loop the robot.)
      if(plan){ bot.target = plan.s; bot.job = plan.j; bot.state = 'moving'; bot._recheck = 20; }
      else {
        bot._actionCooldown = 12;   // nothing to do: look again shortly, not every frame
        if(bot.holding){
          // Holding something nobody can use: after ~3 s it may be binned
          // (binFood), and after ~7 s it's dropped so the robot works again.
          bot._stuck = (bot._stuck || 0) + 12;
          if(bot._stuck > 420){ bot.holding = null; bot._stuck = 0; }
        } else bot._stuck = 0;
      }
    }
    // On the way: if the job has gone (someone else took the burger), stop
    // walking and pick something else.
    if(bot.state === 'moving' && bot.job && bot.target && (bot._recheck -= ds) <= 0){
      bot._recheck = 20;
      if(!bot.job.ok(bot, bot.target)){ bot.state = 'idle'; bot.target = null; bot.job = null;
        bot._bestProg = undefined; bot._stall = 0; bot._ghost = 0; bot._path = null; bot._pathFor = null; }
    }

    if(bot.state==='idle') continue;

    // Safety: if somehow target is gone, reset
    if(!bot.target) { bot.state = 'idle'; continue; }
    
    const tx=bot.target.x;
    const tz=bot.target.z;
    const dx_direct = tx - bot.pos.x;
    const dz_direct = tz - bot.pos.z;
    const dist = Math.sqrt(dx_direct*dx_direct + dz_direct*dz_direct);
    
    const tDist = bot.target.type === 'table' ? 3.0 : 2.0;

    if(dist>tDist){
        // Walk an A* path (12a-robot-nav.js) around stations and walls. The
        // path is planned once per target and replanned if the robot stalls.
        // The old straight-line slide is kept underneath as a fallback: if no
        // path exists, or a replan didn't help, the progress watchdog still
        // phases the robot through after ~1.5 s. Arriving always outranks
        // looking correct.
        if(bot._pathFor !== bot.target){
          bot._pathFor = bot.target; bot._replans = 0;
          bot._path = navPath(bot.pos.x, bot.pos.z, bot.target, tDist - 0.2);
          bot._pi = 0;
        }
        let wx = tx, wz = tz;
        const path = bot._path;
        if(path && bot._pi < path.length){
          const w = path[bot._pi];
          if(Math.hypot(w.x - bot.pos.x, w.z - bot.pos.z) < 0.35) bot._pi++;
          if(bot._pi < path.length){ wx = path[bot._pi].x; wz = path[bot._pi].z; }
        }
        const wdx = wx - bot.pos.x, wdz = wz - bot.pos.z;
        const wd = Math.hypot(wdx, wdz) || 1;
        const step = Math.min(botSpeed * ds, wd);
        const dx = wdx / wd, dz = wdz / wd;
        const nx = bot.pos.x + dx*step, nz = bot.pos.z + dz*step;
        // Progress = path waypoints passed, or distance closed on the target.
        const progress = path ? bot._pi * 1000 - wd : -dist;
        if(bot._ghost > 0){
          bot._ghost -= ds;
          bot.pos.x = nx; bot.pos.z = nz;
        } else {
          if(path && bot._pi < path.length){ bot.pos.x = nx; bot.pos.z = nz; }   // the path is already clear
          else if(!checkColl(nx, nz, bot.id)){ bot.pos.x = nx; bot.pos.z = nz; }
          else if(!checkColl(nx, bot.pos.z, bot.id)){ bot.pos.x = nx; }
          else if(!checkColl(bot.pos.x, nz, bot.id)){ bot.pos.z = nz; }

          if(bot._bestProg === undefined || progress > bot._bestProg + 0.05){
            bot._bestProg = progress; bot._stall = 0;
          } else {
            bot._stall = (bot._stall || 0) + ds;
            if(bot._stall > 90){
              bot._stall = 0; bot._bestProg = undefined;
              if(path && (bot._replans||0) < 1){
                bot._replans = (bot._replans||0) + 1;
                bot._path = navPath(bot.pos.x, bot.pos.z, bot.target, tDist - 0.2); bot._pi = 0;
              } else bot._ghost = 240;
            }
          }
        }

        bot.mesh.position.x = bot.pos.x;
        bot.mesh.position.z = bot.pos.z;
        bot.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      const t = bot.target;
      let actionDone = false;
      const jb = bot.job;
      if(jb && jb.type === t.type && jb.ok(bot, t)){
        if(!bot.stat) bot.stat = robotStatFn(bot);
        jb.act(bot, t);
        actionDone = true;
        _rmemo = {};   // the room changed
      } else if(jb){
        // The job vanished on the way: avoid it here for ~2 s and plan again.
        (bot._avoid || (bot._avoid = {}))[jb.kind + '@' + t.id] = (bot._clock || 0) + 120;
      }
      bot.job = null;

      // Cool down after EVERY arrival, not just successful ones. A robot that
      // lost a race for a resource used to re-target and re-arrive on the very
      // next frame, and each arrival rebuilt the entire restaurant's visuals.
      bot._actionCooldown = actionDone ? 10 : 4;
      if(actionDone) bot._stuck = 0;

      if(bot.state !== 'washing') bot.state = 'idle';
      bot.target = null;
      bot._bestProg = undefined; bot._stall = 0; bot._ghost = 0; bot._path = null; bot._pathFor = null;   // reset nav watchdog
      // Only redraw when something actually changed.
      if(actionDone) updateStationVisuals();
    }
  }
}

