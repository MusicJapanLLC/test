import { Scene, Camera, BufferGeometry, Float32BufferAttribute, RawShaderMaterial,
  Mesh, Points, AdditiveBlending, Vector2 } from 'three';
import { makeRenderer, visibleLoop, onResize, pointerTracker, isMobile, pixelRatioCap } from './webgl-runtime.js';
import { QualityMonitor } from './quality.js';

const vertex = `precision highp float;
attribute vec3 position; varying vec2 vUv;
void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 vUv; uniform float uTime; uniform vec2 uSize,uCenter,uPointer;
void main(){
 vec2 uv=vUv; float aspect=uSize.x/uSize.y;
 vec2 p=(uv-uCenter)*vec2(aspect,1.); p+=uPointer*.012;
 float d=length(p); float glow=exp(-d*5.5)*.095;
 float rings=pow(.5+.5*sin(d*125.-uTime*.8),22.)*exp(-d*4.)*.035;
 float field=0.;
 for(int i=0;i<8;i++){
   float fi=float(i); float x=uv.x+uPointer.x*.012;
   float bend=sin(x*5.2+uTime*.16+fi*.13)*.12;
   bend+=sin(x*9.8-uTime*.12+fi*.2)*.025;
   float line=.52+bend+(fi-3.5)*.015+uPointer.y*.007;
   float distance=abs(uv.y-line);
   float core=exp(-distance*850.)*.32;
   float haze=exp(-distance*95.)*.024;
   field+=(core+haze)*sin(uv.x*3.14159);
 }
 float edge=smoothstep(0.,.15,uv.y)*smoothstep(0.,.2,1.-uv.y);
 vec3 red=vec3(.91,.071,.235);
 gl_FragColor=vec4(red*(field+glow+rings),edge*.9);
}`;
const particleVertex = `precision highp float;
attribute vec3 position; attribute float seed;
uniform float uTime,uRatio;uniform vec2 uPointer;
varying float vAlpha;
void main(){
 vec2 p=position.xy;
 p.x+=sin(uTime*.075+seed*25.)*.028;
 p.y=mod(p.y+uTime*(.002+position.z*.003)+1.,2.)-1.;
 p+=uPointer*.022*(.3+position.z);
 gl_Position=vec4(p,0.,1.);
 gl_PointSize=(1.+position.z*2.)*uRatio;
 vAlpha=(.12+position.z*.38)*(.75+.25*sin(uTime*.35+seed*40.));
}`;
const particleFragment = `precision mediump float;varying float vAlpha;
void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.08,.5,d))*vAlpha;
gl_FragColor=vec4(.91,.16,.25,a);}`;

export function createHeroScene(hero, report = () => {}) {
  let disposed = false, locked = false, restoredOnce = false, restoreTimer = 0;
  let renderer, loop, stopResize = () => {}, width = 1, height = 1, rendered = 0;
  const canvas = document.createElement('canvas');
  canvas.className = 'mj-webgl'; canvas.setAttribute('aria-hidden','true');
  const pointer = pointerTracker(hero);
  const scene = new Scene(), camera = new Camera();
  const uniforms = { uTime:{value:0}, uSize:{value:new Vector2(1,1)},
    uCenter:{value:new Vector2(.76,.55)}, uPointer:{value:new Vector2()}, uRatio:{value:1} };
  const quadGeometry = new BufferGeometry();
  quadGeometry.setAttribute('position',new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const material = new RawShaderMaterial({ vertexShader:vertex, fragmentShader:fragment, uniforms,
    transparent:true,depthTest:false,depthWrite:false,blending:AdditiveBlending });
  scene.add(new Mesh(quadGeometry,material));
  const count = isMobile() ? 84 : 168;
  const positions=[], seeds=[];
  for(let i=0;i<count;i++) {
    positions.push(((i*.6180339887)%1)*2-1,((i*.381966011)%1)*2-1,(i*.75487766)%1);
    seeds.push((i*.56984029)%1);
  }
  const particlesGeometry = new BufferGeometry();
  particlesGeometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  particlesGeometry.setAttribute('seed',new Float32BufferAttribute(seeds,1));
  const particleMaterial = new RawShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,
    uniforms,transparent:true,depthTest:false,depthWrite:false,blending:AdditiveBlending});
  scene.add(new Points(particlesGeometry,particleMaterial));

  function state(values) { report(values); }
  function fallback(reason) {
    if(locked) return;
    locked=true; clearTimeout(restoreTimer); loop?.dispose(); stopResize(); pointer.dispose();
    canvas.remove(); renderer?.dispose();
    const mode=reason==='average-fps-below-45'?'css':'static';
    hero.dataset.mjBackground=mode;
    state({mode,reason,raf:'stopped',stage:3});
  }
  function size(w=width,h=height) {
    width=w; height=h;
    const ratio=monitor.stage>=2?1:Math.min(devicePixelRatio||1,pixelRatioCap());
    renderer.setPixelRatio(ratio); renderer.setSize(w,h,false);
    uniforms.uSize.value.set(w,h); uniforms.uRatio.value=ratio;
    // Use the preserved record's position, without changing its design.
    const record=hero.querySelector('.hero__orbit');
    if(record){const r=record.getBoundingClientRect(),b=hero.getBoundingClientRect();
      uniforms.uCenter.value.set((r.left+r.width/2-b.left)/w,1-(r.top+r.height/2-b.top)/h);}
    state({pixelRatio:ratio});
  }
  const monitor = new QualityMonitor(stage => {
    if(stage===1) particlesGeometry.setDrawRange(0,Math.floor(count/2));
    else if(stage===2) size();
    else fallback('average-fps-below-45');
    state({stage,particles:stage?Math.floor(count/2):count});
  }, fps => state({fps:Number(fps.toFixed(1)),frames:rendered}));
  function lost(event) {
    event.preventDefault(); loop?.enable(false);
    if(restoredOnce) return fallback('second-context-loss');
    restoredOnce=true;
    state({mode:'restoring',raf:'stopped'});
    try {
      const ext=renderer.getContext().getExtension('WEBGL_lose_context');
      if(ext) setTimeout(()=>{if(!locked&&!disposed&&renderer.getContext().isContextLost()){try{ext.restoreContext();}catch{fallback('restore-error');}}},100);
      restoreTimer=setTimeout(()=>fallback('restore-timeout'),2000);
    } catch { fallback('restore-error'); }
  }
  function restored() {
    if(locked||disposed) return;
    clearTimeout(restoreTimer);
    try { size(); renderer.render(scene,camera);
      if(renderer.getContext().isContextLost()) throw Error('context still lost');
      monitor.reset(); loop.enable(true); state({mode:'webgl',restores:1});
    } catch { fallback('restore-render-error'); }
  }
  try {
    renderer=makeRenderer(canvas);
    renderer.debug.onShaderError=()=>fallback('shader-error');
    hero.append(canvas);
    canvas.addEventListener('webglcontextlost',lost);
    canvas.addEventListener('webglcontextrestored',restored);
    stopResize=onResize(hero,size);
    renderer.render(scene,camera);
    if(locked) return {dispose(){}};
    hero.dataset.mjBackground='webgl'; state({mode:'webgl',stage:0,particles:count});
    loop=visibleLoop(hero,(elapsed,delta,now)=>{
      if(locked||disposed)return;
      try {const p=pointer.update(delta);uniforms.uPointer.value.set(p.x,p.y);uniforms.uTime.value=elapsed;
        renderer.render(scene,camera);rendered++;monitor.tick(now);
      }catch{fallback('render-error');}
    },()=>monitor.reset(),running=>state({raf:running?'running':'stopped'}));
  } catch { fallback('webgl-unavailable'); }
  return {
    dispose(){if(disposed)return;disposed=true;loop?.dispose();stopResize();pointer.dispose();clearTimeout(restoreTimer);
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      quadGeometry.dispose();particlesGeometry.dispose();material.dispose();particleMaterial.dispose();renderer?.dispose();canvas.remove();},
  };
}
