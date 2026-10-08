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
  try{ applyBigText(); }catch(e){}
}
function saveSettings(){
  try { localStorage.setItem('burgerBoss_settings', JSON.stringify(settings)); } catch(e){}
}
loadSettings();

// ─────────────────────────────────────────────────────────────
//  AUDIO ENGINE
// ─────────────────────────────────────────────────────────────
let audioCtx = null;
let masterGain = null, sfxGain = null, musicGain = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // master → destination; sfx and music feed master so a single volume
    // slider controls everything while music can be toggled independently.
    masterGain = audioCtx.createGain();
    masterGain.gain.value = (settings.volume!=null ? settings.volume : 0.8);
    masterGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();   sfxGain.gain.value = 1.0;   sfxGain.connect(masterGain);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = (settings.music===false ? 0 : 0.35);
    musicGain.connect(masterGain);
    if(settings.music !== false) startMusic();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
window.addEventListener('pointerdown', initAudio, {once: true});
window.addEventListener('keydown', initAudio, {once: true});

function playSound(type) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(sfxGain || audioCtx.destination);

  const t = audioCtx.currentTime;
  if (type === 'coin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.start(t); osc.stop(t + 0.1);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.start(t); osc.stop(t + 0.2);
  } else if (type === 'sizzle') {
    const bufSize = audioCtx.sampleRate * 0.2; 
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 1000;
    noise.connect(filter); filter.connect(gain);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    noise.start(t);
  } else if (type === 'dump') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  } else if (type === 'serve') {
    // Pleasant two-note "ding" when an order is delivered.
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1318, t + 0.08);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
    osc.start(t); osc.stop(t + 0.22);
  } else if (type === 'daycomplete') {
    // Little ascending fanfare on day-complete (chord arpeggio).
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      o.connect(g2); g2.connect(sfxGain || audioCtx.destination);
      o.type = 'triangle';
      const st = t + i * 0.12;
      o.frequency.setValueAtTime(f, st);
      g2.gain.setValueAtTime(0.0001, st);
      g2.gain.linearRampToValueAtTime(0.2, st + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.01, st + 0.32);
      o.start(st); o.stop(st + 0.32);
    });
  }
}

// ── BACKGROUND MUSIC ──────────────────────────────────────────
// A gentle, generative chord-pad loop (no external assets). It plays a slow
// progression so it never gets grating, and routes through musicGain so it can
// be muted/volume-controlled independently of SFX.
let musicTimer = null;
const MUSIC_CHORDS = [
  [261.63, 329.63, 392.00], // C
  [293.66, 349.23, 440.00], // Dm
  [349.23, 440.00, 523.25], // F
  [392.00, 493.88, 587.33], // G
];
let musicStep = 0;
function startMusic(){
  if(!audioCtx || musicTimer) return;
  const playChord = () => {
    if(!audioCtx || audioCtx.state !== 'running') return;
    const chord = MUSIC_CHORDS[musicStep % MUSIC_CHORDS.length];
    musicStep++;
    const t = audioCtx.currentTime;
    chord.forEach(f => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(g); g.connect(musicGain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + 3.6);
      o.start(t); o.stop(t + 3.8);
    });
  };
  playChord();
  musicTimer = setInterval(playChord, 3600);
}
function stopMusic(){
  if(musicTimer){ clearInterval(musicTimer); musicTimer = null; }
}

