const btn=document.querySelector('.menu-btn');
const nav=document.querySelector('.nav');
const header=document.querySelector('.site-header');

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

if(document.body.classList.contains('subpage-v2')){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    if(node.nodeValue&&node.nodeValue.includes('SUSTAINABOY OS')){
      node.nodeValue=node.nodeValue.replaceAll('SUSTAINABOY OS','この考え方');
    }
  });
  document.querySelectorAll('.byline').forEach(el=>{
    const span=el.querySelector('span');
    const img=el.querySelector('img');
    if(span&&span.textContent.includes('壁谷')) span.textContent='SUSTAINABOY WORKS';
    if(img) img.alt='SUSTAINABOY WORKS';
  });
  document.querySelectorAll('.footer-bottom').forEach(el=>el.textContent='© SUSTAINABOY WORKS');
}

if(document.body.classList.contains('paper-home')){
  const founderLabel=document.querySelector('.founder-card-copy .section-mini');
  if(founderLabel) founderLabel.textContent='このワークについて';
  const founderAlt=document.querySelector('.founder-image img');
  if(founderAlt) founderAlt.alt='SUSTAINABOY WORKS 思考整理ワークの案内';
  const storyLabel=document.querySelector('.story-copy .section-mini');
  if(storyLabel) storyLabel.textContent='ストーリー';
  const storyLink=document.querySelector('.story-copy a[href="/story/"]');
  if(storyLink) storyLink.innerHTML='ストーリーを読む <span>→</span>';
  const copy=document.querySelector('.paper-footer .copy');
  if(copy) copy.textContent='© SUSTAINABOY WORKS';
  document.title='SUSTAINABOY WORKS（サスティナボーイワークス）｜ニュートラル思考整理ワーク';
}

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
if(document.body.classList.contains('subpage-v2')) ensureStyle('/assets/subpage-premium.css');

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