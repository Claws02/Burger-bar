// Headless smoke/perf run: loads the game in Chromium, captures errors,
// screenshots and frame timing. Usage: node tools/smoke.js [outDir]
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const http = require('http');
const ROOT = process.env.WEBROOT || path.join(__dirname, '..', 'www');
const OUT = process.argv[2] || path.join(__dirname, '..', '.smoke');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
(async () => {
  const port = server.address().port;
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('reqfail: ' + r.url()));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.gameState !== undefined || typeof gameState !== 'undefined', null, { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '1-home.png') });
  const steps = process.env.STEPS ? require(path.resolve(process.env.STEPS)) : null;
  if (steps) await steps(page, OUT);
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
