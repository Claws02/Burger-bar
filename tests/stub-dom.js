// Minimal DOM + browser-globals stub, enough to boot the Burger Bar script.
// Elements are created lazily on first getElementById so the game never sees
// null for an id it expects, and every mutation is recorded so tests can assert
// on what the UI *would* have shown.

function makeClassList(el){
  const s=new Set();
  return { add:(...c)=>c.forEach(x=>s.add(x)), remove:(...c)=>c.forEach(x=>s.delete(x)),
    toggle:(c,f)=>{ const on=f!==undefined?f:!s.has(c); on?s.add(c):s.delete(c); return on; },
    contains:c=>s.has(c), _set:s };
}
let onReplace = () => {};
let _elUid = 0;
function makeEl(id='', tag='div'){
  const el = {
    _uid: ++_elUid,
    id, tagName:tag.toUpperCase(), style:new Proxy({},{get:(t,k)=>t[k]??'',set:(t,k,v)=>{t[k]=v;return true;}}),
    children:[], dataset:{}, value:'', checked:false, disabled:false, parentNode:null,
    _text:'', _html:'',
    get textContent(){ return this._text; }, set textContent(v){ this._text=String(v); this.children=[]; },
    // Reflect appended children too: much of the game's UI is built with
    // createElement/appendChild, and a getter that only returned assigned
    // markup made those elements look empty to tests.
    get innerHTML(){
      return this._html + this.children.map(c => c.outerHTML).join('');
    },
    set innerHTML(v){ this._html=String(v); this.children.forEach(c=>c.parentNode=null); this.children=[]; },
    get outerHTML(){
      const cls = [...this.classList._set].join(' ');
      const tag = this.tagName.toLowerCase();
      return `<${tag}${this.id?` id="${this.id}"`:''}${cls?` class="${cls}"`:''}>`
           + this.innerHTML + (this._text||'') + `</${tag}>`;
    },
    get innerText(){ return this._text; }, set innerText(v){ this._text=String(v); },
    appendChild(c){ this.children.push(c); c.parentNode=this; return c; },
    removeChild(c){ const i=this.children.indexOf(c); if(i>=0)this.children.splice(i,1); c.parentNode=null; return c; },
    insertBefore(c){ this.children.unshift(c); c.parentNode=this; return c; },
    // Needed to exercise canvas recycling: a WebGL canvas can only ever hand
    // out one context, so the game replaces the element rather than reusing it.
    cloneNode(deep){
      const n = makeEl(this.id, this.tagName.toLowerCase());
      for(const k in this.dataset) n.dataset[k] = this.dataset[k];
      for(const c of this.classList._set) n.classList.add(c);
      if(deep) n.children = this.children.slice();
      if(this.getContext) n.getContext = () => ({ getExtension:()=>null, canvas:n });
      return n;
    },
    replaceChild(nu, old){
      const i = this.children.indexOf(old);
      if(i>=0){ this.children[i] = nu; } else { this.children.push(nu); }
      nu.parentNode = this; old.parentNode = null;
      if(nu.id) onReplace(nu);
      return old;
    },
    setAttribute(k,v){ this.dataset[k]=v; }, getAttribute(k){ return this.dataset[k]; },
    removeAttribute(k){ delete this.dataset[k]; },
    addEventListener(){}, removeEventListener(){}, focus(){}, blur(){}, click(){}, remove(){},
    getBoundingClientRect(){ return {left:0,top:0,width:100,height:40,right:100,bottom:40}; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    scrollIntoView(){}, getContext(){ return null; },
    offsetWidth:800, offsetHeight:600, clientWidth:800, clientHeight:600,
  };
  el.classList = makeClassList(el);
  // The game assigns .className directly in several places; keep it and
  // classList backed by the same set so serialization sees both.
  Object.defineProperty(el, 'className', {
    get(){ return [...el.classList._set].join(' '); },
    set(v){ el.classList._set.clear();
      String(v).split(/\s+/).filter(Boolean).forEach(c => el.classList._set.add(c)); },
    enumerable:true, configurable:true,
  });
  return el;
}

function install(){
  const els = new Map();
  const body = makeEl('body','body');
  const canvas = makeEl('gameCanvas','canvas');
  canvas.getContext = () => ({ getExtension:()=>null, canvas });
  body.appendChild(canvas);
  els.set('gameCanvas', canvas);
  // Keep getElementById in sync when an element is swapped out wholesale.
  onReplace = el => { els.set(el.id, el); };
  const document = {
    body, documentElement: makeEl('html','html'),
    getElementById(id){
      if(!els.has(id)){ const e = makeEl(id); body.appendChild(e); els.set(id, e); }
      return els.get(id);
    },
    createElement(tag){ const e=makeEl('',tag); if(tag==='canvas') e.getContext=()=>({getExtension:()=>null}); return e; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    _els: els,
  };

  const store = new Map();
  const localStorage = {
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>{ store.set(k,String(v)); },
    removeItem:k=>{ store.delete(k); }, clear:()=>store.clear(),
    get length(){ return store.size; }, _store:store,
  };

  // rAF does NOT auto-run. Callbacks are queued by id (the game runs several
  // concurrent loops -- main animate(), home-screen spin, results counter) so a
  // cancelAnimationFrame on one must not silently kill the others.
  const timers = { pending:new Map(), id:0,
    flush(){ let n=0;
      for(let pass=0; pass<8 && timers.pending.size; pass++){
        const due=[...timers.pending]; timers.pending.clear();
        for(const [,t] of due){ try{ t.fn(); n++; }catch(e){ timers.lastError=e; } }
      }
      return n; } };
  const raf = { pending:new Map(), id:0,
    drain(ts){ const due=[...raf.pending]; raf.pending.clear();
      for(const [,cb] of due){ try{ cb(ts); }catch(e){ raf.lastError=e; throw e; } }
      return due.length; },
    get cb(){ return raf.pending.size ? [...raf.pending.values()][0] : null; } };
  let fakeNow = 0;

  const window = {
    document, localStorage, innerWidth:800, innerHeight:600, devicePixelRatio:1,
    addEventListener(){}, removeEventListener(){},
    requestAnimationFrame(cb){ const id=++raf.id; raf.pending.set(id,cb); return id; },
    cancelAnimationFrame(id){ raf.pending.delete(id); },
    performance:{ now:()=>fakeNow },
    // Timers are queued, not dropped, so tests can flush deferred UI work
    // (the results screen does most of its rendering inside setTimeout).
    setTimeout(fn, ms){ const id=++timers.id; timers.pending.set(id,{fn,at:(ms||0)}); return id; },
    clearTimeout(id){ timers.pending.delete(id); },
    setInterval(){ return ++timers.id; }, clearInterval(){},
    matchMedia:()=>({matches:false, addEventListener(){}, addListener(){}}),
    AudioContext: function(){ return { state:'suspended', currentTime:0, destination:{},
      createGain:()=>({ gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){} }),
      createOscillator:()=>({ type:'', frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){}, start(){}, stop(){} }),
      resume(){}, }; },
    location:{ reload(){}, href:'' }, navigator:{ userAgent:'node', onLine:true },
    alert(){}, confirm:()=>true, prompt:()=>null,
  };
  window.window = window;
  window.webkitAudioContext = window.AudioContext;

  return { window, document, localStorage, raf, timers,
    stepClock:(ms)=>{ fakeNow+=ms; }, now:()=>fakeNow, makeEl };
}
module.exports = { install, makeEl };
