const btn=document.querySelector('.menu-btn'),nav=document.querySelector('.nav');
if(btn&&nav){btn.addEventListener('click',()=>{const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false')}));}
const io='IntersectionObserver'in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08}):null;
document.querySelectorAll('.reveal').forEach(el=>io?io.observe(el):el.classList.add('is-visible'));

const globalFix=document.createElement('link');
globalFix.rel='stylesheet';
globalFix.href='/assets/global-fix.css';
document.head.appendChild(globalFix);

const isHome=location.pathname==='/'||location.pathname==='/index.html';
if(isHome){
  const polish=document.createElement('link');
  polish.rel='stylesheet';
  polish.href='/assets/home-polish.css';
  document.head.appendChild(polish);

  if(!document.querySelector('.mobile-sticky-cta')){
    const sticky=document.createElement('aside');
    sticky.className='mobile-sticky-cta';
    sticky.setAttribute('aria-label','体験会へのショートカット');
    sticky.innerHTML='<a href="#price">体験会を見る<span aria-hidden="true">→</span></a>';
    document.body.appendChild(sticky);
  }
}
