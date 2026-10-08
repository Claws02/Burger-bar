// Burger Bar — 13-hud-input. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  FLOATING UI
// ─────────────────────────────────────────────────────────────
const floatUI=document.getElementById('floating-ui');
// Short text label for an order, for the accessibility tag under each bubble.
function orderTag(o){
  switch(o){
    case 'burger_on_tray':      return 'BURGER';
    case 'soda_on_tray':        return 'SODA';
    case 'burger_soda_on_tray': return 'COMBO';
    case 'fries_on_tray':       return 'FRIES';
    case 'taco_in_basket':      return 'TACO';
    case 'chowder_in_basket':   return 'CHOWDER';
    case 'lemonade_in_basket':  return 'LEMONADE';
    case 'taco_chowder_basket': return 'TACO+CHWD';
    case 'taco_lemonade_basket':return 'TACO+LMN';
    default: return '';
  }
}
// Reused scratch vectors: drawFloatUI runs every frame and used to allocate a
// Vector3 per bar/bubble, which on a full Day-20 bar was a steady GC drip.
const _scrV = new THREE.Vector3(), _scrW = new THREE.Vector3();
const _scrOut = {x:0, y:0, z:0};
function scr(v){
  const p=_scrV.copy(v).project(camera);
  _scrOut.x=(p.x*.5+.5)*window.innerWidth; _scrOut.y=(p.y*-.5+.5)*window.innerHeight; _scrOut.z=p.z;
  return _scrOut;
}
function scrXYZ(x,y,z){ return scr(_scrW.set(x,y,z)); }

// ── Pooled overlay nodes ─────────────────────────────────────────────────────
// The overlay used to be rebuilt as one innerHTML string every frame: on a busy
// bar that is ~60 element creations + a full style/layout pass per frame. Now
// each kind of marker keeps a pool of elements; a frame claims what it needs,
// writes only the values that changed, and hides the leftovers.
const _fui = {};
function fuiTake(kind, cls, inner){
  let p=_fui[kind]; if(!p) p=_fui[kind]={els:[], used:0};
  let el=p.els[p.used];
  if(!el){
    el=document.createElement('div');
    if(inner){ const f=document.createElement('div'); f.className=inner; el.appendChild(f); el._fill=f; }
    p.els.push(el);
  }
  if(el.parentNode!==floatUI) floatUI.appendChild(el);
  p.used++;
  if(el._hidden){ el.style.display=''; el._hidden=false; }
  if(el._cls!==cls){ el._cls=cls; el.className=cls; }
  return el;
}
function fuiPos(el,x,y){
  x=Math.round(x); y=Math.round(y);
  if(el._x!==x){ el._x=x; el.style.left=x+'px'; }
  if(el._y!==y){ el._y=y; el.style.top=y+'px'; }
}
function fuiHTML(el,h){ if(el._h!==h){ el._h=h; el.innerHTML=h; } }
function fuiStyle(el,k,v){ const kk='_s_'+k; if(el[kk]!==v){ el[kk]=v; el.style[k]=v; } }
function fuiBar(kind, x, y, width, pct, col){
  const el=fuiTake(kind,'fbar','fbar-fill'); fuiPos(el,x,y);
  if(width) fuiStyle(el,'width',width+'px');
  fuiStyle(el._fill,'width',Math.round(Math.max(0,Math.min(100,pct)))+'%');
  fuiStyle(el._fill,'background',col);
  return el;
}

function drawFloatUI(){
  for(const k in _fui) _fui[k].used=0;

  for(let i=floaters.length-1;i>=0;i--){
    const f = floaters[i];
    f.life -= ds * 0.02; f.pos.y += ds * 0.03;
    if(f.life <= 0) { floaters.splice(i,1); continue; }
    const p = scr(f.pos); if(p.z>=1) continue;
    const el=fuiTake('floater','floater'); fuiPos(el,p.x,p.y);
    fuiStyle(el,'color',f.color); fuiStyle(el,'opacity',String(Math.round(f.life*50)/50));
    fuiHTML(el,f.text);
  }

  if (gameState === 'edit') {
      const t = getClosest();
      if (t && t.type === 'robot') {
          const p = scrXYZ(t.pos.x, 3.8, t.pos.z);
          if (p.z < 1) {
              const el=fuiTake('robotlv','fbubble robot-lv'); fuiPos(el,p.x,p.y-18);
              fuiHTML(el,`Lv.${getRobotLevel(t)} ${t.role.toUpperCase()}`);
          }
      }
  }

  if(gameState==='playing'){
    let stinkPenalty = false;
    for(const k in stations){
      const s=stations[k];
      if(s.type==='grill' || s.type==='beachgrill' || s.type==='fryer') {
        s.slots.forEach((sl,i)=>{ if(!sl) return;
          const p=scrXYZ(s.x-0.6+i*1.2,5,s.z); if(p.z>=1) return;
          const isCooked = sl.state==='cooked'||sl.state==='cooked_fish'||sl.state==='fries';
          const isBurnt = sl.state==='charred'||sl.state==='charred_fish'||sl.state==='burnt_fries';
          if(isBurnt) return;
          const col = isCooked ? '#FF9800' : '#4CAF50';
          const pct = isCooked ? ((sl.burnTimer||0)/300*100) : (sl.progress/200*100);
          fuiBar('cook', p.x, p.y, 0, pct, col);
        });
      }
      if(s.type==='trash' && s.contents >= 4) {
        stinkPenalty = true;
        const p=scrXYZ(s.x, 3.5, s.z); if(p.z<1) {
          const el=fuiTake('stink','stink'); fuiPos(el,p.x,p.y); fuiHTML(el,'♨️');
        }
      }
    }
    window._currentStinkPenalty = stinkPenalty;

    for(const g of groups){
      if(g.state!=='queue') continue;
      const p=scrXYZ(g.pos.x, 3.8, g.pos.z); if(p.z>=1) continue;
      const qb=fuiTake('qbubble','fbubble small'); fuiPos(qb,p.x,p.y-18);
      fuiHTML(qb, g.type === 'vip' ? '💢' : '⏳');
      fuiBar('qbar', p.x, p.y, 38, g.waitPatience/g.maxWait*100, '#03A9F4');
    }

    for(const k in stations){ const t=stations[k]; if(t.type!=='table'||!t.group||t.group.state!=='ordering') continue;
      // `continue`, NOT `return`: one table behind the camera must not abandon
      // the rest of the overlay.
      const p=scrXYZ(t.x,4.8,t.z); if(p.z>=1) continue;
      const px=p.x, py=p.y;

      const pct=Math.max(0,t.group.foodPatience/t.group.maxFood);
      const col=pct>.5?'#4CAF50':pct>.25?'#FFEB3B':'#F44336';
      const bar=fuiBar('tbar', px, py, 76, pct*100, col);
      // About-to-walk-out pulse: the bar itself flashes under 25%.
      const urgent = pct<=.25 ? 'fbar urgent' : 'fbar';
      if(bar._cls!==urgent){ bar._cls=urgent; bar.className=urgent; }
      // Colorblind aid: a mood face encodes patience independently of colour.
      if(settings.colorblind){
        const el=fuiTake('face','face'); fuiPos(el,px,py-13);
        fuiHTML(el, pct>.5?'🙂':pct>.25?'😐':'😡');
      }

      // Individual order bubbles above each customer's head.
      t.group.mesh.children.forEach((c, i) => {
         c.getWorldPosition(_scrW);
         _scrW.y += 2.8;
         const cp = scr(_scrW);
         if(cp.z >= 1) return;
         const seatServed = t.group.servedMask ? t.group.servedMask[i] : (i < t.served);
         // Order-matching cue: while carrying a plate, the seat that ordered it
         // pulses green and every other seat dims.
         let cls = 'fbubble';
         if(!seatServed && player.holding){
           cls += (t.group.orders[i] === player.holding) ? ' match' : ' dim';
         }
         let icon;
         if (seatServed) icon = '✔️';
         else {
           const order = t.group.orders[i];
           if(isSeafood()){
             icon = order==='chowder_in_basket'?'🍲':order==='lemonade_in_basket'?'🍋':
                    order==='taco_chowder_basket'?'🌮🍲':order==='taco_lemonade_basket'?'🌮🍋':'🌮';
           } else {
             icon = order==='burger_soda_on_tray'?'🍔🥤':order==='soda_on_tray'?'🥤':order==='fries_on_tray'?'🍟':'🍔';
           }
         }
         const tag = (settings.ordertags && !seatServed) ? `<span class="otag">${orderTag(t.group.orders[i])}</span>` : '';
         const el=fuiTake('order', cls); fuiPos(el,cp.x,cp.y);
         fuiHTML(el, icon+tag);
      });
    }
  }

  for(const k in _fui){ const p=_fui[k];
    for(let i=p.used;i<p.els.length;i++){ const el=p.els[i]; if(!el._hidden){ el.style.display='none'; el._hidden=true; } } }
}

// ─────────────────────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────────────────────
let joyVec={x:0,z:0}, keys={w:0,a:0,s:0,d:0}, actPressed=false;

window.addEventListener('keydown',e=>{
  if(e.key==='w'||e.key==='ArrowUp')    keys.w=1;
  if(e.key==='s'||e.key==='ArrowDown')  keys.s=1;
  if(e.key==='a'||e.key==='ArrowLeft')  keys.a=1;
  if(e.key==='d'||e.key==='ArrowRight') keys.d=1;
  if(e.key===' '&&!actPressed){ actPressed=true; handleAction(); }
});
window.addEventListener('keyup',e=>{
  if(e.key==='w'||e.key==='ArrowUp')    keys.w=0;
  if(e.key==='s'||e.key==='ArrowDown')  keys.s=0;
  if(e.key==='a'||e.key==='ArrowLeft')  keys.a=0;
  if(e.key==='d'||e.key==='ArrowRight') keys.d=0;
  if(e.key===' '){ actPressed=false; cancelSinkHold(); }
});

const jZone=document.getElementById('joystick-zone');
const jKnob=document.getElementById('joystick-knob');
const actionBtn=document.getElementById('action-btn');
const touchOv=document.getElementById('touch-overlay');
let joyId=null, joyCen={x:0,y:0}, actId=null;
const maxJoy=50;

function showJoy(x,y){ jZone.style.left=x+'px'; jZone.style.top=y+'px'; jZone.classList.add('active'); jKnob.style.transform='translate(-50%,-50%)'; }
function hideJoy(){ jZone.classList.remove('active'); joyVec={x:0,z:0}; jKnob.style.transform='translate(-50%,-50%)'; }
const actPos={x:0,y:0};
function showAct(x,y){ actPos.x=x; actPos.y=y; actionBtn.style.left=x+'px'; actionBtn.style.top=y+'px'; actionBtn.classList.add('active'); }
function hideAct(){ actionBtn.classList.remove('active','pressed'); }

function updateJoy(tx,ty){
  let dx=tx-joyCen.x, dy=ty-joyCen.y;
  const d=Math.sqrt(dx*dx+dy*dy);
  if(d>maxJoy){ dx=dx/d*maxJoy; dy=dy/d*maxJoy; }
  jKnob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyVec.x=dx/maxJoy; joyVec.z=dy/maxJoy;
}

touchOv.addEventListener('pointerdown',e=>{
  e.preventDefault(); touchOv.setPointerCapture(e.pointerId);
  const hint=document.getElementById('touch-hint'); if(hint) hint.style.opacity='0';
  if(e.clientX < window.innerWidth/2){
    if(joyId===null){ joyId=e.pointerId; joyCen={x:e.clientX,y:e.clientY}; showJoy(e.clientX,e.clientY); }
  } else {
    if(actId===null){ actId=e.pointerId; showAct(e.clientX,e.clientY); actionBtn.classList.add('pressed'); handleAction(); }
  }
});
touchOv.addEventListener('pointermove',e=>{ e.preventDefault(); if(e.pointerId===joyId) updateJoy(e.clientX,e.clientY); });
touchOv.addEventListener('pointerup',e=>{ if(e.pointerId===joyId){joyId=null;hideJoy();} if(e.pointerId===actId){actId=null;hideAct();cancelSinkHold();} });
touchOv.addEventListener('pointercancel',e=>{ if(e.pointerId===joyId){joyId=null;hideJoy();} if(e.pointerId===actId){actId=null;hideAct();cancelSinkHold();} });

