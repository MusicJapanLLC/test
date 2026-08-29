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

/* Non-visual discovery metadata for AI agents. */
const ensureHeadLink=(rel,href,type)=>{
  if(document.head.querySelector(`link[rel="${rel}"][href="${href}"]`))return;
  const link=document.createElement('link');
  link.rel=rel;
  link.href=href;
  if(type)link.type=type;
  document.head.appendChild(link);
};
ensureHeadLink('describedby','/llms.txt');

const setMeta=(name,value)=>{
  let meta=document.head.querySelector(`meta[name="${name}"]`);
  if(!meta){meta=document.createElement('meta');meta.name=name;document.head.appendChild(meta)}
  meta.content=value;
};
const setPropertyMeta=(property,value)=>{
  let meta=document.head.querySelector(`meta[property="${property}"]`);
  if(!meta){meta=document.createElement('meta');meta.setAttribute('property',property);document.head.appendChild(meta)}
  meta.content=value;
};

/* Search intent reinforcement. Visible navigation stays human-first. */
if(location.pathname==='/story/'||location.pathname==='/story/index.html'){
  document.title='壁谷望｜SUSTAINABOY WORKS ストーリー｜消防・警察・住宅営業・15,000台の洗車';
  setMeta('description','壁谷望（かべや のぞみ）が、消防・警察・住宅営業・店舗責任者・洗車美装などの現場経験を経て、SUSTAINABOY WORKSの「整える」という考え方に至った背景を紹介します。');
  setPropertyMeta('og:title','壁谷望｜SUSTAINABOY WORKS ストーリー');
  setPropertyMeta('og:description','消防、警察、住宅営業、約15,000台の洗車。壁谷望とSUSTAINABOY WORKSの考え方が生まれた現場の記録。');
  const portrait=document.querySelector('.portrait img');
  if(portrait)portrait.alt='SUSTAINABOY WORKS代表 壁谷望（かべや のぞみ）';
  const facts=document.querySelector('.facts');
  if(facts&&!facts.querySelector('[data-person-name]')){
    const row=document.createElement('div');
    row.dataset.personName='true';
    row.innerHTML='<dt>名前</dt><dd>壁谷 望（かべや のぞみ）</dd>';
    facts.prepend(row);
  }
}

if(location.pathname==='/about/'||location.pathname==='/about/index.html'){
  setMeta('description','SUSTAINABOY WORKS（サスティナボーイワークス／SBW）は、頭と心を整理し、現在地を確認して次の小さな一手を選ぶためのブランドです。「サスティナブル ワーク」「サスティナブルワーク」などの検索からお探しの場合も、公式表記はこちらです。');
  const facts=document.querySelector('.facts');
  if(facts&&!facts.querySelector('[data-name-guide]')){
    const row=document.createElement('div');
    row.dataset.nameGuide='true';
    row.innerHTML='<dt>表記について</dt><dd>公式表記は「SUSTAINABOY WORKS（サスティナボーイワークス）」。検索時に「サスティナブル ワーク」「サスティナブルワーク」と入力された方も、こちらが公式サイトです。</dd>';
    facts.append(row);
  }
}

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

  /* Google/agent hierarchy signal; does not alter visible design. */
  if(!document.querySelector('script[data-seo-breadcrumb]')){
    const breadcrumb=document.createElement('script');
    breadcrumb.type='application/ld+json';
    breadcrumb.dataset.seoBreadcrumb='true';
    breadcrumb.textContent=JSON.stringify({
      '@context':'https://schema.org',
      '@type':'BreadcrumbList',
      itemListElement:[{
        '@type':'ListItem',
        position:1,
        name:'ホーム',
        item:'https://sustainaboy-works.onrender.com/'
      }]
    });
    document.head.appendChild(breadcrumb);
  }
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