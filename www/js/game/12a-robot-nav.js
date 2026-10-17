// Burger Bar — 12a-robot-nav. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ROBOT NAVIGATION & COORDINATION
// ─────────────────────────────────────────────────────────────
// Robots used to steer in a straight line at their target and slide along
// whatever they hit, phasing through it after 1.5 s of no progress. They also
// all chose the FIRST station in the list that matched, so every chef queued
// at the same counter and every busser at the same table.
//
// This file gives them:
//   • a walkability grid of the store (walls with the door gap, every station
//     footprint), rebuilt only when the layout changes, and A* over it;
//   • nearest-station selection that skips a counter another robot is already
//     heading to (a "claim"), so they spread out instead of racing;
//   • a staging rule that leaves one counter free for the player.

const NAV_CELL = 1;          // grid resolution (world units)
const NAV_PAD = 0.45;        // robot clearance around stations and walls
let _nav = null;             // { sig, x0, z0, nx, nz, blocked:Uint8Array }

// A cheap fingerprint of everything that affects walkability. Edit Mode moves
// stations without any other notification, so this is compared per request.
function navSignature(){
  let s = bounds.l + ',' + bounds.r + ',' + bounds.t + ',' + bounds.b;
  for(const k in stations){
    const st = stations[k];
    if(st.type === 'robot') continue;
    s += '|' + st.id + ':' + st.x + ',' + st.z;
  }
  return s;
}

function navBlockedAt(x, z){
  // Walls: same segments the player collides with, door gap included.
  for(const e of collEdges){
    const half = 0.55/2 + NAV_PAD, ecx = (e.min + e.max)/2;
    if(e.axis === 'x'){
      if(Math.abs(z - e.fixed) < half && x > e.min - NAV_PAD && x < e.max + NAV_PAD){
        if(e.type === 'solid') return true;
        if(Math.abs(x - ecx) > 2.5 - NAV_PAD) return true;   // outside the doorway
      }
    } else {
      if(Math.abs(x - e.fixed) < half && z > e.min - NAV_PAD && z < e.max + NAV_PAD){
        if(e.type === 'solid') return true;
        if(Math.abs(z - ecx) > 2.5 - NAV_PAD) return true;
      }
    }
  }
  for(const k in stations){
    const s = stations[k];
    if(s.type === 'robot') continue;
    if(s.type === 'table'){
      if((x-s.x)**2 + (z-s.z)**2 < (s.r + NAV_PAD)**2) return true;
    } else if(Math.abs(x - s.x) < s.w/2 + NAV_PAD && Math.abs(z - s.z) < s.d/2 + NAV_PAD) return true;
  }
  return false;
}

function navGrid(){
  const sig = navSignature();
  if(_nav && _nav.sig === sig && _nav.edges === collEdges) return _nav;
  // Inside the room plus the yard out front (the dumpster lives there).
  const x0 = Math.floor(bounds.l - 4), x1 = Math.ceil(bounds.r + 4);
  const z0 = Math.floor(bounds.t - 1), z1 = Math.ceil(bounds.b + 26);
  const nx = Math.round((x1 - x0) / NAV_CELL) + 1, nz = Math.round((z1 - z0) / NAV_CELL) + 1;
  const blocked = new Uint8Array(nx * nz);
  for(let j = 0; j < nz; j++) for(let i = 0; i < nx; i++)
    blocked[j*nx + i] = navBlockedAt(x0 + i*NAV_CELL, z0 + j*NAV_CELL) ? 1 : 0;
  _nav = { sig, edges: collEdges, x0, z0, nx, nz, blocked };
  return _nav;
}

// Path from (sx,sz) to any free cell within `reach` of the target centre.
// Returns an array of {x,z} waypoints (excluding the start), or null.
function navPath(sx, sz, target, reach){
  const g = navGrid();
  const { x0, z0, nx, nz, blocked } = g;
  const ci = x => Math.max(0, Math.min(nx-1, Math.round((x - x0) / NAV_CELL)));
  const cj = z => Math.max(0, Math.min(nz-1, Math.round((z - z0) / NAV_CELL)));
  const start = cj(sz)*nx + ci(sx);
  const isGoal = idx => {
    const x = x0 + (idx % nx)*NAV_CELL, z = z0 + Math.floor(idx / nx)*NAV_CELL;
    return (x - target.x)**2 + (z - target.z)**2 <= reach*reach;
  };
  const h = idx => {
    const x = x0 + (idx % nx)*NAV_CELL, z = z0 + Math.floor(idx / nx)*NAV_CELL;
    return Math.max(0, Math.hypot(x - target.x, z - target.z) - reach);
  };
  // The start cell may sit inside a padded footprint (robots stop right at a
  // station's edge); let the search leave it.
  const gScore = new Float32Array(nx*nz).fill(Infinity);
  const came = new Int32Array(nx*nz).fill(-1);
  const closed = new Uint8Array(nx*nz);
  const heap = [];   // binary heap of [f, idx]
  const push = (f, i) => { heap.push([f, i]); let c = heap.length-1;
    while(c > 0){ const p = (c-1) >> 1; if(heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop();
    if(heap.length){ heap[0] = last; let c = 0;
      for(;;){ const l = 2*c+1, r = l+1; let m = c;
        if(l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if(r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if(m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } }
    return top; };
  gScore[start] = 0; push(h(start), start);
  let found = -1, expanded = 0;
  while(heap.length){
    const [, cur] = pop();
    if(closed[cur]) continue;
    closed[cur] = 1;
    if(isGoal(cur) && (!blocked[cur] || cur === start)){ found = cur; break; }
    if(++expanded > 12000) break;
    const ci0 = cur % nx, cj0 = Math.floor(cur / nx);
    for(let dj = -1; dj <= 1; dj++) for(let di = -1; di <= 1; di++){
      if(!di && !dj) continue;
      const ni = ci0 + di, nj = cj0 + dj;
      if(ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
      const n = nj*nx + ni;
      if(blocked[n] || closed[n]) continue;
      // No cutting corners past a blocked cell.
      if(di && dj && (blocked[cj0*nx + ni] || blocked[nj*nx + ci0])) continue;
      const ng = gScore[cur] + (di && dj ? 1.4142 : 1);
      if(ng < gScore[n]){ gScore[n] = ng; came[n] = cur; push(ng + h(n), n); }
    }
  }
  if(found < 0) return null;
  const cells = [];
  for(let c = found; c !== start && c >= 0; c = came[c]) cells.push(c);
  cells.reverse();
  // Drop collinear waypoints so robots walk straight lines between turns.
  const pts = cells.map(c => ({ x: x0 + (c % nx)*NAV_CELL, z: z0 + Math.floor(c / nx)*NAV_CELL }));
  const out = [];
  for(let i = 0; i < pts.length; i++){
    const a = out.length ? out[out.length-1] : { x: sx, z: sz }, b = pts[i], c = pts[i+1];
    if(c && Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.z - a.z) === Math.sign(c.z - b.z)
         && Math.abs((b.x-a.x)*(c.z-b.z) - (b.z-a.z)*(c.x-b.x)) < 1e-6) continue;
    out.push(b);
  }
  return out;
}

// ── Coordination ─────────────────────────────────────────────────────────────
// A station another robot is already walking to, where only one robot can do
// the job: a counter holds one item, and two bussers at one table fight over
// the same trays.
function claimedByOther(bot, s){
  for(const k in stations){
    const r = stations[k];
    if(r === bot || r.type !== 'robot' || r.target !== s) continue;
    if(s.type === 'counter') return true;
    if(s.type === 'table' && r.role === 'busser' && bot.role === 'busser' && (s.dirtyTrays||0) <= 1) return true;
  }
  return false;
}

// Nearest matching station, preferring ones no other robot has claimed.
function pickNear(bot, pred){
  let best = null, bestD = Infinity, fallback = null, fbD = Infinity;
  for(const k in stations){
    const s = stations[k];
    if(s.type === 'robot' || !pred(s)) continue;
    const d = (s.x - bot.pos.x)**2 + (s.z - bot.pos.z)**2;
    if(claimedByOther(bot, s)){ if(s.type !== 'counter' && d < fbD){ fbD = d; fallback = s; } continue; }
    if(d < bestD){ bestD = d; best = s; }
  }
  return best || fallback;
}

// An empty counter a robot may stage food on. Robots leave one counter free
// for the player once the bar has three or more, unless a robot has been
// stuck holding something for ~2 s (then any free counter beats freezing).
function stageCounter(bot){
  let free = 0, counters = 0;
  for(const k in stations){
    const s = stations[k];
    if(s.type !== 'counter') continue;
    counters++;
    if(!s.item && !claimedByOther(bot, s)) free++;
  }
  const reserve = counters >= 3 && !((bot._stuck || 0) > 120) ? 1 : 0;
  if(free <= reserve) return null;
  return pickNear(bot, s => s.type === 'counter' && !s.item);
}

// Burger patties still needed versus already on the way. Robot chefs only
// start a patty when this is positive, so the grill stops filling every
// counter with burgers nobody ordered.
function burgerDemand(){
  let want = 0, have = 0;
  const isBurger = o => o === 'burger_on_tray' || o === 'burger_soda_on_tray';
  for(const g of groups){
    if(g.state === 'eating' || g.state === 'leave') continue;
    want += (g.unservedOrders || []).filter(isBurger).length;
  }
  const carries = h => h === 'raw' || h === 'cooked' || h === 'burger_on_tray' || h === 'burger_soda_on_tray';
  for(const k in stations){
    const s = stations[k];
    if((s.type === 'grill') && s.slots) have += s.slots.filter(sl => sl && (sl.state === 'raw' || sl.state === 'cooked')).length;
    else if(s.type === 'counter' && carries(s.item)) have++;
    else if(s.type === 'robot' && carries(s.holding)) have++;
  }
  if(player && carries(player.holding)) have++;
  return want - have;
}
