// Instrumented Three.js stub for headless testing of Burger Bar.
//
// It is deliberately NOT a renderer. It implements just enough of the r128 API
// for the game script to run, and it *counts every geometry and material ever
// constructed and every one explicitly disposed*. That counter is the whole
// point: it turns "does the game leak GPU memory" into a number.

const counters = { geoCreated:0, geoDisposed:0, matCreated:0, matDisposed:0 };
function resetCounters(){ for(const k in counters) counters[k]=0; }

class Geometry {
  constructor(){ counters.geoCreated++; this.isBufferGeometry=true; this._disposed=false; }
  dispose(){ if(!this._disposed){ this._disposed=true; counters.geoDisposed++; } }
}
class Material {
  constructor(p={}){ counters.matCreated++; this._disposed=false;
    this.color=new Color(p.color); this.transparent=!!p.transparent;
    this.opacity=p.opacity!==undefined?p.opacity:1; this.side=p.side; this.map=null; }
  dispose(){ if(!this._disposed){ this._disposed=true; counters.matDisposed++; } }
}
class Color {
  constructor(c){ this.set(c); }
  set(c){ this._v=c; return this; }
  setHex(h){ this._v=h; return this; }
  getHex(){ return typeof this._v==='number'?this._v:0; }
}
class Vector3 {
  constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; }
  set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; }
  copy(v){ this.x=v.x; this.y=v.y; this.z=v.z; return this; }
  clone(){ return new Vector3(this.x,this.y,this.z); }
  add(v){ this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
  sub(v){ this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; }
  multiplyScalar(s){ this.x*=s; this.y*=s; this.z*=s; return this; }
  length(){ return Math.hypot(this.x,this.y,this.z); }
  normalize(){ const l=this.length()||1; return this.multiplyScalar(1/l); }
  lerp(v,a){ this.x+=(v.x-this.x)*a; this.y+=(v.y-this.y)*a; this.z+=(v.z-this.z)*a; return this; }
  // Deterministic fake projection: keeps z<1 (on-screen) unless the point is
  // well behind the camera, so drawFloatUI's culling branch is exercised.
  project(cam){ const cz=cam&&cam.position?cam.position.z:0;
    const behind=this.z>cz; this.x=this.x/40; this.y=this.y/40; this.z=behind?1.2:0.5; return this; }
  applyMatrix4(){ return this; }
}
class Euler { constructor(){ this.x=0;this.y=0;this.z=0; }
  set(x,y,z){ this.x=x;this.y=y;this.z=z; return this; } }

let __uid=0;
class Object3D {
  constructor(){ this.uuid=++__uid; this.children=[]; this.parent=null;
    this.position=new Vector3(); this.rotation=new Euler(); this.scale=new Vector3(1,1,1);
    this.visible=true; this.castShadow=false; this.receiveShadow=false; this.name=''; }
  add(...cs){ for(const c of cs){ if(!c) continue; c.parent=this; this.children.push(c); } return this; }
  remove(...cs){ for(const c of cs){ const i=this.children.indexOf(c);
    if(i>=0){ this.children.splice(i,1); c.parent=null; } } return this; }
  traverse(fn){ fn(this); for(const c of this.children.slice()) c.traverse(fn); }
  getWorldPosition(t){ let x=0,y=0,z=0,o=this;
    while(o){ x+=o.position.x; y+=o.position.y; z+=o.position.z; o=o.parent; }
    return t?t.set(x,y,z):new Vector3(x,y,z); }
  lookAt(){ return this; }
  updateMatrixWorld(){ return this; }
  clone(){ const o=new Object3D(); o.position.copy(this.position); return o; }
}
class Mesh extends Object3D {
  constructor(geometry, material){ super(); this.geometry=geometry; this.material=material; }
}
class Group extends Object3D {}
class Scene extends Object3D { constructor(){ super(); this.fog=null; this.background=null; } }
class Light extends Object3D {
  constructor(){ super(); this.intensity=1; this.shadow={ mapSize:{width:0,height:0,set(){}},
    camera:{left:0,right:0,top:0,bottom:0,near:0,far:0,updateProjectionMatrix(){}} }; }
}
class Camera extends Object3D {
  constructor(){ super(); this.left=0;this.right=0;this.top=0;this.bottom=0;
    this.near=0;this.far=0;this.zoom=1;this.aspect=1;this.fov=50; }
  updateProjectionMatrix(){ return this; }
}

class WebGLRenderer {
  constructor(opts={}){ this.domElement=opts.canvas||{ addEventListener(){}, style:{} };
    this.shadowMap={enabled:false,type:0}; this.info={memory:{geometries:0,textures:0},render:{calls:0}};
    this._disposed=false; }
  setSize(){} setPixelRatio(){} setClearColor(){} render(){ this.info.render.calls++; }
  dispose(){ this._disposed=true; }
  getContext(){ return { getExtension(){ return null; } }; }
  forceContextLoss(){}
}

const THREE = {
  Scene, Group, Mesh, Object3D, Vector3, Euler, Color,
  BoxGeometry:Geometry, CylinderGeometry:Geometry, SphereGeometry:Geometry,
  PlaneGeometry:Geometry, ConeGeometry:Geometry, TorusGeometry:Geometry,
  TubeGeometry:Geometry,
  GridHelper:class extends Object3D{ constructor(){ super(); this.geometry=new Geometry(); this.material=new Material(); } },
  CatmullRomCurve3:class{ constructor(p){ this.points=p||[]; } getPoints(){ return this.points; } },
  MeshLambertMaterial:Material, MeshBasicMaterial:Material, ShadowMaterial:Material,
  AmbientLight:Light, DirectionalLight:Light, HemisphereLight:Light,
  OrthographicCamera:Camera, PerspectiveCamera:Camera,
  Fog:class{ constructor(c,n,f){ this.color=c;this.near=n;this.far=f; } },
  WebGLRenderer, PCFSoftShadowMap:2,
};

module.exports = { THREE, counters, resetCounters, Geometry, Material };
