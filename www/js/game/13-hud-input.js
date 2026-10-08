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
function scr(v){
  const p=v.clone().project(camera);
  return {x:(p.x*.5+.5)*window.innerWidth, y:(p.y*-.5+.5)*window.innerHeight, z:p.z};
}

function drawFloatUI(){
  let html='';
  
  for(let i=floaters.length-1;i>=0;i--){
    const f = floaters[i];
    f.life -= ds * 0.02; f.pos.y += ds * 0.03;
    if(f.life <= 0) { floaters.splice(i,1); continue; }
    const p = scr(f.pos); if(p.z>=1) continue;
    html+=`<div style="position:absolute;left:${p.x}px;top:${p.y}px;color:${f.color};font-weight:900;font-size:20px;text-shadow:0 2px 4px rgba(0,0,0,0.8);opacity:${f.life};transform:translate(-50%,-50%);pointer-events:none;">${f.text}</div>`;
  }

  if (gameState === 'edit') {
      const t = getClosest();
      if (t && t.type === 'robot') {
          const p = scr(new THREE.Vector3(t.pos.x, 3.8, t.pos.z));
          if (p.z < 1) {
              let lvl = getRobotLevel(t);
              html+=`<div class="fbubble" style="left:${p.x}px;top:${p.y-18}px;font-size:14px;color:#03A9F4;">Lv.${lvl} ${t.role.toUpperCase()}</div>`;
          }
      }
  }

  if(gameState!=='playing'){ floatUI.innerHTML=html; return; }

  let stinkPenalty = false;
  for(const k in stations){ 
    const s=stations[k]; 
    if(s.type==='grill' || s.type==='beachgrill' || s.type==='fryer') {
      s.slots.forEach((sl,i)=>{ if(!sl) return;
        const p=scr(new THREE.Vector3(s.x-0.6+i*1.2,5,s.z)); if(p.z>=1) return;
        const isCooked = sl.state==='cooked'||sl.state==='cooked_fish'||sl.state==='fries';
        let col = isCooked ? '#FF9800' : '#4CAF50';
        let pct = isCooked ? ((sl.burnTimer||0)/300*100) : (sl.progress/200*100);
        html+=`<div class="fbar" style="left:${p.x}px;top:${p.y}px"><div class="fbar-fill" style="width:${pct}%;background:${col}"></div></div>`;
      });
    }
    if(s.type==='trash' && s.contents >= 4) {
      stinkPenalty = true;
      const p=scr(new THREE.Vector3(s.x, 3.5, s.z)); if(p.z<1) {
        html+=`<div style="position:absolute;left:${p.x}px;top:${p.y}px;color:#8bc34a;font-size:30px;transform:translate(-50%,-50%);pointer-events:none;">♨️</div>`;
      }
    }
  }
  window._currentStinkPenalty = stinkPenalty;

  
  groups.forEach(g=>{ 
    if(g.state==='queue') {
      const p=scr(new THREE.Vector3(g.pos.x, 3.8, g.pos.z)); if(p.z>=1) return;
      let icon = g.type === 'vip' ? '💢' : '⏳';
      html+=`<div class="fbubble" style="left:${p.x}px;top:${p.y-18}px;padding:2px 6px;font-size:12px;">${icon}</div>`;
      html+=`<div class="fbar" style="left:${p.x}px;top:${p.y}px;width:38px"><div class="fbar-fill" style="width:${Math.max(0,g.waitPatience/g.maxWait*100)}%;background:#03A9F4"></div></div>`;
    }
  });
  
  for(const k in stations){ const t=stations[k]; if(t.type!=='table'||!t.group||t.group.state!=='ordering') continue;
    // `continue`, NOT `return`: this is a plain for..in, so returning here used
    // to abandon every remaining table AND skip the innerHTML write at the end,
    // freezing the entire overlay whenever one table sat behind the camera.
    const p=scr(new THREE.Vector3(t.x,4.8,t.z)); if(p.z>=1) continue;
    
    // Draw patience bar over the center of the table
    const pct=Math.max(0,t.group.foodPatience/t.group.maxFood);
    const col=pct>.5?'#4CAF50':pct>.25?'#FFEB3B':'#F44336';
    html+=`<div class="fbar" style="left:${p.x}px;top:${p.y}px;width:76px"><div class="fbar-fill" style="width:${pct*100}%;background:${col}"></div></div>`;
    // Colorblind aid: a mood face encodes patience independently of colour.
    if(settings.colorblind){
      const face = pct>.5?'🙂':pct>.25?'😐':'😡';
      html+=`<div style="position:absolute;left:${p.x}px;top:${p.y-13}px;transform:translate(-50%,-50%);font-size:13px;pointer-events:none;">${face}</div>`;
    }

    // Draw individual order bubbles above each customer's head
    t.group.mesh.children.forEach((c, i) => {
       const worldPos = new THREE.Vector3();
       c.getWorldPosition(worldPos);
       worldPos.y += 2.8; 
       const cp = scr(worldPos);
       if(cp.z < 1) {
          let icon = '';
          const seatServed = t.group.servedMask ? t.group.servedMask[i] : (i < t.served);
          // Order-matching cue. While carrying a plate, the seat that ordered it
          // pulses green and every other seat dims -- the single rule the whole
          // game turns on, and it used to be taught nowhere.
          let cls = '';
          if(!seatServed && player.holding){
            cls = (t.group.orders[i] === player.holding) ? ' match' : ' dim';
          }
          if (seatServed) {
              icon = '✔️';
          } else {
              const order = t.group.orders[i];
              if(isSeafood()){
                if(order==='taco_in_basket') icon='🌮';
                else if(order==='chowder_in_basket') icon='🍲';
                else if(order==='lemonade_in_basket') icon='🍋';
                else if(order==='taco_chowder_basket') icon='🌮🍲';
                else if(order==='taco_lemonade_basket') icon='🌮🍋';
                else icon='🌮';
              } else {
                if (order === 'burger_soda_on_tray') icon = '🍔🥤';
                else if (order === 'soda_on_tray') icon = '🥤';
                else if (order === 'fries_on_tray') icon = '🍟';
                else icon = '🍔';
              }
          }
          // Emoji-only orders are unreadable for some players; the tag is a
          // short text label under the icon, toggled in Settings.
          const tag = (settings.ordertags && !seatServed) ? `<span class="otag">${orderTag(t.group.orders[i])}</span>` : '';
          html+=`<div class="fbubble${cls}" style="left:${cp.x}px;top:${cp.y}px;padding:2px 6px;font-size:14px;">${icon}${tag}</div>`;
       }
    });
  }
  floatUI.innerHTML=html;
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
function showAct(x,y){ actionBtn.style.left=x+'px'; actionBtn.style.top=y+'px'; actionBtn.classList.add('active'); }
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

