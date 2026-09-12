(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const lang = document.body.dataset.lang || 'ja';
  let articles = [];
  try {
    articles = JSON.parse($('#djn-search-data')?.textContent || '[]');
  } catch (_) {}

  function openDialog(dialog) {
    if (!dialog) return;
    $$('dialog[open]').forEach(d => { if (d !== dialog) d.close(); });
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    dialog.close();
    if (!$('dialog[open]')) document.body.classList.remove('modal-open');
  }

  const menu = $('#site-menu');
  const search = $('#search-dialog');
  const cookie = $('#cookie-dialog');

  $$('[data-open="menu"]').forEach(b => b.addEventListener('click', () => openDialog(menu)));
  $$('[data-open="search"]').forEach(b => b.addEventListener('click', () => {
    openDialog(search);
    const q = b.dataset.searchQuery || '';
    if ($('#page-search-input') && q) {
      $('#page-search-input').value = q;
      $('#page-search-input').dispatchEvent(new Event('input'));
    }
    setTimeout(() => $('#page-search-input')?.focus(), 50);
  }));
  $$('[data-open="cookies"]').forEach(b => b.addEventListener('click', () => openDialog(cookie)));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(b.closest('dialog'))));
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) closeDialog(d); });
    d.addEventListener('close', () => { if (!$('dialog[open]')) document.body.classList.remove('modal-open'); });
  });
  $$('[data-close-menu-link]').forEach(a => a.addEventListener('click', () => closeDialog(menu)));

  function view(a) {
    return lang === 'ja'
      ? {title:a.ja.title, dek:a.ja.dek, category:a.categoryJa}
      : {title:a.en.title, dek:a.en.dek, category:a.categoryEn};
  }
  function matches(a, q) {
    const v = view(a);
    return [v.title,v.dek,v.category,a.categoryJa,a.categoryEn].join(' ').toLowerCase().includes(q.trim().toLowerCase());
  }
  function resultMarkup(a) {
    const v=view(a);
    return `<a class="search-result-card" href="/${lang}/articles/${a.slug}/">
      <img src="/assets/${a.image}" width="150" height="180" alt="" loading="lazy">
      <span><span class="tag-line">${v.category} · ${a.readMinutes} MIN</span><h2>${v.title}</h2><p>${v.dek}</p></span>
    </a>`;
  }

  const input = $('#page-search-input');
  const results = $('#search-results');
  const count = $('#search-count');
  function renderSearch() {
    if (!input || !results) return;
    const q=input.value;
    const list=q ? articles.filter(a=>matches(a,q)) : articles;
    results.innerHTML = list.length ? list.map(resultMarkup).join('') : `<p class="empty-state">${lang==='ja'?'一致する記事はありません':'No matching stories'}</p>`;
    if (count) count.textContent=`${list.length} ARTICLES`;
  }
  input?.addEventListener('input', renderSearch);
  renderSearch();

  const quick = $('#menu-search-input');
  quick?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openDialog(search);
      if (input) {
        input.value=quick.value;
        renderSearch();
        setTimeout(()=>input.focus(),40);
      }
    }
  });

  const readerModes=['reader-compact','', 'reader-large'];
  let readerIndex=Number(localStorage.getItem('djn-reader-index') || 1);
  function applyReader() {
    document.body.classList.remove('reader-compact','reader-large');
    if (readerModes[readerIndex]) document.body.classList.add(readerModes[readerIndex]);
  }
  applyReader();
  $$('[data-reader-size]').forEach(b=>b.addEventListener('click',()=>{
    readerIndex=(readerIndex+1)%readerModes.length;
    localStorage.setItem('djn-reader-index',String(readerIndex));
    applyReader();
  }));

  const scrollTop=$('#scroll-top');
  function scrollUI() {
    scrollTop?.classList.toggle('is-visible',window.scrollY>520);
  }
  addEventListener('scroll',scrollUI,{passive:true});
  scrollUI();
  scrollTop?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

  const consentKey='djn-cookie-consent';
  const banner=$('#cookie-banner');
  if (banner && !localStorage.getItem(consentKey)) banner.hidden=false;
  $$('[data-cookie-accept]').forEach(b=>b.addEventListener('click',()=>{
    localStorage.setItem(consentKey,'ok');
    if (banner) banner.hidden=true;
  }));
  $('#cookie-save')?.addEventListener('click',()=>{
    localStorage.setItem(consentKey,'ok');
    if (banner) banner.hidden=true;
    closeDialog(cookie);
  });
})();
