// Burger Bar — 14-main. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
try { applyBigText(); } catch(e){ console.warn('applyBigText failed', e); }
applyQuality();
loadSave();
// Build the player from the saved character + skin. Must run after loadSave()
// (so cosm is populated) and after the CHARACTERS/buildCharacter definitions.
try { rebuildPlayerMesh(); } catch(e){ console.warn('Initial player build failed', e); }
updateBoundsFromLevel();

if (loadedLayout && loadedLayout.length > 0) {
    loadedLayout.forEach(l => {
        addStation(l.id, l.type, l.x, l.z, l.w, l.d, {role: l.role, hiredDay: l.hiredDay});
    });
} else {
    initStations();
    for(let i=1;i<=upg.extraGrills;i++)   { const pos=freeSpot(); if(pos) addStation('grill'+i,'grill',pos.x,pos.z,3.5,2); }
    for(let i=1;i<=upg.extraSinks;i++)    { const pos=freeSpot(); if(pos) addStation('sink'+i,'sink',pos.x,pos.z,2.2,2.2); }
    for(let i=1;i<=upg.extraCounters;i++) { const pos=freeSpot(); if(pos) addStation('counter'+(i+1),'counter',pos.x,pos.z,1.8,1.8); }
    for(let i=1;i<upg.tableCount;i++)     { const pos=freeSpot(); if(pos) addStation('table'+i,'table',pos.x,pos.z,5,5); }
    for(let i=0;i<upg.robotCount;i++)     { 
        const rData = upg.robots[i] || {role: 'busser', hiredDay: 1};
        const pos = getValidSpawn(); 
        if(pos) addStation('robot'+i,'robot',pos.x,pos.z,1.5,1.5,{role: rData.role, hiredDay: rData.hiredDay}); 
    }
    for(let i=0;i<upg.sodaCount;i++) { const pos=freeSpot(); if(pos) addStation('soda'+i,'sodafountain',pos.x,pos.z,2,2); }
    saveGame();
}

try { prewarmModels(); } catch(e){ console.warn('prewarm failed', e); }
applyCrown();
rebuildAll();
updateCashUI();
showStartMenu();

// Fade out the CLAWEngineering splash once the game is ready (with a minimum
// on-screen time so the brand moment is visible even on fast loads).
function hideBootSplash(){
  const sp=document.getElementById('boot-splash');
  if(!sp) return;
  const wait = Math.max(0, 1600 - performance.now());
  setTimeout(()=>{ sp.classList.add('hide'); setTimeout(()=>{ if(sp.parentNode) sp.parentNode.removeChild(sp); }, 700); }, wait);
}
hideBootSplash();

// First-run onboarding: auto-open the paged intro walkthrough exactly once so
// new players aren't dropped in cold. They can step through with Next or Skip
// straight to the game; the detailed step list stays available via Practice.
if(!localStorage.getItem('burgerBoss_tutorialSeen')){
  try { localStorage.setItem('burgerBoss_tutorialSeen','1'); } catch(e){}
  setTimeout(()=>{ try{ showIntro(); }catch(e){} }, 2200);
}

// ─────────────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────────────
let lastT=performance.now(), ds=1;
const homeScreenEl=document.getElementById('home-screen');
const TARGET=1/60;

// Walk cycle + carry pose on the character rig. Limbs ease toward their pose so
// starting/stopping never snaps.
function animatePlayerRig(moving, dsF){
  const k = Math.min(1, .25 * dsF), w = player.wobble, carrying = !!player.holding;
  const ease = (o, prop, v) => { if(o) o.rotation[prop] += (v - o.rotation[prop]) * k; };
  const swing = moving ? Math.sin(w) : 0;
  ease(pLegL, 'x',  swing * .7);
  ease(pLegR, 'x', -swing * .7);
  ease(pBody, 'z', moving ? Math.sin(w) * .06 : 0);
  ease(pBody, 'x', moving ? .08 : 0);
  // Carrying: both arms forward under the tray. Otherwise they swing opposite the legs.
  ease(pArmL, 'x', carrying ? -1.25 : -swing * .55);
  ease(pArmR, 'x', carrying ? -1.25 :  swing * .55);
  ease(pArmL, 'z', carrying ? .05 : .18);
  ease(pArmR, 'z', carrying ? -.05 : -.18);
}

function animate(){
  requestAnimationFrame(animate);
  try {
  if(gamePaused) return;
  const now=performance.now();
  const frameMs = now-lastT;
  ds=Math.min(frameMs/1000,0.1)/TARGET; lastT=now;
  if(gameState==='playing') perfSample(frameMs);

  (window._clouds||[]).forEach(c=>{ c.position.x+=c._spd*ds; if(c.position.x>75) c.position.x=-75; });

  if(gameState==='playing'||gameState==='edit'||gameState==='start_menu'){

    if(gameState==='edit'&&dragStation){
      const fx=Math.round(player.pos.x+Math.sin(player.dir)*4);
      const fz=Math.round(player.pos.z+Math.cos(player.dir)*4);
      dragStation.mesh.position.lerp(new THREE.Vector3(fx,0,fz),.28);
      placeGhost.visible=true; placeGhost.position.set(fx,.1,fz);
      placeGhost.material.color.setHex(validPlacement(dragStation,fx,fz)?0x00ff00:0xff0000);
      hlRing.visible=false;
    } else if (gameState==='edit' || gameState==='playing') {
      placeGhost.visible=false;
      const t=getClosest();
      if(t){
          hlRing.visible=true;
          if(t.type === 'robot') hlRing.position.set(t.pos.x, .12, t.pos.z);
          else hlRing.position.set(t.x, .12, t.z);
      } else {
          hlRing.visible=false;
      }
      // Contextual action prompt: tell the player what ACT will do right now.
      const al=document.getElementById('act-label');
      if(al){
        const prompt = (gameState==='playing') ? actionPromptFor(t) : '';
        if(prompt && actionBtn.classList.contains('active')){
          // Position comes from where the thumb put the button (showAct), so no
          // per-frame layout read is needed.
          if(al._t !== prompt){ al._t = prompt; al.textContent = prompt; }
          const lx = actPos.x + 'px', ly = (actPos.y - 68) + 'px';
          if(al.style.left !== lx) al.style.left = lx;
          if(al.style.top !== ly) al.style.top = ly;
          if(al.style.display !== 'block') al.style.display = 'block';
        } else if(al.style.display !== 'none') al.style.display = 'none';
      }
    } else {
      hlRing.visible=false;
      const al=document.getElementById('act-label'); if(al) al.style.display='none';
    }

    const spd=player.speed+upg.speedLv*.035;
    let vx=joyVec.x*spd*ds, vz=joyVec.z*spd*ds;
    if(keys.w) vz=-spd*ds; if(keys.s) vz=spd*ds;
    if(keys.a) vx=-spd*ds; if(keys.d) vx=spd*ds;
    const nx=player.pos.x+vx, nz=player.pos.z+vz;
    
    if(!checkColl(nx,nz)){ player.pos.x=nx; player.pos.z=nz; }
    else if(!checkColl(nx,player.pos.z)) player.pos.x=nx;
    else if(!checkColl(player.pos.x,nz)) player.pos.z=nz;

    const moving = !!(vx||vz);
    if(gameState==='playing') updateTrail(ds, moving);

    if(vx||vz){
      const ta=Math.atan2(vx,vz); let df=ta-player.dir;
      while(df<-Math.PI)df+=Math.PI*2; while(df>Math.PI)df-=Math.PI*2;
      player.dir+=df*.28; pMesh.rotation.y=player.dir;
      player.wobble+=.28*ds;
      pMesh.position.y=Math.abs(Math.sin(player.wobble))*.1;
    } else { player.wobble=0; pMesh.position.y=0; }
    animatePlayerRig(moving, ds);
    pMesh.position.x=player.pos.x; pMesh.position.z=player.pos.z;

    // Follow the player, but keep the bar framed: on tall portrait screens the
    // view is taller than the whole lot, so clamp instead of showing empty grass.
    let camX = player.pos.x, camZ = player.pos.z;
    {
      const halfW = (camera.right - camera.left) / 2, halfH = (camera.top - camera.bottom) / 2 * 1.414;
      const minX = bounds.l - 6 + halfW, maxX = bounds.r + 6 - halfW;
      const minZ = bounds.t - 7 + halfH, maxZ = bounds.b + 16 - halfH;
      camX = minX > maxX ? (bounds.l + bounds.r) / 2 : Math.max(minX, Math.min(maxX, camX));
      camZ = minZ > maxZ ? (bounds.t + bounds.b + 9) / 2 : Math.max(minZ, Math.min(maxZ, camZ));
    }
    camera.position.x=camX; camera.position.z=camZ+frustumSize*.95;
    camera.lookAt(camX,0,camZ);
    fitSunToView(camX, camZ);

    if(gameState==='playing'){
      updateRobots(ds);
      updateSinkHold(ds);

      let needVis=false;
      for(const k in stations){ const s=stations[k];
        if(s.type!=='grill' && s.type!=='fryer') continue;
        // Fries cook at a fixed rate (no grill upgrade); the grill uses the
        // Turbo Grill multiplier.
        const cookRate = s.type==='fryer' ? 0.6 : upg.grillMult;
        s.slots.forEach(sl=>{
          if(!sl) return;
          if(sl.state === 'raw' || sl.state === 'raw_fries') {
            sl.progress += cookRate*ds;
            if(sl.progress >= 200){
              sl.state = s.type==='fryer' ? 'fries' : 'cooked';
              sl.burnTimer=0; needVis=true; playSound('ding');
            }
          } else if (sl.state === 'cooked' || sl.state === 'fries') {
            // Burn window is fixed (independent of cook speed) so upgrading the
            // grill makes cooking faster WITHOUT making food burn faster.
            sl.burnTimer += ds;
            if(sl.burnTimer >= 200 && !sl._warned){ sl._warned = true; playSound('warn'); }
            if(sl.burnTimer >= 300) {
              sl.state = s.type==='fryer' ? 'burnt_fries' : 'charred';
              needVis=true; playSound('burnt');
            }
          }
        });
      }
      if(needVis) updateStationVisuals();

      // Refresh the goals panel only when the numbers behind it actually move.
      if(goalsPanelOpen){
        const sig = stats.groupsServed + '|' + Math.floor(stats.cashEarned) + '|' +
                    stats.combosServed + '|' + stats.walkouts + '|' + Math.round(stats.totalStars);
        if(sig !== window._goalsSig){ window._goalsSig = sig; renderGoalsPanel(); }
      }

      if(streakTimer>0){ streakTimer-=ds; if(streakTimer<=0) serveStreak=0; }
      // Surface the streak. The bonus system was well designed but completely
      // invisible until it fired, so nobody chased it.
      {
        const sw = document.getElementById('streak-wrap');
        if(sw){
          if(serveStreak >= 2 && streakTimer > 0){
            if(sw.style.display !== 'inline-flex') sw.style.display = 'inline-flex';
            const mult = 1 + Math.min(serveStreak - 1, 4) * 0.1;
            const label = `🔥 x${mult.toFixed(1)}`, sx = document.getElementById('streak-x');
            if(sx.textContent !== label) sx.textContent = label;
            document.getElementById('streak-fill').style.width = Math.round(Math.max(0, Math.min(100, streakTimer / 360 * 100))) + '%';
          } else if(sw.style.display !== 'none') sw.style.display = 'none';
        }
      }
      updateRush(ds);
      updateTutorial(ds);
      if(stats.spawnTimer>0) stats.spawnTimer-=ds;
      if(stats.groupsLeft>0&&stats.spawnTimer<=0){ 
        // After day 10: spawn up to maxSimultaneous groups at once when timer fires
        const toSpawn = Math.min(stats.groupsLeft, stats.maxSimultaneous||1);
        for(let _i=0;_i<toSpawn;_i++) { if(stats.groupsLeft>0) spawnGroup(); }
        let r = Math.random();
        // Spawn interval scales by day: early days slow, later days faster (but not before day 10)
        const baseDelay = eco.day <= 3 ? 18 : eco.day <= 6 ? 14 : eco.day <= 10 ? 11 : 8;
        let delay;
        if(r < 0.05) delay = baseDelay * 0.55;
        else if(r < 0.10) delay = baseDelay * 1.4;
        else {
          const w = (Math.random() + Math.random() + Math.random()) / 3;
          delay = baseDelay * (0.75 + w * 0.5);
        }
        stats.spawnTimer = delay * 60 * heatSpawnMult() * rushSpawnMult();
      }

      if(stats.groupsLeft===0&&groups.length===0&&gameState==='playing'){
        endDay(); return;
      }

      // Stamp queue positions once per frame. This used to be a filtered array
      // plus an indexOf() per group (O(n^2)), read from a snapshot taken before
      // the loop could seat anyone.
      { let qpos = 0; for(const q of groups) if(q.state === 'queue') q._qi = qpos++; }
      for(let i=groups.length-1;i>=0;i--){
        const g=groups[i];
        if(g.state==='approach_door'){
          g.target.set(doorX(),0,bounds.b-2); if(moveToTarget(g,ds)) g.state='queue';
        }
        else if(g.state==='queue'){
          const qi = g._qi || 0;
          g.target.set(doorX() + (qi % 2 === 0 ? -1.0 : 1.0), 0, bounds.b - 2 + qi * 2.5); // Line out the door
          moveToTarget(g,ds); 
          g.waitPatience -= ds * (window._currentStinkPenalty ? 1.2 : 1.0) * (tutorialActive() ? 0 : 1);
          
          if(g.waitPatience<=0){ g.state='leave'; stats.walkouts=(stats.walkouts||0)+1; playSound('walkout'); }
          else if(qi===0){
            let tgt=null;
            for(const k in stations){ const s=stations[k]; if(s.type==='table'&&!s.group&&s.dirtyTrays===0){tgt=s;break;} }
            if(tgt){ g.state='to_table'; tgt.group=g; tgt.served=0; g.tbl=tgt; }
          }
        }
        else if(g.state==='to_table'){
          g.target.set(g.tbl.x,0,g.tbl.z); 
          if(moveToTarget(g,ds)) { 
            g.state='ordering';
            g.mesh.rotation.y = 0; 
            g.mesh.children.forEach((c, idx) => {
               c.position.set(idx === 0 ? -2.8 : 2.8, 0, 0); 
               c.rotation.y = idx === 0 ? Math.PI/2 : -Math.PI/2; 
            });
          }
        }
        else if(g.state==='ordering'){
          g.foodPatience -= ds * (window._currentStinkPenalty ? 1.2 : 1.0) * (tutorialActive() ? 0 : 1);
          if(g.foodPatience<=0){ g.state='leave'; stats.walkouts=(stats.walkouts||0)+1; g.tbl.group=null; g.tbl.served=0; playSound('walkout'); }
        }
        else if(g.state==='eating'){
          g.eatTimer-=ds;
          if(g.eatTimer<=0){
            const ws=Math.max(0,g.waitPatience/g.maxWait), fs=Math.max(0,g.foodPatience/g.maxFood);
            const tot=ws*.3+fs*.7;
            const stars=tot>.8?5:tot>.6?4:tot>.4?3:tot>.2?2:1;
            
            let rawCash;
            {
              rawCash = g.size * 16 * (stars/5);
              const sodaCount = g.orders.filter(o => o==='burger_soda_on_tray' || o==='soda_on_tray').length;
              rawCash += sodaCount * 7 * (stars/5);
              const friesCount = g.orders.filter(o => o==='fries_on_tray').length;
              rawCash += friesCount * 5 * (stars/5);
            }

            // Mastery tip: a small bonus for 4-5 star service rewards getting good.
            if(stars >= 4) rawCash += (stars - 3) * g.size * 1.5;

            if(g.type === 'vip') rawCash *= 3;
            // Early-day boost: Tier-1 shop items cost $55-80 while a Day-1 group
            // paid ~$16, putting the first upgrade 3-4 days out. This lands it
            // on Day 2 without inflating the rest of the curve.
            rawCash *= eco.day <= 4 ? 1.30 : eco.day <= 6 ? 1.15 : 1.0;
            rawCash *= diffPayoutMult();
            // Heat pays: a hotter kitchen tips better, and rush-hour serves more so.
            rawCash *= heatTipMult() * rushTipMult();

            // Serve streak: consecutive serves within the window stack a tip
            // bonus (up to +40%).
            if(streakTimer > 0) serveStreak++; else serveStreak = 1;
            stats.bestStreak = Math.max(stats.bestStreak || 0, serveStreak);
            streakTimer = 360; // ~6s window
            const streakBonus = 1 + Math.min(serveStreak - 1, 4) * 0.1;
            rawCash *= streakBonus;

            const cash = Math.round(rawCash * 100) / 100;
            eco.cash += cash; stats.cashEarned += cash; stats.totalStars += stars; stats.groupsServed++;
            renderGoalsPanel();   // keep the top-left badge honest even when closed
            updateCashUI();
            playSound('coin');
            // Mastery feedback: a chime + callout on great service.
            if(stars >= 4){
              playSound(stars === 5 ? 'sparkle' : 'serve');
              spawnFloater(g.tbl.mesh.position.clone().add(new THREE.Vector3(0,0.9,0)),
                stars===5?'PERFECT! ⭐':'GREAT! ⭐', '#FFD54F');
            }
            if(serveStreak >= 2){
              spawnFloater(g.tbl.mesh.position.clone().add(new THREE.Vector3(0,1.7,0)),
                `🔥 STREAK x${serveStreak}`, '#FF8A65');
            }
            spawnFloater(g.tbl.mesh.position, `+$${cash.toFixed(2)}`);
            
            // `+=`: a heavy customer eats several rounds at one table, so the
            // trays from earlier rounds are still sitting there. Assigning here
            // deleted them from the game's closed tray economy and could starve
            // the player of trays mid-day.
            g.tbl.dirtyTrays += g.tbl.served; g.tbl.served=0; g.tbl.group=null; updateStationVisuals();

            if(g.type === 'heavy' && g.heavyCount > 1) {
                g.heavyCount--;
                g.state = 'ordering';
                g.foodPatience = g.maxFood;
                g.tbl.group = g; 
                let orderType;
                {
                  orderType='burger_on_tray';
                  if(menuFriesActive() && Math.random()<0.22){orderType='fries_on_tray';}
                  else if(menuComboActive()){const r=Math.random();if(r<0.25)orderType='soda_on_tray';else if(r<0.70)orderType='burger_soda_on_tray';}
                }
                g.orders = [orderType];
                g.unservedOrders = [...g.orders];
                g.servedMask = g.orders.map(()=>false);
            } else {
                g.state='leave';
            }
          }
        }
        else if(g.state==='leave'){
          if(!g.stoodUp) {
             g.stoodUp = true;
             g.mesh.children.forEach((c, idx) => {
                 c.position.set(idx * 1.7 - (g.size > 1 ? .85 : 0), 0, idx * .4);
                 c.rotation.y = 0;
             });
          }
          g.target.set(doorX(),0,bounds.b+2); if(moveToTarget(g,ds)) g.state='leaving';
        }
        else if(g.state==='leaving'){
          g.target.set(doorX()+(g.id%1-.5)*6, 0, bounds.b+18);
          if(moveToTarget(g,ds)){ discard(scene, g.mesh); groups.splice(i,1); }
        }
      }
    }
    drawFloatUI();
  }
  // The Home Screen is an opaque overlay with its own renderers; drawing the
  // full bar underneath it every frame only cost battery.
  updateStationBatch();
  updateAmbience();
  if(gameState==='start_menu' && homeScreenEl.style.display!=='none'){
    // The opaque Home Screen covers the canvas except the preview window.
    renderHomeShowcase();
  } else {
    renderer.render(scene,camera);
  }
  } catch(err){
    // A per-frame error shouldn't blank the screen forever. Log it and, once,
    // tell the player how to recover instead of leaving a frozen black canvas.
    console.error('Frame error:', err);
    try { window.BurgerLogError && window.BurgerLogError('frame: ' + (err && err.stack || err)); } catch(_){}
    if(!window._frameErrShown){
      window._frameErrShown = true;
      const d=document.createElement('div');
      d.style.cssText="position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(183,28,28,.95);color:#fff;font-family:sans-serif;font-size:13px;font-weight:700;padding:10px 16px;border-radius:14px;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.5);";
      d.innerHTML="Something glitched. <a href='#' onclick='location.reload();return false;' style='color:#fff;text-decoration:underline;'>Reload</a>";
      document.body.appendChild(d);
    }
  }
}

animate();
