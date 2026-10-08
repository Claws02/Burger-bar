// Burger Bar — 08a-characters. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  PLAYER CHARACTERS
// ─────────────────────────────────────────────────────────────
// A CHARACTER is a body plan; a SKIN is the outfit (jacket, hat, accent, and the
// skin tone for the human chef). Animals and objects keep their own natural
// colours and wear the outfit, so "Space Chef Cat" is an orange cat in a navy
// jacket rather than a navy cat.
//
// Every character shares one rig, feet on y = 0:
//
//   group
//   ├─ legL, legR      pivots at the hips      (walk cycle swings rotation.x)
//   └─ body            pivot at the hips       (sway / breathing)
//      ├─ torso        baked
//      ├─ head         pivot at the neck, baked (face + hat)
//      └─ armL, armR   pivots at the shoulders (swing, carry pose)
//
// Each rigid part is baked per character + skin + crown, so the player costs
// a couple of dozen draw calls and switching characters allocates nothing new
// after the first visit.

const CHARACTERS = [
  {id:'human',   name:'Chef',        icon:'👨‍🍳', kind:'Human'},
  {id:'cat',     name:'Chef Cat',    icon:'🐱',   kind:'Animal'},
  {id:'bear',    name:'Chef Bear',   icon:'🐻',   kind:'Animal'},
  {id:'penguin', name:'Chef Penguin',icon:'🐧',   kind:'Animal'},
  {id:'frog',    name:'Chef Frog',   icon:'🐸',   kind:'Animal'},
  {id:'dino',    name:'Chef Dino',   icon:'🦖',   kind:'Animal'},
  {id:'bunny',   name:'Chef Bunny',  icon:'🐰',   kind:'Animal'},
  {id:'burger',  name:'Sir Burger',  icon:'🍔',   kind:'Object'},
  {id:'toaster', name:'Toastmaster', icon:'🍞',   kind:'Object'},
  {id:'robot',   name:'Cook-Bot',    icon:'🤖',   kind:'Object'},
  {id:'avocado', name:'Avocado',     icon:'🥑',   kind:'Object'},
  {id:'coffee',  name:'Mug',         icon:'☕',   kind:'Object'},
];
function getActiveCharacter(){
  return CHARACTERS.find(c => c.id === (cosm.character || 'human')) || CHARACTERS[0];
}

// Per-character body plan: natural colours and proportions.
const CHAR_PLANS = {
  human:   { fur:null,      hand:null,      hipY:.8,  legs:'pants', head:'human'   },
  cat:     { fur:'#f2a24b', hand:'#fff3e0', hipY:.78, legs:'fur',   head:'cat'     },
  bear:    { fur:'#8a5a3a', hand:'#a9764f', hipY:.78, legs:'fur',   head:'bear'    },
  penguin: { fur:'#263238', hand:'#263238', hipY:.6,  legs:'feet',  head:'penguin' },
  frog:    { fur:'#5fb648', hand:'#5fb648', hipY:.7,  legs:'fur',   head:'frog'    },
  dino:    { fur:'#3fa56a', hand:'#3fa56a', hipY:.8,  legs:'fur',   head:'dino'    },
  bunny:   { fur:'#f6efe6', hand:'#f6efe6', hipY:.78, legs:'fur',   head:'bunny'   },
  burger:  { object:'burger',  hipY:.62 },
  toaster: { object:'toaster', hipY:.62 },
  robot:   { object:'robot',   hipY:.72 },
  avocado: { object:'avocado', hipY:.6 },
  coffee:  { object:'coffee',  hipY:.6 },
};

// Plain hex helpers (no THREE dependency): relative luminance and darken/lighten.
function _rgb(hex){ const h = String(hex).replace('#',''); const v = parseInt(h.length === 3 ? h.replace(/./g,'$&$&') : h, 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function _lum(hex){ const [r,g,b] = _rgb(hex); return (.2126*r + .7152*g + .0722*b) / 255; }
function _shade(hex, f){ return '#' + _rgb(hex).map(c => Math.max(0, Math.min(255, Math.round(c*f))).toString(16).padStart(2,'0')).join(''); }

// ── Shared face + outfit parts ───────────────────────────────────────────────
// Big glossy cartoon eyes: white, iris, pupil, catch-light. `look` nudges the
// pupils so faces feel alive rather than staring through you.
function chEyes(g, y, z, spread, size, iris, opts){
  opts = opts || {};
  for(const s of [-1, 1]){
    const x = s * spread;
    addMesh(g, GSphS(size, 18, 14), MP('#ffffff', 40), x, y, z, 0,0,0,false).scale.set(1, 1.18, .55);
    addMesh(g, GSphS(size*.62, 16, 12), MP(iris || '#4e342e', 80), x, y - size*.08, z + size*.42, 0,0,0,false).scale.set(opts.slit ? .55 : 1, 1.12, .45);
    addMesh(g, GSphS(size*.34, 12, 10), M('#101010'), x, y - size*.1, z + size*.55, 0,0,0,false).scale.set(opts.slit ? .35 : 1, 1.15, .4);
    addMesh(g, GSphS(size*.17, 8, 6), ME('#ffffff'), x + size*.22, y + size*.25, z + size*.62, 0,0,0,false);
    if(opts.brow) addMesh(g, GRBox(size*1.5, size*.26, size*.26, size*.12), M(opts.brow), x, y + size*1.45, z + size*.1, 0,0,-s*.12,false);
  }
}
function chSmile(g, y, z, w, color){
  addMesh(g, GTor(w, w*.2, 6, 14, Math.PI), M(color || '#6d2b20'), 0, y, z, 0,0,Math.PI,false);
}
function chBlush(g, y, z, spread){
  for(const s of [-1,1]) addMesh(g, GSphS(.085, 10, 8), M('#ff8a80', .55), s*spread, y, z, 0,0,0,false).scale.set(1.3, .7, .4);
}
// Puffy chef toque. With the Golden Burger Crown it turns gold and gains points.
function chHat(g, y, scale, sk, crown){
  const hatCol = crown ? '#ffd54f' : sk.hatColor;
  const top = crown ? MP('#ffd54f', 150) : (_lum(hatCol) > .85 ? MP('#fbfbfb', 20) : M(hatCol));
  const band = crown ? MP('#ffb300', 150) : (_lum(hatCol) > .85 ? M('#eceff1') : M(_shade(hatCol, .8)));
  const h = new THREE.Group(); h.position.y = y; h.scale.setScalar(scale); g.add(h);
  addMesh(h, GCylT(.43, .45, .28, 28), band, 0, .14, 0);
  addMesh(h, GCylT(.47, .4, .5, 28), top, 0, .5, 0);
  addMesh(h, GSphS(.42, 24, 16), top, 0, .86, 0).scale.set(1, .72, 1);
  for(let i=0;i<7;i++){
    const a = i / 7 * Math.PI * 2;
    addMesh(h, GSphS(.24, 14, 10), top, Math.cos(a)*.3, .8, Math.sin(a)*.3).scale.set(1, .85, 1);
  }
  if(crown){
    for(let i=0;i<6;i++){
      const a = i / 6 * Math.PI * 2;
      addMesh(h, GCone(.08, .2, 8), MP('#ffb300',150), Math.cos(a)*.44, .36, Math.sin(a)*.44, 0,0,0,false);
    }
    addMesh(h, GSphS(.07, 10, 8), ME('#e53935'), 0, .16, .46, 0,0,0,false);
  }
}
// Chef jacket: rounded torso, double-breasted buttons, neckerchief, apron.
function chJacket(g, w, h, d, sk, opts){
  opts = opts || {};
  const jacket = M(sk.bodyColor);
  const light = _lum(sk.bodyColor) > .6;
  addMesh(g, GRBox(w, h, d, Math.min(w, d) * .42, 3), jacket, 0, h/2, 0);
  addMesh(g, GRBox(w*.98, h*.16, d*.98, .08), M(_shade(sk.bodyColor, .9)), 0, h*.08, 0, 0,0,0,false); // hem
  const btn = light ? MP('#90a4ae', 120) : MP('#ffd54f', 140);
  for(const bx of [-.13, .13]) for(let i=0;i<3;i++)
    addMesh(g, GSphS(.045, 8, 6), btn, bx * (w/.95), h*.42 + i*h*.17, d/2 + .005, 0,0,0,false);
  if(!opts.noKerchief){
    const acc = sk.trailColor || '#e53935';
    addMesh(g, GCone(.15, .24, 3), M(acc), 0, h - .02, d/2 - .02, Math.PI + .25, 0, 0, false);
    addMesh(g, GTor(w*.32, .055, 6, 18), M(acc), 0, h - .03, 0, Math.PI/2, 0, 0, false);
  }
  if(opts.apron) addMesh(g, GRBox(w*.72, h*.5, .05, .05), M(light ? '#eceff1' : '#fafafa'), 0, h*.27, d/2 + .015, 0,0,0,false);
}
// An arm hanging from a shoulder pivot (local y goes DOWN the arm).
function chArm(sk, hand, len, sleeveOverride){
  const g = new THREE.Group();
  const sleeve = M(sleeveOverride || sk.bodyColor);
  addMesh(g, GCap(.13, len*.55), sleeve, 0, -len*.38, 0);
  addMesh(g, GCylT(.155, .15, .1, 14), M(_lum(sleeveOverride || sk.bodyColor) > .7 ? '#e0e0e0' : '#fafafa'), 0, -len*.74, 0, 0,0,0,false);
  addMesh(g, GSphS(.15, 14, 10), M(hand), 0, -len*.88, .02);
  return g;
}
function chLeg(kind, col){
  const g = new THREE.Group();
  if(kind === 'feet'){
    addMesh(g, GRBox(.3, .14, .5, .07), M('#ffa726'), 0, -.53, .12);
    addMesh(g, GCap(.12, .2), M(col), 0, -.3, 0);
  } else {
    addMesh(g, GCap(.15, kind === 'pants' ? .38 : .3), M(kind === 'pants' ? '#37474f' : col), 0, -.36, 0);
    if(kind === 'pants') addMesh(g, GRBox(.32, .16, .46, .07), MP('#212121', 60), 0, -.72, .07);
    else addMesh(g, GSphS(.19, 14, 10), M(col), 0, -.7, .08).scale.set(1, .6, 1.3);
  }
  return g;
}

// ── Heads ────────────────────────────────────────────────────────────────────
// Each returns the neck-pivot group content; hat height `hy` is where the toque sits.
function chHead(kind, sk, crown){
  const g = new THREE.Group();
  const P = CHAR_PLANS[kind] || {};
  const fur = M(P.fur || sk.headColor);
  let hy = .74, hs = 1;
  switch(kind){
    case 'human': {
      const skin = M(sk.headColor), hair = M('#5d4037');
      addMesh(g, GSphS(.5, 28, 20), skin, 0, .42, 0).scale.set(1, .96, .95);
      for(const s of [-1,1]) addMesh(g, GSphS(.12, 12, 8), skin, s*.49, .4, 0).scale.set(.6, 1, 1);
      addMesh(g, GSphS(.51, 24, 12), hair, 0, .5, -.05, -.25, 0, 0).scale.set(1, .8, .95);
      for(const s of [-1,1]) addMesh(g, GRBox(.1, .22, .16, .04), hair, s*.46, .52, .08, 0,0,0,false); // sideburns
      chEyes(g, .46, .4, .17, .1, '#5d4037', { brow:'#4e342e' });
      addMesh(g, GSphS(.075, 12, 10), M(_shade(sk.headColor, .9)), 0, .34, .48, 0,0,0,false);
      chSmile(g, .22, .43, .1);
      chBlush(g, .3, .4, .3);
      break;
    }
    case 'cat': {
      addMesh(g, GSphS(.52, 28, 20), fur, 0, .42, 0).scale.set(1.08, .95, .95);
      addMesh(g, GSphS(.22, 18, 12), M('#fff3e0'), 0, .27, .38, 0,0,0,false).scale.set(1.25, .8, .7);
      for(const s of [-1,1]){
        addMesh(g, GCone(.2, .36, 4), fur, s*.33, .86, -.02, 0, Math.PI/4, s*.25);
        addMesh(g, GCone(.12, .24, 4), M('#f8bbd0'), s*.32, .84, .04, 0, Math.PI/4, s*.25, false);
        for(let i=0;i<2;i++) addMesh(g, GBox(.4, .015, .015), M('#fafafa'), s*.42, .26 + i*.07, .46, 0, 0, s*(i?.12:-.1), false);
      }
      for(let i=-1;i<=1;i++) addMesh(g, GRBox(.06, .2, .05, .02), M('#c77a2c'), i*.12, .78, .3, -.5, 0, 0, false); // stripes
      chEyes(g, .48, .4, .18, .11, '#7cb342', { slit:true });
      addMesh(g, GCone(.06, .07, 3), M('#f06292'), 0, .33, .55, Math.PI, 0, 0, false);
      chSmile(g, .2, .5, .07, '#5d2b1f');
      hy = .7; hs = .82;
      break;
    }
    case 'bear': {
      addMesh(g, GSphS(.54, 28, 20), fur, 0, .42, 0);
      for(const s of [-1,1]){
        addMesh(g, GSphS(.17, 14, 10), fur, s*.4, .82, 0);
        addMesh(g, GSphS(.1, 12, 8), M('#d7a982'), s*.4, .83, .07, 0,0,0,false).scale.set(1,1,.5);
      }
      addMesh(g, GSphS(.24, 18, 12), M('#e0bc95'), 0, .27, .4, 0,0,0,false).scale.set(1.15, .85, .75);
      addMesh(g, GSphS(.08, 12, 8), MP('#2b1b14', 120), 0, .36, .58, 0,0,0,false).scale.set(1.3, .9, 1);
      chEyes(g, .5, .43, .19, .085, '#3e2723');
      chSmile(g, .2, .55, .07, '#4e2a1a');
      chBlush(g, .32, .45, .33);
      hy = .74; hs = .85;
      break;
    }
    case 'penguin': {
      addMesh(g, GSphS(.5, 28, 20), fur, 0, .4, 0);
      addMesh(g, GSphS(.4, 24, 16), M('#fafafa'), 0, .36, .19, 0,0,0,false).scale.set(1.05, .95, .75);
      chEyes(g, .48, .43, .15, .09, '#263238');
      addMesh(g, GCone(.12, .3, 12), M('#ffa726'), 0, .33, .56, Math.PI/2, 0, 0, false);
      chBlush(g, .32, .44, .27);
      hy = .68; hs = .82;
      break;
    }
    case 'frog': {
      addMesh(g, GSphS(.52, 28, 20), fur, 0, .34, 0).scale.set(1.22, .82, 1);
      addMesh(g, GSphS(.42, 20, 12), M('#d4ec9e'), 0, .24, .18, 0,0,0,false).scale.set(1.2, .6, .8);
      for(const s of [-1,1]){
        addMesh(g, GSphS(.22, 18, 14), fur, s*.28, .7, .12);
      }
      chEyes(g, .74, .26, .28, .13, '#33691e');
      chSmile(g, .3, .52, .16, '#2e5d1f');
      chBlush(g, .3, .5, .42);
      hy = .82; hs = .78;
      break;
    }
    case 'dino': {
      addMesh(g, GSphS(.5, 28, 20), fur, 0, .44, 0).scale.set(1, .95, 1.05);
      addMesh(g, GRBox(.62, .34, .42, .16, 3), fur, 0, .3, .4);
      addMesh(g, GRBox(.56, .14, .36, .06), M('#c8e6c9'), 0, .17, .42, 0,0,0,false);
      for(const s of [-1,1]) addMesh(g, GSphS(.04, 8, 6), M('#1b5e20'), s*.12, .4, .62, 0,0,0,false);
      for(let i=0;i<3;i++) addMesh(g, GCone(.03, .07, 5), M('#ffffff'), -.16 + i*.16, .14, .6, Math.PI, 0, 0, false);
      chEyes(g, .64, .4, .19, .1, '#f9a825');
      for(let i=0;i<3;i++) addMesh(g, GCone(.1, .2, 4), M('#ffca28'), 0, .9 - i*.2, -.32 - i*.12, -.5 - i*.3, 0, 0);
      hy = .8; hs = .8;
      break;
    }
    case 'bunny': {
      addMesh(g, GSphS(.5, 28, 20), fur, 0, .4, 0).scale.set(1, .95, .95);
      for(const s of [-1,1]){
        addMesh(g, GCap(.12, .55), fur, s*.42, 1.0, -.04, -.12, 0, -s*.55);
        addMesh(g, GCap(.065, .45), M('#f8bbd0'), s*.42, 1.0, .05, -.12, 0, -s*.55, false);
      }
      addMesh(g, GSphS(.2, 16, 12), M('#ffffff'), 0, .27, .36, 0,0,0,false).scale.set(1.3, .8, .7);
      addMesh(g, GSphS(.06, 10, 8), M('#f06292'), 0, .35, .5, 0,0,0,false);
      addMesh(g, GRBox(.13, .1, .03, .02), M('#ffffff'), 0, .17, .5, 0,0,0,false);
      chEyes(g, .48, .4, .18, .1, '#6d4c41');
      chBlush(g, .3, .42, .3);
      hy = .7; hs = .74;
      break;
    }
  }
  chHat(g, hy, hs, sk, crown);
  return g;
}

// ── Objects: the body IS the character; limbs + hat are added around it ──────
function chObject(kind, sk, crown){
  const g = new THREE.Group();
  let hatY = 1.6, hatS = .78;
  switch(kind){
    case 'burger': {
      addMesh(g, GCylT(.66, .6, .3, 32), M('#d48a3c'), 0, .15, 0);
      addMesh(g, GCylT(.72, .72, .3, 32), MP('#5a3219', 25), 0, .45, 0);
      addMesh(g, GBox(1.3, .07, 1.3), M('#ffc928'), 0, .63, 0, 0, Math.PI/4, 0, false);
      addMesh(g, GTor(.68, .08, 8, 32), M('#7cc242'), 0, .68, 0, Math.PI/2, 0, 0, false);
      addMesh(g, GCyl(.6, .08, 28), M('#e53935'), 0, .74, 0, 0,0,0,false);
      addMesh(g, GSphS(.74, 32, 16, ), M('#e3a352'), 0, .76, 0).scale.set(1, .74, 1);
      for(let i=0;i<12;i++){ const a = i*2.4, r = .16 + (i%4)*.12;
        addMesh(g, GSphS(.04, 8, 6), M('#fff6dc'), Math.cos(a)*r, .76 + .55*Math.sqrt(Math.max(0, 1-(r/.74)**2)), Math.sin(a)*r, 0,a,0,false).scale.set(1,.6,1.5); }
      chEyes(g, 1.02, .55, .22, .12, '#4e342e', { brow:'#8d5524' });
      chSmile(g, .45, .7, .16, '#2b1408');
      chBlush(g, .92, .6, .45);
      hatY = 1.25; hatS = .72;
      break;
    }
    case 'toaster': {
      addMesh(g, GRBox(1.3, 1.2, .9, .3, 3), MP('#d9e0e4', 150), 0, .6, 0);
      addMesh(g, GRBox(1.32, .2, .92, .08), MP(sk.bodyColor, 80), 0, .3, 0, 0,0,0,false);
      for(const s of [-1,1]){
        addMesh(g, GRBox(.42, .06, .6, .03), M('#263238'), s*.27, 1.2, 0, 0,0,0,false);
        addMesh(g, GRBox(.36, .45, .5, .1), M('#e8b56b'), s*.27, 1.36, 0);
        addMesh(g, GRBox(.3, .05, .44, .02), M('#9c6b30'), s*.27, 1.58, 0, 0,0,0,false);
      }
      addMesh(g, GRBox(.1, .3, .14, .04), M('#37474f'), .7, .9, 0, 0,0,0,false);
      chEyes(g, .82, .45, .22, .12, '#37474f');
      chSmile(g, .55, .46, .13, '#37474f');
      hatY = 1.62; hatS = .7;
      break;
    }
    case 'robot': {
      addMesh(g, GRBox(1.1, 1.0, .8, .28, 3), MP('#b0bec5', 110), 0, .5, 0);
      addMesh(g, GRBox(.62, .4, .05, .08), MP('#1c262b', 140), 0, .55, .41, 0,0,0,false);
      ['#ef5350','#ffee58','#66bb6a'].forEach((c,i)=> addMesh(g, GSphS(.05,8,6), ME(c), -.16+i*.16, .55, .45, 0,0,0,false));
      addMesh(g, GCyl(.18, .14, 14), MP('#90a4ae', 100), 0, 1.06, 0);
      addMesh(g, GRBox(.95, .72, .8, .26, 3), MP('#cfd8dc', 120), 0, 1.48, 0);
      addMesh(g, GRBox(.78, .36, .06, .12), MP('#0f1a20', 160), 0, 1.5, .4, 0,0,0,false);
      for(const s of [-1,1]) addMesh(g, GRBox(.16, .16, .04, .07), ME('#4dd0e1'), s*.18, 1.52, .44, 0,0,0,false);
      addMesh(g, GBox(.24, .03, .03), ME('#4dd0e1'), 0, 1.38, .44, 0,0,0,false);
      for(const s of [-1,1]) addMesh(g, GCyl(.1, .1, 12), MP('#90a4ae', 100), s*.5, 1.5, 0, 0, 0, Math.PI/2);
      hatY = 1.82; hatS = .7;
      break;
    }
    case 'avocado': {
      const egg = cachedGeo('avoEgg', ()=>{ const pts=[]; for(let i=0;i<=16;i++){ const t=i/16, a=-Math.PI/2+t*Math.PI;
        const r=Math.cos(a)*(1-.28*Math.sin(a+Math.PI/2)*(t>.5?1:0)); pts.push(new THREE.Vector2(Math.max(.001,r)*.62, Math.sin(a)*.8)); }
        return new THREE.LatheGeometry(pts, 28); });
      addMesh(g, egg, MP('#2f5d1e', 40), 0, .8, 0);
      addMesh(g, egg, M('#c5e17a'), 0, .82, .2, 0,0,0,false).scale.set(.84, .9, .5);
      addMesh(g, GSphS(.24, 20, 14), MP('#6d4c41', 60), 0, .62, .42);
      chEyes(g, 1.08, .44, .17, .1, '#33691e');
      chSmile(g, .92, .48, .08, '#33691e');
      chBlush(g, 1.0, .44, .3);
      hatY = 1.5; hatS = .66;
      break;
    }
    case 'coffee': {
      addMesh(g, GCylT(.62, .55, 1.25, 32), MP('#fafafa', 70), 0, .62, 0);
      addMesh(g, GCylT(.63, .63, .22, 32), M(sk.bodyColor), 0, .5, 0, 0,0,0,false);
      addMesh(g, GCyl(.57, .04, 28), M('#5d3a24'), 0, 1.22, 0, 0,0,0,false);
      addMesh(g, GTor(.3, .08, 10, 20), MP('#fafafa', 70), .68, .7, 0, 0, 0, Math.PI/2);
      for(let i=0;i<3;i++) addMesh(g, GSphS(.1 - i*.02, 10, 8), M('#ffffff', .45), -.15 + i*.12, 1.45 + i*.18, 0, 0,0,0,false);
      chEyes(g, .88, .56, .2, .11, '#5d4037');
      chSmile(g, .7, .58, .12, '#5d4037');
      chBlush(g, .78, .55, .38);
      hatY = 1.27; hatS = .66;
      break;
    }
  }
  chHat(g, hatY, hatS, sk, crown);
  return g;
}

// Build a character at gameplay scale (feet on y=0). Returns the group and the
// parts callers animate: body, head, armL/armR, legL/legR.
function buildCharacter(charId, sk, opts){
  const def = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
  const P = CHAR_PLANS[def.id] || CHAR_PLANS.human;
  const crown = !!(opts && opts.crown);
  const key = 'ch|' + def.id + '|' + (sk.id || sk.bodyColor) + '|' + (crown ? 1 : 0);
  const g = new THREE.Group();
  const out = { group:g, body:null, head:null, armL:null, armR:null, legL:null, legR:null, hat:null };
  const hip = P.hipY;

  const body = new THREE.Group(); body.position.y = hip; g.add(body); out.body = body;
  const hand = P.hand || sk.headColor;

  if(P.object){
    body.add(bake(key + '|obj', ()=>chObject(P.object, sk, crown)));
    out.head = body;
    const armLen = .62, shoulderY = P.object === 'robot' ? .85 : P.object === 'toaster' ? .75 : .65;
    const reach = P.object === 'burger' ? .76 : P.object === 'coffee' ? .64 : .72;
    for(const s of [-1,1]){
      const arm = new THREE.Group(); arm.position.set(s*reach, shoulderY, 0); arm.rotation.z = s * -.35; body.add(arm);
      arm.add(bake(key + '|arm', ()=>chArm(sk, '#ffffff', armLen, P.object === 'robot' ? '#90a4ae' : sk.bodyColor)));
      if(s < 0) out.armL = arm; else out.armR = arm;
    }
    for(const s of [-1,1]){
      const leg = new THREE.Group(); leg.position.set(s*.24, hip, 0); g.add(leg);
      leg.add(bake(key + '|leg', ()=>{ const l = new THREE.Group();
        addMesh(l, GCap(.09, hip*.55), M(P.object === 'robot' ? '#78909c' : '#4e342e'), 0, -hip*.42, 0);
        addMesh(l, GRBox(.3, .14, .42, .07), MP(P.object === 'robot' ? '#546e7a' : '#d32f2f', 60), 0, -hip + .07, .06);
        return l; }));
      if(s < 0) out.legL = leg; else out.legR = leg;
    }
    return out;
  }

  // Animal & human: jacketed torso, head on a neck pivot.
  const torsoW = def.id === 'penguin' ? 1.0 : def.id === 'frog' ? 1.0 : .95;
  const torsoH = def.id === 'penguin' ? .95 : .9;
  body.add(bake(key + '|torso', ()=>{
    const t = new THREE.Group();
    chJacket(t, torsoW, torsoH, .66, sk);
    if(def.id === 'dino') addMesh(t, GCylT(.06, .24, .9, 10), M(P.fur), 0, .1, -.5, -1.1, 0, 0);
    if(def.id === 'cat') addMesh(t, GTor(.32, .07, 8, 20, Math.PI*1.2), M(P.fur), 0, .3, -.42, 0, Math.PI/2, .4);
    if(def.id === 'bunny') addMesh(t, GSphS(.17, 14, 10), M('#ffffff'), 0, .12, -.38);
    if(def.id === 'bear') addMesh(t, GSphS(.1, 10, 8), M(P.fur), 0, .1, -.36);
    return t;
  }));
  const head = new THREE.Group(); head.position.y = torsoH - .02; body.add(head); out.head = head;
  head.add(bake(key + '|head', ()=>chHead(def.id, sk, crown)));

  for(const s of [-1,1]){
    const arm = new THREE.Group(); arm.position.set(s*(torsoW/2 + .08), torsoH - .14, 0); arm.rotation.z = s * -.18; body.add(arm);
    arm.add(bake(key + '|arm', ()=> def.id === 'penguin'
      ? (()=>{ const a = new THREE.Group(); addMesh(a, GCap(.12, .45), M(P.fur), 0, -.32, 0).scale.set(.6,1,1.25); return a; })()
      : chArm(sk, hand, .7)));
    if(s < 0) out.armL = arm; else out.armR = arm;
  }
  for(const s of [-1,1]){
    const leg = new THREE.Group(); leg.position.set(s*.2, hip, 0); g.add(leg);
    leg.add(bake(key + '|leg', ()=>chLeg(P.legs, P.fur || '#37474f')));
    if(s < 0) out.legL = leg; else out.legR = leg;
  }
  return out;
}
