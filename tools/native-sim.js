// Simulates the iOS Capacitor bridge in Chromium to verify the native save
// mirror: restore-on-launch, newest-copy-wins, and write/remove mirroring.
// Usage: node tools/native-sim.js
const path = require('path'), fs = require('fs'), http = require('http');
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..', 'www');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
const initScript = (store) => {
  window.__nativeStore = store; window.__calls = [];
  window.webkit = { messageHandlers: { bridge: { postMessage(){} } } };
  const methods = n => n.map(name => ({ name, rtype: 'promise' }));
  window.Capacitor = {
    PluginHeaders: [
      { name: 'Preferences', methods: methods(['get','set','remove','keys']) },
      { name: 'Haptics', methods: methods(['impact','notification']) },
      { name: 'StatusBar', methods: methods(['hide','show']) },
      { name: 'SplashScreen', methods: methods(['hide']) },
      { name: 'App', methods: [{ name:'addListener', rtype:'callback' }] },
    ],
    nativePromise(plugin, method, opts) {
      window.__calls.push(plugin + '.' + method);
      const s = window.__nativeStore;
      if (plugin === 'Preferences') {
        if (method === 'keys') return Promise.resolve({ keys: Object.keys(s) });
        if (method === 'get') return Promise.resolve({ value: s[opts.key] ?? null });
        if (method === 'set') { s[opts.key] = opts.value; return Promise.resolve(); }
        if (method === 'remove') { delete s[opts.key]; return Promise.resolve(); }
      }
      return Promise.resolve({});
    },
    nativeCallback() { return 'cb1'; },
  };
};
(async () => {
  const port = server.address().port;
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  let failures = 0;
  const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

  // A) Fresh install, but native storage holds a Day-12 save (web storage purged).
  const nativeSave = JSON.stringify({ v: 6, savedAt: 2000, activeStoreIdx: 0, stores: [{ name: 'Burger Bar #1', unlocked: true,
    eco: { cash: 777, day: 12, floorLevel: 0, totalTrays: 8, menu: { combos: true } }, upg: {}, gStats: { lifeStars: 0, lifeGroups: 0, recentDays: [] }, wings: [], layout: [] }] });
  let ctx = await browser.newContext(); await ctx.addInitScript(initScript, { burgerBoss_save: nativeSave, burgerBoss_tutorialSeen: '1' });
  let page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window._gameBooted && typeof eco !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => eco.day) === 12, 'restores the save from native storage when web storage is empty');
  check(await page.evaluate(() => window.__calls.includes('SplashScreen.hide')), 'hides the native splash once booted');
  check(await page.evaluate(() => window.__calls.includes('StatusBar.hide')), 'hides the status bar');
  // B) Writes are mirrored.
  await page.evaluate(() => { eco.cash = 4242; saveGame(); });
  await page.waitForTimeout(100);
  check(await page.evaluate(() => JSON.parse(window.__nativeStore.burgerBoss_save).stores[0].eco.cash === 4242), 'mirrors saves to native storage');
  await page.evaluate(() => { haptic('success'); });
  check(await page.evaluate(() => window.__calls.includes('Haptics.notification')), 'routes haptics to the native plugin');
  check(errs.length === 0, 'no page errors (' + errs.join('; ') + ')');
  await ctx.close();

  // C) Web copy newer than native copy: web wins.
  ctx = await browser.newContext(); await ctx.addInitScript(initScript, { burgerBoss_save: nativeSave, burgerBoss_tutorialSeen: '1' });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('burgerBoss_save', s); sessionStorage.setItem('seeded', '1'); } },
    nativeSave.replace('"savedAt":2000', '"savedAt":9000').replace('"day":12', '"day":30'));
  page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window._gameBooted && typeof eco !== 'undefined', null, { timeout: 20000 });
  check(await page.evaluate(() => eco.day) === 30, 'keeps the newer web save over an older native copy');
  await ctx.close();

  await browser.close(); server.close();
  console.log(failures ? failures + ' native-sim check(s) failed' : 'native-sim OK');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
