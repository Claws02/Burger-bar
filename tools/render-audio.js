// Renders a listenable preview of the synthesized audio (no audio files ship
// with the game) to store/audio-preview.wav: menu music, shift music with
// gameplay SFX, then a lunch rush.  Usage: node tools/render-audio.js
const path = require('path'), fs = require('fs'), http = require('http');
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..'), WWW = path.join(ROOT, 'www');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png' };
const server = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(WWW, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
(async () => {
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => window._gameBooted && typeof playSound === 'function', null, { timeout: 20000 });
  const b64 = await page.evaluate(async () => {
    const SR = 44100, LEN = 42;
    const off = new OfflineAudioContext(2, SR * LEN, SR);
    // Point the engine at the offline context and build its graph.
    audioCtx = off; settings.music = true;
    masterGain = off.createGain(); masterGain.gain.value = .9;
    const comp = off.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5;
    _mix = off.createGain(); _mix.gain.value = 1.6; _mix.connect(comp); comp.connect(masterGain); masterGain.connect(off.destination);
    _reverb = off.createConvolver(); _reverb.buffer = _mkImpulse(off, 1.6, 3.2);
    const ro = off.createGain(); ro.gain.value = .32; _reverb.connect(ro); ro.connect(_mix);
    _revSend = off.createGain(); _revSend.connect(_reverb);
    sfxGain = off.createGain(); sfxGain.connect(_mix);
    musicGain = off.createGain(); musicGain.gain.value = .42; musicGain.connect(_mix);
    _noiseBuf = _mkNoise(off, 2);
    // Music: 6 bars menu, 10 bars shift, 6 bars rush.
    const eighthAt = bpm => 60 / bpm / 2;
    let t = .2, step = 0;
    const play = (bars, mood) => { setMusicMood(mood); const e = eighthAt(mood === 2 ? MUSIC.bpm * 1.12 : MUSIC.bpm);
      for (let i = 0; i < bars * 8; i++) { _musicStep(step++, t); t += e; } };
    play(6, 0); const shiftStart = t; play(10, 1); const rushStart = t; play(6, 2);
    // SFX over the shift section, in gameplay order.
    const seq = ['doorbell', 'pickup', 'grillplace', 'pickup', 'ding', 'pickup', 'pour', 'serve', 'coin', 'sparkle',
                 'place', 'washed', 'place', 'warn', 'burnt', 'toss', 'error', 'walkout', 'dump', 'achieve'];
    seq.forEach((n, i) => playSound(n, shiftStart + .6 + i * 1.05));
    playSound('rush', rushStart); playSound('coin', rushStart + 2); playSound('sparkle', rushStart + 3);
    playSound('daycomplete', t + .2);
    const buf = await off.startRendering();
    // 16-bit PCM WAV
    const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true);
    out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    let peak = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][i])); peak = Math.max(peak, Math.abs(v));
      out.setInt16(44 + (i * 2 + c) * 2, v * 32767, true); }
    window.__peak = peak;
    const bytes = new Uint8Array(out.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const peak = await page.evaluate(() => window.__peak);
  fs.mkdirSync(path.join(ROOT, 'store'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'store', 'audio-preview.wav'), Buffer.from(b64, 'base64'));
  console.log('wrote store/audio-preview.wav, peak', peak.toFixed(3), errs.length ? 'ERRORS: ' + errs.join('; ') : 'no errors');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
