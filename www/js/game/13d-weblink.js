// Burger Bar — 13d-weblink. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  CO-OP IN THE BROWSER: ROOM CODES
// ─────────────────────────────────────────────────────────────
// The web version (GitHub Pages, added to the home screen) has no Game
// Center, so two phones find each other with a short room code:
//
//   1. Lobby. Both phones connect to free public MQTT brokers over secure
//      WebSockets (no accounts). The host listens on burgerbar/coop/v1/<CODE>/h;
//      the guest keeps announcing "join" there until the host answers
//      "welcome". From then on both use the broker that carried the welcome.
//   2. Direct link. Over the lobby they swap WebRTC offer/answer/ICE (public
//      STUN only) and open a data channel straight between the phones.
//   3. Relay fallback. Until the direct link opens, or if it can't (some
//      cellular networks), game messages go through the broker instead.
//      The game then sends fewer snapshots (link.slow).
//
// coopRoomLink() returns the same { send, close, onmessage, onclose } link the
// rest of co-op uses (13b-coop.js). Nothing here knows about the game.

const COOP_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
const COOP_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const COOP_TOPIC = 'burgerbar/coop/v1/';
const COOP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I/L/O/0/1 to misread
const COOP_DC_CHUNK = 15000;     // safe data-channel message size on every browser
const COOP_MQTT_CHUNK = 60000;   // public brokers accept far more; stay polite

function coopNewCode(){ let c = ''; for(let i = 0; i < 4; i++) c += COOP_CODE_CHARS[Math.floor(Math.random() * COOP_CODE_CHARS.length)]; return c; }
function coopCleanCode(s){ return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BURGER/, '').slice(0, 4); }
// Tests and local checks can point the lobby at their own broker: ?broker=ws://…
function coopBrokerList(){
  try { const m = /[?&]broker=([^&]+)/.exec(location.search); if(m) return [decodeURIComponent(m[1])]; } catch(e){}
  return window.__coopBrokers || COOP_BROKERS;
}

// ── A minimal MQTT 3.1.1 client over WebSocket (QoS 0 only) ──────────────────
// Enough for a lobby and a relay: CONNECT, SUBSCRIBE, PUBLISH, PING.
function MqttWs(url, onMessage, onState){
  const enc = new TextEncoder(), dec = new TextDecoder();
  const id = 'bb' + Math.random().toString(36).slice(2, 12);
  let ws, buf = new Uint8Array(0), ping = null, pid = 1;
  const self = { url, ready: false, closed: false };
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const len = n => { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if(n > 0) d |= 128; out.push(d); } while(n > 0); return out; };
  const packet = (head, body) => new Uint8Array([head, ...len(body.length), ...body]);
  const send = p => { try { if(ws && ws.readyState === 1) ws.send(p); } catch(e){} };
  self.subscribe = topic => { pid = (pid % 65000) + 1; send(packet(0x82, [pid >> 8, pid & 255, ...str(topic), 0])); };
  self.publish = (topic, text) => {
    const t = str(topic), p = enc.encode(text);
    const body = new Uint8Array(t.length + p.length); body.set(t, 0); body.set(p, t.length);
    const head = len(body.length), out = new Uint8Array(1 + head.length + body.length);
    out[0] = 0x30; out.set(head, 1); out.set(body, 1 + head.length);
    send(out);
  };
  self.close = () => {
    self.closed = true; self.ready = false; clearInterval(ping);
    try { send(new Uint8Array([0xE0, 0])); ws.close(); } catch(e){}
  };
  function onData(chunk){
    const b = new Uint8Array(buf.length + chunk.length); b.set(buf, 0); b.set(chunk, buf.length); buf = b;
    for(;;){
      if(buf.length < 2) return;
      let n = 0, mul = 1, i = 1, byte;
      do { if(i >= buf.length) return; byte = buf[i++]; n += (byte & 127) * mul; mul *= 128; } while(byte & 128);
      if(buf.length < i + n) return;
      const type = buf[0] >> 4, body = buf.subarray(i, i + n);
      buf = buf.slice(i + n);
      if(type === 2){ self.ready = true; onState(self, 'ready'); }                       // CONNACK
      else if(type === 3){                                                               // PUBLISH (QoS 0)
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        onMessage(self, topic, dec.decode(body.subarray(2 + tl)));   // QoS 0: no packet id follows
      }
    }
  }
  try {
    ws = new WebSocket(url, ['mqtt']);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 60, ...str(id)]));   // clean session, 60 s keep-alive
      ping = setInterval(() => send(new Uint8Array([0xC0, 0])), 25000);
    };
    ws.onmessage = e => onData(new Uint8Array(e.data));
    ws.onerror = () => {};
    ws.onclose = () => { clearInterval(ping); const was = self.ready; self.ready = false; if(!self.closed) onState(self, was ? 'lost' : 'failed'); };
  } catch(e){ setTimeout(() => onState(self, 'failed'), 0); }
  return self;
}

// ── Long messages travel in numbered pieces (shared with the Game Center link) ─
function coopChunker(maxLen, sendRaw){
  let seq = 0;
  return text => {
    if(text.length <= maxLen){ sendRaw(text); return; }
    const id = (++seq) + Math.random().toString(36).slice(2, 6), n = Math.ceil(text.length / maxLen);
    for(let i = 0; i < n; i++) sendRaw('~' + id + ':' + i + ':' + n + ':' + text.slice(i * maxLen, (i + 1) * maxLen));
  };
}
function coopAssembler(deliver){
  const parts = {};
  return d => {
    if(d[0] !== '~'){ deliver(d); return; }
    const [id, i, n] = d.slice(1).split(':', 3), body = d.slice(1 + id.length + i.length + n.length + 3);
    const p = parts[id] || (parts[id] = { got: 0, n: +n, bits: [] });
    if(p.bits[+i] === undefined){ p.bits[+i] = body; p.got++; }
    if(p.got === p.n){ delete parts[id]; deliver(p.bits.join('')); }
  };
}

// ── The room link ────────────────────────────────────────────────────────────
// role: 'host' | 'guest'. onstatus(text) keeps the Together screen informed.
function coopRoomLink(role, code, onstatus){
  const me = Math.random().toString(36).slice(2, 10);
  const base = COOP_TOPIC + code + '/';
  const inbox = base + (role === 'host' ? 'h' : 'g'), outbox = base + (role === 'host' ? 'g' : 'h');
  const status = t => { try { onstatus && onstatus(t); } catch(e){} };
  const link = { onmessage: null, onclose: null, slow: true, direct: false, code, closed: false };
  let peer = null, broker = null, pc = null, dc = null, joinTimer = null, iceQueue = [];
  const deliver = text => { let m; try { m = JSON.parse(text); } catch(e){ return; } if(link.onmessage) link.onmessage(m); };
  const fromRelay = coopAssembler(deliver), fromDirect = coopAssembler(deliver);
  const wire = (b, k, d) => b.publish(outbox, JSON.stringify({ f: me, k, d }));
  const relaySend = coopChunker(COOP_MQTT_CHUNK, text => { if(broker) wire(broker, 'm', text); });
  const directSend = coopChunker(COOP_DC_CHUNK, text => { try { dc.send(text); } catch(e){} });

  link.send = msg => {
    if(link.closed) return;
    const text = JSON.stringify(msg);
    if(link.direct && dc && dc.readyState === 'open') directSend(text); else relaySend(text);
  };
  link.close = () => {
    if(link.closed) return;
    try { link.send({ t: 'bye' }); } catch(e){}
    shutdown();
  };
  function shutdown(){
    link.closed = true;
    clearInterval(joinTimer);
    try { dc && dc.close(); } catch(e){}
    try { pc && pc.close(); } catch(e){}
    setTimeout(() => brokers.forEach(b => b.close()), 300);   // let the goodbye leave first
  }
  function lost(why){ if(link.closed) return; shutdown(); if(link.onclose) link.onclose(why); }

  // Direct WebRTC link. Fails quietly: the relay keeps working.
  function rtc(){
    if(typeof RTCPeerConnection === 'undefined') return null;
    const p = new RTCPeerConnection({ iceServers: COOP_ICE });
    p.onicecandidate = e => { if(e.candidate && broker) wire(broker, 's', { ice: e.candidate }); };
    p.onconnectionstatechange = () => {
      if(p.connectionState === 'failed' || p.connectionState === 'closed'){ link.direct = false; link.slow = true; if(!link.closed) status('Connected through the relay'); }
    };
    return p;
  }
  function useChannel(ch){
    dc = ch;
    dc.onopen = () => { link.direct = true; link.slow = false; status('Connected directly ⚡'); };
    dc.onclose = () => { link.direct = false; link.slow = true; };
    dc.onmessage = e => fromDirect(String(e.data));
  }
  async function startOffer(){
    pc = rtc(); if(!pc) return;
    useChannel(pc.createDataChannel('game', { ordered: true }));
    try {
      await pc.setLocalDescription(await pc.createOffer());
      wire(broker, 's', { sdp: pc.localDescription });
    } catch(e){}
  }
  async function onSignal(d){
    try {
      if(d.sdp){
        if(d.sdp.type === 'offer'){
          pc = rtc(); if(!pc) return;
          pc.ondatachannel = e => useChannel(e.channel);
          await pc.setRemoteDescription(d.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          wire(broker, 's', { sdp: pc.localDescription });
        } else if(pc) await pc.setRemoteDescription(d.sdp);
        for(const c of iceQueue.splice(0)) await pc.addIceCandidate(c);
      } else if(d.ice && pc){
        if(pc.remoteDescription) await pc.addIceCandidate(d.ice); else iceQueue.push(d.ice);
      }
    } catch(e){}
  }

  function onWire(b, topic, text){
    if(topic !== inbox || link.closed) return;
    let w; try { w = JSON.parse(text); } catch(e){ return; }
    if(!w || w.f === me) return;
    if(role === 'host'){
      if(w.k === 'join'){
        if(peer && peer !== w.f){ wire(b, 'full', 0); return; }
        if(!peer){
          peer = w.f; broker = b;
          brokers.forEach(x => { if(x !== b) x.close(); });
          status('Connected through the relay');
          startOffer();
        }
        wire(b, 'welcome', 0);
        return;
      }
    } else {
      if(w.k === 'welcome' && !peer){
        peer = w.f; broker = b; clearInterval(joinTimer);
        brokers.forEach(x => { if(x !== b) x.close(); });
        status('Connected through the relay');
        return;
      }
      if(w.k === 'full' && !peer){ status('That room already has two chefs.'); lost('full'); return; }
    }
    if(w.f !== peer || b !== broker) return;
    if(w.k === 's') onSignal(w.d);
    else if(w.k === 'm') fromRelay(w.d);
  }

  let failed = 0;
  const urls = coopBrokerList();
  const brokers = urls.map(u => MqttWs(u, onWire, (b, st) => {
    if(st === 'ready'){
      b.subscribe(inbox);
      if(!peer) status(role === 'host' ? `Room ${code} is open. Waiting for your friend…` : `Looking for room ${code}…`);
      if(role === 'guest' && !joinTimer){
        const knock = () => brokers.forEach(x => { if(x.ready) wire(x, 'join', 0); });
        setTimeout(knock, 300);
        joinTimer = setInterval(knock, 1000);
      }
    } else if(st === 'failed' || st === 'lost'){
      if(b === broker) lost('lost');
      else if(++failed >= urls.length && !peer){ status("Couldn't reach the lobby. Check your connection."); lost('offline'); }
    }
  }));
  status('Connecting…');
  return link;
}
