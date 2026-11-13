// Burger Bar — 06a-layout. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  STORE LAYOUT: kitchen at the back, dining at the front
// ─────────────────────────────────────────────────────────────
// A fully upgraded store used to fall apart: expansions pushed the back wall
// away from the starter kitchen (stranding it mid-floor), and every new item
// was packed from the back wall forward, so 18 tables sat 85 units from the
// door behind a sea of empty floor.
//
// Now:
//   • kitchen equipment is placed from the back wall forward, tables from the
//     front door back (layoutSpot), so the dining room fills toward the door;
//   • when an expansion moves the back wall, the kitchen moves with it;
//   • Auto-arrange (Edit Mode) lays a whole store out cleanly: the kitchen line
//     along the back wall, a pass of counters in front of it, a grid of tables
//     between the pass and the door, and a clear aisle from the door.

const KITCHEN_TYPES = ['fridge', 'grill', 'fryer', 'sink', 'trayrack', 'sodafountain'];
const KITCHEN_BAND = 14;     // how far in front of the back wall counts as "the kitchen"

function moveStation(s, x, z){ s.x = x; s.z = z; if(s.mesh) s.mesh.position.set(x, 0, z); }

// An expansion moved the back wall by dz (negative = further back): keep the
// kitchen against it.
function followBackWall(dz){
  if(!dz) return;
  const oldBack = baseBounds.t - dz;
  for(const k in stations){
    const s = stations[k];
    if(s.type === 'robot' || s.type === 'dumpster' || s.type === 'table') continue;
    if(s.z < oldBack + KITCHEN_BAND) moveStation(s, s.x, s.z + dz);
  }
  for(const k in stations){ const r = stations[k]; if(r.type === 'robot' && r.pos.z < oldBack + KITCHEN_BAND){ r.pos.z += dz; r.mesh.position.z = r.pos.z; } }
  markStationsDirty();
}

// Lay the whole store out. Returns true if everything found a place.
function autoArrangeStore(){
  const b = bounds, door = (baseBounds.l + baseBounds.r) / 2;
  const all = Object.values(stations).filter(s => s.type !== 'robot' && s.type !== 'dumpster');
  const byId = (a, c) => (parseInt(String(a.id).replace(/\D/g, '')) || 0) - (parseInt(String(c.id).replace(/\D/g, '')) || 0);
  const kitchen = all.filter(s => KITCHEN_TYPES.includes(s.type))
    .sort((a, c) => KITCHEN_TYPES.indexOf(a.type) - KITCHEN_TYPES.indexOf(c.type) || byId(a, c));
  const counters = all.filter(s => s.type === 'counter').sort(byId);
  const tables = all.filter(s => s.type === 'table').sort(byId);
  const bins = all.filter(s => s.type === 'trash');
  const left = b.l + 1.2, right = b.r - 1.2;

  // Park everything out of the way first so the packing below can't collide
  // with an item's old position.
  all.forEach((s, i) => moveStation(s, 1000 + i * 10, 1000));

  // 1. Kitchen line(s) along the back wall, with a walkway between rows.
  let x = left, z = b.t + 0.8, rowD = 0;
  for(const s of kitchen){
    if(x + s.w > right){ z += rowD + 2.8; x = left; rowD = 0; }
    moveStation(s, x + s.w / 2, z + s.d / 2);
    x += s.w + 1.3; rowD = Math.max(rowD, s.d);
  }
  // 2. The pass: rows of counters in front of the kitchen, centred.
  let passZ = z + rowD + 2.9;
  const perRow = Math.max(1, Math.floor((right - left + 0.8) / 2.7));
  for(let i = 0; i < counters.length; i += perRow){
    const row = counters.slice(i, i + perRow);
    const span = (row.length - 1) * 2.7;
    row.forEach((s, j) => moveStation(s, door - span / 2 + j * 2.7, passZ + 0.9));
    if(i + perRow < counters.length) passZ += 4.4;
  }
  const diningTop = passZ + (counters.length ? 1.8 : 0) + 2.6;
  // 3. Bins in the front corners, then tables: a grid from the door back,
  // columns mirrored either side of a clear aisle in line with the door.
  const binSpots = bins.map((s, i) => ({ x: i % 2 ? b.r - 1.6 - Math.floor(i / 2) * 2.4 : b.l + 1.6 + Math.floor(i / 2) * 2.4, z: b.b - 1.6 }));
  bins.forEach((s, i) => moveStation(s, binSpots[i].x, binSpots[i].z));
  const cols = [];
  for(let off = 6; door - off >= b.l + 3.2 || door + off <= b.r - 3.2; off += 6.6)
    for(const xx of [door - off, door + off]) if(xx >= b.l + 3.2 && xx <= b.r - 3.2) cols.push(xx);
  // Spread the rows over the whole dining room instead of bunching them at
  // the door (6.6 apart at the tightest, 12 at the loosest).
  const front = b.b - 4.2, back = diningTop + 2.5;
  const rows = Math.max(1, Math.ceil((tables.length + bins.length) / Math.max(1, cols.length)));
  const step = rows > 1 ? Math.min(12, Math.max(6.6, (front - back) / (rows - 1))) : 6.6;
  const spots = [];
  for(let zz = front; zz >= back - 1e-6; zz -= step)
    for(const xx of cols)
      if(!binSpots.some(p => Math.abs(p.x - xx) < 4.4 && Math.abs(p.z - zz) < 4.4)) spots.push({ x: xx, z: zz });
  spots.sort((p, q) => (q.z - p.z) || (Math.abs(p.x - door) - Math.abs(q.x - door)));
  const leftovers = [];
  tables.forEach((t, i) => { const p = spots[i]; if(p) moveStation(t, p.x, p.z); else leftovers.push(t); });
  // Anything that didn't fit the plan: first free spot.
  let ok = true;
  for(const s of leftovers){
    const p = layoutSpot(s.type, s.w, s.d);
    if(p) moveStation(s, p.x, p.z); else ok = false;
  }
  for(const s of all) if(s.x > 500){ const p = layoutSpot(s.type, s.w, s.d); if(p) moveStation(s, p.x, p.z); else ok = false; }
  // Robots standing inside the new layout step out of the way.
  for(const k in stations){
    const r = stations[k];
    if(r.type !== 'robot' || !navBlockedAt(r.pos.x, r.pos.z)) continue;
    const p = freeSpot(1.5, 1.5) || getValidSpawn();
    r.pos.x = p.x; r.pos.z = p.z; r.mesh.position.set(p.x, 0, p.z); r.target = null; r.job = null; r.state = 'idle';
  }
  markStationsDirty();
  if(typeof updateStationVisuals === 'function') updateStationVisuals(true);
  return ok;
}

// True if some station sits outside the walls (e.g. an old save whose store
// was deeper before floors 7-10 started widening it instead).
function layoutOutOfBounds(){
  const b = bounds;
  for(const k in stations){
    const s = stations[k];
    if(s.type === 'robot' || s.type === 'dumpster') continue;
    if(s.x - s.w / 2 < b.l || s.x + s.w / 2 > b.r || s.z - s.d / 2 < b.t || s.z + s.d / 2 > b.b) return true;
  }
  return false;
}

function editAutoArrange(){
  if(gameState !== 'edit') return;
  autoArrangeStore();
  saveGame();
  playSound('coin');
  showToast('✨ Store rearranged: kitchen at the back, tables by the door', 2400);
}
window.editAutoArrange = editAutoArrange;
