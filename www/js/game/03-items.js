// Burger Bar — 03-items. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ITEM MESHES (Option B Combo Stacking)
// ─────────────────────────────────────────────────────────────
function itemMesh(type){
  const g=new THREE.Group();
  if(type==='raw'){
    addMesh(g, GCyl(.3,.18,12), matRaw, 0,.09,0, 0,0,0,false);
  } else if(type==='cooked'){
    addMesh(g, GSphS(.55,8,6), matBun, 0,.1,0).scale.set(.95,.3,.95);
    addMesh(g, GCyl(.28,.18,12), matMeat, 0,.3,0);
    addMesh(g, GBox(.9,.05,.9), matCheese, 0,.45,0);
    addMesh(g, GCyl(.28,.06,12), matTomato, 0,.55,0);
    addMesh(g, GSphS(.55,8,6), matBun, 0,.75,0).scale.set(.95,.34,.95);
  } else if(type==='charred'){
    addMesh(g, GCyl(.3,.18,12), matCharred, 0,.09,0, 0,0,0,false);
  } else if(type==='soda'){
    addMesh(g, GCyl(0.18, 0.4, 12), matCup, 0, 0.28, 0); 
    addMesh(g, GCyl(0.19, 0.05, 12), matSilver, 0, 0.5, 0); 
    addMesh(g, GCyl(0.02, 0.2, 6), matSilver, 0, 0.6, 0); 
  } else if(type==='tray'){
    addMesh(g, GBox(1.6, 0.08, 1.1), matTray, 0,.04,0, 0,0,0,false); 
    addMesh(g, GBox(1.5, 0.12, 1.0), M('#dddddd'), 0,.06,0, 0,0,0,false); 
  } else if(type==='dirty_tray'){
    addMesh(g, GBox(1.6, 0.08, 1.1), matTray, 0,.04,0, 0,0,0,false); 
    const pc=[M('#8a6045'),M('#a88b73'),M('#556b2f')];
    for(let i=0;i<6;i++){
      const pm=new THREE.Mesh(crumbGeo(i), pc[i%3]);
      pm.position.set((Math.random()-.5)*1.3,.1,(Math.random()-.5)*.8); g.add(pm);
    }
  } else if(type==='soda_on_tray'){
    g.add(itemMesh('tray'));
    const sm=itemMesh('soda'); sm.position.set(0, 0.04, 0); g.add(sm);
  } else if(type==='burger_on_tray'){
    g.add(itemMesh('tray'));
    const bm=itemMesh('cooked'); bm.position.set(0, 0.08, 0); g.add(bm);
  } else if(type==='burger_soda_on_tray'){
    g.add(itemMesh('tray'));
    const bm=itemMesh('cooked'); bm.position.set(-0.35, 0.08, 0); g.add(bm); 
    const sm=itemMesh('soda'); sm.position.set(0.45, 0.04, 0); g.add(sm); 
  } else if(type==='trash_bag'){
    addMesh(g, GSph(0.6, 12), matTrashBag, 0, 0.5, 0);
    addMesh(g, GCyl(0.1, 0.2, 8), matTrashBag, 0, 1.1, 0);

  // ── FRIES ITEMS ─────────────────────────────────────────────
  } else if(type==='raw_fries'){
    // Pale cut potatoes, not yet fried.
    addMesh(g, GBox(0.5,0.28,0.5), M('#d9c48a'), 0,0.14,0, 0,0,0,false);
    [[-.12,-.08],[.1,.1],[0,-.12]].forEach(([fx,fz])=> addMesh(g, GBox(0.07,0.32,0.07), M('#e5d9a8'), fx,0.3,fz, 0,0,0, false));
  } else if(type==='fries'){
    // Golden fries in a red carton.
    addMesh(g, GBox(0.42,0.5,0.42), M('#e53935'), 0,0.25,0, 0,0,0,false);
    [[-.12,-.1],[.1,-.12],[0,.08],[-.08,.1],[.12,.06]].forEach(([fx,fz])=> addMesh(g, GBox(0.06,0.5,0.06), M('#f1c453'), fx,0.55,fz, 0,0,0, false));
  } else if(type==='burnt_fries'){
    addMesh(g, GBox(0.42,0.5,0.42), M('#7a2f2a'), 0,0.25,0, 0,0,0,false);
    [[-.12,-.1],[.1,-.12],[0,.08],[-.08,.1],[.12,.06]].forEach(([fx,fz])=> addMesh(g, GBox(0.06,0.5,0.06), M('#3a2a1a'), fx,0.55,fz, 0,0,0, false));
  } else if(type==='fries_on_tray'){
    g.add(itemMesh('tray'));
    const fm=itemMesh('fries'); fm.position.set(0, 0.04, 0); fm.scale.set(0.85,0.85,0.85); g.add(fm);

  // ── SEAFOOD ITEMS ──────────────────────────────────────────
  } else if(type==='raw_fish'){
    // Raw fish fillet — orange slab
    addMesh(g, GBox(0.8,0.15,0.5), M('#ff7043'), 0,0.08,0, 0,0,0,false);
    addMesh(g, GBox(0.6,0.08,0.35),M('#ff8a65'), 0,0.16,0, 0,0,0,false);
  } else if(type==='cooked_fish'){
    // Grilled fish — golden with grill marks
    addMesh(g, GBox(0.8,0.18,0.5), M('#ffb300'), 0,0.09,0, 0,0,0,false);
    for(let i=-1;i<=1;i++) addMesh(g, GBox(0.8,0.04,0.04), M('#5d4037'), 0,0.19,i*0.12, 0,0,0,false);
  } else if(type==='charred_fish'){
    addMesh(g, GBox(0.8,0.18,0.5), M('#3e2723'), 0,0.09,0, 0,0,0,false);
  } else if(type==='fish_taco'){
    // Taco shell (U-shape) + fish filling
    addMesh(g, cachedGeo('taco', ()=>new THREE.CylinderGeometry(0.35,0.35,0.55,16,1,true,0,Math.PI)), M('#ffd54f'), 0,0.1,0, 0,0,0,false);
    addMesh(g, GBox(0.5,0.2,0.25), M('#ffb300'), 0,0.22,0, 0,0,0,false);
    addMesh(g, GBox(0.4,0.08,0.18), M('#aed581'), 0,0.32,0, 0,0,0,false); // lettuce
    addMesh(g, GBox(0.3,0.06,0.14), M('#ef5350'), 0,0.38,0, 0,0,0,false); // salsa
  } else if(type==='chowder'){
    // Bowl with creamy soup
    addMesh(g, GCylT(0.38,0.28,0.32,16), M('#8d6e63'), 0,0.16,0);
    addMesh(g, GCyl(0.34,0.04,16), M('#fff8e1'), 0,0.32,0, 0,0,0,false);
    addMesh(g, GSph(0.1,6), M('#ff8f00'), -0.12,0.36,0);
    addMesh(g, GSph(0.08,6), M('#e91e63'), 0.1,0.35,0.08);
  } else if(type==='lemonade'){
    // Yellow cup with straw
    addMesh(g, GCyl(0.18,0.4,12), M('#fff176'), 0,0.28,0);
    addMesh(g, GCyl(0.19,0.05,12), M('#f9a825'), 0,0.5,0);
    addMesh(g, GCyl(0.015,0.35,6), M('#fff'), 0,0.62,0);
    addMesh(g, GSph(0.05,6), M('#ffee58'), 0,0.5,0.15);
  } else if(type==='basket'){
    // Wicker seafood basket
    addMesh(g, GBox(1.6,0.1,1.1), M('#8d6e63'), 0,0.05,0, 0,0,0,false);
    addMesh(g, GBox(1.5,0.14,1.0), M('#a1887f'), 0,0.07,0, 0,0,0,false);
    // Basket weave lines
    for(let i=-2;i<=2;i++) addMesh(g, GBox(1.52,0.02,0.04), M('#795548'), 0,0.14,i*0.19, 0,0,0,false);
  } else if(type==='dirty_basket'){
    addMesh(g, GBox(1.6,0.1,1.1), M('#8d6e63'), 0,0.05,0, 0,0,0,false);
    addMesh(g, GBox(1.5,0.14,1.0), M('#5d4037'), 0,0.07,0, 0,0,0,false);
    const pc=[M('#8a6045'),M('#556b2f'),M('#3e2723')];
    for(let i=0;i<5;i++){
      const pm=new THREE.Mesh(crumbGeo(i), pc[i%3]);
      pm.position.set((Math.random()-.5)*1.3,.15,(Math.random()-.5)*.8); g.add(pm);
    }
  } else if(type==='taco_in_basket'){
    g.add(itemMesh('basket'));
    const t=itemMesh('fish_taco'); t.position.set(0,0.08,0); g.add(t);
  } else if(type==='chowder_in_basket'){
    g.add(itemMesh('basket'));
    const c=itemMesh('chowder'); c.position.set(0,0.08,0); g.add(c);
  } else if(type==='lemonade_in_basket'){
    g.add(itemMesh('basket'));
    const l=itemMesh('lemonade'); l.position.set(0,0.04,0); g.add(l);
  } else if(type==='taco_chowder_basket'){
    g.add(itemMesh('basket'));
    const t=itemMesh('fish_taco'); t.position.set(-0.38,0.08,0); g.add(t);
    const c=itemMesh('chowder'); c.position.set(0.4,0.08,0); c.scale.setScalar(0.82); g.add(c);
  } else if(type==='taco_lemonade_basket'){
    g.add(itemMesh('basket'));
    const t=itemMesh('fish_taco'); t.position.set(-0.38,0.08,0); g.add(t);
    const l=itemMesh('lemonade'); l.position.set(0.4,0.04,0); l.scale.setScalar(0.85); g.add(l);
  }
  return g;
}

