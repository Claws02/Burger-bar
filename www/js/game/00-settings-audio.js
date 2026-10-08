// Burger Bar — 00-settings-audio. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  SETTINGS (persisted independently of the game save)
// ─────────────────────────────────────────────────────────────
let settings = { volume: 0.8, music: true, colorblind: false, difficulty: 'normal' };
function loadSettings(){
  try {
    const raw = localStorage.getItem('burgerBoss_settings');
    if(raw) settings = Object.assign(settings, JSON.parse(raw));
  } catch(e){}
  // applyBigText() lives in 09-menus-dayflow.js; 14-main.js applies it at boot.
}
function saveSettings(){
  try { localStorage.setItem('burgerBoss_settings', JSON.stringify(settings)); } catch(e){}
}
loadSettings();

// ─────────────────────────────────────────────────────────────
//  AUDIO ENGINE
// ─────────────────────────────────────────────────────────────
// Everything is synthesized: no audio files ship with the game. The graph:
//
//   voices ─► sfxBus ───┐                 ┌─► reverb (generated room IR) ─┐
//   music  ─► musicBus ─┼─► (send) ───────┘                               │
//                       └──────────────► mix ◄────────────────────────────┘
//                                         └─► compressor ─► master ─► out
//
// SFX are layered (tone + noise + body), enveloped, slightly randomised in
// pitch so repeats don't sound robotic. Two ambience beds (grill sizzle, sink
// water) follow the game state. Music is a scheduled diner-jazz loop whose
// arrangement follows the moment: mellow on the menu, full band in a shift,
// double-time hats in a lunch rush.
let audioCtx = null;
let masterGain = null, sfxGain = null, musicGain = null;
let _mix = null, _reverb = null, _revSend = null, _noiseBuf = null;
const _amb = { sizzle:null, water:null };
function _mkNoise(ctx, secs){
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate), d = b.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
  return b;
}
function _mkImpulse(ctx, secs, decay){
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for(let c=0;c<2;c++){ const d = b.getChannelData(c);
    for(let i=0;i<n;i++) d[i] = (Math.random()*2 - 1) * Math.pow(1 - i/n, decay) * (i < 200 ? i/200 : 1); }
  return b;
}
function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    audioCtx = new AC();
    const c = audioCtx;
    masterGain = c.createGain(); masterGain.gain.value = (settings.volume!=null ? settings.volume : 0.8);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .18;
    _mix = c.createGain(); _mix.gain.value = 1.6;   // hot into the compressor: phone speakers are small
    _mix.connect(comp); comp.connect(masterGain); masterGain.connect(c.destination);
    _reverb = c.createConvolver(); _reverb.buffer = _mkImpulse(c, 1.6, 3.2);
    const revOut = c.createGain(); revOut.gain.value = .32; _reverb.connect(revOut); revOut.connect(_mix);
    _revSend = c.createGain(); _revSend.gain.value = 1; _revSend.connect(_reverb);
    sfxGain = c.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(_mix);
    musicGain = c.createGain(); musicGain.gain.value = (settings.music===false ? 0 : 0.42); musicGain.connect(_mix);
    _noiseBuf = _mkNoise(c, 2);
    _initAmbience();
    if(settings.music !== false) startMusic();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
window.addEventListener('pointerdown', initAudio, {once: true});
window.addEventListener('keydown', initAudio, {once: true});

// ── Voice helpers ────────────────────────────────────────────────────────────
const _jit = (v, amt) => v * (1 + (Math.random()*2 - 1) * (amt || .03));
// One enveloped oscillator. env: [attack, hold, release] seconds.
function _tone(dest, type, f0, t, env, peak, f1, opts){
  opts = opts || {};
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + env[0] + env[1] + env[2] * .6);
  if(opts.detune) o.detune.value = opts.detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + env[0]);
  g.gain.setValueAtTime(peak, t + env[0] + env[1]);
  g.gain.exponentialRampToValueAtTime(0.0001, t + env[0] + env[1] + env[2]);
  o.connect(g); g.connect(dest);
  if(opts.wet){ const s = audioCtx.createGain(); s.gain.value = opts.wet; g.connect(s); s.connect(_revSend); }
  o.start(t); o.stop(t + env[0] + env[1] + env[2] + .05);
  return o;
}
// Filtered noise burst. filter: [type, freq, Q], optional freq sweep to f1.
function _noise(dest, t, env, peak, filter, f1, opts){
  opts = opts || {};
  const s = audioCtx.createBufferSource(); s.buffer = _noiseBuf;
  const f = audioCtx.createBiquadFilter(); f.type = filter[0]; f.frequency.setValueAtTime(filter[1], t); f.Q.value = filter[2] || 1;
  if(f1) f.frequency.exponentialRampToValueAtTime(f1, t + env[0] + env[1] + env[2]);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + env[0]);
  g.gain.setValueAtTime(peak, t + env[0] + env[1]);
  g.gain.exponentialRampToValueAtTime(0.0001, t + env[0] + env[1] + env[2]);
  s.connect(f); f.connect(g); g.connect(dest);
  if(opts.wet){ const w = audioCtx.createGain(); w.gain.value = opts.wet; g.connect(w); w.connect(_revSend); }
  s.start(t, Math.random() * 1.5); s.stop(t + env[0] + env[1] + env[2] + .05);
}
// Bell / chime: sine fundamental + inharmonic partials, long decay.
function _bell(dest, f, t, peak, len, wet){
  _tone(dest, 'sine', f, t, [.002, 0, len], peak, 0, { wet });
  _tone(dest, 'sine', f * 2.76, t, [.001, 0, len * .45], peak * .35, 0, { wet });
  _tone(dest, 'sine', f * 5.4, t, [.001, 0, len * .2], peak * .15, 0, { wet });
}

// Game events that also deserve a tap on the hand (fires even when muted).
const SOUND_HAPTICS = { coin:'light', serve:'success', error:'warning', dump:'medium', rush:'heavy', daycomplete:'success', burnt:'warning', walkout:'warning' };
const _lastPlay = {};
// `at` (audio-clock seconds) is only used by the offline preview renderer.
function playSound(type, at) {
  if (SOUND_HAPTICS[type] && at === undefined) haptic(SOUND_HAPTICS[type]);
  if (!audioCtx || (audioCtx.state !== 'running' && at === undefined)) return;
  const now = at !== undefined ? at : audioCtx.currentTime;
  // Same sound twice in 30 ms (e.g. two robots at once) just doubles volume.
  if(_lastPlay[type] && now - _lastPlay[type] < .03) return;
  _lastPlay[type] = now;
  const t = now + .005, D = sfxGain;
  switch(type){
    case 'coin': {             // cash register: drawer clack + two bright bells
      _noise(D, t, [.001, .01, .05], .25, ['bandpass', 2500, 1.5]);
      _bell(D, _jit(1975), t + .03, .16, .35, .25);
      _bell(D, _jit(2637), t + .11, .14, .5, .3);
      break;
    }
    case 'serve': {            // warm two-note marimba
      _tone(D, 'sine', 784, t, [.004, 0, .28], .22, 0, { wet:.2 });
      _tone(D, 'sine', 3136, t, [.001, 0, .05], .05);
      _tone(D, 'sine', 1175, t + .1, [.004, 0, .35], .2, 0, { wet:.25 });
      _tone(D, 'sine', 4700, t + .1, [.001, 0, .05], .04);
      break;
    }
    case 'sparkle': {          // perfect service: rising glints
      [1568, 2093, 2637, 3136].forEach((f, i) => _bell(D, _jit(f, .01), t + i * .055, .07, .4, .45));
      break;
    }
    case 'error': {            // soft "bonk", not a buzzer
      _tone(D, 'triangle', 330, t, [.003, .02, .16], .25, 150);
      _tone(D, 'sine', 165, t, [.003, .02, .18], .2, 90);
      break;
    }
    case 'pickup': {           // light pop
      _tone(D, 'sine', _jit(520, .06), t, [.002, 0, .07], .16, 900);
      _noise(D, t, [.001, 0, .03], .06, ['highpass', 3000]);
      break;
    }
    case 'place': {            // tray/plate set down: soft clack
      _noise(D, t, [.001, 0, .05], .18, ['bandpass', _jit(1800, .1), 2]);
      _tone(D, 'sine', _jit(240, .05), t, [.002, 0, .07], .12, 160);
      break;
    }
    case 'grillplace':
    case 'sizzle': {           // patty hits the grill: hiss burst
      _noise(D, t, [.01, .08, .45], .22, ['highpass', 3200, .7], 5200);
      _noise(D, t, [.005, .02, .2], .12, ['bandpass', 900, 1]);
      break;
    }
    case 'warn': {             // about to burn: two quick soft beeps
      _tone(D, 'square', 1320, t, [.002, .04, .03], .05);
      _tone(D, 'square', 1320, t + .12, [.002, .04, .03], .05);
      break;
    }
    case 'ding': {             // cooked: kitchen timer ding
      _bell(D, 1760, t, .12, .55, .3);
      break;
    }
    case 'burnt': {            // sad descending tones + puff
      _tone(D, 'triangle', 440, t, [.005, .05, .25], .14, 330);
      _tone(D, 'triangle', 330, t + .16, [.005, .05, .35], .14, 220);
      _noise(D, t, [.02, .05, .4], .1, ['lowpass', 900]);
      break;
    }
    case 'pour': {             // soda: fizz glug
      _noise(D, t, [.02, .2, .25], .14, ['bandpass', 1400, 4], 2600);
      for(let i=0;i<3;i++) _tone(D, 'sine', _jit(300 + i*70, .1), t + i*.07, [.003, 0, .06], .08, 520);
      break;
    }
    case 'washed': {           // splash + squeaky clean
      _noise(D, t, [.01, .05, .25], .16, ['bandpass', 1200, .8], 600);
      _tone(D, 'sine', 2400, t + .2, [.01, .04, .08], .06, 3600);
      _tone(D, 'sine', 2800, t + .3, [.01, .04, .08], .05, 4200);
      break;
    }
    case 'toss': {             // into the bin
      _noise(D, t, [.002, .01, .12], .16, ['lowpass', 1400]);
      _tone(D, 'sine', 140, t, [.002, 0, .12], .18, 70);
      break;
    }
    case 'dump': {             // bag into dumpster: heavy thud + rattle
      _tone(D, 'sine', 90, t, [.003, .02, .3], .35, 45);
      _noise(D, t, [.003, .05, .35], .2, ['lowpass', 700]);
      _noise(D, t + .08, [.01, .03, .2], .08, ['bandpass', 3000, 3]);
      break;
    }
    case 'doorbell': {         // diner door bell as a guest walks in
      _bell(D, 1318, t, .09, .9, .5);
      _bell(D, 1046, t + .16, .08, 1.1, .5);
      break;
    }
    case 'walkout': {          // guest leaves unhappy
      _tone(D, 'sine', 392, t, [.01, .04, .2], .12, 330, { wet:.2 });
      _tone(D, 'sine', 294, t + .14, [.01, .06, .35], .12, 247, { wet:.2 });
      break;
    }
    case 'click': {            // UI button
      _tone(D, 'sine', 1200, t, [.001, 0, .035], .08, 700);
      break;
    }
    case 'achieve':
    case 'counter': {          // achievement / goal chime
      [1046, 1318, 1568].forEach((f, i) => _bell(D, f, t + i * .07, .1, .7, .4));
      break;
    }
    case 'rush': {             // brass-ish stab + whoosh
      const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(800, t);
      f.frequency.exponentialRampToValueAtTime(3200, t + .1); f.frequency.exponentialRampToValueAtTime(900, t + .5); f.connect(D);
      [262, 330, 392, 523].forEach(fr => { _tone(f, 'sawtooth', fr, t, [.02, .12, .3], .06, 0, { detune: 6 }); _tone(f, 'sawtooth', fr, t, [.02, .12, .3], .05, 0, { detune: -7 }); });
      _noise(D, t, [.15, .05, .2], .12, ['bandpass', 600, .7], 4000);
      break;
    }
    case 'daycomplete': {      // fanfare: arpeggio into a held chord
      [523, 659, 784, 1047].forEach((f, i) => _tone(D, 'triangle', f, t + i * .11, [.01, .05, .4], .14, 0, { wet:.35 }));
      [523, 659, 784].forEach(f => _tone(D, 'sine', f, t + .5, [.03, .5, 1.0], .07, 0, { wet:.4 }));
      _bell(D, 2093, t + .5, .06, 1.2, .5);
      break;
    }
  }
}

// ── Ambience beds ────────────────────────────────────────────────────────────
function _loopNoise(filter, q){
  const s = audioCtx.createBufferSource(); s.buffer = _noiseBuf; s.loop = true;
  const f = audioCtx.createBiquadFilter(); f.type = filter[0]; f.frequency.value = filter[1]; f.Q.value = q || 1;
  const g = audioCtx.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start();
  return { src:s, filter:f, gain:g, level:0 };
}
function _initAmbience(){
  _amb.sizzle = _loopNoise(['highpass', 4200], .6);
  // Crackle: a slow random LFO on the sizzle filter keeps it from sounding like static.
  const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
  lfo.frequency.value = 7.3; lg.gain.value = 900; lfo.connect(lg); lg.connect(_amb.sizzle.filter.frequency); lfo.start();
  _amb.water = _loopNoise(['bandpass', 900], .7);
  const wl = audioCtx.createOscillator(), wg = audioCtx.createGain();
  wl.frequency.value = 3.1; wg.gain.value = 350; wl.connect(wg); wg.connect(_amb.water.filter.frequency); wl.start();
}
function _bedTo(bed, v){
  if(!bed || Math.abs(bed.level - v) < .002) return;
  bed.level = v; bed.gain.gain.setTargetAtTime(v, audioCtx.currentTime, .12);
}
// Called from the main loop. Cheap: only touches the graph when a level changes.
function updateAmbience(){
  if(!audioCtx || !_amb.sizzle) return;
  let cooking = 0;
  if(gameState === 'playing' && !gamePaused){
    for(const k in stations){ const s = stations[k];
      if((s.type === 'grill' || s.type === 'fryer') && s.slots) for(const sl of s.slots) if(sl) cooking++; }
  }
  _bedTo(_amb.sizzle, Math.min(.09, cooking * .022));
  _bedTo(_amb.water, (gameState === 'playing' && typeof sinkHoldActive !== 'undefined' && sinkHoldActive) ? .07 : 0);
}

// ── Music: scheduled diner jazz ──────────────────────────────────────────────
// Lookahead scheduler (setInterval only queues notes ~120 ms ahead on the
// audio clock), so timing stays tight even when a frame hitches.
const MUSIC = { bpm:104, step:0, next:0, timer:null, mood:0 };
// Cmaj7 – A7 – Dm7 – G7 (a I–VI–ii–V turnaround), then Fmaj7 – Fm6 – Em7 – A7.
const MUSIC_PROG = [
  { root:48, notes:[64,67,71,74] }, { root:45, notes:[61,64,67,70] },
  { root:50, notes:[65,69,72,76] }, { root:43, notes:[65,67,71,74] },
  { root:41, notes:[64,65,69,72] }, { root:41, notes:[62,65,68,72] },
  { root:40, notes:[62,64,67,71] }, { root:45, notes:[61,64,67,71] },
];
const _mf = n => 440 * Math.pow(2, (n - 69) / 12);
const PENTA = [72, 74, 76, 79, 81, 84];
// 0 = menu (mellow), 1 = shift (full band), 2 = rush (driving).
function setMusicMood(m){ MUSIC.mood = m; }
function _ep(t, midi, len, vel){        // electric piano: two detuned sines + bell partial + tremolo
  const out = audioCtx.createGain(); out.gain.value = 1;
  const trem = audioCtx.createOscillator(), tg = audioCtx.createGain();
  trem.frequency.value = 4.5; tg.gain.value = .25 * vel; trem.connect(tg); tg.connect(out.gain);
  trem.start(t); trem.stop(t + len + .1);
  out.connect(musicGain);
  const s = audioCtx.createGain(); s.gain.value = .35; out.connect(s); s.connect(_revSend);
  const f = _mf(midi);
  _tone(out, 'sine', f, t, [.008, len * .3, len * .7], vel, 0, { detune: 4 });
  _tone(out, 'sine', f, t, [.008, len * .3, len * .7], vel * .6, 0, { detune: -5 });
  _tone(out, 'sine', f * 4, t, [.002, 0, .12], vel * .12);
}
function _musicStep(step, t){
  const beat = 60 / MUSIC.bpm, eighth = beat / 2;
  const bar = Math.floor(step / 8) % MUSIC_PROG.length, pos = step % 8, ch = MUSIC_PROG[bar];
  const swing = (pos % 2 === 1) ? eighth * .32 : 0;
  const tt = t + swing, mood = MUSIC.mood;
  // Walking bass on quarters: root, 3rd/5th, 5th, chromatic approach to next root.
  if(pos % 2 === 0){
    const next = MUSIC_PROG[(bar + 1) % MUSIC_PROG.length].root;
    const walk = [ch.root, ch.root + (pos === 2 ? 4 : 7), ch.root + 7, next + (next > ch.root ? -1 : 1)][pos / 2];
    const f = _mf(walk - (mood === 0 ? 0 : 0));
    _tone(musicGain, 'triangle', f, tt, [.006, beat * .45, beat * .4], mood === 0 ? .16 : .22);
    _tone(musicGain, 'sine', f * 2, tt, [.004, 0, .08], .05);
  }
  // Comping: long chord on 1, short stab on the "and" of 2 (and of 4 in the shift).
  if(pos === 0) ch.notes.forEach(n => _ep(tt, n, beat * 2.4, mood === 0 ? .045 : .05));
  if(pos === 3 || (mood >= 1 && pos === 7)) ch.notes.slice(1).forEach(n => _ep(tt, n, beat * .5, .035));
  // Brushed drums once a shift starts.
  if(mood >= 1){
    if(pos === 0 || pos === 4) _tone(musicGain, 'sine', 110, tt, [.002, .01, .22], .32, 45);
    if(pos === 2 || pos === 6) _noise(musicGain, tt, [.02, .03, .16], .1, ['bandpass', 2400, .6]);
    if(pos % 2 === 1 || mood === 2) _noise(musicGain, tt, [.001, 0, .04], pos % 2 ? .05 : .035, ['highpass', 7500]);
    if(mood === 2 && pos % 2 === 0) _noise(musicGain, tt + eighth / 2, [.001, 0, .03], .03, ['highpass', 8000]);
  } else if(pos % 2 === 1){
    _noise(musicGain, tt, [.001, 0, .03], .025, ['highpass', 8000]);
  }
  // Vibraphone noodles: sparse, pentatonic, seeded by bar so phrases repeat a bit.
  if(mood >= 1){
    const seed = (bar * 7 + pos * 13 + Math.floor(step / 64) * 3) % 11;
    if(seed < (mood === 2 ? 4 : 3) && pos !== 0){
      const n = PENTA[(seed + bar) % PENTA.length];
      _bell(musicGain, _mf(n), tt, .045, beat * 1.1, .5);
    }
  }
}
function _musicTick(){
  if(!audioCtx || audioCtx.state !== 'running') return;
  const tempo = MUSIC.mood === 2 ? MUSIC.bpm * 1.12 : MUSIC.bpm;
  const eighth = 60 / tempo / 2;
  if(MUSIC.next < audioCtx.currentTime) MUSIC.next = audioCtx.currentTime + .05;
  while(MUSIC.next < audioCtx.currentTime + .12){
    _musicStep(MUSIC.step++, MUSIC.next);
    MUSIC.next += eighth;
  }
}
function startMusic(){
  if(!audioCtx || MUSIC.timer) return;
  MUSIC.next = audioCtx.currentTime + .1;
  MUSIC.timer = setInterval(_musicTick, 25);
}
function stopMusic(){
  if(MUSIC.timer){ clearInterval(MUSIC.timer); MUSIC.timer = null; }
}

// UI buttons click.
document.addEventListener('pointerdown', e => {
  const b = e.target && e.target.closest && e.target.closest('button, .hbtn-play, .hbtn-square, .hbtn-wide, .upg-item');
  if(b) playSound('click');
}, true);

// ─────────────────────────────────────────────────────────────
//  HAPTICS
// ─────────────────────────────────────────────────────────────
// Native Taptic feedback through Capacitor's Haptics plugin when running as the
// iOS app; navigator.vibrate on Android browsers; silently nothing elsewhere.
// Respects the Settings toggle. style: 'light' | 'medium' | 'heavy' | 'success' | 'error'.
function haptic(style){
  if(settings.haptics === false) return;
  try {
    const H = window.NativeBridge && window.NativeBridge.haptics;
    if(H){
      if(style === 'success' || style === 'error' || style === 'warning')
        H.notification({ type: style.toUpperCase() });
      else H.impact({ style: (style || 'light').toUpperCase() });
      return;
    }
    if(navigator.vibrate) navigator.vibrate(style === 'heavy' || style === 'error' ? 30 : 12);
  } catch(e){}
}
