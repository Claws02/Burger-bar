// Boots the REAL Burger Bar game script (extracted verbatim from index.html)
// inside a Node vm with stubbed THREE + DOM. Nothing here reimplements game
// logic -- tests run against shipping code.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { THREE, counters, resetCounters } = require('./stub-three.js');
const { install } = require('./stub-dom.js');

// Allows pointing the harness at another build (e.g. a pre-fix revision) for
// A/B comparison: BURGERBAR_INDEX=/tmp/old.html node tests/run.js
const INDEX = process.env.BURGERBAR_INDEX || path.join(__dirname, '..', 'index.html');

function extractGameScript(html){
  const start = html.indexOf('<script type="text/gamejs"');
  if(start === -1) throw new Error('game script block not found in index.html');
  const bodyStart = html.indexOf('>', start) + 1;
  const end = html.indexOf('</script>', bodyStart);
  if(end === -1) throw new Error('unterminated game script block');
  return html.slice(bodyStart, end);
}

function boot(opts = {}){
  const html = fs.readFileSync(INDEX, 'utf8');
  const src  = extractGameScript(html);
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

  // The script ends with a call to animate(); our rAF stub only *records* the
  // callback, so exactly one frame runs at boot and tests drive the rest.
  vm.runInContext(src, sandbox, { filename:'index.html#game-code' });

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

module.exports = { boot, extractGameScript, counters, resetCounters };
