// Boots the REAL Burger Bar game scripts (www/js/game/*.js, in boot.js order)
// inside a Node vm with stubbed THREE + DOM. Nothing here reimplements game
// logic -- tests run against shipping code.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { THREE, counters, resetCounters } = require('./stub-three.js');
const { install } = require('./stub-dom.js');

// Game sources: the ordered list of classic scripts declared in www/js/boot.js.
// Each file is run as its OWN vm script, exactly as the browser loads them, so a
// load-time call into a later file fails here just as it would on device.
const WWW = process.env.BURGERBAR_WWW || path.join(__dirname, '..', 'www');

function gameFiles(){
  const boot = fs.readFileSync(path.join(WWW, 'js', 'boot.js'), 'utf8');
  const m = boot.match(/GAME_FILES\s*=\s*\[([\s\S]*?)\]/);
  if(!m) throw new Error('GAME_FILES list not found in boot.js');
  return m[1].match(/'([^']+)'/g).map(q => q.slice(1, -1));
}
function readSources(){
  return gameFiles().map(f => ({ name: f + '.js',
    code: fs.readFileSync(path.join(WWW, 'js', 'game', f + '.js'), 'utf8') }));
}
// The real index.html markup, for the DOM stub.
function readIndex(){ return fs.readFileSync(path.join(WWW, 'index.html'), 'utf8'); }

function boot(opts = {}){
  const sources = readSources();
  const dom  = install();
  resetCounters();

  const sandbox = Object.assign(Object.create(null), dom.window, {
    THREE, console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, Error, Set, Map,
    parseInt, parseFloat, isNaN, isFinite,
    document: dom.document, localStorage: dom.localStorage,
    performance: dom.window.performance,
    requestAnimationFrame: dom.window.requestAnimationFrame,
    cancelAnimationFrame: dom.window.cancelAnimationFrame,
    setTimeout: dom.window.setTimeout.bind(dom.window), clearTimeout: dom.window.clearTimeout.bind(dom.window),
    setInterval: dom.window.setInterval.bind(dom.window), clearInterval: dom.window.clearInterval.bind(dom.window),
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  if(opts.save) dom.localStorage.setItem('burgerBoss_save', JSON.stringify(opts.save));
  // Most tests are about other systems; the first-shift tutorial (which holds
  // arrivals) only runs where a test asks for it.
  if(!opts.tutorial) dom.localStorage.setItem('burgerBoss_firstShiftDone', '1');

  // The script ends with a call to animate(); our rAF stub only *records* the
  // callback, so exactly one frame runs at boot and tests drive the rest.
  for(const f of sources) vm.runInContext(f.code, sandbox, { filename: f.name });

  const api = {
    ctx: sandbox, dom, counters,
    get: n => vm.runInContext(n, sandbox),
    // Wrapped in an IIFE by default: top-level let/const in separate vm scripts
    // share one global lexical scope and collide across calls.
    run: code => vm.runInContext('(function(){' + code + '})()', sandbox),
    runRaw: code => vm.runInContext(code, sandbox),
    frame(n = 1, msPerFrame = 16.7){
      for(let i=0;i<n;i++){ dom.stepClock(msPerFrame); dom.raf.drain(dom.now()); }
    },
    flushTimers(){ return dom.timers.flush(); },
    text(id){ return dom.document.getElementById(id).textContent; },
    html(id){ return dom.document.getElementById(id).innerHTML; },
    leak(){ return { geo: counters.geoCreated - counters.geoDisposed,
                     mat: counters.matCreated - counters.matDisposed,
                     created: counters.geoCreated, disposed: counters.geoDisposed }; },
  };
  return api;
}

module.exports = { boot, readSources, readIndex, counters, resetCounters };
