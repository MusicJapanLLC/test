const btn=document.querySelector('.menu-btn'),nav=document.querySelector('.nav');
if(btn&&nav){btn.addEventListener('click',()=>{const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false')}));}

const io='IntersectionObserver'in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08}):null;
document.querySelectorAll('.reveal').forEach(el=>io?io.observe(el):el.classList.add('is-visible'));

const ensureStyle=href=>{if(!document.querySelector(`link[href="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link)}};
ensureStyle('/assets/global-fix.css');

const header=document.querySelector('.site-header');
if(header){let ticking=false;const syncHeader=()=>{header.classList.toggle('is-scrolled',window.scrollY>18);ticking=false};syncHeader();addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(syncHeader);ticking=true}},{passive:true});}

const isHome=location.pathname==='/'||location.pathname==='/index.html';
if(isHome){
  ensureStyle('/assets/home-polish.css');
  if(!document.querySelector('.mobile-sticky-cta')){
    const sticky=document.createElement('aside');
    sticky.className='mobile-sticky-cta';
    sticky.setAttribute('aria-label','体験会へのショートカット');
    sticky.innerHTML='<a href="#price">体験会を見る<span aria-hidden="true">→</span></a>';
    document.body.appendChild(sticky);
  }
}
