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
  if(player && (player.holding === 'fries' || player.holding === 'fries_on_tray')) have++;
  return want - have;
}

function updateRobots(ds){
  for(const k in stations){
    const bot=stations[k]; if(bot.type!=='robot') continue;
    bot.mesh.position.y=Math.sin(Date.now()/180)*.15;

    const lvl = getRobotLevel(bot);
    const botSpeed = 0.02 + (lvl * 0.025);

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
          bot._bestDist = undefined; bot._stall = 0; bot._ghost = 0; }
    }

    if(bot.state==='idle' && !(bot._actionCooldown > 0)){
      if(bot.role==='chef'){
        if(bot.holding === 'charred') {
            const trash = Object.values(stations).find(s => s.type === 'trash');
            if(trash && trash.contents < 4) { bot.target = trash; bot.state = 'moving'; }
        } else if (bot.holding === 'cooked') {
            const c = Object.values(stations).find(s => s.type === 'counter' && !s.item);
            if(c) { bot.target = c; bot.state = 'moving'; }
            else {
                const cTray = Object.values(stations).find(s => s.type === 'counter' && s.item === 'tray');
                if(cTray) { bot.target = cTray; bot.state = 'moving'; }
                else {
                    const trash = Object.values(stations).find(s => s.type === 'trash');
                    if(trash && trash.contents < 4) { bot.target = trash; bot.state = 'moving'; }
                }
            }
        } else if (bot.holding === 'raw') {
            const g = Object.values(stations).find(s => s.type === 'grill' && s.slots.includes(null));
            if(g) { bot.target = g; bot.state = 'moving'; }
            else {
                const trash = Object.values(stations).find(s => s.type === 'trash');
                if(trash && trash.contents < 4) { bot.target = trash; bot.state = 'moving'; }
            }
        } else if (bot.holding === 'burnt_fries') {
            const trash = Object.values(stations).find(s => s.type === 'trash');
            if(trash && trash.contents < 4) { bot.target = trash; bot.state = 'moving'; }
        } else if (bot.holding === 'fries') {
            // Stage fries on a counter for a waiter to plate, exactly as the
            // chef does with a cooked patty.
            const c = Object.values(stations).find(s => s.type === 'counter' && !s.item);
            if(c) { bot.target = c; bot.state = 'moving'; }
            else {
                const cTray = Object.values(stations).find(s => s.type === 'counter' && s.item === 'tray');
                if(cTray) { bot.target = cTray; bot.state = 'moving'; }
                else {
                    const rack = Object.values(stations).find(s => s.type === 'trayrack' && s.cleanTrays > 0);
                    if(rack) { bot.target = rack; bot.state = 'moving'; }
                }
            }
        } else if (!bot.holding) {
            // Flat priority list across BOTH cookers. Clear blockages first
            // (burnt food occupies a slot forever), then collect finished food
            // before it burns, then start new batches.
            const find = fn => Object.values(stations).find(fn);
            const fryBurnt = find(s => s.type==='fryer' && s.slots.some(sl => sl && sl.state==='burnt_fries'));
            const gCharred = find(s => s.type==='grill' && s.slots.some(sl => sl && sl.state==='charred'));
            const fryDone  = find(s => s.type==='fryer' && s.slots.some(sl => sl && sl.state==='fries'));
            const gCooked  = find(s => s.type==='grill' && s.slots.some(sl => sl && sl.state==='cooked'));
            const fryFree  = find(s => s.type==='fryer' && s.slots.includes(null));
            const gEmpty   = find(s => s.type==='grill' && s.slots.includes(null));
            if(fryBurnt)      { bot.target = fryBurnt; bot.state = 'moving'; }
            else if(gCharred) { bot.target = gCharred; bot.state = 'moving'; }
            else if(fryDone)  { bot.target = fryDone;  bot.state = 'moving'; }
            else if(gCooked)  { bot.target = gCooked;  bot.state = 'moving'; }
            else if(fryFree && friesDemand() > 0) { bot.target = fryFree; bot.state = 'moving'; }
            else if(gEmpty) {
                const fridge = find(s => s.type === 'fridge');
                if(fridge) { bot.target = fridge; bot.state = 'moving'; bot._grillTarget = gEmpty; }
            }
            {
            }
        }
      } 
      else if(bot.role==='busser'){
        {
          if(bot.holding === 'dirty_tray') {
              const sink = Object.values(stations).find(s => s.type === 'sink');
              if(sink) { bot.target = sink; bot.state = 'moving'; }
          } else if(bot.holding === 'tray') {
              const rack = Object.values(stations).find(s => s.type === 'trayrack');
              if(rack) { bot.target = rack; bot.state = 'moving'; }
          } else if(!bot.holding) {
              const t = Object.values(stations).find(s => s.type === 'table' && s.dirtyTrays > 0);
              if(t) { bot.target = t; bot.state = 'moving'; }
          }
        }
      }
      else if(bot.role==='waiter'){
        // Waiter AI — handles burger_on_tray, soda_on_tray, burger_soda_on_tray combos
        let foundTarget = false;

        // Helper: does any ordering table need this item?
        const tableWants = (item) => Object.values(stations).find(s =>
            s.type==='table' && s.group && s.group.state==='ordering' &&
            s.group.unservedOrders.includes(item));

        // Helper: does any ordering table need a combo that contains this item?
        const tableNeedsComboWith = (item) => Object.values(stations).find(s =>
            s.type==='table' && s.group && s.group.state==='ordering' &&
            s.group.unservedOrders.includes('burger_soda_on_tray') &&
            (item==='burger_on_tray' || item==='soda_on_tray'));

        if(bot.holding === 'burger_on_tray'){
            // Can we deliver directly?
            const directTable = tableWants('burger_on_tray');
            if(directTable){ bot.target=directTable; bot.state='moving'; foundTarget=true; }

            // Or is there a combo order needing us? Go to soda fountain to complete it.
            if(!foundTarget && tableWants('burger_soda_on_tray')){
                const sf = Object.values(stations).find(s=>s.type==='sodafountain');
                if(sf){ bot.target=sf; bot.state='moving'; foundTarget=true; }
            }

            // Stage on empty counter rather than trash
            if(!foundTarget){
                const ec = Object.values(stations).find(s=>s.type==='counter'&&!s.item);
                if(ec){ bot.target=ec; bot.state='moving'; foundTarget=true; }
            }
        }
        else if(bot.holding === 'soda_on_tray'){
            // Deliver directly if table wants soda only
            const directTable = tableWants('soda_on_tray');
            if(directTable){ bot.target=directTable; bot.state='moving'; foundTarget=true; }

            // Or pick up a burger from counter to complete a combo
            if(!foundTarget && tableWants('burger_soda_on_tray')){
                const burgerCounter = Object.values(stations).find(s=>
                    s.type==='counter' && (s.item==='burger_on_tray' || s.item==='cooked'));
                if(burgerCounter){ bot.target=burgerCounter; bot.state='moving'; foundTarget=true; }
            }

            // Stage on counter
            if(!foundTarget){
                const ec = Object.values(stations).find(s=>s.type==='counter'&&!s.item);
                if(ec){ bot.target=ec; bot.state='moving'; foundTarget=true; }
            }
        }
        else if(bot.holding === 'burger_soda_on_tray'){
            // Deliver combo
            const t = tableWants('burger_soda_on_tray');
            if(t){ bot.target=t; bot.state='moving'; foundTarget=true; }
            // Nowhere to deliver — stage or trash
            if(!foundTarget){
                const ec = Object.values(stations).find(s=>s.type==='counter'&&!s.item);
                if(ec){ bot.target=ec; bot.state='moving'; foundTarget=true; }
            }
            if(!foundTarget){
                const trash = Object.values(stations).find(s=>s.type==='trash'&&s.contents<4);
                if(trash){ bot.target=trash; bot.state='moving'; foundTarget=true; }
            }
        }
        else if(bot.holding && bot.holding !== 'tray'){
            // Some other food item — deliver directly or stage
            const t = tableWants(bot.holding);
            if(t){ bot.target=t; bot.state='moving'; foundTarget=true; }
            if(!foundTarget){
                const ec = Object.values(stations).find(s=>s.type==='counter'&&!s.item);
                if(ec){ bot.target=ec; bot.state='moving'; foundTarget=true; }
            }
        }
        else if(bot.holding === 'tray'){
            // Holding empty tray — figure out what to build
            const tables = Object.values(stations).filter(s=>
                s.type==='table'&&s.group&&s.group.state==='ordering'&&s.group.unservedOrders.length>0);

            for(const t of tables){
                const order = t.group.unservedOrders[0];

                if(order==='burger_soda_on_tray'){
                    // Check if burger_on_tray already staged on counter
                    const burgerStaged = Object.values(stations).find(s=>s.type==='counter'&&s.item==='burger_on_tray');
                    if(burgerStaged){ bot.target=burgerStaged; bot.state='moving'; foundTarget=true; break; }
                    // Check if soda staged
                    const sodaStaged = Object.values(stations).find(s=>s.type==='counter'&&s.item==='soda_on_tray');
                    if(sodaStaged){ bot.target=sodaStaged; bot.state='moving'; foundTarget=true; break; }
                    // Pick up burger from cooked counter
                    const cookedCounter = Object.values(stations).find(s=>s.type==='counter'&&s.item==='cooked');
                    if(cookedCounter){ bot.target=cookedCounter; bot.state='moving'; foundTarget=true; break; }
                    // Otherwise go get soda first
                    const sf = Object.values(stations).find(s=>s.type==='sodafountain');
                    if(sf){ bot.target=sf; bot.state='moving'; foundTarget=true; break; }
                }
                else if(order==='soda_on_tray'){
                    const sf = Object.values(stations).find(s=>s.type==='sodafountain');
                    if(sf){ bot.target=sf; bot.state='moving'; foundTarget=true; break; }
                }
                else if(order==='fries_on_tray'){
                    // Fries staged on a counter, else plate straight off the fryer.
                    const cFries = Object.values(stations).find(s=>s.type==='counter'&&s.item==='fries');
                    if(cFries){ bot.target=cFries; bot.state='moving'; foundTarget=true; break; }
                    const fDone = Object.values(stations).find(s=>s.type==='fryer'&&s.slots.some(sl=>sl&&sl.state==='fries'));
                    if(fDone){ bot.target=fDone; bot.state='moving'; foundTarget=true; break; }
                }
                else if(order==='burger_on_tray'){
                    // Check for assembled item on counter
                    const c = Object.values(stations).find(s=>s.type==='counter'&&s.item==='burger_on_tray');
                    if(c){ bot.target=c; bot.state='moving'; foundTarget=true; break; }
                    const cc = Object.values(stations).find(s=>s.type==='counter'&&s.item==='cooked');
                    if(cc){ bot.target=cc; bot.state='moving'; foundTarget=true; break; }
                }
            }

            // No use for tray right now — return it
            if(!foundTarget){
                const rack = Object.values(stations).find(s=>s.type==='trayrack');
                if(rack){ bot.target=rack; bot.state='moving'; foundTarget=true; }
            }
        }
        else if(!bot.holding){
            // Empty hands — find ready food or get a tray
            const tables = Object.values(stations).filter(s=>
                s.type==='table'&&s.group&&s.group.state==='ordering'&&s.group.unservedOrders.length>0);

            for(const t of tables){
                const order = t.group.unservedOrders[0];

                // Grab fully assembled item directly from counter
                const assembled = Object.values(stations).find(s=>s.type==='counter'&&s.item===order);
                if(assembled){ bot.target=assembled; bot.state='moving'; foundTarget=true; break; }

                // Partial combo: grab burger_on_tray to then go get soda
                if(order==='burger_soda_on_tray'){
                    const bt = Object.values(stations).find(s=>s.type==='counter'&&s.item==='burger_on_tray');
                    if(bt){ bot.target=bt; bot.state='moving'; foundTarget=true; break; }
                    const st = Object.values(stations).find(s=>s.type==='counter'&&s.item==='soda_on_tray');
                    if(st){ bot.target=st; bot.state='moving'; foundTarget=true; break; }
                }

                // Get a tray to start building
                const needsTray = order==='burger_on_tray'||order==='soda_on_tray'||order==='burger_soda_on_tray'||order==='fries_on_tray';
                if(needsTray){
                    const rack = Object.values(stations).find(s=>s.type==='trayrack'&&s.cleanTrays>0);
                    if(rack){ bot.target=rack; bot.state='moving'; foundTarget=true; break; }
                }
            }
        }
      }
    }

    // ── Universal fallback plan ───────────────────────────────────────────
    // Every (role x held item) combination must have somewhere to go. Without
    // this, a robot holding an item its role had no plan for -- or ANY robot
    // once the trash bin filled, since every role's bin branch required
    // contents<4 -- parked itself permanently and never worked again.
    // Enumerated by tests/run.js -> "no robot role/holding combination is a
    // permanent dead end".
    if(bot.state === 'idle' && !(bot._actionCooldown > 0)){
      const pick = fn => Object.values(stations).find(fn);
      if(bot.holding === 'trash_bag'){
        const d = pick(s => s.type === 'dumpster');
        if(d){ bot.target = d; bot.state = 'moving'; }
      } else if(bot.holding){
        const ec = pick(s => s.type === 'counter' && !s.item);
        if(ec){ bot.target = ec; bot.state = 'moving'; }
        else {
          const tr = pick(s => s.type === 'trash' && s.contents < 4);
          if(tr){ bot.target = tr; bot.state = 'moving'; }
        }
      } else {
        // Empty-handed and a bin is full: haul it out. Robots can now clear the
        // trash themselves, so a full bin no longer bricks the whole staff.
        const full = pick(s => s.type === 'trash' && s.contents >= 4);
        if(full){ bot.target = full; bot.state = 'moving'; }
      }

      // Absolute last resort. If a robot has been holding something with
      // nowhere to put it for ~5s (every counter occupied AND every bin full),
      // it bins the item by hand rather than freezing for the rest of the day.
      if(bot.state === 'idle' && bot.holding){
        bot._stuck = (bot._stuck || 0) + 1;
        if(bot._stuck > 300){ bot.holding = null; bot._stuck = 0; updateHolding(); }
      } else bot._stuck = 0;
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
        let dx = dx_direct / dist;
        let dz = dz_direct / dist;

        // Robots used to walk straight through walls, counters and tables. They
        // now slide along obstacles like the player does -- but there is NO
        // pathfinding, so sliding alone can livelock: a robot wedged between
        // the tray rack and the back wall slides freely on z forever while
        // never getting closer on x.
        //
        // The watchdog therefore measures PROGRESS TOWARD THE TARGET, not
        // whether a given axis is blocked. If the robot hasn't got meaningfully
        // closer in ~1.5s it phases through obstacles until it arrives.
        // Reaching the target always outranks looking correct.
        const stepX = dx * botSpeed * ds, stepZ = dz * botSpeed * ds;
        const nx = bot.pos.x + stepX, nz = bot.pos.z + stepZ;
        if(bot._ghost > 0){
          bot._ghost -= ds;
          bot.pos.x = nx; bot.pos.z = nz;
        } else {
          if(!checkColl(nx, nz, bot.id)){ bot.pos.x = nx; bot.pos.z = nz; }
          else if(!checkColl(nx, bot.pos.z, bot.id)){ bot.pos.x = nx; }
          else if(!checkColl(bot.pos.x, nz, bot.id)){ bot.pos.z = nz; }

          if(bot._bestDist === undefined || dist < bot._bestDist - 0.05){
            bot._bestDist = dist; bot._stall = 0;
          } else {
            bot._stall = (bot._stall || 0) + ds;
            if(bot._stall > 90){ bot._ghost = 240; bot._stall = 0; }
          }
        }

        bot.mesh.position.x = bot.pos.x;
        bot.mesh.position.z = bot.pos.z;
        bot.mesh.rotation.y = Math.atan2(dx_direct, dz_direct);
    } else {
      const t = bot.target;
      let actionDone = false;

      if(bot.role === 'chef') {
          if(t.type === 'fridge' && !bot.holding) { bot.holding = 'raw'; actionDone = true; }
          else if(t.type === 'grill') {
              if(bot.holding === 'raw') {
                  const i = t.slots.indexOf(null);
                  if(i !== -1) { t.slots[i] = {state:'raw', progress:0, burnTimer:0}; bot.holding = null; actionDone = true; }
              } else if (!bot.holding) {
                  const i = t.slots.findIndex(s => s && s.state === 'charred');
                  if(i !== -1) { bot.holding = 'charred'; t.slots[i] = null; actionDone = true; }
                  else {
                      const i2 = t.slots.findIndex(s => s && s.state === 'cooked');
                      if(i2 !== -1) { bot.holding = 'cooked'; t.slots[i2] = null; actionDone = true; }
                  }
              }
          }
          else if(t.type === 'fryer') {
              // The fryer needs no ingredient: an empty-handed ACT drops a fresh
              // basket in, same as the player's recipe.
              if(!bot.holding) {
                  const bi = t.slots.findIndex(sl => sl && sl.state === 'burnt_fries');
                  if(bi !== -1) { bot.holding = 'burnt_fries'; t.slots[bi] = null; actionDone = true; }
                  else {
                      const ci = t.slots.findIndex(sl => sl && sl.state === 'fries');
                      if(ci !== -1) { bot.holding = 'fries'; t.slots[ci] = null; actionDone = true; }
                      else if(friesDemand() > 0) {
                          const fi = t.slots.indexOf(null);
                          if(fi !== -1) { t.slots[fi] = {state:'raw_fries', progress:0, burnTimer:0};
                                          actionDone = true; playSound('sizzle'); }
                      }
                  }
              }
          }
          else if(t.type === 'counter') {
              if(bot.holding === 'cooked') {
                  if(!t.item) { t.item = 'cooked'; bot.holding = null; actionDone = true; }
                  else if(t.item === 'tray') { t.item = 'burger_on_tray'; bot.holding = null; actionDone = true; }
              }
              else if(bot.holding === 'fries') {
                  if(!t.item) { t.item = 'fries'; bot.holding = null; actionDone = true; }
                  else if(t.item === 'tray') { t.item = 'fries_on_tray'; bot.holding = null; actionDone = true; }
              }
          }
          else if(t.type === 'trayrack' && bot.holding === 'fries' && t.cleanTrays > 0) {
              // Fallback when every counter is occupied: plate it directly.
              t.cleanTrays--; bot.holding = 'fries_on_tray'; actionDone = true;
          }
          else if(t.type === 'trash') {
              if((bot.holding === 'charred' || bot.holding === 'cooked' || bot.holding === 'raw' ||
                  bot.holding === 'burnt_fries' || bot.holding === 'fries') && t.contents < 4) { t.contents++; bot.holding = null; actionDone = true; }
          }
      }
      else if(bot.role === 'busser') {
          if(t.type === 'table' && !bot.holding && t.dirtyTrays > 0) {
              t.dirtyTrays--; bot.holding = 'dirty_tray'; actionDone = true;
          } else if(t.type === 'sink' && bot.holding === 'dirty_tray') {
              bot.holding = 'tray'; bot.timer = 100 - (lvl * 15); bot.state = 'washing'; actionDone = true;
          } else if(t.type === 'trayrack' && bot.holding === 'tray') {
              t.cleanTrays++; bot.holding = null; actionDone = true;
          }
      }
      else if(bot.role === 'waiter') {
          if(t.type === 'trayrack' && !bot.holding && t.cleanTrays > 0) {
              t.cleanTrays--; bot.holding = 'tray'; actionDone = true;
          }
          else if(t.type === 'sodafountain') {
              if(bot.holding === 'tray')          { bot.holding = 'soda_on_tray';       actionDone = true; }
              else if(bot.holding === 'burger_on_tray') { bot.holding = 'burger_soda_on_tray'; actionDone = true; }
          }
          else if(t.type === 'fryer') {
              // A tray held at the fryer plates finished fries straight out of
              // the basket, matching the player's shortcut.
              if(bot.holding === 'tray'){
                  const ci = t.slots.findIndex(sl => sl && sl.state === 'fries');
                  if(ci !== -1){ t.slots[ci] = null; bot.holding = 'fries_on_tray'; actionDone = true; }
              }
          }
          else if(t.type === 'counter') {
              // Pick up assembled item
              if(!bot.holding && (t.item==='burger_on_tray'||t.item==='soda_on_tray'||t.item==='burger_soda_on_tray'||t.item==='fries_on_tray')){
                  bot.holding = t.item; t.item = null; actionDone = true;
              }
              // Tray + cooked → burger_on_tray
              else if(bot.holding==='tray' && t.item==='cooked'){
                  t.item = null; bot.holding = 'burger_on_tray'; actionDone = true;
              }
              // Tray + fries → fries_on_tray
              else if(bot.holding==='tray' && t.item==='fries'){
                  t.item = null; bot.holding = 'fries_on_tray'; actionDone = true;
              }
              // Combine burger+soda on counter
              else if(bot.holding==='burger_on_tray' && t.item==='soda_on_tray'){
                  bot.holding = 'burger_soda_on_tray'; t.item = null; actionDone = true;
              }
              else if(bot.holding==='soda_on_tray' && t.item==='burger_on_tray'){
                  bot.holding = 'burger_soda_on_tray'; t.item = null; actionDone = true;
              }
              else if(bot.holding==='soda_on_tray' && t.item==='cooked'){
                  // Soda + cooked on counter → burger_soda combo
                  bot.holding = 'burger_soda_on_tray'; t.item = null; actionDone = true;
              }
              // Stage item on empty counter
              else if(bot.holding && bot.holding!=='tray' && !t.item){
                  t.item = bot.holding; bot.holding = null; actionDone = true;
              }
          }
          else if(t.type === 'table') {
              if(t.group && t.group.state==='ordering' && bot.holding) {
                  if(serveHeldToGroup(t, bot.holding)){ bot.holding = null; actionDone = true; }
              }
          }
          else if(t.type === 'trash') {
              if(bot.holding && t.contents < 4) {
                  t.contents++;
                  bot.holding = bot.holding.includes('tray') ? 'tray' : null;
                  actionDone = true;
              }
          }
      }

      // ── Universal actions ───────────────────────────────────────────────
      // Catches every (role x holding x station) combination the role-specific
      // handlers above don't name, so nothing falls through silently.
      if(!actionDone){
        if(t.type === 'trash'){
          if(!bot.holding && t.contents >= 4){ bot.holding = 'trash_bag'; t.contents = 0; actionDone = true; }
          else if(bot.holding && bot.holding !== 'trash_bag' && t.contents < 4){
            t.contents++;
            bot.holding = bot.holding.includes('_on_tray') ? 'tray' : null;
            actionDone = true;
          }
        } else if(t.type === 'dumpster' && bot.holding === 'trash_bag'){
          bot.holding = null; actionDone = true; playSound('dump');
        } else if(t.type === 'counter' && !t.item && bot.holding && bot.holding !== 'trash_bag'){
          t.item = bot.holding; bot.holding = null; actionDone = true;
        } else if(t.type === 'trayrack' && bot.holding === 'tray'){
          t.cleanTrays++; bot.holding = null; actionDone = true;
        }
      }

      // Cool down after EVERY arrival, not just successful ones. A robot that
      // lost a race for a resource used to re-target and re-arrive on the very
      // next frame, and each arrival rebuilt the entire restaurant's visuals.
      bot._actionCooldown = actionDone ? 15 : 30;
      if(actionDone) bot._stuck = 0;

      if(bot.state !== 'washing') bot.state = 'idle';
      bot.target = null;
      bot._bestDist = undefined; bot._stall = 0; bot._ghost = 0;   // reset nav watchdog
      // Only redraw when something actually changed.
      if(actionDone) updateStationVisuals();
    }
  }
}

