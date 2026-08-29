const btn=document.querySelector('.menu-btn');
const nav=document.querySelector('.nav');
const header=document.querySelector('.site-header');

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

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if(header){
  let ticking=false;
  const syncHeader=()=>{header.classList.toggle('is-scrolled',window.scrollY>20);ticking=false};
  syncHeader();
  addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(syncHeader);ticking=true}},{passive:true});
}

const revealEls=[...document.querySelectorAll('.reveal')];
document.querySelectorAll('.flow .reveal').forEach((el,i)=>el.style.transitionDelay=`${Math.min(i*55,220)}ms`);

if(!reduceMotion&&'IntersectionObserver'in window){
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
  revealEls.forEach(el=>io.observe(el));
}else{
  revealEls.forEach(el=>el.classList.add('is-visible'));
}

const isHome=location.pathname==='/'||location.pathname==='/index.html';
if(isHome){
  let sticky=document.querySelector('.mobile-sticky-cta');
  if(!sticky){
    sticky=document.createElement('aside');
    sticky.className='mobile-sticky-cta';
    sticky.setAttribute('aria-label','体験会へのショートカット');
    sticky.innerHTML='<a href="#price">体験会を見る<span aria-hidden="true">↗</span></a>';
    document.body.appendChild(sticky);
  }

  const hero=document.querySelector('.hero');
  const price=document.querySelector('#price');
  let heroVisible=true;
  let priceVisible=false;
  const syncSticky=()=>sticky.classList.toggle('is-visible',!heroVisible&&!priceVisible&&innerWidth<760);

  if('IntersectionObserver'in window){
    if(hero){new IntersectionObserver(entries=>{heroVisible=entries[0]?.isIntersecting??true;syncSticky()},{threshold:.08}).observe(hero)}
    if(price){new IntersectionObserver(entries=>{priceVisible=entries[0]?.isIntersecting??false;syncSticky()},{threshold:.05}).observe(price)}
  }
  addEventListener('resize',syncSticky,{passive:true});

  if(!reduceMotion){
    const route=document.querySelector('.hero-route');
    const compass=document.querySelector('.hero-compass');
    let motionTick=false;
    addEventListener('scroll',()=>{
      if(motionTick||scrollY>innerHeight*1.15)return;
      motionTick=true;
      requestAnimationFrame(()=>{
        const y=Math.min(scrollY,innerHeight);
        if(route)route.style.transform=`translate3d(0,${y*.035}px,0)`;
        if(compass)compass.style.marginTop=`${y*.018}px`;
        motionTick=false;
      });
    },{passive:true});
  }
}
