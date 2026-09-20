const root=document.documentElement;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const saver=Boolean(navigator.connection?.saveData);
let booted=false,scene=null,motion=null,generation=0,repeat=false;
const status={mode:'css',stage:0,raf:'stopped',fps:'not measured',lcp:'pending',scroll:'native'};
let diagnostic=null;
function report(values){Object.assign(status,values);if(diagnostic)diagnostic.textContent=JSON.stringify(status,null,2);}

function fallbackArtwork(hero){
  if(hero.querySelector('.mj-field'))return;
  const field=document.createElement('div');field.className='mj-field';field.setAttribute('aria-hidden','true');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 1200 800');svg.setAttribute('preserveAspectRatio','none');
  for(let i=0;i<7;i++){
    const path=document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d',`M -80 ${420+i*13} C 230 ${180+i*14} 410 ${580-i*9} 700 ${325+i*12} S 1060 ${255+i*14} 1280 ${430+i*11}`);
    path.style.setProperty('--wave-index',i);svg.append(path);
  }
  const dust=document.createElement('div');dust.className='mj-dust';
  for(let i=0;i<28;i++){const dot=document.createElement('i');dot.style.cssText=`left:${i*61.8%100}%;top:${i*38.2%100}%;--dust-index:${i}`;dust.append(dot);}
  const halo=document.createElement('div');halo.className='mj-halo';
  const line=document.createElement('div');line.className='mj-intro-line';
  field.append(halo,svg,dust,line);hero.append(field);
  hero.dataset.mjBackground='css';
}

function enhanceDecorations(){
  document.querySelectorAll('.related-card:first-child').forEach(card=>{
    if(card.querySelector('.mj-voice'))return;
    const voice=document.createElement('div');voice.className='mj-voice';voice.setAttribute('aria-hidden','true');
    for(let i=0;i<28;i++){const bar=document.createElement('i');bar.style.setProperty('--bar-height',`${7+i*17%29}px`);bar.style.setProperty('--bar-index',i);voice.append(bar);}
    card.classList.add('mj-ambient');card.append(voice);
  });
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
    entry.target.classList.toggle('mj-in-view',entry.isIntersecting);
  }),{threshold:0});
  document.querySelectorAll('.mj-ambient,.manifesto__wave').forEach(el=>io.observe(el));
  document.querySelectorAll('.release-card').forEach(card=>{
    const visual=card.querySelector('.release-card__visual');if(!visual)return;
    card.addEventListener('pointermove',e=>{
      if(reduce.matches||saver||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
      const rect=visual.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
      visual.style.setProperty('--tilt-x',`${(x-.5)*8}deg`);visual.style.setProperty('--tilt-y',`${(.5-y)*8}deg`);
      visual.style.setProperty('--shine-x',`${x*100}%`);visual.style.setProperty('--shine-y',`${y*100}%`);
    });
    card.addEventListener('pointerleave',()=>{visual.style.setProperty('--tilt-x','0deg');visual.style.setProperty('--tilt-y','0deg');});
  });
  // Give all section headings/cards the same data-driven reveal contract.
  document.querySelectorAll('.section-heading,.release-card,.about-brand,.related-card,.manifesto>h2,.manifesto__body,.profile-hero,.inner-page__hero')
    .forEach(el=>el.setAttribute('data-reveal',''));
}

async function configure(){
  const version=++generation;
  motion?.dispose();scene?.dispose();motion=null;scene=null;
  const hero=document.querySelector('.hero');
  root.dataset.mjMotion=reduce.matches||saver?'off':'on';
  if(hero)hero.dataset.mjBackground='css';
  if(reduce.matches||saver){report({mode:'static',scroll:'native',raf:'stopped',intro:'disabled'});return;}
  try{
    const module=await import('./motion.js');
    if(version!==generation)return;
    motion=module.createMotion({hero,repeat,report,introDelay:introDelay()});
  }catch(error){report({scroll:'native fallback',motionError:String(error)});}
  if(!hero||version!==generation)return;
  // Separate network graph: text/intro never wait for Three.js or its GPU setup.
  const load=async()=>{
    if(version!==generation||reduce.matches||saver)return;
    try{const module=await import('./hero-webgl.js');
      if(version===generation)scene=module.createHeroScene(hero,report);
    }catch(error){hero.dataset.mjBackground='static';report({mode:'static',reason:'webgl-import-error'});}
  };
  if('requestIdleCallback'in window)requestIdleCallback(load,{timeout:1600});else setTimeout(load,200);
}

function boot(){
  if(booted)return;booted=true;
  root.dataset.mjExperience='vinyl';root.dataset.mjEdition='immersive';
  const hero=document.querySelector('.hero');
  if(hero){fallbackArtwork(hero);hero.classList.add('mj-ambient');
    try{repeat=sessionStorage.getItem('mj-intro-seen')==='1';sessionStorage.setItem('mj-intro-seen','1');}catch{/* first visit if storage is unavailable */}}
  if(__MJ_REVIEW__&&new URLSearchParams(location.search).has('mj-diagnostics')){
    diagnostic=document.createElement('pre');diagnostic.className='mj-diagnostics';diagnostic.setAttribute('aria-label','Performance diagnostics');document.body.append(diagnostic);
    try{new PerformanceObserver(list=>{const last=list.getEntries().at(-1);report({lcp:Math.round(last.startTime)+' ms (unthrottled unless DevTools configured)'});}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
  }
  enhanceDecorations();configure();reduce.addEventListener('change',configure);
}
document.addEventListener('visibilitychange',()=>{root.dataset.mjVisibility=document.hidden?'hidden':'visible';});
// The preserved homepage is React-owned. Wait for its committed effect before DOM decoration.
const home=/^\/(?:en\/?)?$/.test(location.pathname)||/^\/(?:en\/)?index\.html$/.test(location.pathname);

// The curtain has to cover the first paint, so it is built during module evaluation
// instead of waiting for React's ready event. Only the first visit of a session sees
// it, it is inert to pointer and assistive technology, and it always clears itself.
let curtainStart=0;
function dropCurtain(){
  if(!home||reduce.matches||saver)return;
  try{if(sessionStorage.getItem('mj-intro-seen')==='1')return;}catch{return;}
  const host=document.body;
  if(!host)return;
  const curtain=document.createElement('div');
  curtain.className='mj-curtain';curtain.setAttribute('aria-hidden','true');
  const bloom=document.createElement('div');bloom.className='mj-curtain__bloom';
  const line=document.createElement('div');line.className='mj-curtain__line';
  curtain.append(bloom,line);host.append(curtain);
  root.dataset.mjCurtain='run';curtainStart=performance.now();
  let cleared=false;
  const clear=()=>{if(cleared)return;cleared=true;curtain.remove();delete root.dataset.mjCurtain;};
  curtain.addEventListener('animationend',event=>{if(event.animationName==='mj-curtain-lift')clear();});
  setTimeout(clear,2600);
}
dropCurtain();

// Hand the hero timeline whatever is left of the curtain, so the headline starts
// moving as the curtain clears instead of playing behind it.
const introDelay=()=>curtainStart?Math.max(0,.72-(performance.now()-curtainStart)/1000):0;
if(!home||root.dataset.mjReady==='true')boot();else addEventListener('music-japan:ready',boot,{once:true});
