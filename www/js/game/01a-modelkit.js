// Burger Bar — 01a-modelkit. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  MODEL KIT — shapes, textures and batching for the procedural models
// ─────────────────────────────────────────────────────────────
// Everything in the bar is built from code, not imported assets: the app stays
// tiny and loads offline. This kit is what makes those models look finished:
//
//   GRBox()      rounded (bevelled) boxes, so nothing reads as a raw cube
//   MP()/ME()    glossy metal and glowing materials alongside matte M()
//   tex*()       canvas-drawn textures (wood, tile, grass, asphalt, signage)
//   bake()       collapses a multi-part model into ONE mesh per material and
//                caches the result, so a 30-part grill costs ~4 draw calls and
//                every grill after the first costs no new geometry at all.
//
// Colour: the renderer outputs sRGB with ACES tone mapping. Hex colours are
// authored in sRGB, so every material factory converts them to linear first;
// use lin() for any other colour that reaches a shader (fog, light colours).

function lin(c){ return new THREE.Color(c).convertSRGBToLinear(); }

// Glossy material for steel, chrome, glass and plastic highlights.
function MP(c, shininess, opacity){
  const key = 'P|' + c + '|' + (shininess||60) + '|' + (opacity===undefined?'':opacity);
  let m = _matCache.get(key);
  if(!m){
    m = new THREE.MeshPhongMaterial({ color: lin(c), shininess: shininess || 60, specular: lin('#ffffff').multiplyScalar(.35) });
    if(opacity !== undefined){ m.transparent = true; m.opacity = opacity; }
    m._shared = true; _matCache.set(key, m);
  }
  return m;
}
// Self-lit material (heating elements, screens, neon). Unaffected by light or fog.
function ME(c){
  const key = 'E|' + c;
  let m = _matCache.get(key);
  if(!m){ m = new THREE.MeshBasicMaterial({ color: lin(c), fog: false }); m._shared = true; _matCache.set(key, m); }
  return m;
}
// Textured matte material. `draw(ctx, size)` paints a square canvas once.
function MT(key, draw, size, tint){
  const k = 'T|' + key + '|' + (tint||'');
  let m = _matCache.get(k);
  if(!m){
    m = new THREE.MeshLambertMaterial({ map: canvasTex(key, draw, size), color: tint ? lin(tint) : 0xffffff });
    m._shared = true; _matCache.set(k, m);
  }
  return m;
}
const _texCache = new Map();
function canvasTex(key, draw, size, height){
  let t = _texCache.get(key);
  if(t) return t;
  size = size || 256;
  const c = document.createElement('canvas'); c.width = size; c.height = height || size;
  const ctx = c.getContext && c.getContext('2d');
  if(ctx && ctx.fillRect) draw(ctx, size, height || size);
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  t._shared = true;
  _texCache.set(key, t);
  return t;
}
// Deterministic noise so textures look the same every launch.
function _rng(seed){ let s = seed >>> 0 || 1; return ()=>{ s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

// ── Texture painters ─────────────────────────────────────────────────────────
const TEX = {
  wood(ctx, n){       // warm diner floor planks, 4 per tile
    const r = _rng(7), pw = n / 4;
    for(let i=0;i<4;i++){
      const base = [ '#d6a468', '#c99659', '#dcae74', '#cf9d61' ][i];
      ctx.fillStyle = base; ctx.fillRect(i*pw, 0, pw, n);
      for(let k=0;k<26;k++){       // grain
        ctx.strokeStyle = `rgba(110,70,30,${.05+r()*.08})`; ctx.lineWidth = 1+r()*1.5;
        const x = i*pw + r()*pw; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x+4, n*.3, x-4, n*.6, x+2, n); ctx.stroke();
      }
      const cut = r()*n;           // board end joint
      ctx.fillStyle = 'rgba(90,55,25,.55)'; ctx.fillRect(i*pw, cut, pw, 2);
      ctx.fillStyle = 'rgba(80,50,20,.6)'; ctx.fillRect(i*pw, 0, 2, n);
    }
  },
  checker(ctx, n){    // classic black & white diner tile, 2x2 per tile
    const h = n/2;
    ctx.fillStyle = '#ece4d3'; ctx.fillRect(0,0,n,n);
    ctx.fillStyle = '#5c6670'; ctx.fillRect(0,0,h,h); ctx.fillRect(h,h,h,h);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 3; ctx.strokeRect(0,0,h,h); ctx.strokeRect(h,0,h,h); ctx.strokeRect(0,h,h,h); ctx.strokeRect(h,h,h,h);
  },
  subway(ctx, n){     // white kitchen wall tile
    ctx.fillStyle = '#c9d3d6'; ctx.fillRect(0,0,n,n);
    const rh = n/8, rw = n/4;
    for(let y=0;y<8;y++) for(let x=-1;x<5;x++){
      const ox = (y%2) ? rw/2 : 0;
      ctx.fillStyle = y%3 ? '#f7fafa' : '#eef3f4';
      ctx.fillRect(x*rw+ox+2, y*rh+2, rw-4, rh-4);
    }
  },
  grass(ctx, n){
    const r = _rng(11);
    ctx.fillStyle = '#5aa83c'; ctx.fillRect(0,0,n,n);
    for(let i=0;i<900;i++){
      ctx.fillStyle = r() < .5 ? `rgba(40,110,30,${.12+r()*.15})` : `rgba(160,220,90,${.1+r()*.15})`;
      ctx.fillRect(r()*n, r()*n, 2+r()*3, 2+r()*3);
    }
  },
  pavers(ctx, n){
    ctx.fillStyle = '#9aa3a6'; ctx.fillRect(0,0,n,n);
    const q = n/4;
    for(let y=0;y<4;y++) for(let x=0;x<4;x++){
      ctx.fillStyle = (x+y)%2 ? '#c4c9cb' : '#bcc2c4';
      ctx.fillRect(x*q+2, y*q+2, q-4, q-4);
    }
  },
  asphalt(ctx, n){
    const r = _rng(3);
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(0,0,n,n);
    for(let i=0;i<1400;i++){ ctx.fillStyle = `rgba(${r()<.5?0:255},${r()<.5?0:255},${r()<.5?0:255},.05)`; ctx.fillRect(r()*n, r()*n, 2, 2); }
  },
  gingham(ctx, n){    // red & white diner tray paper
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0,0,n,n);
    const q = n/8;
    ctx.fillStyle = 'rgba(211,47,47,.45)';
    for(let i=0;i<8;i+=2){ ctx.fillRect(i*q,0,q,n); ctx.fillRect(0,i*q,n,q); }
  },
  dinerwall(ctx, n){  // cream upper wall, red lower band with a chrome stripe
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(0,0,n,n);
    ctx.fillStyle = '#d63a2f'; ctx.fillRect(0, n*.62, n, n*.38);
    ctx.fillStyle = '#e9eef0'; ctx.fillRect(0, n*.58, n, n*.05);
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, n*.63, n, 3);
  },
};

// A flat ground plane (XZ) with UVs in world units/tile, so one shared
// texture tiles correctly at any size.
function GPlane(w, d, tile){
  return cachedGeo('pl|'+w+'|'+d+'|'+tile, ()=>{
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI/2);
    const uv = g.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*w/tile, uv.getY(i)*d/tile);
    return g;
  });
}
// A vertical wall slab whose front/back faces tile the texture in world units.
function GWall(w, h, d, tile){
  return cachedGeo('wl|'+w+'|'+h+'|'+d+'|'+tile, ()=>{
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, nrm = g.attributes.normal;
    for(let i=0;i<uv.count;i++){
      const nx = Math.abs(nrm.getX(i)), nz = Math.abs(nrm.getZ(i));
      const span = nz > .5 ? w : nx > .5 ? d : Math.max(w,d);
      uv.setXY(i, uv.getX(i)*span/tile, uv.getY(i)*h/h);
    }
    return g;
  });
}

// ── Rounded box ──────────────────────────────────────────────────────────────
// Same construction as three's RoundedBoxGeometry: an odd-segmented box whose
// vertices are pushed onto a radius around an inner box.
function GRBox(w, h, d, r, s){
  r = r === undefined ? 0.12 : r; s = s || 2;
  return cachedGeo('rb|'+w+'|'+h+'|'+d+'|'+r+'|'+s, ()=>{
    const seg = s*2 + 1;
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
    const rr = Math.max(0.001, Math.min(r, w/2-.001, h/2-.001, d/2-.001));
    const half = .5/seg, bx = w/2-rr, by = h/2-rr, bz = d/2-rr;
    const pos = g.attributes.position, nor = g.attributes.normal;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos, i);
      n.copy(v);
      n.x -= Math.sign(n.x)*half; n.y -= Math.sign(n.y)*half; n.z -= Math.sign(n.z)*half;
      n.normalize();
      pos.setXYZ(i, bx*Math.sign(v.x)+n.x*rr, by*Math.sign(v.y)+n.y*rr, bz*Math.sign(v.z)+n.z*rr);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  });
}
// Low-poly faceted blob (foliage, bushes): detail-0 icosahedron = flat normals.
const GIco = (r, detail)=>cachedGeo('ico|'+r+'|'+(detail||0), ()=>new THREE.IcosahedronGeometry(r, detail||0));
// Torus (rims, handles, steering wheels).
const GTor = (r, t, rs, ts, arc)=>cachedGeo('tor|'+r+'|'+t+'|'+(rs||8)+'|'+(ts||16)+'|'+(arc||0), ()=>new THREE.TorusGeometry(r, t, rs||8, ts||16, arc||Math.PI*2));
// Capsule-ish limb: a cylinder with hemispherical caps, built once per size.
function GCap(r, len, s){
  s = s || 8;
  return cachedGeo('cap|'+r+'|'+len+'|'+s, ()=>{
    const pts = [];
    for(let i=0;i<=s/2;i++){ const a = -Math.PI/2 + i/(s/2)*Math.PI/2; pts.push(new THREE.Vector2(Math.cos(a)*r, Math.sin(a)*r - len/2)); }
    for(let i=0;i<=s/2;i++){ const a = i/(s/2)*Math.PI/2; pts.push(new THREE.Vector2(Math.cos(a)*r, Math.sin(a)*r + len/2)); }
    return new THREE.LatheGeometry(pts, s+4);
  });
}

// ── Baking ───────────────────────────────────────────────────────────────────
// Merge every mesh in `src` into one BufferGeometry per material. Returns
// [{geo, mat, cast}], geometries tagged _shared (owned by the cache).
function _mergeByMaterial(src){
  src.updateMatrixWorld(true);
  return _mergeRoots([src], new THREE.Matrix4().copy(src.matrixWorld).invert());
}
// Merge the meshes under several roots, expressed in the space `inv` maps to.
function _mergeRoots(roots, inv){
  const byMat = new Map(), m4 = new THREE.Matrix4();
  for(const root of roots) root.traverse(o=>{
    if(!o.isMesh || !o.visible) return;
    let e = byMat.get(o.material);
    if(!e){ e = { geos: [], cast: false }; byMat.set(o.material, e); }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    e.geos.push(g); e.cast = e.cast || o.castShadow;
  });
  const parts = [];
  for(const [mat, e] of byMat){
    let n = 0; for(const g of e.geos) n += g.attributes.position.count;
    const pos = new Float32Array(n*3), nor = new Float32Array(n*3);
    const hasUV = e.geos.every(g=>g.attributes.uv);
    const uv = hasUV ? new Float32Array(n*2) : null;
    let o = 0;
    for(const g of e.geos){
      pos.set(g.attributes.position.array, o*3);
      if(g.attributes.normal) nor.set(g.attributes.normal.array, o*3);
      if(uv) uv.set(g.attributes.uv.array, o*2);
      o += g.attributes.position.count; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if(uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    geo._shared = true;
    parts.push({ geo, mat, cast: e.cast });
  }
  return parts;
}
function _partsToGroup(parts){
  const grp = new THREE.Group();
  for(const p of parts){
    const m = new THREE.Mesh(p.geo, p.mat);
    m.castShadow = p.cast; m.receiveShadow = true;
    grp.add(m);
  }
  return grp;
}
// Cached bake: build(): THREE.Group runs once per key; later calls clone meshes
// that share the merged geometry. Keys must capture everything build() reads.
const _bakeCache = new Map();
function bake(key, build){
  let parts = _bakeCache.get(key);
  if(!parts){
    const src = build();
    parts = _mergeByMaterial(src);
    disposeObj(src);
    _bakeCache.set(key, parts);
  }
  return _partsToGroup(parts);
}
// One-off bake of a group's static children in place (world/room scenery that
// is rebuilt when the floor plan changes). Children listed in `keep` survive.
function bakeInPlace(grp, keep){
  const tmp = new THREE.Group();
  for(const c of [...grp.children]){ if(keep && keep.includes(c)) continue; grp.remove(c); tmp.add(c); }
  const parts = _mergeByMaterial(tmp);
  disposeObj(tmp);
  for(const p of parts){
    p.geo._shared = false;   // owned by this group; freed on the next rebuild
    const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = p.cast; m.receiveShadow = true;
    grp.add(m);
  }
}
// Canvas texture with text (signage). Cached by text+style.
function signTex(text, opts){
  opts = opts || {};
  const key = 'sign|' + text + '|' + JSON.stringify(opts);
  return canvasTex(key, (ctx, w, h)=>{
    ctx.fillStyle = opts.bg || '#c62828'; ctx.fillRect(0,0,w,h);
    if(opts.stripe){ ctx.fillStyle = opts.stripe; ctx.fillRect(0, h*.78, w, h*.08); ctx.fillRect(0, h*.14, w, h*.08); }
    ctx.fillStyle = opts.fg || '#fff8e1';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(h*(opts.size||.36))}px Nunito, "Arial Black", sans-serif`;
    if(opts.glow){ ctx.shadowColor = opts.glow; ctx.shadowBlur = h*.06; }
    ctx.fillText(text, w/2, h*.52, w*.92);
  }, opts.w || 1024, opts.h || 256);
}
