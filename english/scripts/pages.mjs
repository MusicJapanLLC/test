// After `vite build`: the crawlable side of MJ ENGLISH.
// - one static page per phrase/word (dist/c/<id>/) with meaning, examples, notes, audio and structured data
// - one page per record (dist/r/<id>/) and an about page
// - static landing content inside the app shell (dist/index.html) so crawlers and AI readers see real text
// - sitemap.xml, robots.txt, llms.txt and llms-full.txt (a plain-text catalogue for AI assistants)
// Pages are Japanese-first (the audience is Japanese learners); the English phrases are marked lang="en".
// Only production builds are indexable (VERCEL_ENV=production or MJ_INDEX=1).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const SITE = (process.env.MJ_EN_URL || 'https://english.music-japan.com').replace(/\/$/, '');
const INDEX = process.env.VERCEL_ENV === 'production' || process.env.MJ_INDEX === '1';
const TODAY = new Date().toISOString().slice(0, 10);

const read = (f, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(root, 'public/data', f), 'utf8')); } catch { return fallback; } };
const cards = read('cards.json', []);
const words = read('words.json', []);
const drills = read('drills.json', []);
const meta = read('meta.json', { records: [] });
const records = meta.records;
const items = [...cards, ...words];
const byRec = new Map(records.map((r) => [r.id, []]));
for (const c of [...items, ...drills]) byRec.get(c.rec)?.push(c);
const recById = new Map(records.map((r) => [r.id, r]));

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/* Japanese names for records (titles and search snippets) */
const RJA = {
  'talk-01-cafe': 'カフェで使う英語', 'talk-12-reactions': '会話のリアクション英語', 'talk-14-listening': '聞き取れない英語（つなぎ言葉・音の変化）',
  'talk-03-pickup': '知らない人に話しかける英語', 'talk-04-crush': '恋愛・デートの英語', 'talk-05-dm': 'DM・テキストの英語',
  'talk-02-bar-party': 'バー・パーティーの英語', 'talk-06-gym': 'ジムで使う英語', 'talk-07-work': '職場の英会話', 'talk-08-business': 'ビジネス英会話（商談・提案・請求）',
  'talk-09-money': 'お金の英語', 'talk-10-paperwork-travel': '旅行・手続きの英語', 'talk-11-phone-online': '電話・オンラインの英語',
  'talk-13-conflict-feelings': 'ケンカ・謝罪・気持ちの英語', 'talk-15-textbook-vs-real': '教科書英語とネイティブ英語の違い',
  'songs-01-now': '洋楽タイトルで覚える英語（2000年代〜）', 'songs-02-classics': '洋楽クラシックで覚える英語', 'movies-01': '映画の名セリフで覚える英語',
  'movies-02-tv': '海外ドラマのセリフで覚える英語', 'books-01': '名著の一文で覚える英語', 'comedy-01': '英語の笑い・ジョークの仕組み', 'science-01': '研究・科学の話をする英語',
  'words-13-core-verbs-adjectives': '日常の動詞・形容詞', 'words-03-verbs': '基本動詞', 'words-04-phrasal-verbs': '句動詞', 'words-11-connectors-life': 'つなぎ言葉・副詞',
  'words-01-feelings': '気持ちの英単語', 'words-02-people': '人・性格の英単語', 'words-05-describing': '描写の形容詞', 'words-07-slang': '英語スラング（2020年代）',
  'words-12-idioms-more': '英語イディオム', 'words-08-food-health': '食・ジム・恋愛の英単語', 'words-09-travel-tech': '旅行・テックの英単語',
  'words-06-business': 'ビジネス英単語', 'words-10-news-music': 'ニュース・音楽の英単語',
  'levelup-01-softening': '角を立てない英語（クッション言葉）', 'levelup-02-opinions': '意見を言う・反論する英語', 'levelup-03-storytelling': '話を面白く伝える英語',
  'levelup-04-negotiation': '交渉・説得の英語', 'levelup-05-banter': 'いじり・皮肉・ツッコミの英語', 'levelup-06-feelings': '気持ちをうまく言う英語',
  'levelup-07-meetings': '会議・仕事チャットの英語', 'levelup-08-dating-deep': '恋愛の本音を伝える英語', 'levelup-09-studio': '音楽スタジオ・クリエイティブの英語',
  'words-14-levelup-verbs': '一歩上の英語動詞', 'words-15-levelup-adjectives': '一歩上の英語形容詞', 'words-16-levelup-nouns': '会話で使う抽象名詞',
  'words-17-collocations': 'コロケーション（make, do, take, have, get）', 'words-18-news-business-c1': 'ニュース・ビジネス上級英単語', 'words-19-phrasal-verbs-2': '句動詞 II',
  'drills-01-present': '瞬間英作文：現在形と現在進行形', 'drills-02-past': '瞬間英作文：過去形と used to', 'drills-03-present-perfect': '瞬間英作文：現在完了形',
  'drills-04-future': '瞬間英作文：未来（will・be going to・進行形の予定）', 'drills-05-requests': '瞬間英作文：丁寧なお願い（could・would you mind）',
  'drills-06-advice-rules': '瞬間英作文：助言とルール（should・had better・have to）', 'drills-07-questions': '瞬間英作文：疑問文と間接疑問文',
  'drills-08-comparisons': '瞬間英作文：比較級・最上級・as ... as', 'drills-09-conditionals': '瞬間英作文：仮定法と if 文', 'drills-10-relative': '瞬間英作文：関係詞（who・which・where）',
  'drills-11-ing-to': '瞬間英作文：動名詞と不定詞', 'drills-12-passive': '瞬間英作文：受け身と get 受け身', 'drills-13-reported': '瞬間英作文：話法（told me to）',
  'drills-14-articles': '瞬間英作文：冠詞と数量詞（a・the・some）', 'drills-15-prepositions': '瞬間英作文：前置詞（in・on・at）', 'drills-16-wish-rather': '瞬間英作文：I wish・I\'d rather・it\'s time',
};
const rja = (r) => RJA[r.id] ?? (r.lv === 'build' ? `瞬間英作文：${r.t}` : r.t);
const KIND = { talk: 'Real Talk', songs: 'Songs', movies: 'Movies & TV', books: 'Classic Books', science: 'Science', comedy: 'Comedy', words: 'Words', drill: 'Build It' };
const POS = { n: '名詞', v: '動詞', adj: '形容詞', adv: '副詞', phr: 'フレーズ', int: '間投詞', prep: '前置詞', conj: '接続詞', pron: '代名詞', det: '限定詞', abbr: '略語' };
const recCode = (r) => `MJ-EN ${String(r.no).padStart(3, '0')}`;

/* audio: point straight at the recorded clip inside its chunk (media fragment) */
const audioIdx = new Map();
function audioSrc(c, key = 'h') {
  if (!audioIdx.has(c.rec)) {
    try { audioIdx.set(c.rec, JSON.parse(fs.readFileSync(path.join(root, 'public/audio', `${c.rec}.json`), 'utf8'))); } catch { audioIdx.set(c.rec, null); }
  }
  const i = audioIdx.get(c.rec);
  const e = i?.c?.[`${c.id}:${key}`];
  if (!e || !i.f?.[e[0]]) return '';
  return `/audio/${i.f[e[0]]}#t=${Math.max(0, e[1] - 0.05).toFixed(2)},${(e[1] + e[2] + 0.1).toFixed(2)}`;
}

/* ── shared page frame ── */
const ORG = {
  '@type': 'Organization', '@id': 'https://music-japan.com/#organization', name: 'Music Japan LLC', alternateName: '合同会社Music Japan',
  url: 'https://music-japan.com/', logo: `${SITE}/icons/icon-512.png`, sameAs: ['https://music-japan.com/', 'https://x.com/Music_Japan_LLC'],
  address: { '@type': 'PostalAddress', addressLocality: 'Osaka', addressCountry: 'JP' },
};
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'MJ ENGLISH', alternateName: 'MJイングリッシュ', inLanguage: ['ja', 'en'], publisher: { '@id': ORG['@id'] } };

const CSS = `:root{color-scheme:dark;--bg:#060607;--bg1:#0e0e10;--ink:#efe9e0;--ink2:#c9c2b7;--mute:#8d867e;--line:rgba(239,233,224,.14);--red:#e1222f}
@media(prefers-color-scheme:light){:root{color-scheme:light;--bg:#efe9e0;--bg1:#f7f3ec;--ink:#0b0b0c;--ink2:#3a3732;--mute:#6c665e;--line:rgba(11,11,12,.14);--red:#d11f2b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,'Hiragino Sans','Zen Kaku Gothic New','Noto Sans JP','Segoe UI',sans-serif}
a{color:inherit}main{max-width:720px;margin:0 auto;padding:20px 18px 72px}header.top{display:flex;justify-content:space-between;align-items:center;max-width:720px;margin:0 auto;padding:14px 18px;border-bottom:1px solid var(--line)}
.brand{font:900 15px/1 'Arial Black',Arial,sans-serif;letter-spacing:.08em;text-decoration:none}.brand span{display:block;font:600 8.5px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.32em;color:var(--red)}
nav.top a{margin-left:14px;font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-decoration:none;color:var(--ink2)}
.crumbs{font:500 12px ui-monospace,Menlo,monospace;color:var(--mute);margin:8px 0 18px}.crumbs a{text-decoration:none}
.k{font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin:0}
h1{font:900 clamp(34px,8vw,56px)/1.04 'Arial Black','Helvetica Neue',Arial,sans-serif;letter-spacing:-.02em;margin:8px 0 6px}h1.jp{font-family:inherit;font-weight:800;font-size:clamp(26px,6vw,38px)}
h2{font-size:17px;margin:34px 0 10px;padding-top:14px;border-top:1px solid var(--line)}.ipa{color:var(--mute);margin:0 0 10px;font-family:'Charis SIL','Doulos SIL','Lucida Sans Unicode',sans-serif}
.ja{font-size:22px;font-weight:800;margin:10px 0 4px}.def{color:var(--ink2)}audio{width:100%;max-width:420px;margin:8px 0}
ol,ul{padding-left:22px}li{margin:6px 0}.who{display:inline-block;min-width:1.6em;font:700 12px ui-monospace,Menlo,monospace;color:var(--mute)}
.ok{color:#5fd08c}.ng{color:#ff5a5f}.n{color:var(--ink2);font-size:15px}blockquote{margin:12px 0;padding:10px 14px;border-left:3px solid var(--red);background:var(--bg1)}
.go{display:inline-block;margin:28px 0 0;padding:14px 22px;border-radius:99px;background:var(--red);color:#fff;font-weight:800;text-decoration:none}
.list{list-style:none;padding:0}.list li{padding:10px 0;border-bottom:1px solid var(--line);margin:0}.list a{font-weight:800;text-decoration:none}.list small{display:block;color:var(--ink2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;list-style:none;padding:0}.grid li{margin:0;padding:12px;border:1px solid var(--line);border-radius:6px}.grid a{text-decoration:none;font-weight:800}.grid small{display:block;color:var(--mute)}
footer{max-width:720px;margin:0 auto;padding:24px 18px 48px;border-top:1px solid var(--line);font-size:13px;color:var(--mute)}`;

function page({ p, title, desc, body, ld = [], lang = 'ja', type = 'website' }) {
  const url = `${SITE}${p}`;
  const graph = { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...ld] };
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
${INDEX ? '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">' : '<meta name="robots" content="noindex,nofollow">'}
<meta property="og:type" content="${type}"><meta property="og:site_name" content="MJ ENGLISH"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@Music_Japan_LLC">
<link rel="icon" href="/icon.svg"><link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt"><meta name="theme-color" content="#060607"><style>${CSS}</style>
<script type="application/ld+json">${json(graph)}</script></head><body>
<header class="top"><a class="brand" href="/">ENGLISH<span>MUSIC JAPAN</span></a><nav class="top"><a href="/records/">Records</a><a href="/about/">About</a><a href="/#/">App</a></nav></header>
<main>${body}</main>
<footer>MJ ENGLISH — Real English, on record. by <a href="https://music-japan.com/">Music Japan LLC</a>（大阪）· <a href="/about/">MJ ENGLISHについて</a> · <a href="/llms.txt">llms.txt</a></footer>
</body></html>`;
}

const crumbsLd = (list) => ({ '@type': 'BreadcrumbList', itemListElement: list.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${item}` })) });
const write = (rel, html) => { const f = path.join(dist, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

/* ── phrase / word pages ── */
function cardPage(c) {
  const r = recById.get(c.rec);
  const p = `/c/${c.id}/`;
  const isWord = c.k === 'w';
  const head = c.h;
  const title = isWord ? `${head} の意味と使い方（${POS[c.pos] ?? '英単語'}）｜例文・発音 | MJ ENGLISH` : `「${head}」の意味と使い方｜例文・発音・ネイティブのニュアンス | MJ ENGLISH`;
  const desc = clip(`「${head}」は「${c.ja}」。${c.d ? c.d + ' ' : ''}${c.l?.[0]?.[1] ? '例：' + c.l[0][1] + ' ' : ''}会話例・IPA・使い分けを音声つきで。`, 150);
  const src = audioSrc(c);
  const lines = (c.l ?? []).map(([w, t], i) => {
    const a = audioSrc(c, `l${i}`);
    return `<li>${w ? `<span class="who">${esc(w)}</span>` : ''}<span lang="en">${esc(t)}</span>${a ? ` <audio controls preload="none" src="${a}"></audio>` : ''}</li>`;
  }).join('');
  const good = (c.v ?? []).map(([t, n]) => `<li><span class="ok">○</span> <span lang="en">${esc(t)}</span>${n ? ` <span class="n">— ${esc(n)}</span>` : ''}</li>`).join('');
  const bad = (c.x ?? []).map(([t, lab, n]) => `<li><span class="ng">×</span> <span lang="en">${esc(t)}</span> <span class="n">（${lab === 'cringe' ? '不自然' : '教科書的'}）${n ? esc(n) : ''}</span></li>`).join('');
  const verdict = c.re === 'textbook' ? '<p class="n">この言い方は通じるけれど、教科書っぽく聞こえます。下の自然な言い方もセットで。</p>' : c.re === 'cringe' ? '<p class="n">この言い方はネイティブはまず使いません。下の自然な言い方を使いましょう。</p>' : '';
  const related = (byRec.get(c.rec) ?? []).filter((x) => x.id !== c.id && x.k !== 'd');
  const at = related.findIndex((x) => x.id > c.id);
  const near = [...related.slice(Math.max(0, at - 3)), ...related.slice(0, 3)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
  const faq = [
    { q: `「${head}」の意味は？`, a: `「${c.ja}」という意味です。${c.d ?? ''}` },
    ...(c.y ? [{ q: `「${head}」はどう使う？`, a: c.y }] : []),
    ...(c.n ? [{ q: `「${head}」のニュアンスや注意点は？`, a: c.n }] : []),
  ];
  const body = `
<p class="crumbs"><a href="/">MJ ENGLISH</a> › <a href="/r/${c.rec}/">${esc(r ? `${recCode(r)} ${r.t}` : '')}</a> › ${esc(head)}</p>
<p class="k">${esc(KIND[c.s] ?? '')}${isWord && c.pos ? ` · ${esc(POS[c.pos] ?? c.pos)}` : ''}${c.re && c.re !== 'real' ? ` · ${c.re === 'cringe' ? 'NG' : '教科書的'}` : ''}</p>
<h1 lang="en">${esc(head)}</h1>
${c.ipa ? `<p class="ipa">/${esc(c.ipa)}/</p>` : ''}
${src ? `<audio controls preload="none" src="${src}"></audio>` : ''}
<p class="ja">${esc(c.ja)}</p>
<p class="def">「<span lang="en">${esc(head)}</span>」は「${esc(c.ja)}」という意味の英語${isWord ? `（${esc(POS[c.pos] ?? '単語')}）` : '表現'}です。${c.d ? `英語で言うと <span lang="en">${esc(c.d)}</span>` : ''}</p>
${verdict}
${c.q ? `<blockquote lang="en">“${esc(c.q[0])}”<br><small>— ${esc(c.q[1])}</small></blockquote>` : ''}
${c.r ? `<p class="n">出典・関連：<span lang="en">${esc(c.r)}</span></p>` : ''}
${lines ? `<h2>例文・会話例</h2><ol>${lines}</ol>` : ''}
${good || bad ? `<h2>自然な言い方・避けたい言い方</h2><ul>${good}${bad}</ul>` : ''}
${c.y ? `<h2>${isWord ? '使い方のポイント' : 'なぜこう言うのか'}</h2><p>${esc(c.y).replace(/\n/g, '<br>')}</p>` : ''}
${c.n ? `<h2>${c.s === 'science' ? '研究のポイント' : 'カルチャー・ニュアンス'}</h2><p>${esc(c.n).replace(/\n/g, '<br>')}</p>` : ''}
${c.c ? `<p class="n">Source: <span lang="en">${esc(c.c)}</span>${c.u ? ` <a href="${esc(c.u)}" rel="nofollow noopener">論文を読む</a>` : ''}</p>` : ''}
${c.sl ? `<p class="n">聞こえ方：<span lang="en">${esc(c.sl)}</span></p>` : ''}
${near.length ? `<h2>同じレコードのフレーズ</h2><ul class="list">${near.map((x) => `<li><a href="/c/${x.id}/" lang="en">${esc(x.h)}</a><small>${esc(x.ja)}</small></li>`).join('')}</ul>` : ''}
<a class="go" href="/#/c/${c.id}">アプリで音声つきで練習する →</a>`;
  const ld = [
    crumbsLd([['MJ ENGLISH', '/'], [r ? r.t : 'Records', `/r/${c.rec}/`], [head, p]]),
    { '@type': 'DefinedTerm', '@id': `${SITE}${p}#term`, name: head, description: `${c.ja}${c.d ? ' / ' + c.d : ''}`, inLanguage: 'en', url: `${SITE}${p}`, inDefinedTermSet: { '@type': 'DefinedTermSet', name: r ? `${r.t} — MJ ENGLISH` : 'MJ ENGLISH', url: `${SITE}/r/${c.rec}/` } },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  write(`c/${c.id}/index.html`, page({ p, title, desc, body, ld, type: 'article' }));
  return p;
}

/* ── record pages ── */
function recordPage(r) {
  const list = byRec.get(r.id) ?? [];
  const p = `/r/${r.id}/`;
  const isDrill = r.lv === 'build';
  const name = rja(r);
  const title = isDrill ? `瞬間英作文：${r.t}（${list.length}問）｜${r.sub} | MJ ENGLISH` : `${name}｜${r.t} ${list.length}選（音声・例文つき） | MJ ENGLISH`;
  const desc = clip(isDrill
    ? `${(r.ex ?? []).join(' ')} 日本語から英語を組み立てる瞬間英作文 ${list.length}問。全文音声つき。`
    : `${name}を${list.length}個。${r.sub}。${list.slice(0, 4).map((c) => c.h).join(' / ')} など、意味・例文・発音を音声つきで。`, 155);
  const body = isDrill ? `
<p class="crumbs"><a href="/">MJ ENGLISH</a> › <a href="/records/">Records</a> › ${esc(r.t)}</p>
<p class="k">${esc(recCode(r))} · BUILD IT · 瞬間英作文</p>
<h1 class="jp">瞬間英作文：${esc(r.t)}</h1>
<p class="def" lang="en">${esc(r.sub)}</p>
${r.ex?.length ? `<h2>文法のポイント</h2>${r.ex.map((x) => `<p>${esc(x)}</p>`).join('')}` : ''}
<h2>問題と答え（${list.length}問）</h2>
<ol>${list.map((c) => { const a = audioSrc(c); return `<li>${esc(c.ja)}<br><b lang="en">${esc(c.h)}</b>${c.n ? ` <span class="n">— ${esc(c.n)}</span>` : ''}${a ? `<br><audio controls preload="none" src="${a}"></audio>` : ''}</li>`; }).join('')}</ol>
<a class="go" href="/#/r/${r.id}">アプリで単語タイルを並べて練習する →</a>` : `
<p class="crumbs"><a href="/">MJ ENGLISH</a> › <a href="/records/">Records</a> › ${esc(r.t)}</p>
<p class="k">${esc(recCode(r))} · ${esc(r.lv === 'levelup' ? 'LEVEL UP' : KIND[r.s] ?? '')}</p>
<h1 class="jp">${esc(name)}</h1>
<p class="def"><span lang="en">${esc(r.t)}</span> — <span lang="en">${esc(r.sub)}</span>。ネイティブが実際に使う${list.length}個を、意味・例文・発音つきでまとめました。</p>
<ol class="list">${list.map((c) => `<li><a href="/c/${c.id}/" lang="en">${esc(c.h)}</a><small>${esc(c.ja)}${c.l?.[0]?.[1] ? ` — <span lang="en">${esc(c.l[0][1])}</span>` : ''}</small></li>`).join('')}</ol>
<a class="go" href="/#/r/${r.id}">このレコードをアプリで練習する →</a>`;
  const ld = [
    crumbsLd([['MJ ENGLISH', '/'], ['Records', '/records/'], [r.t, p]]),
    isDrill
      ? { '@type': 'LearningResource', name: `瞬間英作文：${r.t}`, description: desc, learningResourceType: 'Exercise', educationalLevel: 'Intermediate', inLanguage: ['ja', 'en'], teaches: r.sub, url: `${SITE}${p}`, provider: { '@id': ORG['@id'] } }
      : { '@type': 'DefinedTermSet', name: `${r.t} — MJ ENGLISH`, description: desc, url: `${SITE}${p}`, hasDefinedTerm: list.slice(0, 200).map((c) => ({ '@type': 'DefinedTerm', name: c.h, description: c.ja, url: `${SITE}/c/${c.id}/` })) },
  ];
  write(`r/${r.id}/index.html`, page({ p, title, desc, body, ld }));
  return p;
}

const SHELVES = [
  ['Real Talk｜シーン別の英会話', (r) => r.s === 'talk' && r.lv !== 'levelup'],
  ['Level Up｜一段上の英語フレーズ', (r) => r.s === 'talk' && r.lv === 'levelup'],
  ['Build It｜瞬間英作文（文法）', (r) => r.lv === 'build'],
  ['Words｜英単語', (r) => r.s === 'words' && r.lv !== 'levelup'],
  ['Level Up Words｜上級英単語・コロケーション', (r) => r.s === 'words' && r.lv === 'levelup'],
  ['Songs, Film & Books｜洋楽・映画・名著', (r) => ['songs', 'movies', 'books'].includes(r.s)],
  ['Comedy & Science｜笑いと研究の英語', (r) => ['comedy', 'science'].includes(r.s)],
];
const shelvesHtml = () => SHELVES.map(([name, f]) => {
  const rs = records.filter(f);
  return rs.length ? `<h2>${esc(name)}</h2><ul class="grid">${rs.map((r) => `<li><a href="/r/${r.id}/">${esc(r.t)}</a><small>${esc(rja(r))} · ${r.n}</small></li>`).join('')}</ul>` : '';
}).join('');

const counts = { phrases: cards.length, words: words.length, drills: drills.length, records: records.length };
const INTRO = `MJ ENGLISH は、合同会社Music Japan（大阪）がつくる英語アプリです。カフェ、恋愛、仕事、ジム、音楽スタジオ、DM まで、ネイティブが本当に使うフレーズ ${counts.phrases.toLocaleString()} 個と英単語 ${counts.words.toLocaleString()} 語、瞬間英作文 ${counts.drills.toLocaleString()} 問を、シーン別の「レコード」にまとめています。すべてのカードに自然な音声、発音記号（IPA）、例文、日本語の解説がつきます。`;

function recordsIndex() {
  const p = '/records/';
  const title = 'Records｜シーン別の英語フレーズ・英単語・瞬間英作文の一覧 | MJ ENGLISH';
  const desc = clip(`${counts.records}枚のレコード（テーマ別セット）一覧。シーン別英会話、一段上のフレーズ、瞬間英作文、英単語、洋楽・映画・名著の英語。全部音声つき。`, 155);
  const body = `<p class="crumbs"><a href="/">MJ ENGLISH</a> › Records</p><h1 class="jp">Records</h1><p class="def">${esc(INTRO)}</p>${shelvesHtml()}`;
  write('records/index.html', page({ p, title, desc, body, ld: [crumbsLd([['MJ ENGLISH', '/'], ['Records', p]])] }));
  return p;
}

function aboutPage() {
  const p = '/about/';
  const title = 'MJ ENGLISHについて｜作り方・音声・引用のルール | MJ ENGLISH';
  const desc = 'MJ ENGLISH（合同会社Music Japan）の学習方法、音声の作り方、名著・映画・洋楽の引用ルール、データの扱いについて。';
  const body = `<p class="crumbs"><a href="/">MJ ENGLISH</a> › About</p><h1 class="jp">MJ ENGLISHについて</h1>
<p class="def">${esc(INTRO)}</p>
<h2>学び方</h2><p>Today のボタンひとつで、その日の復習と新しいカードが始まります。英語を聞いて、意味を確認して、Again か Got it で自分を判定。覚えたカードは 12時間 → 2日 → 5日 → 12日 → 30日 → 75日の間隔で戻ってきます（間隔反復）。日本語を見て英語で言う「日本語→英語」モード、単語タイルを並べる瞬間英作文、レコードを連続再生するリスニングドリル（シャドーイング対応）もあります。</p>
<h2>音声</h2><p>全カードを、オープンなニューラル音声モデル Kokoro（Apache-2.0）で事前に録音しています。見出しのゆっくり版と、会話の A・B は別の声です。発音記号はカーネギーメロン大学の CMU Pronouncing Dictionary をもとにした米国英語の IPA です。</p>
<h2>引用のルール</h2><p>名著の引用は、米国と日本の両方でパブリックドメインになっている作品だけを、Project Gutenberg の原文と一字一句照合して掲載しています。映画・ドラマは作品名と年を明記して一行だけ引用し、洋楽の歌詞は掲載しません（曲名とアーティスト名を挙げ、例文はすべてオリジナル）。研究のカードには元の論文を記載しています。</p>
<h2>データ</h2><p>学習の記録はブラウザの中だけに保存されます。アカウント登録はありません。</p>
<h2>運営</h2><p>合同会社Music Japan（Music Japan LLC）— 大阪。音楽制作・配信、Podcast、インタビューを軸にした音楽・メディア会社です。<a href="https://music-japan.com/">music-japan.com</a></p>`;
  write('about/index.html', page({ p, title, desc, body, ld: [crumbsLd([['MJ ENGLISH', '/'], ['About', p]])] }));
  return p;
}

/* ── the app shell gets real content for crawlers (replaced by the app when it starts) ── */
function shell() {
  const f = path.join(dist, 'index.html');
  let html = fs.readFileSync(f, 'utf8');
  const title = 'MJ ENGLISH｜ネイティブが本当に使う英語フレーズ・英単語・瞬間英作文（全部音声つき）';
  const desc = clip(`カフェ、恋愛、仕事、ジム、音楽スタジオ。シーン別の生きた英語フレーズ${counts.phrases.toLocaleString()}個、英単語${counts.words.toLocaleString()}語、瞬間英作文${counts.drills}問。全カード音声・IPA・例文・日本語解説つき。合同会社Music Japan。`, 155);
  html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace('<meta property="og:image" content="og.png" />', `<meta property="og:image" content="${SITE}/og.png" />\n  <meta property="og:url" content="${SITE}/" />\n  <meta property="og:locale" content="ja_JP" />\n  <link rel="canonical" href="${SITE}/" />\n  <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`);
  if (!INDEX) html = html.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <meta name="robots" content="noindex,nofollow" />');
  const ld = { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, { '@type': 'LearningResource', '@id': `${SITE}/#app`, name: 'MJ ENGLISH', description: desc, url: `${SITE}/`, inLanguage: ['ja', 'en'], learningResourceType: ['Flashcard', 'Exercise', 'Audio'], educationalLevel: ['Beginner', 'Intermediate', 'Advanced'], teaches: 'Spoken American English: phrases, vocabulary, grammar', provider: { '@id': ORG['@id'] }, isPartOf: { '@id': WEBSITE['@id'] } }] };
  html = html.replace('</head>', `  <script type="application/ld+json">${json(ld)}</script>\n</head>`);
  const landing = `<section class="page seo-landing"><p class="eyebrow">Music Japan · Osaka</p><h1 class="display">Real English,<br>on record.</h1>
<p>${esc(INTRO)}</p>
<p><a href="#/">Start today's session</a> · <a href="/records/">Records</a> · <a href="/about/">About</a></p>
${SHELVES.map(([name, fn]) => { const rs = records.filter(fn); return rs.length ? `<h2>${esc(name)}</h2><ul>${rs.map((r) => `<li><a href="/r/${r.id}/">${esc(r.t)}</a> — ${esc(rja(r))}</li>`).join('')}</ul>` : ''; }).join('')}
</section>`;
  html = html.replace('<main id="view" class="view" tabindex="-1"></main>', `<main id="view" class="view" tabindex="-1" lang="ja">${landing}</main>`);
  fs.writeFileSync(f, html);
}

/* ── AI-readable catalogue ── */
function llms() {
  const lines = [`# MJ ENGLISH`, '', `> ${INTRO}`, '',
    `MJ ENGLISH (by Music Japan LLC, Osaka) teaches spoken American English to Japanese speakers: ${counts.phrases} phrases (chunks), ${counts.words} words and ${counts.drills} sentence-building drills, grouped into ${counts.records} themed "records". Every card has a recorded natural voice, IPA, examples and Japanese explanations. Each phrase and word has its own page at ${SITE}/c/<id>/ and each record at ${SITE}/r/<id>/.`, '',
    '## Records'];
  for (const [name, f] of SHELVES) {
    const rs = records.filter(f);
    if (!rs.length) continue;
    lines.push('', `### ${name}`);
    for (const r of rs) lines.push(`- [${r.t} — ${rja(r)}](${SITE}/r/${r.id}/): ${r.sub} (${r.n})`);
  }
  lines.push('', '## About', `- [About MJ ENGLISH](${SITE}/about/): method, voice, quoting rules`, `- [Full catalogue (plain text)](${SITE}/llms-full.txt)`, `- [Music Japan LLC](https://music-japan.com/)`, '');
  fs.writeFileSync(path.join(dist, 'llms.txt'), lines.join('\n'));
  const full = [`# MJ ENGLISH — full catalogue`, '', `> ${INTRO}`, '', `Source: ${SITE}/  ·  Built ${TODAY}`, ''];
  for (const r of records) {
    const list = byRec.get(r.id) ?? [];
    full.push(`## ${recCode(r)} ${r.t} — ${rja(r)}`, `${r.sub}  ·  ${SITE}/r/${r.id}/`, ...(r.ex ?? []).map((x) => `> ${x}`), '');
    for (const c of list) {
      if (c.k === 'd') { full.push(`- ${c.ja} → ${c.h}`); continue; }
      const ex = c.l?.[0]?.[1] ? ` Example: "${c.l[0][1]}"` : '';
      full.push(`- ${c.h}${c.pos ? ` (${c.pos})` : ''} — ${c.ja}${c.d ? `; ${c.d}` : ''}.${ex} ${SITE}/c/${c.id}/`);
    }
    full.push('');
  }
  fs.writeFileSync(path.join(dist, 'llms-full.txt'), full.join('\n'));
}

/* ── build ── */
const urls = ['/', '/records/', '/about/'];
for (const c of items) urls.push(cardPage(c));
for (const r of records) urls.push(recordPage(r));
recordsIndex();
aboutPage();
shell();
llms();
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`);
const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
fs.writeFileSync(path.join(dist, 'robots.txt'), INDEX
  ? `User-agent: *\nAllow: /\n\n${bots.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}\n\nSitemap: ${SITE}/sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n');
console.log(`pages ${urls.length} (${items.length} cards, ${records.length} records) · ${INDEX ? 'indexable' : 'noindex (preview)'}`);
