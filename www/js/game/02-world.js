// Burger Bar — 02-world. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  BUILD WORLD
// ─────────────────────────────────────────────────────────────
function buildWorld(){
  while(worldGrp.children.length) discard(worldGrp, worldGrp.children[0]);
  const b = bounds;
  const rW = b.r-b.l, rD = b.b-b.t;
  const cx = (b.r+b.l)/2, cz = (b.b+b.t)/2;
  const sw = 6;
  const dcx = (baseBounds.l+baseBounds.r)/2;
  const bz = b.t;

  if(isSeafood()){
    // ── BEACH WORLD ──────────────────────────────────────────
    scene.background = new THREE.Color('#87CEEB');
    scene.fog = new THREE.Fog('#b3e5fc', 50, 120);

    // Deep ocean behind restaurant (extends far back)
    addMesh(worldGrp, GBox(200,1,100), M('#0277bd'), 0,-1, b.t-30, 0,0,0,false);
    // Shallow ocean (lighter, closer)
    addMesh(worldGrp, GBox(200,.3,30), M('#4fc3f7'), 0,-.6, b.t-12, 0,0,0,false);
    // Wave foam strips
    for(let i=0;i<4;i++) addMesh(worldGrp, GBox(120,.08,1.2), M('#e3f2fd',.6), 0,-.1, b.t-4-i*5, 0,0,0,false);

    // Sandy beach ground (all around)
    addMesh(worldGrp, GBox(200,.5,200), M('#f9e4b7'), 0,-.76,0, 0,0,0,false);
    // Darker wet sand near water
    addMesh(worldGrp, GBox(200,.3,12), M('#e0c882'), 0,-.55, b.t-6, 0,0,0,false);

    // Boardwalk planks in front of restaurant
    addMesh(worldGrp, GBox(rW+sw*2,.35,rD+sw*2), M('#8d6e63'), cx,-.18,cz, 0,0,0,false);
    for(let xi=b.l-sw;xi<b.r+sw;xi+=1.4)
      addMesh(worldGrp, GBox(.06,.06,rD+sw*2), M('#6d4c41'), xi,.1,cz, 0,0,0,false);

    // Ocean road → replace with sandy path
    addMesh(worldGrp, GBox(100,.1,10), M('#e0c882'), cx,-.2, b.b+sw+5, 0,0,0,false);

    // Palm trees instead of regular trees
    const palmPos=[
      {x:b.l-7,z:b.t-4},{x:b.r+7,z:b.t-4},
      {x:b.l-9,z:cz-4}, {x:b.r+9,z:cz-4},
      {x:b.l-8,z:b.b+3},{x:b.r+8,z:b.b+3},
    ];
    for(const tp of palmPos){
      const lean = (tp.x<0 ? 1:-1)*0.15;
      addMesh(worldGrp, GCyl(.25,.35,6,8), M('#8d6e63'), tp.x,3,tp.z, 0,0,lean);
      addMesh(worldGrp, GSph(.5,6), M('#1b5e20'), tp.x+lean*8,6.5,tp.z);
      // Fronds
      for(let f=0;f<5;f++){
        const ang=(f/5)*Math.PI*2;
        addMesh(worldGrp, GBox(2.5,.12,.3), M('#2e7d32'),
          tp.x+Math.cos(ang)*1.5, 6.5, tp.z+Math.sin(ang)*1.5, 0,ang+.3,0.35);
      }
    }

    // Beach umbrella tables outside
    for(const px of [dcx-9, dcx+9]){
      addMesh(worldGrp, GCyl(.08,.08,3,6), M('#9e9e9e'), px,1.5,b.b+4);
      addMesh(worldGrp, GCone(2,.5,8), M('#e53935'), px,3.3,b.b+4);
      addMesh(worldGrp, GCyl(1.1,.12,16), M('#eeeeee'), px,.5,b.b+4);
      // Lounge chairs
      addMesh(worldGrp, GBox(1.2,.2,2), M('#f9e4b7'), px,.15,b.b+5.5, 0.25,0,0);
    }

    // Surfboards leaning on wall
    for(const sx of [-2,2]){
      addMesh(worldGrp, GBox(.4,2.2,.12), M(sx<0?'#ff5722':'#1976D2'), cx+sx*3,.9,bz-.2, -0.15,0,sx>0?.1:-.1);
    }

    // Seagulls (white cones in sky)
    [[cx-12,14,bz-20],[cx+10,16,bz-25],[cx-5,13,bz-18]].forEach(([x,y,z])=>{
      addMesh(worldGrp, GBox(.9,.1,.08), M('#fff'), x,y,z, 0,0,.4);
      addMesh(worldGrp, GBox(.9,.1,.08), M('#fff'), x+.7,y+.2,z, 0,0,-.4);
    });

    // Sign — SEAFOOD SHACK thatched style
    addMesh(worldGrp, GBox(rW*.6,1.8,.28), M('#0277bd'), cx,4.1,bz-.35);
    ['S','E','A','F','O','O','D',' ','S','H','A','C','K'].forEach((l,i)=>{
      if(l===' ') return;
      addMesh(worldGrp, GBox(.42,.9,.14), M('#ffffff'), cx-4.0+i*.62,4.1,bz-.22);
    });
    addMesh(worldGrp, GBox(.18,2.4,.18), M('#8d6e63'), cx-rW*.28, 3.2, bz-.35);
    addMesh(worldGrp, GBox(.18,2.4,.18), M('#8d6e63'), cx+rW*.28, 3.2, bz-.35);

  } else {
    buildBurgerWorld(b, rW, rD, cx, cz, sw, dcx, bz);
    // Scenery never moves: collapse it to one mesh per material.
    bakeInPlace(worldGrp);
  }

  if(!window._cloudsBuilt){
    window._cloudsBuilt=true;
    window._clouds=[];
    for(let c=0;c<8;c++){
      const cg=new THREE.Group();
      for(let p=0;p<4;p++){
        const cp=new THREE.Mesh(GSphS(2.4+Math.round(Math.random()*3)*0.6,8,6), M('#ffffff',.8));
        cp.position.set((Math.random()-.5)*5,Math.random()*2,(Math.random()-.5)*3);
        cg.add(cp);
      }
      cg.position.set((Math.random()-.5)*100, 22+Math.random()*8, -40+Math.random()*-60);
      cg._spd = .008+Math.random()*.012;
      scene.add(cg); window._clouds.push(cg);
    }
  }
}

function buildBurgerWorld(b, rW, rD, cx, cz, sw, dcx, bz){
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(lin(SKY), 60, 130);
    const grass = MT('grass', TEX.grass, 256);
    const pavers = MT('pavers', TEX.pavers, 256);
    const asphalt = MT('asphalt', TEX.asphalt, 256);

    // Ground, sidewalk apron, street.
    addMesh(worldGrp, GPlane(170,170,10), grass, 0,-.5,0, 0,0,0,false);
    addMesh(worldGrp, GBox(rW+sw*2,.3,rD+sw*2), M('#b9bfc2'), cx,-.2,cz, 0,0,0,false);
    addMesh(worldGrp, GPlane(rW+sw*2-.2, rD+sw*2-.2, 4), pavers, cx,-.04,cz, 0,0,0,false);
    const roadZ = b.b+sw+6;
    addMesh(worldGrp, GBox(120,.3,.5), M('#d5d9db'), cx,-.2, roadZ-6.2, 0,0,0,false);   // curb
    addMesh(worldGrp, GPlane(120,12,12), asphalt, cx,-.32, roadZ, 0,0,0,false);
    for(let i=-6;i<=6;i++) addMesh(worldGrp, GBox(3.2,.02,.35), M('#ffd54f'), cx+i*9,-.3, roadZ, 0,0,0,false);
    addMesh(worldGrp, GBox(120,.02,.18), M('#f5f5f5'), cx,-.3, roadZ+5.2, 0,0,0,false);

    // Parked cars across the street: a little life at the edge of the frame.
    [[cx-22,'#1e88e5'],[cx+19,'#fdd835'],[cx+31,'#e53935']].forEach(([x,col],i)=>{
      const c=new THREE.Group(); c.position.set(x,0,roadZ+3); c.rotation.y = i===1?Math.PI:0;
      addMesh(c, GRBox(5,1.1,2.3,.4), MP(col,90), 0,.95,0);
      addMesh(c, GRBox(2.8,.9,2.0,.35), MP('#cfe8f5',120,.85), -.2,1.8,0);
      addMesh(c, GRBox(2.9,.12,2.1,.06), MP(col,90), -.2,2.28,0);
      for(const wx of [-1.6,1.6]) for(const wz of [-1.1,1.1]) addMesh(c, GCyl(.45,.35,16), M('#1d1f22'), wx,.45,wz, Math.PI/2,0,0);
      addMesh(c, GBox(.1,.25,.5), ME('#fff8e1'), 2.52,1.05,.65, 0,0,0,false);
      addMesh(c, GBox(.1,.25,.5), ME('#fff8e1'), 2.52,1.05,-.65, 0,0,0,false);
      worldGrp.add(c);
    });

    // Street lamps
    for(const lx of [b.l-4, b.r+4]){
      const z = b.b+sw-1;
      addMesh(worldGrp, GCylT(.1,.16,7,10), MP('#37474f',60), lx,3.5,z);
      addMesh(worldGrp, GCylT(.3,.36,.4,10), MP('#37474f',60), lx,.2,z);
      addMesh(worldGrp, GCap(.07,1.4), MP('#37474f',60), lx+(lx<cx?.6:-.6),7.05,z, 0,0,Math.PI/2);
      addMesh(worldGrp, GRBox(.8,.3,.6,.12), MP('#263238',60), lx+(lx<cx?1.25:-1.25),7.0,z);
      addMesh(worldGrp, GBox(.6,.06,.4), ME('#fff3c4'), lx+(lx<cx?1.25:-1.25),6.84,z, 0,0,0,false);
    }

    // Entrance planters with flowers
    for(const px of [dcx-8, dcx+8]){
      addMesh(worldGrp, GRBox(2.2,1,1.4,.12), M('#8a5a35'), px,.5, b.b+2);
      addMesh(worldGrp, GBox(2,.1,1.2), M('#5d4037'), px,1.0, b.b+2, 0,0,0,false);
      addMesh(worldGrp, GIco(.62), M('#3f9a3a'), px-.45,1.4, b.b+2);
      addMesh(worldGrp, GIco(.55), M('#4caf50'), px+.45,1.35, b.b+2);
      [['#ec407a',-.7,.2],['#ffca28',.1,-.3],['#ab47bc',.6,.25],['#ff7043',-.1,.35]].forEach(([c,fx,fz])=>
        addMesh(worldGrp, GSph(.14,8), M(c), px+fx,1.85, b.b+2+fz, 0,0,0,false));
    }

    // Trees: faceted canopies read as stylised, not unfinished.
    const treePos=[
      {x:b.l-8,z:b.t-6,s:1},{x:b.r+8,z:b.t-6,s:1.15},
      {x:b.l-10,z:cz,s:.9},  {x:b.r+10,z:cz,s:1.05},
      {x:b.l-10,z:b.b+4,s:1},{x:b.r+10,z:b.b+4,s:.95},
      {x:b.l-20,z:b.t+2,s:1.2},{x:b.r+20,z:b.t-2,s:1.1},
    ];
    for(const tp of treePos){
      const t=new THREE.Group(); t.position.set(tp.x,0,tp.z); t.scale.setScalar(tp.s);
      addMesh(t, GCylT(.28,.42,3.2,8), M('#7b5a3e'), 0,1.6,0);
      addMesh(t, GIco(2.1), M('#3f9142'), 0,5.0,0);
      addMesh(t, GIco(1.6), M('#58ad48'), .9,6.0,-.5);
      addMesh(t, GIco(1.3), M('#4a9e40'), -.9,5.8,.6);
      worldGrp.add(t);
    }
    // Low hedges along the side walls (squashed, half-sunk so they read as
    // shrubs, not floating gems).
    for(let z=b.t+3; z<b.b-1; z+=5){
      for(const [x,dz] of [[b.l-1.7,0],[b.r+1.7,2.5]]){
        if(z+dz > b.b-1) continue;
        addMesh(worldGrp, GIco(1.0), M('#3d8a35'), x, .2, z+dz).scale.set(1,.55,1.4);
        addMesh(worldGrp, GIco(.7), M('#58a845'), x+.25, .5, z+dz+.7).scale.set(1,.65,1);
      }
    }

    // Patio tables with umbrellas out front
    for(const px of [dcx-7, dcx+7]){
      const z = b.b+4.5;
      addMesh(worldGrp, GCyl(1.15,.12,24), M('#fafafa'), px,1.8, z);
      addMesh(worldGrp, GCyl(.08,1.8,8), CHROME(), px,.9, z);
      addMesh(worldGrp, GCyl(.05,5.4,8), MP('#9e9e9e',60), px,2.75, z);
      addMesh(worldGrp, GCone(2.3,.8,16), M('#e53935'), px,5.4, z);
      addMesh(worldGrp, GCylT(2.3,2.3,.25,16), M('#fafafa'), px,4.92, z, 0,0,0,false);
      addMesh(worldGrp, GSph(.14,8), M('#fafafa'), px,5.85, z);
    }

    // Rooftop sign on the back wall: real lettering, neon frame, burger icon.
    const signW = Math.min(14, rW*.6);
    addMesh(worldGrp, GRBox(signW+.5,2.5,.4,.2), MP('#212121',80), cx, 4.4, bz-.45);
    const face = new THREE.MeshBasicMaterial({ map: signTex('BURGER BAR', {bg:'#c62828', fg:'#fff8e1', stripe:'#ffca28', glow:'#ffecb3', size:.5}), fog:false });
    face._shared = true;
    addMesh(worldGrp, cachedGeo('signface|'+signW, ()=>new THREE.PlaneGeometry(signW, 2.0)), face, cx, 4.4, bz-.24, 0,0,0,false);
    addMesh(worldGrp, GBox(signW+.3,.08,.08), ME('#ffe082'), cx, 5.6, bz-.22, 0,0,0,false);
    addMesh(worldGrp, GBox(signW+.3,.08,.08), ME('#ffe082'), cx, 3.2, bz-.22, 0,0,0,false);
    for(const sx of [-1,1]){
      const bx = cx + sx*(signW/2+1.3);
      addMesh(worldGrp, GSphS(.95,16,8), M('#e6a54a'), bx,5.0,bz-.4).scale.set(1,.55,1);
      addMesh(worldGrp, GCyl(.98,.25,18), M('#6a3b1c'), bx,4.55,bz-.4);
      addMesh(worldGrp, GCyl(1.02,.08,18), M('#ffca28'), bx,4.72,bz-.4, 0,0,0,false);
      addMesh(worldGrp, GCyl(.95,.2,18), M('#e6a54a'), bx,4.25,bz-.4);
    }
    addMesh(worldGrp, GBox(.18,2.4,.18), CHROME(), cx-signW*.4, 3.2, bz-.45);
    addMesh(worldGrp, GBox(.18,2.4,.18), CHROME(), cx+signW*.4, 3.2, bz-.45);
}

function buildArchway(parent, cx, cz, wH, dir){
  const isX = (dir==='left'||dir==='right');
  const fw=.35, fh=wH, fd=.35, hw=2.5;
  if(isX){
    addMesh(parent, GBox(fw,fh,fd), matFrameDark, cx, fh/2, cz-hw);
    addMesh(parent, GBox(fw,fh,fd), matFrameDark, cx, fh/2, cz+hw);
    addMesh(parent, GBox(fw,.3,hw*2+fw*2), matFrameDark, cx, fh-.1, cz);
  } else {
    addMesh(parent, GBox(hw*2+fw*2,.3,fd), matFrameDark, cx, fh-.1, cz);
    addMesh(parent, GBox(fd,fh,fw), matFrameDark, cx-hw, fh/2, cz);
    addMesh(parent, GBox(fd,fh,fw), matFrameDark, cx+hw, fh/2, cz);
  }
}

// ─────────────────────────────────────────────────────────────
//  BUILD ROOM
// ─────────────────────────────────────────────────────────────
function buildRoom(){
  while(roomGrp.children.length) discard(roomGrp, roomGrp.children[0]);
  collEdges = [];

  const b = bounds;
  const w = b.r - b.l, d = b.b - b.t;
  const cx = (b.r + b.l) / 2, cz = (b.b + b.t) / 2;
  const sea = isSeafood();

  if(sea){
    addMesh(roomGrp, GBox(w,.25,d), M('#e0c882'), cx,.05,cz, 0,0,0,false);
    for(let xi=0;xi<w;xi+=1.5) addMesh(roomGrp, GBox(.05,.01,d), M('#4fc3f7'), b.l+xi,.18,cz, 0,0,0,false);
  } else {
    // Classic diner checkerboard, one tile = 2.5 world units.
    addMesh(roomGrp, GBox(w,.2,d), M('#3a3f47'), cx,.0,cz, 0,0,0,false);
    addMesh(roomGrp, GPlane(w,d,3.2), MT('checker', TEX.checker, 256), cx,.11,cz, 0,0,0,false);
  }

  const wH=2.8, wT=0.55, doorHalfW = 2.5;
  const dt = sea ? 0 : decorTier();
  _roomDecorTier = dt;
  const outerMat = sea ? matWallOut : MT('dinerwall', TEX.dinerwall, 256);
  const kitchMat = sea ? matWallKitch : MT('subway', TEX.subway, 256);
  const capMat = sea ? matWallCap : (dt >= 6 ? MP('#ffca28',140) : CHROME());
  function wallSeg(x,y,z,sw,sh,sd,isK){
    const geo = sea ? GBox(sw,sh,sd) : GWall(sw,sh,sd, isK ? 4 : 3);
    addMesh(roomGrp, geo, isK?kitchMat:outerMat, x,y,z);
    addMesh(roomGrp, sea ? GBox(sw+.08,.2,sd+.08) : GRBox(sw+.1,.2,sd+.1,.08), capMat, x,y+sh/2+.1,z);
  }

  const edges = [];
  edges.push({ axis:'x', fixed:baseBounds.b+wT/2, min:baseBounds.l, max:baseBounds.r, type:'maindoor', isK:false });
  edges.push({ axis:'x', fixed:baseBounds.t-wT/2, min:baseBounds.l, max:baseBounds.r, type: 'solid', isK:true });
  edges.push({ axis:'z', fixed:baseBounds.l-wT/2, min:baseBounds.t, max:baseBounds.b, type: 'solid', isK:false });
  edges.push({ axis:'z', fixed:baseBounds.r+wT/2, min:baseBounds.t, max:baseBounds.b, type: 'solid', isK:false });
  collEdges = edges;

  for(const e of edges) {
    let holes = [];
    const ecx = (e.min+e.max)/2;
    if(e.type === 'maindoor') holes.push({center: ecx, halfW: doorHalfW});
    if(e.type === 'archway')  holes.push({center: ecx, halfW: doorHalfW});

    let cursor = e.min;
    for(const hole of holes){
      const segEnd = hole.center - hole.halfW;
      if(segEnd > cursor+.1){
        const segW = segEnd-cursor; const segC = cursor+segW/2;
        if(e.axis==='x') wallSeg(segC, wH/2, e.fixed, segW, wH, wT, e.isK);
        else             wallSeg(e.fixed, wH/2, segC, wT, wH, segW, e.isK);
      }
      cursor = hole.center + hole.halfW;
    }
    if(e.max > cursor+.1){
      const segW=e.max-cursor; const segC=cursor+segW/2;
      if(e.axis==='x') wallSeg(segC, wH/2, e.fixed, segW, wH, wT, e.isK);
      else             wallSeg(e.fixed, wH/2, segC, wT, wH, segW, e.isK);
    }

    if(e.type === 'maindoor') {
      // Glass double doors in chrome frames, propped open.
      const pw = doorHalfW-.2, ph=wH-.1;
      addMesh(roomGrp, GRBox(doorHalfW*2+wT*.6,.24,wT+.05,.06), sea?matFrameDark:CHROME(), ecx, wH, e.fixed);
      for(const side of [-1,1]){
        const dg = new THREE.Group(); dg.position.set(ecx+side*(doorHalfW-.05), 0, e.fixed); dg.rotation.y = side*-.55;
        addMesh(dg, GRBox(pw,ph,.12,.05), sea?M('#8D6E63',.9):MP('#b3e5fc',120,.45), -side*pw/2, ph/2, 0, 0,0,0,false);
        addMesh(dg, GBox(.08,ph,.16), sea?matFrameDark:CHROME(), -side*.04, ph/2, 0, 0,0,0,false);
        addMesh(dg, GBox(.06,.9,.2), sea?matFrameDark:CHROME(), -side*(pw-.25), 1.3, 0, 0,0,0,false);
        roomGrp.add(dg);
      }
      if(!sea) addMesh(roomGrp, GRBox(doorHalfW*2-.4,.04,2.2,.1), M('#8e1b1b'), ecx,.14, e.fixed-1.6, 0,0,0,false); // door mat
    }
  }

  if(sea){
    for(let xi=0;xi<w;xi+=1) for(let yi=0;yi<2;yi++)
      addMesh(roomGrp, GBox(.82,.82,.05), M('#ffffff'), b.l+xi+.5, .5+yi*.88+.18, b.t-wT+.32, 0,0,0,false);
  } else {
    buildDinerDecor(b, wT, dt);
  }
  bakeInPlace(roomGrp);
}

// Back-wall dressing and the Fancy Decor tiers (patience upgrade), so every
// purchase visibly changes the room.
function buildDinerDecor(b, wT, dt){
  const backZ = b.t - wT + .3;          // just in front of the back wall
  const cx = (b.l + b.r) / 2;
  // Menu board (always): chalkboard with real prices.
  const menu = new THREE.MeshBasicMaterial({ map: signTex('BURGERS $16  ·  FRIES $5  ·  SODA $7', {bg:'#22302b', fg:'#f1f8e9', size:.34}) });
  menu._shared = true;
  addMesh(roomGrp, GRBox(8.4,1.15,.1,.06), M('#6d4c41'), cx, 2.25, backZ+.02, 0,0,0,false);
  addMesh(roomGrp, cachedGeo('menuface', ()=>new THREE.PlaneGeometry(8.1,1.0)), menu, cx, 2.25, backZ+.09, 0,0,0,false);
  // Wall clock
  addMesh(roomGrp, GCyl(.42,.08,24), M('#fafafa'), b.r-2.2, 2.2, backZ+.05, Math.PI/2,0,0,false);
  addMesh(roomGrp, GTor(.42,.05,6,24), MP('#c62828',60), b.r-2.2, 2.2, backZ+.08, 0,0,0,false);
  addMesh(roomGrp, GBox(.04,.3,.02), M('#111'), b.r-2.2, 2.3, backZ+.12, 0,0,.4,false);
  addMesh(roomGrp, GBox(.03,.22,.02), M('#111'), b.r-2.15, 2.18, backZ+.12, 0,0,-1.3,false);

  if(dt >= 1){                       // potted plants in the corners
    for(const [px,pz] of [[b.l+.8,b.t+.8],[b.r-.8,b.t+.8],[b.l+.8,b.b-.8],[b.r-.8,b.b-.8]]){
      addMesh(roomGrp, GCylT(.45,.34,.8,14), M('#d8743a'), px,.5,pz);
      addMesh(roomGrp, GIco(.62,1), M('#3f9a3a'), px,1.35,pz);
      addMesh(roomGrp, GIco(.4), M('#58ad48'), px+.25,1.85,pz-.1);
    }
  }
  if(dt >= 2){                       // framed burger art on the back wall
    for(const fx of [b.l+3.2, b.l+5.4]){
      addMesh(roomGrp, GRBox(1.5,1.1,.08,.04), M('#3e2723'), fx, 2.15, backZ+.04, 0,0,0,false);
      addMesh(roomGrp, GBox(1.25,.85,.02), M('#fff3e0'), fx, 2.15, backZ+.09, 0,0,0,false);
      addMesh(roomGrp, GSphS(.3,12,6), M('#e6a54a'), fx, 2.2, backZ+.1, 0,0,0,false).scale.set(1,.5,.2);
      addMesh(roomGrp, GBox(.6,.1,.03), M('#6a3b1c'), fx, 2.05, backZ+.1, 0,0,0,false);
    }
  }
  if(dt >= 3){                       // jukebox
    const jx = b.l + 1.1, jz = b.t + 5.5;
    addMesh(roomGrp, GRBox(1.2,2.3,1.0,.2), MP('#8d2a1c',90), jx,1.15,jz);
    addMesh(roomGrp, GSphS(.62,16,8), MP('#ffca28',100), jx,2.3,jz).scale.set(1,.7,.85);
    addMesh(roomGrp, GRBox(.9,.8,.05,.1), ME('#ffb74d'), jx+.01,1.6,jz+.5, 0,0,0,false);
    for(let i=0;i<4;i++) addMesh(roomGrp, GBox(.85,.05,.04), ME(['#e040fb','#40c4ff','#69f0ae','#ff5252'][i]), jx,.6+i*.18,jz+.52, 0,0,0,false);
  }
  if(dt >= 4){                       // neon OPEN sign + string lights
    const open = new THREE.MeshBasicMaterial({ map: signTex('OPEN', {bg:'#1a0d1f', fg:'#ff4081', glow:'#ff80ab', size:.7}), fog:false });
    open._shared = true;
    addMesh(roomGrp, cachedGeo('openface', ()=>new THREE.PlaneGeometry(2.4,.6)), open, b.l+3.6, 2.6, backZ+.1, 0,0,0,false);
    const cols = ['#ffd54f','#ff8a65','#81d4fa','#aed581'];
    let i = 0;
    for(let x=b.l+.6; x<b.r; x+=1.2) addMesh(roomGrp, GSph(.09,6), ME(cols[i++%4]), x, 3.05, backZ+.1, 0,0,0,false);
    for(let z=b.t+.6; z<b.b; z+=1.2){
      addMesh(roomGrp, GSph(.09,6), ME(cols[i++%4]), b.l-wT+.3, 3.05, z, 0,0,0,false);
      addMesh(roomGrp, GSph(.09,6), ME(cols[i++%4]), b.r+wT-.3, 3.05, z, 0,0,0,false);
    }
  }
  if(dt >= 6){                       // gold-star celebration balloons
    for(const [bx,bz2,c] of [[b.r-1,b.t+1.6,'#ffca28'],[b.r-1.6,b.t+1.1,'#ef5350'],[b.l+1.6,b.b-1.4,'#42a5f5']]){
      addMesh(roomGrp, GSph(.38,12), MP(c,120), bx, 3.9, bz2);
      addMesh(roomGrp, GCyl(.01,2.6,4), M('#eeeeee'), bx, 2.4, bz2, 0,0,0,false);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  STATION BUILDERS
// ─────────────────────────────────────────────────────────────
// ── Upgrade tiers that change how things LOOK ───────────────────────────────
// A purchase should be visible in the bar, not just a number in a menu.
function grillTier(){ const m = upg.grillMult || 0.5; return m >= 2.2 ? 2 : m >= 1.2 ? 1 : 0; }
function decorTier(){ return Math.max(0, Math.min(6, Math.round(((upg.patienceMult||1) - 1) / 0.35))); }
const GRILL_TIER_NAMES = ['Diner Grill', 'Pro Flat-Top', 'TURBO Grill'];

// Common station parts
const STEEL  = ()=>MP('#c9d2d8', 70);
const STEELD = ()=>MP('#8f9aa2', 50);
const CHROME = ()=>MP('#eef3f6', 140);
const RUBBER = ()=>M('#2a2d31');
function knob(g, x, y, z){ addMesh(g, GCyl(.11,.12,12), M('#1f2226'), x,y,z, Math.PI/2,0,0, false); addMesh(g, GBox(.03,.14,.04), M('#f5f5f5'), x,y+.02,z+.07, 0,0,0,false); }
function kick(g, w, d){ addMesh(g, GBox(w-.12,.22,d-.12), RUBBER(), 0,.11,0, 0,0,0,false); }

function buildFridge(){
  return bake('fridge', ()=>{
    const g=new THREE.Group();
    kick(g, 3, 2.8);
    addMesh(g, GRBox(2.9,5.0,2.7,.22), STEEL(), 0,2.72,0);
    // Freezer door (top) and glass door (bottom) showing stacked patties.
    addMesh(g, GRBox(2.7,1.45,.14,.06), MP('#dfe6ea',90), 0,4.3,1.38);
    addMesh(g, GRBox(2.7,2.95,.12,.06), MP('#e6edf0',90), 0,2.05,1.36);
    addMesh(g, GRBox(2.3,2.45,.06,.05), MP('#a8d9ef',110,.55), 0,2.1,1.44, 0,0,0,false);
    for(let s=0;s<3;s++){
      addMesh(g, GBox(2.1,.05,1), STEELD(), 0,1.15+s*.78,1.0, 0,0,0,false);
      for(let p=0;p<4;p++) addMesh(g, GCylT(.24,.24,.12,14), M('#d0606e'), -.75+p*.5,1.25+s*.78,1.05, 0,0,0,false);
    }
    addMesh(g, GCap(.07,1.0), CHROME(), 1.12,4.3,1.55, 0,0,0,false);
    addMesh(g, GCap(.07,2.0), CHROME(), 1.12,2.2,1.55, 0,0,0,false);
    addMesh(g, GRBox(.8,.24,.04,.05), ME('#4dd0e1'), -.75,4.75,1.46, 0,0,0,false);   // temp display
    addMesh(g, GRBox(2.95,.18,2.75,.08), STEELD(), 0,5.25,0);
    return g;
  });
}
function buildSink(){
  return bake('sink', ()=>{
    const g=new THREE.Group();
    kick(g, 1.8, 1.8);
    addMesh(g, GRBox(1.8,2.6,1.8,.12), STEEL(), 0,1.42,0);
    addMesh(g, GRBox(1.5,1.6,.06,.05), STEELD(), 0,1.35,.9, 0,0,0,false);
    addMesh(g, GCap(.05,.9), CHROME(), 0,2.05,.96, 0,0,Math.PI/2,false);
    addMesh(g, GRBox(1.95,.16,1.95,.06), CHROME(), 0,2.8,0);
    addMesh(g, GRBox(1.25,.1,1.0,.08), MP('#5b6b75',90), -.1,2.86,.15, 0,0,0,false);   // basin
    addMesh(g, GRBox(1.15,.04,.9,.06), MP('#7fd0f0',120,.85), -.1,2.9,.15, 0,0,0,false); // water
    // Gooseneck faucet
    addMesh(g, GCyl(.07,.9,10), CHROME(), -.1,3.25,-.65);
    addMesh(g, GTor(.22,.06,8,14,Math.PI), CHROME(), -.1,3.7,-.43, 0,Math.PI/2,0);
    addMesh(g, GCyl(.05,.2,8), CHROME(), -.1,3.6,-.21);
    addMesh(g, GSph(.09,10), M('#e53935'), -.45,3.0,-.7);
    addMesh(g, GSph(.09,10), M('#1e88e5'), .25,3.0,-.7);
    // Drying rack where clean trays stack (x+.6, z-.6)
    for(const dx of [.2, 1.0]) addMesh(g, GBox(.05,.5,.05), CHROME(), dx,3.1,-.6, 0,0,0,false);
    return g;
  });
}
function buildTrayRack(w,d){
  return bake('trayrack|'+w+'|'+d, ()=>{
    const g=new THREE.Group();
    kick(g, w, d);
    addMesh(g, GRBox(w,2.55,d,.12), M('#8a5a35'), 0,1.4,0);
    for(let i=0;i<3;i++) addMesh(g, GBox(w-.25,.04,.05), M('#6d4426'), 0,.75+i*.7,d/2+.005, 0,0,0,false);
    addMesh(g, GRBox(w+.1,.12,d+.1,.05), CHROME(), 0,2.75,0);
    for(const [px,pz] of [[-1,-1],[1,-1]]) addMesh(g, GCyl(.05,.9,8), CHROME(), px*(w/2-.08),3.2,pz*(d/2-.08));
    addMesh(g, GCyl(.05,w-.1,8), CHROME(), 0,3.65,-(d/2-.08), 0,0,Math.PI/2);
    // Little "TRAYS" plate
    addMesh(g, GRBox(.9,.28,.04,.05), M('#fff3d6'), 0,2.2,d/2+.02, 0,0,0,false);
    return g;
  });
}
function buildGrill(){
  const tier = grillTier();
  const g = bake('grill|'+tier, ()=>{
    const g=new THREE.Group();
    const body  = tier===2 ? MP('#17191c',130) : tier===1 ? STEEL() : MP('#3d434a',35);
    const panel = tier===2 ? MP('#24272b',120) : tier===1 ? MP('#b5bfc5',80) : MP('#2b3035',30);
    kick(g, 3.5, 2.3);
    addMesh(g, GRBox(3.5,2.7,2.3,.16), body, 0,1.47,0);
    addMesh(g, GRBox(3.2,1.3,.08,.06), panel, 0,1.85,1.16, 0,0,0,false);
    for(let i=0;i<3;i++) knob(g, -.9+i*.9, 1.85, 1.22);
    // Cook surface: grates over glowing coals (tier 0), flat-top (1), turbo (2)
    addMesh(g, GRBox(3.3,.2,1.9,.06), MP('#1a1c1f',60), 0,2.86,.05);
    addMesh(g, GBox(3.0,.05,1.5), ME(tier===1?'#ff7a2a':'#ff5418'), 0,2.97,.2, 0,0,0,false);
    if(tier===0) for(let i=-1.3;i<=1.31;i+=.26) addMesh(g, GBox(.07,.07,1.55), M('#15171a'), i,3.02,.2, 0,0,0,false);
    else addMesh(g, GBox(3.0,.04,1.5), MP(tier===2?'#3a3f46':'#59626a',120), 0,3.0,.2, 0,0,0,false);
    // Backsplash + hood
    addMesh(g, GRBox(3.6,1.7,.32,.08), tier===0 ? MP('#9aa5ad',60) : CHROME(), 0,3.75,-1.0);
    addMesh(g, GRBox(3.8,.35,1.0,.1), tier===2 ? MP('#17191c',130) : STEELD(), 0,4.75,-.65);
    if(tier>=1){
      addMesh(g, GBox(3.2,.06,.06), ME('#4fc3f7'), 0,2.84,1.08, 0,0,0,false);       // gas flame strip
      addMesh(g, GBox(2.8,.08,.12), ME('#ffcc80'), 0,4.55,-.3, 0,0,0,false);        // heat lamp
      addMesh(g, GCap(.06,3.0), CHROME(), 0,2.55,1.32, 0,0,Math.PI/2,false);       // towel rail
    }
    if(tier===1) addMesh(g, GBox(3.52,.18,.02), M('#d63a2f'), 0,1.05,1.16, 0,0,0,false);
    if(tier===2){
      for(const sx of [-.35,.35]) addMesh(g, GBox(.22,2.7,.02), M('#e53935'), sx,1.47,1.16, 0,0,0,false);   // racing stripes
      for(let i=0;i<4;i++) addMesh(g, GBox(.5,.07,.02), ME('#ff6d00'), -1.15+i*.75,.75,1.17, 0,0,0,false); // glowing vents
      for(const sx of [-1.45,1.45]){                                                  // twin exhausts
        addMesh(g, GCyl(.16,1.3,12), CHROME(), sx,5.4,-1.0);
        addMesh(g, GCyl(.11,.05,12), ME('#ff9100'), sx,6.06,-1.0, 0,0,0,false);
      }
      addMesh(g, GCyl(.32,.05,20), M('#fafafa'), 1.25,3.7,-.83, Math.PI/2,0,0,false); // gauge
      addMesh(g, GBox(.04,.26,.02), M('#d50000'), 1.3,3.75,-.8, 0,0,-.7,false);
    }
    return g;
  });
  g._tier = tier;
  return g;
}
function buildFryer(){
  return bake('fryer', ()=>{
    const g=new THREE.Group();
    kick(g, 3.2, 2.3);
    addMesh(g, GRBox(3.2,2.7,2.3,.16), STEEL(), 0,1.47,0);
    addMesh(g, GRBox(2.9,1.2,.06,.06), STEELD(), 0,1.8,1.16, 0,0,0,false);
    for(let i=0;i<2;i++) knob(g, -.6+i*1.2, 1.9, 1.22);
    addMesh(g, GRBox(3.3,.16,2.0,.06), CHROME(), 0,2.86,.05);
    for(const sx of [-.8,.8]){
      addMesh(g, GRBox(1.35,.12,1.45,.05), MP('#2a2d31',40), sx,2.9,.15, 0,0,0,false);
      addMesh(g, GBox(1.2,.04,1.3), MP('#e2a83a',140), sx,2.97,.15, 0,0,0,false);       // hot oil
      addMesh(g, GCap(.05,.7), M('#1c1c1c'), sx,3.25,.95, Math.PI/3,0,0,false);         // basket handle
    }
    addMesh(g, GRBox(3.3,1.4,.3,.08), STEEL(), 0,3.65,-1.0);
    addMesh(g, GRBox(1.0,.45,.1,.05), MP('#20262b',90), -.9,3.8,-.82, 0,0,0,false);
    addMesh(g, GBox(.18,.12,.03), ME('#ff9800'), -1.15,3.82,-.76, 0,0,0,false);
    addMesh(g, GBox(.18,.12,.03), ME('#76ff03'), -.85,3.82,-.76, 0,0,0,false);
    addMesh(g, GRBox(1.0,.36,.06,.05), M('#fbc02d'), .8,3.85,-.83, 0,0,0,false);       // "FRIES" plate
    return g;
  });
}
function buildSodaFountain(){
  return bake('soda', ()=>{
    const g=new THREE.Group();
    kick(g, 2, 2);
    addMesh(g, GRBox(2,2.6,2,.14), M('#c62828'), 0,1.42,0);
    addMesh(g, GBox(2.02,.14,2.02), M('#fafafa'), 0,1.0,0, 0,0,0,false);
    addMesh(g, GRBox(2.15,.16,2.15,.06), CHROME(), 0,2.8,0);
    addMesh(g, GRBox(1.6,1.5,.9,.12), CHROME(), 0,3.65,-.45);
    addMesh(g, GRBox(1.4,.7,.05,.06), ME('#ffecb3'), 0,3.95,0.01, 0,0,0,false);         // backlit panel
    ['#e53935','#ff9800','#43a047'].forEach((c,i)=>{
      addMesh(g, GRBox(.3,.32,.06,.06), M(c), -.42+i*.42,3.95,.05, 0,0,0,false);
      addMesh(g, GCyl(.06,.22,10), CHROME(), -.42+i*.42,3.1,-.05);
    });
    addMesh(g, GRBox(1.5,.08,.9,.04), MP('#5f6b72',90), 0,2.92,.25, 0,0,0,false);       // drip tray
    for(let i=0;i<4;i++) addMesh(g, GCylT(.2,.16,.14,14), M(i%2?'#fafafa':'#e53935'), .72,3.0+i*.12,.55, 0,0,0,false); // cup stack
    return g;
  });
}
function buildTrash(){
  return bake('trash', ()=>{
    const g=new THREE.Group();
    addMesh(g, GCylT(.78,.66,2.35,22), MP('#2e7d32',40), 0,1.2,0);
    addMesh(g, GCylT(.8,.8,.12,22), M('#f1f1f1'), 0,1.6,0, 0,0,0,false);
    addMesh(g, GSphS(.84,22,8), MP('#1b5e20',50), 0,2.38,0).scale.set(1,.32,1);
    addMesh(g, GRBox(.7,.28,.08,.05), M('#0f3a12'), 0,2.42,.72, -.3,0,0,false);         // swing flap
    return g;
  });
}
function buildDumpster(){
  return bake('dumpster', ()=>{
    const g=new THREE.Group();
    addMesh(g, GRBox(4,2.7,3,.18), MP('#2f6b3a',35), 0,1.65,0);
    for(const sx of [-1.4,0,1.4]) addMesh(g, GBox(.08,2.2,3.04), M('#255a30'), sx,1.65,0, 0,0,0,false);
    addMesh(g, GRBox(2.0,.14,3.1,.05), M('#1d1f22'), -1.0,3.1,0, .12,0,0);
    addMesh(g, GRBox(2.0,.14,3.1,.05), M('#1d1f22'), 1.0,3.04,0);
    for(const sx of [-1.6,1.6]) for(const sz of [-1.1,1.1]) addMesh(g, GCyl(.2,.18,12), M('#222'), sx,.2,sz, 0,0,Math.PI/2);
    addMesh(g, GRBox(1.2,.36,.04,.05), M('#fff176'), 0,2.2,1.52, 0,0,0,false);
    return g;
  });
}
function buildCounter(w,d){
  return bake('counter|'+w+'|'+d, ()=>{
    const g=new THREE.Group();
    kick(g, w, d);
    addMesh(g, GRBox(w,2.55,d,.12), M('#c0392b'), 0,1.4,0);
    addMesh(g, GBox(w+.01,.1,d+.01), CHROME(), 0,.62,0, 0,0,0,false);
    addMesh(g, GRBox(w-.3,1.5,.05,.06), M('#a93226'), 0,1.55,d/2+.01, 0,0,0,false);
    addMesh(g, GRBox(w+.2,.12,d+.2,.05), CHROME(), 0,2.75,0);
    addMesh(g, GRBox(w+.14,.14,d+.14,.05), M('#f5f0e6'), 0,2.87,0);                     // marble top
    return g;
  });
}
function buildTable(){
  const dt = decorTier();
  const tv = dt>=5?1:0;
  const tbl = bake('table|'+tv, ()=>{
    const g=new THREE.Group();
    addMesh(g, GCylT(.55,.65,.08,22), CHROME(), 0,.04,0);
    addMesh(g, GCyl(.12,2.0,12), CHROME(), 0,1.05,0);
    addMesh(g, GCyl(1.25,.12,32), M('#fbfbf8'), 0,2.1,0);
    addMesh(g, GTor(1.25,.06,6,40), CHROME(), 0,2.1,0, Math.PI/2,0,0,false);
    // Condiments + napkins
    addMesh(g, GCap(.09,.22), M('#d32f2f'), -.22,2.38,-.35, 0,0,0,false);
    addMesh(g, GCap(.09,.22), M('#fbc02d'), .02,2.38,-.4, 0,0,0,false);
    addMesh(g, GRBox(.34,.26,.16,.04), CHROME(), .32,2.3,-.38, 0,0,0,false);
    if(dt>=5){
      addMesh(g, GCylT(.1,.13,.3,12), MP('#80deea',120,.7), 0,2.32,.35, 0,0,0,false);
      addMesh(g, GSph(.11,8), M('#ec407a'), -.06,2.58,.35, 0,0,0,false);
      addMesh(g, GSph(.1,8), M('#ffca28'), .08,2.55,.3, 0,0,0,false);
    }
    // Two diner stools with backs, facing the table.
    for(const sx of [-2.8, 2.8]){
      const out = Math.sign(sx);
      addMesh(g, GCylT(.38,.45,.06,16), CHROME(), sx,.03,0, 0,0,0,false);
      addMesh(g, GCyl(.08,.9,10), CHROME(), sx,.48,0);
      addMesh(g, GCyl(.6,.2,22), MP('#c62828',45), sx,1.0,0);
      addMesh(g, GTor(.6,.05,6,24), CHROME(), sx,.92,0, Math.PI/2,0,0,false);
      addMesh(g, GRBox(.2,1.05,1.0,.1), MP('#c62828',45), sx+out*.55,1.65,0);
      addMesh(g, GCyl(.04,.7,8), CHROME(), sx+out*.55,1.0,0);
    }
    return g;
  });
  tbl._tv = tv;
  return tbl;
}

// Swap in the right model tier for anything an upgrade (or a robot's level)
// has changed, and redress the room for the decor tier. Returns the stations
// whose model changed so callers can celebrate them.
let _roomDecorTier = -1;
function refreshUpgradeVisuals(){
  if(isSeafood()) return [];
  const gt = grillTier(), tv = decorTier() >= 5 ? 1 : 0;
  const changed = [];
  for(const k in stations){
    const s = stations[k]; if(!s.mesh) continue;
    let mesh = null;
    if(s.type==='grill' && s.mesh._tier !== gt) mesh = buildGrill();
    else if(s.type==='table' && s.mesh._tv !== tv) mesh = buildTable();
    else if(s.type==='robot'){
      const lvl = getRobotLevel(s), lt = lvl >= 5 ? 2 : lvl >= 3 ? 1 : 0;
      if(s.mesh._lvlTier !== lt) mesh = buildRobot(s.role, lvl);
    }
    if(!mesh) continue;
    const old = s.mesh;
    mesh.position.copy(old.position); mesh.rotation.y = old.rotation.y;
    discard(stGrp, old); stGrp.add(mesh); s.mesh = mesh;
    changed.push(s);
  }
  if(_roomDecorTier !== decorTier()){ _roomDecorTier = decorTier(); buildRoom(); }
  if(changed.length) markStationsDirty();
  return changed;
}
function buildRobot(role, lvl){
  lvl = lvl || 1;
  const lt = lvl >= 5 ? 2 : lvl >= 3 ? 1 : 0;
  const g = bake('robot|'+role+'|'+lt, ()=>{
    const g=new THREE.Group();
    const body = role==='chef'?'#00acc1':role==='waiter'?'#d81b60':'#fb8c00';
    const trim = lt===2 ? MP('#ffca28',150) : lt===1 ? CHROME() : MP('#90a4ae',60);
    addMesh(g, GCylT(.55,.62,.25,20), M('#263238'), 0,.28,0);                 // wheel base
    addMesh(g, GTor(.6,.08,8,24), trim, 0,.28,0, Math.PI/2,0,0,false);
    addMesh(g, GRBox(1.15,1.15,1.0,.38), MP(body,70), 0,1.05,0);              // body
    addMesh(g, GRBox(.7,.5,.05,.12), MP('#eceff1',90), 0,1.05,.5, 0,0,0,false); // chest plate
    addMesh(g, GSph(.07,8), ME(lt===2?'#ffd54f':'#76ff03'), .2,1.15,.53, 0,0,0,false);
    addMesh(g, GRBox(.95,.62,.85,.24), MP('#f5f7f8',90), 0,1.95,0);           // head
    addMesh(g, GRBox(.78,.38,.06,.14), MP('#0f1a20',140), 0,1.97,.42, 0,0,0,false); // visor
    for(const ex of [-.17,.17]) addMesh(g, GRBox(.14,.16,.04,.06), ME('#4dd0e1'), ex,2.0,.46, 0,0,0,false);
    addMesh(g, GCyl(.04,.4,8), trim, 0,2.45,0);
    addMesh(g, GSph(.1,10), ME(lt===2?'#ffd54f':body), 0,2.7,0, 0,0,0,false);
    for(const ax of [-.68,.68]){                                               // arms
      addMesh(g, GSph(.15,10), trim, ax,1.3,0, 0,0,0,false);
      addMesh(g, GCap(.11,.45), MP('#b0bec5',60), ax*1.05,1.0,.12, -.5,0,0,false);
    }
    if(role==='chef'){                                                         // toque
      addMesh(g, GCyl(.33,.3,16), M('#ffffff'), 0,2.42,0);
      addMesh(g, GSphS(.42,16,10), M('#ffffff'), 0,2.66,0).scale.set(1,.6,1);
    } else if(role==='waiter'){                                                // bow tie
      addMesh(g, GCone(.12,.22,4), M('#111'), -.11,1.6,.5, 0,0,Math.PI/2,false);
      addMesh(g, GCone(.12,.22,4), M('#111'), .11,1.6,.5, 0,0,-Math.PI/2,false);
    } else {                                                                   // busser cap
      addMesh(g, GSphS(.48,16,8), M('#ef6c00'), 0,2.2,0).scale.set(1,.45,1);
      addMesh(g, GRBox(.5,.05,.35,.03), M('#ef6c00'), 0,2.2,.5, 0,0,0,false);
    }
    if(lt>=1) addMesh(g, GTor(.56,.05,6,24), trim, 0,1.55,0, Math.PI/2,0,0,false);
    return g;
  });
  g._lvlTier = lt;
  return g;
}









// ── SEAFOOD STATION BUILDERS ──────────────────────────────────
function buildCooler(){
  const g=new THREE.Group();
  addMesh(g, GBox(3,2.8,2), M('#b3e5fc'), 0,1.4,0);
  addMesh(g, GBox(3.1,0.18,2.1), M('#e1f5fe'), 0,2.89,0);
  addMesh(g, GBox(2.6,0.6,1.6), M('#0288d1'), 0,2.4,0);
  addMesh(g, GBox(2.4,0.1,1.4), M('#80d8ff'), 0,2.72,0, 0,0,0,false);
  return g;
}
function buildBeachGrill(){
  const g=new THREE.Group();
  addMesh(g, GBox(3.2,2.6,2.2), M('#37474f'), 0,1.3,0);
  addMesh(g, GBox(2.8,0.18,1.5), M('#ff8f00'), 0,2.62,0.2, 0,0,0,false);
  addMesh(g, GBox(3.3,1.8,0.4), M('#263238'), 0,3.7,-1.05);
  addMesh(g, GCyl(.18,2.8,8), M('#9e9e9e'), 0,5.1,-1.05);
  for(let i=-1;i<=1;i+=.4) addMesh(g, GBox(2.8,.06,.06), M('#555'), i,2.7,.2, 0,Math.PI/2,0,false);
  return g;
}
function buildAssemblyStation(w,d){
  const g=new THREE.Group();
  addMesh(g, GBox(w,2.8,d), M('#795548'), 0,1.4,0);
  addMesh(g, GBox(w+.18,.18,d+.18), M('#f9e4b7'), 0,2.89,0);
  addMesh(g, GBox(w+.32,.09,d+.32), M('#d4b483'), 0,2.98,0);
  // Taco shell rack on top
  addMesh(g, GBox(0.5,0.3,0.3), M('#ffd54f'), -0.6,3.1,0);
  addMesh(g, GBox(0.5,0.3,0.3), M('#ffd54f'),  0.6,3.1,0);
  return g;
}
function buildChowderPot(){
  const g=new THREE.Group();
  addMesh(g, GBox(2.2,2.8,1.8), M('#37474f'), 0,1.4,0);
  addMesh(g, new THREE.CylinderGeometry(0.65,0.55,0.9,14), M('#5d4037'), 0,3.1,0);
  addMesh(g, new THREE.CylinderGeometry(0.62,0.62,0.08,14), M('#fff8e1'), 0,3.56,0, 0,0,0,false);
  addMesh(g, GBox(0.12,0.5,0.12), M('#9e9e9e'), 0.5,3.35,0);
  return g;
}
function buildLemonadeStation(){
  const g=new THREE.Group();
  addMesh(g, GBox(2,2.8,2), M('#f9a825'), 0,1.4,0);
  addMesh(g, GBox(2.1,0.18,2.1), M('#fff9c4'), 0,2.89,0);
  // Pitcher
  addMesh(g, new THREE.CylinderGeometry(0.3,0.24,0.7,12), M('#fff176'), 0,3.25,0);
  addMesh(g, GCyl(0.32,0.06,12), M('#f9a825'), 0,3.62,0, 0,0,0,false);
  // Lemon slices
  addMesh(g, new THREE.CylinderGeometry(0.2,0.2,0.06,8), M('#ffee58'), -0.35,3.65,0.2, 0,0,0,false);
  return g;
}
function buildBasketRack(w,d){
  const g=new THREE.Group();
  addMesh(g, GBox(w,2.8,d), M('#6d4c41'), 0,1.4,0);
  addMesh(g, GBox(w+.1,.1,d+.1), M('#8d6e63'), 0,2.85,0);
  return g;
}



const stations = {};
// ── Static station batch ─────────────────────────────────────────────────────
// Stations don't move outside Edit Mode, so all of them (robots excepted) are
// merged into one mesh per material: a full Day-20 bar draws its equipment in a
// few dozen calls instead of a couple of hundred. The individual station meshes
// stay in the scene (hidden) for Edit Mode, positions and raycast-free logic.
const stationBatch = new THREE.Group(); scene.add(stationBatch);
let _stationBatchDirty = true, _stationBatchOn = false;
function markStationsDirty(){ _stationBatchDirty = true; }
function _clearStationBatch(){
  while(stationBatch.children.length){ const m = stationBatch.children[0]; stationBatch.remove(m); if(m.geometry) m.geometry.dispose(); }
}
function updateStationBatch(){
  if(gameState === 'edit'){
    if(_stationBatchOn){
      _clearStationBatch();
      for(const k in stations) if(stations[k].mesh) stations[k].mesh.visible = true;
      _stationBatchOn = false;
    }
    _stationBatchDirty = true;
    return;
  }
  if(_stationBatchOn && !_stationBatchDirty) return;
  _clearStationBatch();
  const statics = [];
  for(const k in stations){ const s = stations[k]; if(s.mesh && s.type !== 'robot'){ s.mesh.visible = true; statics.push(s.mesh); } }
  stGrp.updateMatrixWorld(true);
  const parts = _mergeRoots(statics, new THREE.Matrix4().copy(stGrp.matrixWorld).invert());
  for(const p of parts){
    p.geo._shared = false;
    const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = p.cast; m.receiveShadow = true;
    stationBatch.add(m);
  }
  for(const s of statics) s.visible = false;
  _stationBatchOn = true; _stationBatchDirty = false;
}

function addStation(id,type,x,z,w,d,opts={}){
  if(stations[id]) return stations[id];
  markStationsDirty();
  let mesh;
  if(type==='fridge')  mesh=buildFridge();
  if(type==='sink')    mesh=buildSink();
  if(type==='trayrack') mesh=buildTrayRack(w,d);
  if(type==='grill')   mesh=buildGrill();
  if(type==='fryer')   mesh=buildFryer();
  if(type==='sodafountain') mesh=buildSodaFountain();
  if(type==='counter') mesh=buildCounter(w,d);
  if(type==='trash')   mesh=buildTrash();
  if(type==='dumpster')mesh=buildDumpster();
  if(type==='table')   mesh=buildTable();
  if(type==='robot')   mesh=buildRobot(opts.role||'busser', getRobotLevel({hiredDay:opts.hiredDay}));
  // seafood stations
  if(type==='cooler')           mesh=buildCooler();
  if(type==='beachgrill')       mesh=buildBeachGrill();
  if(type==='assembly')         mesh=buildAssemblyStation(w,d);
  if(type==='chowderpot')       mesh=buildChowderPot();
  if(type==='lemonadestation')  mesh=buildLemonadeStation();
  if(type==='basketrack')       mesh=buildBasketRack(w,d);
  mesh.position.set(x,0,z);
  stGrp.add(mesh);
  const s={id,type,x,z,w,d,mesh,visuals:[],...opts};
  if(type==='grill')   s.slots=[null,null];
  if(type==='fryer')   s.slots=[null,null];
  if(type==='counter') s.item=null;
  if(type==='sink')    s.cleanTrays=0; 
  if(type==='trayrack') s.cleanTrays=0; 
  if(type==='trash')   s.contents=0; 
  if(type==='table')   { s.r=2.2; s.group=null; s.served=0; s.dirtyTrays=0; }
  if(type==='robot')   { s.role=opts.role||'busser'; s.state='idle'; s.pos=new THREE.Vector3(x,0,z); s.target=null; s.holding=null; s.timer=0; s._actionCooldown=0; }
  // seafood
  if(type==='beachgrill')      s.slots=[null,null];
  if(type==='assembly')        s.item=null;
  if(type==='chowderpot')      { s.chowderReady=true; s.cooldown=0; } // always has chowder
  if(type==='lemonadestation') s.item=null;
  if(type==='basketrack')      s.cleanBaskets=4;
  if(type==='cooler')          s.item=null; // unlimited raw fish (refills auto)
  stations[id]=s; return s;
}
function removeStation(id){
  const s = stations[id];
  if(!s) return;
  if(s.visuals) s.visuals.forEach(v => discard(scene, v));
  discard(stGrp, s.mesh); markStationsDirty();
  delete stations[id];
}

function initStations(){
  if(isSeafood()){
    // Seafood Shack layout
    addStation('cooler0',   'cooler',      -8,  -8,  3,   2);
    addStation('bgrill0',   'beachgrill',   0,  -8.5,3.2, 2);
    addStation('assembly0', 'assembly',     6,  -8.5,2.2, 1.8);
    addStation('chowder0',  'chowderpot',  -3.5,-8.5,2.2, 1.8);
    addStation('lemonade0', 'lemonadestation', 9,-8.5,2, 2);
    addStation('basketrack0','basketrack', -5.5,-8,  1.8, 1.8);
    addStation('sink0','sink',-8,3,1.8,1.8);
    addStation('trash0','trash', 8, 4, 2, 2);
    addStation('dumpster0','dumpster', 0, bounds.b+20, 4, 3);
    addStation('table0','table',0,4,5,5);
  } else {
    addStation('fridge','fridge',-8,-8,3,3);
    addStation('sink0','sink',-4.5,-8.5,1.8,1.8);
    addStation('rack0','trayrack',-2.2,-8.5,1.8,1.8); 
    addStation('grill0','grill',1.2,-8.5,3.5,2);
    addStation('counter0','counter',4.8,-8.5,1.8,1.8);
    addStation('counter1','counter',7.2,-8.5,1.8,1.8);
    addStation('trash0','trash',-8,6,2,2);
    addStation('dumpster0', 'dumpster', 0, bounds.b + 20, 4, 3); 
    addStation('table0','table',0,4,5,5);
  }
}

