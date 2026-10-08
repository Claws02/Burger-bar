// Screenshot tour for visual review: STEPS=tools/visual-steps.js node tools/smoke.js .smoke/visual
const path = require('path');
module.exports = async (page, OUT) => {
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  await page.evaluate(() => { try { endIntro(); } catch (e) {} });
  await page.waitForTimeout(600); await shot('a-home');
  // Day 1, fresh bar, a customer seated and ordering.
  await page.evaluate(() => { startNextDay(); stats.spawnTimer = 0; });
  await page.waitForTimeout(9000); await shot('b-day1');
  // Maxed bar with every visual tier.
  await page.evaluate(() => {
    quitToMenu && (gameState = 'start_menu');
    eco.day = 19; eco.floorLevel = 2; updateBoundsFromLevel();
    upg.grillMult = 3; upg.patienceMult = 3; upg.speedLv = 5; eco.menu = { combos: true, fries: true };
    const P = () => freeSpot();
    for (let i = 1; i < 3; i++) { const p = P(); if (p) addStation('grill' + i, 'grill', p.x, p.z, 3.5, 2); }
    { const p = P(); if (p) addStation('fryer0', 'fryer', p.x, p.z, 3.2, 2); }
    { const p = P(); if (p) addStation('soda0', 'sodafountain', p.x, p.z, 2, 2); }
    for (let i = 1; i < 6; i++) { const p = P(); if (p) { addStation('table' + i, 'table', p.x, p.z, 5, 5); upg.tableCount++; } }
    for (let i = 0; i < 3; i++) { const role = ['chef', 'waiter', 'busser'][i]; upg.robots.push({ role, hiredDay: 1 });
      const p = getValidSpawn(); addStation('robot' + i, 'robot', p.x, p.z, 1.5, 1.5, { role, hiredDay: 1 }); }
    upg.robotCount = 3; rebuildAll(); refreshUpgradeVisuals(); applySkates();
    startNextDay(); stats.spawnTimer = 0;
    Object.values(stations).forEach(s => { if (s.type === 'grill') s.slots = [{ state: 'cooked', progress: 200, burnTimer: 0 }, { state: 'raw', progress: 90, burnTimer: 0 }];
      if (s.type === 'counter') s.item = 'burger_soda_on_tray'; if (s.type === 'trayrack') s.cleanTrays = 8; });
    updateStationVisuals(true);
  });
  await page.waitForTimeout(12000); await shot('c-day20');
  await page.evaluate(() => { player.pos.set(0, 0, -6); });
  await page.waitForTimeout(800); await shot('d-kitchen');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200); await shot('e-portrait');
};
