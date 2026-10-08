// App Store screenshots at the 6.9" iPhone size (1320x2868), captured from the
// real game. Usage: node tools/store-shots.js  -> store/screenshots/*.png
const path = require('path'), fs = require('fs'), http = require('http');
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..'), WWW = path.join(ROOT, 'www'), OUT = path.join(ROOT, 'store', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png' };
const server = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(WWW, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
  await page.addInitScript(() => { localStorage.setItem('burgerBoss_tutorialSeen', '1'); });
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => window._gameBooted && typeof eco !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const shot = async n => { await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  // A mid-game bar: grown, upgraded, staffed.
  await page.evaluate(() => {
    eco.day = 17; eco.cash = 1840.5; eco.floorLevel = 1; updateBoundsFromLevel();
    gStats.lifeStars = 4.6 * 120; gStats.lifeGroups = 120;
    upg.grillMult = 2.3; upg.patienceMult = 2.4; upg.speedLv = 3; eco.menu = { combos: true, fries: true };
    const P = () => freeSpot();
    { const p = P(); if (p) addStation('grill1', 'grill', p.x, p.z, 3.5, 2); }
    { const p = P(); if (p) addStation('fryer0', 'fryer', p.x, p.z, 3.2, 2); upg.fryerCount = 1; }
    { const p = P(); if (p) addStation('soda0', 'sodafountain', p.x, p.z, 2, 2); upg.sodaCount = 1; }
    for (let i = 1; i < 4; i++) { const p = P(); if (p) { addStation('table' + i, 'table', p.x, p.z, 5, 5); upg.tableCount++; } }
    ['chef','waiter'].forEach((role, i) => { upg.robots.push({ role, hiredDay: 5 }); const p = getValidSpawn();
      addStation('robot' + i, 'robot', p.x, p.z, 1.5, 1.5, { role, hiredDay: 5 }); });
    upg.robotCount = 2; adapt.playStreak = 5; adapt.lastPlayDate = adaptToday(); adapt.heat = 4;
    rebuildAll(); refreshUpgradeVisuals(); applySkates(); saveGame(); showStartMenu();
  });
  await page.waitForTimeout(2500); await shot('1-home');
  await page.evaluate(() => { startNextDay(); stats.spawnTimer = 0; stats.maxSimultaneous = 3;
    Object.values(stations).forEach(s => { if (s.type === 'grill') s.slots = [{ state: 'cooked', progress: 200, burnTimer: 0 }, { state: 'raw', progress: 120, burnTimer: 0 }];
      if (s.type === 'fryer') s.slots = [{ state: 'fries', progress: 200, burnTimer: 0 }, null];
      if (s.type === 'counter') s.item = 'burger_soda_on_tray'; if (s.type === 'trayrack') s.cleanTrays = 6; });
    player.holding = 'burger_on_tray'; updateHolding(); updateStationVisuals(true); });
  await page.waitForTimeout(16000); await shot('2-service');
  await page.evaluate(() => { stats.rushAt = [stats.groupsLeft]; });
  await page.waitForTimeout(6000); await shot('3-rush');
  await page.evaluate(() => { showShop(); });
  await page.waitForTimeout(1200); await shot('4-shop');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
