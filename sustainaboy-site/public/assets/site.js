const btn=document.querySelector('.menu-btn');
const nav=document.querySelector('.nav');
const header=document.querySelector('.site-header');

/* Keep navigation language natural across every page. URLs stay stable for SEO,
   but visible labels avoid internal jargon and person-name-heavy navigation. */
const naturalLabels=[
  ['/method/','考え方'],
  ['/story/','ストーリー'],
  ['/about/','ブランドについて']
];
naturalLabels.forEach(([href,label])=>{
  document.querySelectorAll(`a[href="${href}"]`).forEach(a=>{
    if(!a.classList.contains('brand')) a.textContent=label;
  });
});

if(btn&&nav){
  btn.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    btn.setAttribute('aria-expanded',String(open));
    document.body.classList.toggle('menu-open',open);
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
    document.body.classList.remove('menu-open');
  }));
}

const ensureStyle=href=>{if(!document.querySelector(`link[href="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link)}};
ensureStyle('/assets/global-fix.css');
ensureStyle('/assets/mobile-fixes.css');

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if(header){
  let ticking=false;
  const syncHeader=()=>{header.classList.toggle('is-scrolled',window.scrollY>12);ticking=false};
  syncHeader();
  addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(syncHeader);ticking=true}},{passive:true});
}

const revealEls=[...document.querySelectorAll('.reveal')];
if(!reduceMotion&&'IntersectionObserver'in window){
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}
    });
  },{threshold:.1,rootMargin:'0px 0px -6% 0px'});
  revealEls.forEach(el=>io.observe(el));
}else{revealEls.forEach(el=>el.classList.add('is-visible'))}

const isPaperHome=document.body.classList.contains('paper-home');
if(isPaperHome&&!reduceMotion){
  const stage=document.querySelector('.paper-stage');
  const notes=[...document.querySelectorAll('.paper-sheet > .sticky-note')];
  if(stage&&notes.length){
    stage.addEventListener('pointermove',e=>{
      if(innerWidth<760)return;
      const r=stage.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      notes.forEach((note,i)=>{
        const m=(i+1)*2.2;
        note.style.translate=`${x*m}px ${y*m}px`;
      });
    });
    stage.addEventListener('pointerleave',()=>notes.forEach(note=>note.style.translate='0 0'));
  }
}