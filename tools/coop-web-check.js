// End-to-end check of browser co-op with room codes: a local MQTT broker over
// WebSocket stands in for the public lobby brokers, and two Chromium pages
// play together over a real WebRTC data channel (or the broker relay with
// RELAY=1, which disables WebRTC).
//
// Needs the broker packages (not app dependencies):
//   npm i --no-save aedes@0.51.3 ws@8.18.0
// Usage: node tools/coop-web-check.js [outDir]
const path = require('path'), fs = require('fs'), http = require('http');
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const req = m => { try { return require(m); } catch { return require(path.join(process.env.BROKER_MODULES || '', m)); } };
const Aedes = req('aedes'), { WebSocketServer, createWebSocketStream } = req('ws');
const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.argv[2] || path.join(__dirname, '..', '.smoke', 'coop');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' };

(async () => {
  const aedes = (typeof Aedes.createBroker === 'function') ? await Aedes.createBroker() : Aedes();
  let relayed = 0;
  aedes.on('publish', p => { if(p.topic.startsWith('burgerbar/')) relayed += p.payload.length; });
  const bsrv = http.createServer().listen(0);
  new WebSocketServer({ server: bsrv }).on('connection', ws => aedes.handle(createWebSocketStream(ws)));
  const web = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
  const url = `http://localhost:${web.address().port}/index.html?broker=${encodeURIComponent('ws://localhost:' + bsrv.address().port)}`;

  const browser = await pw.chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });   // separate phones
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.setItem('burgerBoss_tutorialSeen', '1'); localStorage.setItem('burgerBoss_firstShiftDone', '1'); } catch(e){} });
    if(process.env.RELAY) await p.addInitScript(() => { delete window.RTCPeerConnection; });
    p.on('pageerror', e => errors.push(name + ': ' + e.message));
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof storeCtx !== 'undefined' && storeCtx.length > 0, null, { timeout: 90000 });
    await p.evaluate(() => { try { endIntro(); } catch(e){} localStorage.setItem('burgerBoss_firstShiftDone', '1'); });
    return p;
  };
  const host = await open('host'), guest = await open('guest');
  await host.evaluate(() => { eco.day = 8; eco.cash = 400; saveGame(); coopSaveName('Caleb'); showCoop(); coopHostRoom(); });
  await guest.evaluate(() => { cosm.equippedSkin = 'ninja'; rebuildPlayerMesh(); coopSaveName('Sam'); });
  await host.waitForFunction(() => coop.netStatus && coop.netStatus.includes('Waiting'), null, { timeout: 30000 });
  const code = await host.evaluate(() => coop.link.code);
  await host.screenshot({ path: path.join(OUT, '1-host-room-code.png') });
  await guest.evaluate(c => { showCoop(); document.getElementById('coop-code').value = c.toLowerCase(); }, code);
  await guest.screenshot({ path: path.join(OUT, '2-guest-join.png') });
  await guest.evaluate(() => coopJoinRoom());
  await host.waitForFunction(() => !!coop.peer, null, { timeout: 30000 });
  await guest.waitForFunction(() => coop.gotWorld, null, { timeout: 30000 });
  if(!process.env.RELAY) await guest.waitForFunction(() => coop.link.direct, null, { timeout: 20000 }).catch(() => {});
  await host.screenshot({ path: path.join(OUT, '3-host-friend-joined.png') });
  const relayBefore = relayed;
  await host.evaluate(() => { closeCoop(); startNextDay(); });
  await guest.waitForFunction(() => gameState === 'playing', null, { timeout: 30000 });
  // The guest grabs a patty from the fridge.
  await guest.evaluate(() => { const f = stations.fridge; player.pos.set(f.x, 0, f.z + 3.4); player.dir = Math.PI; });
  await guest.waitForTimeout(2500);
  await guest.evaluate(() => handleAction());
  await guest.waitForFunction(() => player.holding === 'raw', null, { timeout: 30000 }).catch(() => {});
  await guest.waitForTimeout(4000);
  await guest.screenshot({ path: path.join(OUT, '4-guest-playing.png') });
  await host.screenshot({ path: path.join(OUT, '5-host-playing.png') });
  const st = p => p.evaluate(() => ({ role: coop.role, peer: coop.peer && coop.peer.name, direct: !!(coop.link && coop.link.direct),
    state: gameState, customers: groups.length + '/' + stats.groupsLeft, hands: player.holding,
    partnerHands: coop.remote ? coop.remote.holding : (coop.hostAv && coop.hostAv.h) || null }));
  const H = await st(host), G = await st(guest);
  console.log('room', code);
  console.log('host ', JSON.stringify(H));
  console.log('guest', JSON.stringify(G));
  console.log('bytes relayed through the broker during play:', relayed - relayBefore);
  await guest.evaluate(() => coopLeave());
  await host.waitForFunction(() => !coop.peer, null, { timeout: 15000 }).catch(() => {});
  console.log('after leave: host peer', await host.evaluate(() => coop.peer), '| guest role', await guest.evaluate(() => coop.role));
  const ok = H.peer === 'Sam' && G.peer === 'Caleb' && G.hands === 'raw' && H.partnerHands === 'raw' && (process.env.RELAY || G.direct);
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  console.log(ok && !errors.length ? 'COOP WEB CHECK OK' : 'COOP WEB CHECK FAILED');
  await browser.close(); web.close(); bsrv.close(); aedes.close();
  process.exit(ok && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
