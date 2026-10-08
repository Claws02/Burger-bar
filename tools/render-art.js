// Renders the App Store icon, launch splash and PWA icons from the game's own
// 3D burger model (so marketing art always matches the game).
// Usage: node tools/render-art.js
const path = require('path'), fs = require('fs'), http = require('http');
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(WWW, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);

(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => window._gameBooted && typeof itemMesh === 'function', null, { timeout: 20000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const art = await page.evaluate(() => {
    // Render the burger once, transparent, at high resolution.
    function renderBurger(size){
      const c = document.createElement('canvas'); c.width = c.height = size;
      const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      r.setClearColor(0x000000, 0);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(lin('#fff4e0'), lin('#6a3a1a'), 0.55));
      const key = new THREE.DirectionalLight(lin('#fff1dc'), 1.5); key.position.set(3, 6, 5); sc.add(key);
      const rim = new THREE.DirectionalLight(lin('#ffcf8a'), 1.4); rim.position.set(-4, 2.5, -4); sc.add(rim);
      // Hi-detail build of the in-game burger (same palette, more segments)
      // so the silhouette stays smooth at icon size.
      const b = new THREE.Group(), S = 64;
      const mk = (geo, col, y, sh) => { const m = new THREE.Mesh(geo, sh ? MP(col, sh) : M(col)); m.position.y = y; b.add(m); return m; };
      mk(new THREE.CylinderGeometry(.47,.42,.17,S), '#d48a3c', .085);
      mk(new THREE.CylinderGeometry(.53,.53,.16,S), '#4e2a14', .245, 20);
      const ch = mk(new THREE.BoxGeometry(.86,.04,.86), '#ffbf1f', .335); ch.rotation.y = Math.PI/4;
      const let_ = new THREE.Mesh(new THREE.TorusGeometry(.52,.05,8,S), M('#6fbf3a')); let_.rotation.x = Math.PI/2; let_.position.y = .37; b.add(let_);
      mk(new THREE.CylinderGeometry(.5,.5,.04,S), '#6fbf3a', .37);
      mk(new THREE.CylinderGeometry(.4,.4,.06,S), '#e53935', .41);
      const crown = mk(new THREE.SphereGeometry(.53,S,S/2,0,Math.PI*2,0,Math.PI/2), '#de9440', .43); crown.scale.y = .66;
      for(let i=0;i<14;i++){ const a = i*2.39996, rr = .1 + (i%4)*.095; const sd = mk(new THREE.SphereGeometry(.03,10,8), '#fff6dc', 0);
        sd.position.set(Math.cos(a)*rr, .43 + .35*Math.sqrt(Math.max(0, 1-(rr/.53)**2)), Math.sin(a)*rr); sd.scale.set(1,.6,1.5); sd.rotation.y = a; }
      b.rotation.set(0.12, -0.5, 0); sc.add(b);
      const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
      cam.position.set(0, 1.35, 3.6); cam.lookAt(0, 0.33, 0);
      r.render(sc, cam);
      const url = c.toDataURL('image/png'); r.dispose(); return url;
    }
    const burger = renderBurger(1400);
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const out = {};
        // App icon: warm diner gradient, sunburst, burger, no transparency.
        const ic = document.createElement('canvas'); ic.width = ic.height = 1024;
        const x = ic.getContext('2d');
        const g = x.createRadialGradient(512, 430, 60, 512, 520, 760);
        g.addColorStop(0, '#ffb74d'); g.addColorStop(.55, '#f4511e'); g.addColorStop(1, '#b71c1c');
        x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
        x.save(); x.translate(512, 470);
        for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,0)';
          x.beginPath(); x.moveTo(0, 0); x.lineTo(-90, -900); x.lineTo(90, -900); x.closePath(); x.fill(); }
        x.restore();
        x.fillStyle = 'rgba(80,20,0,.32)'; x.beginPath(); x.ellipse(512, 770, 270, 46, 0, 0, Math.PI * 2); x.fill();
        x.drawImage(img, 62, 0, 900, 900);
        out.icon = ic.toDataURL('image/png');
        // Launch splash: matches the in-game boot splash background.
        const sp = document.createElement('canvas'); sp.width = sp.height = 2732;
        const y = sp.getContext('2d');
        const g2 = y.createRadialGradient(1366, 1040, 50, 1366, 1366, 1900);
        g2.addColorStop(0, '#1c2740'); g2.addColorStop(.72, '#0a0e16'); y.fillStyle = g2; y.fillRect(0, 0, 2732, 2732);
        y.drawImage(img, 1366 - 330, 1366 - 420, 660, 660);
        y.fillStyle = '#ffffff'; y.textAlign = 'center'; y.font = '900 132px Nunito, sans-serif';
        y.fillText('BURGER BAR', 1366, 1366 + 330);
        out.splash = sp.toDataURL('image/png');
        res(out);
      };
      img.src = burger;
    });
  });
  const write = (rel, dataUrl) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('wrote', rel); };
  write('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', art.icon);
  for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    write('ios/App/App/Assets.xcassets/Splash.imageset/' + n, art.splash);
  write('store/app-icon-1024.png', art.icon);
  // PWA / apple-touch icons, downscaled in the page for quality.
  for (const s of [512, 180]) {
    const d = await page.evaluate(([src, s]) => new Promise(res => { const i = new Image(); i.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, s, s); res(c.toDataURL('image/png')); }; i.src = src; }), [art.icon, s]);
    write(`www/icons/icon-${s}.png`, d);
  }
  await browser.close(); server.close();
  // App Store rejects icons with an alpha channel; flatten everything we wrote.
  require('child_process').execFileSync('python3', [path.join(__dirname, 'flatten-png.py'),
    'store/app-icon-1024.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    ...['', '-1', '-2'].map(s => `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${s}.png`),
    'www/icons/icon-512.png', 'www/icons/icon-180.png'], { cwd: ROOT, stdio: 'inherit' });
})().catch(e => { console.error(e); process.exit(1); });
