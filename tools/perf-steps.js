// Day-20 full-restaurant perf scenario for tools/smoke.js (STEPS=tools/perf-steps.js).
// Builds a maxed bar, starts Day 20, lets robots run it and samples frame cost.
const path = require('path');
module.exports = async (page, OUT) => {
  await page.evaluate(() => { try { endIntro(); } catch (e) {} });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '2-home.png') });
  await page.evaluate(() => {
    eco.day = 19; eco.cash = 5000; eco.totalTrays = 20; eco.floorLevel = Math.max(eco.floorLevel||0, 2);
    updateBoundsFromLevel();
    upg.sodaCount = 1; upg.fryerCount = 1; upg.grillMult = 3; upg.tableCount = 1;
    eco.menu = { combos: true, fries: true };
    const P = () => freeSpot();
    for (let i = 1; i < 4; i++) { const p = P(); if (p) addStation('grill' + i, 'grill', p.x, p.z, 3.5, 2); }
    { const p = P(); if (p) addStation('fryer0', 'fryer', p.x, p.z, 3.2, 2); }
    { const p = P(); if (p) addStation('soda0', 'sodafountain', p.x, p.z, 2, 2); }
    for (let i = 2; i < 6; i++) { const p = P(); if (p) addStation('counter' + i, 'counter', p.x, p.z, 1.8, 1.8); }
    for (let i = 1; i < 8; i++) { const p = P(); if (p) { addStation('table' + i, 'table', p.x, p.z, 5, 5); upg.tableCount++; } }
    for (let i = 0; i < 8; i++) { const role = ['chef', 'waiter', 'busser'][i % 3];
      upg.robots.push({ role, hiredDay: 1 }); const p = getValidSpawn();
      addStation('robot' + i, 'robot', p.x, p.z, 1.5, 1.5, { role, hiredDay: 1 }); }
    upg.robotCount = 8;
    rebuildAll();
    startNextDay();
    // Instrumentation
    window.__perf = { frames: [], float: 0, robots: 0, render: 0, n: 0, vis: 0 };
    const wrap = (name, key) => { const f = window[name]; window[name] = function () { const t = performance.now(); const r = f.apply(this, arguments); window.__perf[key] += performance.now() - t; return r; }; };
    wrap('drawFloatUI', 'float'); wrap('updateRobots', 'robots');
    const usv = window.updateStationVisuals; window.updateStationVisuals = function () { window.__perf.vis++; return usv.apply(this, arguments); };
    const rr = renderer.render.bind(renderer);
    renderer.render = (s, c) => { const t = performance.now(); rr(s, c); window.__perf.render += performance.now() - t; window.__perf.n++; };
    let last = performance.now();
    (function tick() { const n = performance.now(); window.__perf.frames.push(n - last); last = n; if (window.__perf.frames.length < 100000) requestAnimationFrame(tick); })();
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, '3-day20-early.png') });
  await page.waitForTimeout(20000);
  await page.screenshot({ path: path.join(OUT, '4-day20-busy.png') });
  const r = await page.evaluate(() => {
    const p = window.__perf, f = p.frames.slice(5).sort((a, b) => a - b);
    const info = renderer.info;
    return { frames: p.n, avgFrameMs: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(2), p95: +f[Math.floor(f.length * .95)].toFixed(2),
      floatMsPerFrame: +(p.float / p.n).toFixed(3), robotsMsPerFrame: +(p.robots / p.n).toFixed(3), renderMsPerFrame: +(p.render / p.n).toFixed(2),
      stationRebuilds: p.vis, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
      groups: groups.length, served: stats.groupsServed, walkouts: stats.walkouts, day: eco.day, state: gameState,
      domNodes: document.getElementsByTagName('*').length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
  });
  console.log(JSON.stringify(r, null, 1));
};
