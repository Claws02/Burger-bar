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
    // ── BURGER BAR WORLD (original) ──────────────────────────
    scene.background = new THREE.Color('#87CEEB');
    scene.fog = new THREE.Fog('#87CEEB', 50, 110);

    addMesh(worldGrp, GBox(120,.5,120), matGrass, 0,-.75,0, 0,0,0,false);
    addMesh(worldGrp, GBox(rW+sw*2,.3,rD+sw*2), matSidewalk, cx,-.2,cz, 0,0,0,false);
    addMesh(worldGrp, GBox(100,.2,12), matRoad, cx,-.25, b.b+sw+6, 0,0,0,false);
    for(let i=-4;i<=4;i++) addMesh(worldGrp, GBox(4,.05,.4), matRoadLine, cx+i*10,-.15, b.b+sw+6, 0,0,0,false);
    addMesh(worldGrp, GBox(rW+sw*2+2,.4,.5), matSilver, cx,-.1, b.b+sw, 0,0,0,false);

    for(const lx of [b.l-4, b.r+4]){
      addMesh(worldGrp, GCyl(.12,7,8), M('#455A64'), lx,3.5, b.b+sw-1);
      addMesh(worldGrp, GBox(1,.5,.8), M('#37474F'), lx,7.2, b.b+sw-1);
      addMesh(worldGrp, GSph(.22,8), MB('#ffffff'), lx,7.0, b.b+sw-1, 0,0,0,false);
    }

    for(const px of [dcx-8, dcx+8]){
      addMesh(worldGrp, GBox(1.5,1,1.5), matWood, px,.5, b.b+2);
      addMesh(worldGrp, GBox(1.3,.2,1.3), matFrameDark, px,1.1, b.b+2, 0,0,0,false);
      addMesh(worldGrp, GSph(.65,8), matPlant, px,1.7, b.b+2);
    }

    const treePos=[
      {x:b.l-8,z:b.t-6},{x:b.r+8,z:b.t-6},
      {x:b.l-10,z:cz},  {x:b.r+10,z:cz},
      {x:b.l-10,z:b.b+4},{x:b.r+10,z:b.b+4},
    ];
    for(const tp of treePos){
      addMesh(worldGrp, GCyl(.35,3,8), M('#8d6e63'), tp.x,1.5,tp.z);
      addMesh(worldGrp, GSph(2.1,8), M('#4caf50'), tp.x,5.5,tp.z);
      addMesh(worldGrp, GSph(1.5,8), M('#66bb6a'), tp.x+.7,6.4,tp.z-.4);
    }

    for(const px of [dcx-7, dcx+7]){
      addMesh(worldGrp, GCyl(1.15,.15,16), M('#eeeeee'), px,1.8, b.b+4.5);
      addMesh(worldGrp, GCyl(.1,1.8,8), matPoleGray, px,.9, b.b+4.5);
      addMesh(worldGrp, GCyl(.06,5.5,8), matPoleGray, px,2.75, b.b+4.5);
      addMesh(worldGrp, new THREE.ConeGeometry(2.1,.75,8), matUmbrella, px,5.4, b.b+4.5);
    }

    addMesh(worldGrp, GBox(rW*.65,1.7,.28), matSign, cx, 4.1, bz-.35);
    ['B','U','R','G','E','R',' ','B','A','R'].forEach((l,i)=>{
      if(l===' ') return;
      addMesh(worldGrp, GBox(.55,1.1,.14), matSignTxt, cx-3.5+i*.7, 4.1, bz-.22);
    });
    addMesh(worldGrp, GBox(.18,2.4,.18), matSilver, cx-rW*.3, 3.2, bz-.35);
    addMesh(worldGrp, GBox(.18,2.4,.18), matSilver, cx+rW*.3, 3.2, bz-.35);
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
  
  if(isSeafood()){
    // Sandy tile floor with blue grout lines
    addMesh(roomGrp, GBox(w,.25,d), M('#e0c882'), cx,.05,cz, 0,0,0,false);
    for(let xi=0;xi<w;xi+=1.5) addMesh(roomGrp, GBox(.05,.01,d), M('#4fc3f7'), b.l+xi,.18,cz, 0,0,0,false);
  } else {
    addMesh(roomGrp, GBox(w,.25,d), matDFloor, cx,.05,cz, 0,0,0,false);
    for(let xi=0;xi<w;xi+=1.5) addMesh(roomGrp, GBox(.05,.01,d), M('#c2a057'), b.l+xi,.18,cz, 0,0,0,false);
  }

  const wH=2.8, wT=0.55, doorHalfW = 2.5;
  function wallSeg(x,y,z,sw,sh,sd,isK){
    addMesh(roomGrp, GBox(sw,sh,sd), isK?matWallKitch:matWallOut, x,y,z);
    addMesh(roomGrp, GBox(sw+.08,.2,sd+.08), matWallCap, x,y+sh/2+.1,z);
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
      const pw = doorHalfW*2/2-.2, ph=wH-.08;
      addMesh(roomGrp, GBox(doorHalfW*2+wT*.5,.22,wT), matFrameDark, ecx, wH, e.fixed);
      const dl=new THREE.Mesh(GBox(pw,ph,.1), M('#8D6E63',.9)); dl.position.set(ecx-pw/2-.18,ph/2,e.fixed); dl.rotation.y=.08; roomGrp.add(dl);
      const dr=new THREE.Mesh(GBox(pw,ph,.1), M('#8D6E63',.9)); dr.position.set(ecx+pw/2+.18,ph/2,e.fixed); dr.rotation.y=-.08; roomGrp.add(dr);
    }
  }

  for(let xi=0;xi<w;xi+=1){
    for(let yi=0;yi<2;yi++) addMesh(roomGrp, GBox(.82,.82,.05), M('#ffffff'), b.l+xi+.5, .5+yi*.88+.18, b.t-wT+.32, 0,0,0,false);
  }
}

// ─────────────────────────────────────────────────────────────
//  STATION BUILDERS
// ─────────────────────────────────────────────────────────────
function buildFridge(){
  const g=new THREE.Group();
  addMesh(g, GBox(3,5,3), matSilver, 0,2.5,0);
  const d=new THREE.Mesh(GBox(2.8,3.5,.45), M('#8ab8d0',.8)); d.position.set(0,3,1.5); g.add(d);
  addMesh(g, GBox(.28,1.4,.28), matBlack, 1.15,3,1.78);
  addMesh(g, GBox(1.4,.55,.05), M('#1565C0'), 0,1.4,1.53);
  return g;
}
function buildSink(){
  const g=new THREE.Group();
  addMesh(g, GBox(1.8,2.8,1.8), matSilver, 0,1.4,0);
  addMesh(g, GBox(1.6,.3,1.6), M('#b0bec5'), 0,2.95,0);
  addMesh(g, GBox(1.4,.2,1.4), M('#81d4fa',.8), 0,3.0,0);
  addMesh(g, GBox(.12,.8,.8), matSilver, 0,3.5,-0.6);
  return g;
}
function buildTrayRack(w,d){
  const g=new THREE.Group();
  addMesh(g, GBox(w,2.8,d), M('#5D4037'), 0,1.4,0); 
  addMesh(g, GBox(w+.1,.1,d+.1), matSilver, 0,2.85,0); 
  addMesh(g, GBox(w-.2,.3,.05), matSilver, 0,3.0,-d/2+.1); 
  return g;
}
function buildGrill(){
  const g=new THREE.Group();
  addMesh(g, GBox(3.5,3,2.5), matDark, 0,1.5,0);
  addMesh(g, GBox(3.0,.18,1.5), matGlowRed, 0,3,.2, 0,0,0,false);
  addMesh(g, GBox(3.6,2.1,.4), matDark, 0,4.05,-1.05);
  addMesh(g, GCyl(.2,3.2,8), matSilver, 0,5.3,-1.05);
  for(let i=-1.2;i<=1.2;i+=.4) addMesh(g, GBox(3.0,.08,.08), M('#333'), i,3.1,.2, 0,Math.PI/2,0, false);
  return g;
}
function buildFryer(){
  const g=new THREE.Group();
  addMesh(g, GBox(3.2,3,2.5), matDark, 0,1.5,0);
  addMesh(g, GBox(2.8,.4,1.8), matSilver, 0,2.85,.1);                 // oil vat rim
  addMesh(g, GBox(2.6,.2,1.6), M('#d7a13a'), 0,3.04,.1, 0,0,0,false); // golden oil surface
  addMesh(g, GBox(3.3,2,.4), matDark, 0,3.9,-1.05);                   // back panel
  addMesh(g, GBox(.5,.5,.3), matBlack, -1.0,3.4,-.95);               // control box
  addMesh(g, GCyl(.1,2.2,8), matSilver, 1.2,3.9,-.6, 0,0,-Math.PI/3); // basket handle
  return g;
}
function buildSodaFountain(){
  const g=new THREE.Group();
  addMesh(g, GBox(2,2.8,2), M('#8d6e63'), 0,1.4,0);
  addMesh(g, GBox(2.2,.18,2.2), M('#eeeeee'), 0,2.89,0);
  addMesh(g, GBox(1.4, 1.5, 1.0), matSilver, 0, 3.65, -0.4);
  addMesh(g, GBox(1.2, 0.4, 0.8), matBlack, 0, 4.2, -0.3);
  addMesh(g, GBox(1.4, 0.1, 1.2), matSilver, 0, 3.0, 0.1); 
  for(let i=-0.4; i<=0.4; i+=0.4) {
    addMesh(g, GCyl(0.05, 0.2, 8), matSilver, i, 3.3, 0);
    addMesh(g, GBox(0.2, 0.3, 0.1), M('#f44336'), i, 3.6, 0.1);
  }
  return g;
}
function buildTrash(){
  const g=new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(.78,.6,2.5,16), M('#2e7d32'), 0,1.25,0);
  addMesh(g, new THREE.CylinderGeometry(.84,.84,.18,16), M('#1b5e20'), 0,2.6,0);
  return g;
}
function buildDumpster(){
  const g=new THREE.Group();
  addMesh(g, GBox(4, 3, 3), M('#1b5e20'), 0, 1.5, 0); 
  addMesh(g, GBox(4.2, 0.2, 3.2), matBlack, 0, 3.1, 0); 
  addMesh(g, GBox(0.2, 3.2, 0.2), matSilver, -2.1, 1.6, 0); 
  addMesh(g, GBox(0.2, 3.2, 0.2), matSilver, 2.1, 1.6, 0);
  return g;
}
function buildCounter(w,d){
  const g=new THREE.Group();
  addMesh(g, GBox(w,2.8,d), M('#8d6e63'), 0,1.4,0);
  addMesh(g, GBox(w+.18,.18,d+.18), M('#eeeeee'), 0,2.89,0);
  addMesh(g, GBox(w+.32,.09,d+.32), M('#9e9e9e'), 0,2.98,0);
  return g;
}
function buildTable(){
  const g=new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(1.2,1.2,.12,16), M('#e6c27a'), 0,2.12,0);
  addMesh(g, GCyl(.12,2.12,8), M('#757575'), 0,1.06,0);
  addMesh(g, GCyl(.45,.06,16), M('#9e9e9e'), 0,.06,0);
  addMesh(g, GCyl(.08,.45,8), M('#FFFDE7'), 0,2.35,0);
  const flame=new THREE.Mesh(GSph(.1,6), MB('#FF9100')); flame.position.set(0,2.62,0); g.add(flame);
  
  for(const sx of [-2.8, 2.8]){
    addMesh(g, new THREE.CylinderGeometry(.55,.55,.09,12), M('#c29b57'), sx,.98,0);
    addMesh(g, GCyl(.08,.98,8), M('#757575'), sx,.49,0);
  }
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

function buildRobot(role){
  const g=new THREE.Group();
  const bodyColor = role==='chef'?'#00bcd4':role==='waiter'?'#e91e63':'#ff9800';
  addMesh(g, GSph(.7,12), M(bodyColor), 0,1.4,0);
  addMesh(g, GBox(.9,.28,.28), M('#ffffff'), 0,1.55,.58);
  addMesh(g, GCyl(.05,.6,6), M('#ccc'), 0,2.15,0);
  addMesh(g, GSph(.12,6), MB('#ffeb3b'), 0,2.5,0);
  return g;
}

const stations = {};
function addStation(id,type,x,z,w,d,opts={}){
  if(stations[id]) return stations[id];
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
  if(type==='robot')   mesh=buildRobot(opts.role||'busser');
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
  discard(stGrp, s.mesh);
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

