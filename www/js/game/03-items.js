// Burger Bar — 03-items. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ITEM MESHES (Option B Combo Stacking)
// ─────────────────────────────────────────────────────────────
// Item models. itemParts() builds the raw parts; itemMesh() returns a BAKED
// copy (one mesh per material, geometry shared across every copy), because
// trays, burgers and cups are created constantly: on stations, in hands, on
// tables. Composite items reuse the parts of their components.
function itemMesh(type){ return bake('item|'+type, ()=>itemParts(type)); }
function burgerParts(g, x, y, z, s){
  const b = new THREE.Group(); b.position.set(x,y,z); b.scale.setScalar(s||1); g.add(b);
  addMesh(b, GCylT(.47,.43,.16,20), M('#d99a4e'), 0,.08,0);                         // heel
  addMesh(b, GCylT(.52,.52,.15,20), MP('#5b3219',25), 0,.24,0);                      // patty
  addMesh(b, GBox(.82,.035,.82), M('#ffc928'), 0,.33,0, 0,Math.PI/4,0,false);        // cheese
  addMesh(b, GCylT(.56,.5,.05,14), M('#7cc242'), 0,.37,0, 0,0,0,false);              // lettuce
  addMesh(b, GCyl(.36,.05,16), M('#e53935'), 0,.41,0, 0,0,0,false);                  // tomato
  const crown = addMesh(b, GSphS(.52,20,10), M('#e3a352'), 0,.43,0); crown.scale.set(1,.62,1);
  for(let i=0;i<9;i++){                                                              // sesame
    const a = i*2.4, r = .14 + (i%3)*.11;
    addMesh(b, GSphS(.035,5,4), M('#fff3d0'), Math.cos(a)*r, .43+.3*Math.sqrt(Math.max(0,1-(r/.52)**2)), Math.sin(a)*r, 0,0,0,false).scale.set(1,.6,1.4);
  }
}
function sodaParts(g, x, y, z, s){
  const c = new THREE.Group(); c.position.set(x,y,z); c.scale.setScalar(s||1); g.add(c);
  addMesh(c, GCylT(.2,.15,.52,16), M('#e53935'), 0,.26,0);
  addMesh(c, GCylT(.19,.18,.14,16), M('#fafafa'), 0,.3,0, 0,0,0,false);
  addMesh(c, GCylT(.215,.2,.05,16), M('#fafafa'), 0,.54,0, 0,0,0,false);
  addMesh(c, GCyl(.025,.38,6), M('#f8bbd0'), .05,.7,0, 0,0,.18,false);
}
function friesParts(g, x, y, z, s, burnt){
  const f = new THREE.Group(); f.position.set(x,y,z); f.scale.setScalar(s||1); g.add(f);
  addMesh(f, GCylT(.3,.2,.48,4), M(burnt?'#6d2a24':'#d32f2f'), 0,.24,0, 0,Math.PI/4,0);
  if(!burnt) addMesh(f, GCyl(.08,.02,10), M('#ffca28'), 0,.3,.2, Math.PI/2,0,0,false);
  [[-.1,-.08,.1],[.08,-.1,-.08],[0,.06,.05],[-.06,.1,-.12],[.11,.05,.14],[.02,-.02,-.05],[-.12,.0,0]].forEach(([fx,fz,rz])=>
    addMesh(f, GBox(.055,.5,.055), M(burnt?'#3a2a1a':'#f4c542'), fx,.58,fz, 0,0,rz,false));
}
function trayParts(g){
  addMesh(g, GRBox(1.6,.09,1.1,.04), MP('#c62828',40), 0,.045,0, 0,0,0,false);
  addMesh(g, GBox(1.3,.012,.82), MT('gingham', TEX.gingham, 128), 0,.095,0, 0,0,0,false);
}
function itemParts(type){
  const g=new THREE.Group();
  if(type==='raw'){
    addMesh(g, GCylT(.5,.5,.16,20), M('#d9606f'), 0,.08,0, 0,0,0,false);
    for(let i=0;i<6;i++) addMesh(g, GSphS(.05,5,4), M('#f2c6cb'), Math.cos(i*1.9)*.28,.16,Math.sin(i*1.9)*.25, 0,0,0,false);
  } else if(type==='cooked'){
    burgerParts(g, 0,0,0, 1);
  } else if(type==='charred'){
    addMesh(g, GCylT(.48,.5,.15,20), M('#2a1d17'), 0,.08,0, 0,0,0,false);
    for(let i=0;i<3;i++) addMesh(g, GSph(.12,6), M('#555'), -.15+i*.15,.3+i*.1,0, 0,0,0,false);   // smoke puffs
  } else if(type==='soda'){
    sodaParts(g, 0,0,0, 1);
  } else if(type==='tray'){
    trayParts(g);
  } else if(type==='dirty_tray'){
    trayParts(g);
    const pc=[M('#8a6045'),M('#c9a77c'),M('#6b8e23')];
    [[-.45,.2],[.3,-.25],[.5,.22],[-.2,-.3],[.05,.05],[-.55,-.1]].forEach(([px,pz],i)=>
      addMesh(g, crumbGeo(i), pc[i%3], px,.13,pz, 0,0,0,false));
    addMesh(g, GIco(.18), M('#fafafa'), .45,.18,-.05, 0,0,0,false);                 // crumpled napkin
    addMesh(g, GCyl(.17,.01,12), M('#c62828'), -.3,.11,.15, 0,0,0,false);           // ketchup smear
  } else if(type==='soda_on_tray'){
    trayParts(g); sodaParts(g, 0,.09,0, 1);
  } else if(type==='burger_on_tray'){
    trayParts(g); burgerParts(g, 0,.1,0, 1);
  } else if(type==='burger_soda_on_tray'){
    trayParts(g); burgerParts(g, -.33,.1,0, .92); sodaParts(g, .46,.09,0, .95);
  } else if(type==='trash_bag'){
    addMesh(g, GIco(.62,1), MP('#2e3b2f',80), 0,.55,0);
    addMesh(g, GCylT(.06,.16,.25,8), MP('#2e3b2f',80), 0,1.15,0);
    addMesh(g, GTor(.1,.03,6,10), M('#ffca28'), 0,1.3,0, 0,0,0,false);
  } else if(type==='raw_fries'){
    addMesh(g, GRBox(.62,.3,.5,.05), MP('#9e9e9e',80), 0,.15,0, 0,0,0,false);       // wire basket
    [[-.15,-.1],[.1,.1],[0,-.12],[.18,-.05],[-.08,.12]].forEach(([fx,fz])=>
      addMesh(g, GBox(.06,.34,.06), M('#efe2b4'), fx,.33,fz, 0,0,.25*fx*4,false));
  } else if(type==='fries'){
    friesParts(g, 0,0,0, 1, false);
  } else if(type==='burnt_fries'){
    friesParts(g, 0,0,0, 1, true);
  } else if(type==='fries_on_tray'){
    trayParts(g); friesParts(g, 0,.09,0, .85, false);
  } else {
    console.warn('itemMesh: unknown item', type);
  }
  return g;
}

