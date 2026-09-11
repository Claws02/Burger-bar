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
function makeEl(id='', tag='div'){
  const el = {
    id, tagName:tag.toUpperCase(), style:new Proxy({},{get:(t,k)=>t[k]??'',set:(t,k,v)=>{t[k]=v;return true;}}),
    children:[], dataset:{}, value:'', checked:false, disabled:false,
    _text:'', _html:'',
    get textContent(){ return this._text; }, set textContent(v){ this._text=String(v); this.children=[]; },
    get innerHTML(){ return this._html; }, set innerHTML(v){ this._html=String(v); },
    get innerText(){ return this._text; }, set innerText(v){ this._text=String(v); },
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ const i=this.children.indexOf(c); if(i>=0)this.children.splice(i,1); return c; },
    insertBefore(c){ this.children.unshift(c); return c; },
    setAttribute(k,v){ this.dataset[k]=v; }, getAttribute(k){ return this.dataset[k]; },
    removeAttribute(k){ delete this.dataset[k]; },
    addEventListener(){}, removeEventListener(){}, focus(){}, blur(){}, click(){}, remove(){},
    getBoundingClientRect(){ return {left:0,top:0,width:100,height:40,right:100,bottom:40}; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    scrollIntoView(){}, getContext(){ return null; },
    offsetWidth:800, offsetHeight:600, clientWidth:800, clientHeight:600,
  };
  el.classList = makeClassList(el);
  return el;
}

function install(){
  const els = new Map();
  const canvas = makeEl('gameCanvas','canvas');
  canvas.getContext = () => ({ getExtension:()=>null, canvas });
  els.set('gameCanvas', canvas);

  const body = makeEl('body','body');
  const document = {
    body, documentElement: makeEl('html','html'),
    getElementById(id){ if(!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
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
    setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
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

  return { window, document, localStorage, raf,
    stepClock:(ms)=>{ fakeNow+=ms; }, now:()=>fakeNow, makeEl };
}
module.exports = { install, makeEl };
