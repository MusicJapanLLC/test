// After `vite build`: one small static page per card (dist/c/<id>/) so every chunk and word has its own
// shareable, searchable URL, plus sitemap.xml and robots.txt. Only production is indexable.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const SITE = (process.env.MJ_EN_URL || 'https://english.music-japan.com').replace(/\/$/, '');
const noindex = process.env.VERCEL_ENV !== 'production';

const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'public/data', f), 'utf8'));
const items = [...read('cards.json'), ...read('words.json')];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LABEL = { talk: 'Real Talk', songs: 'Songs', movies: 'Movies & TV', books: 'Classic Books', science: 'Science', comedy: 'Comedy', words: 'Words' };

const css = `body{margin:0;background:#0b0b0e;color:#f3eee6;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Hiragino Sans','Noto Sans JP',sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 18px 64px}a{color:inherit}.k{font:700 12px sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8f897f}
h1{font:900 clamp(36px,9vw,60px)/1.05 'Arial Black',Arial,sans-serif;letter-spacing:-.02em;margin:8px 0}.ipa{color:#8f897f;margin:0}.ja{font-size:20px;font-weight:800}
ol{padding-left:20px}blockquote{margin:0;padding:10px 14px;border-left:3px solid #ff2e3e;background:rgba(255,255,255,.04)}.n{color:#c9c2b8;font-size:14px}
.go{display:inline-block;margin-top:20px;padding:14px 22px;border-radius:99px;background:#ff2e3e;color:#fff;font-weight:800;text-decoration:none}
@media(prefers-color-scheme:light){body{background:#f6f3ee;color:#141413}.n{color:#3d3a35}}`;

function page(c) {
  const url = `${SITE}/c/${c.id}/`;
  const ex = c.l?.[0]?.[1] ?? '';
  const title = `${c.h} — meaning & examples | MJ ENGLISH`;
  const desc = `${c.ja}. ${ex}`.slice(0, 155);
  const lines = (c.l ?? []).map(([w, t]) => `<li>${w ? `<b>${esc(w)}:</b> ` : ''}${esc(t)}</li>`).join('');
  const alts = [...(c.v ?? []).map(([t, n]) => `<li>✓ ${esc(t)} <span class="n">${esc(n)}</span></li>`), ...(c.x ?? []).map(([t, l, n]) => `<li>${l === 'cringe' ? '✗' : '⚠'} ${esc(t)} <span class="n">${esc(n)}</span></li>`)].join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<meta property="og:type" content="article"><meta property="og:title" content="${esc(`${c.h} · MJ ENGLISH`)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../icon.svg"><style>${css}</style>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'DefinedTerm', name: c.h, description: c.ja, inDefinedTermSet: 'MJ ENGLISH', url })}</script>
</head><body><main>
<p class="k">${esc(LABEL[c.s] ?? '')}${c.pos ? ` · ${esc(c.pos)}` : ''}</p>
<h1>${esc(c.h)}</h1>${c.ipa ? `<p class="ipa">/${esc(c.ipa)}/</p>` : ''}
<p class="ja" lang="ja">${esc(c.ja)}</p>${c.d ? `<p>${esc(c.d)}</p>` : ''}
${c.q ? `<blockquote>“${esc(c.q[0])}”<br><small>— ${esc(c.q[1])}</small></blockquote>` : ''}
${c.r ? `<p>Reference: ${esc(c.r)}</p>` : ''}
${lines ? `<ol>${lines}</ol>` : ''}${alts ? `<ul>${alts}</ul>` : ''}
${c.y ? `<p class="n" lang="ja">${esc(c.y)}</p>` : ''}${c.n ? `<p class="n" lang="ja">${esc(c.n)}</p>` : ''}${c.c ? `<p class="n">Source: ${esc(c.c)}</p>` : ''}
<a class="go" href="../../#/c/${c.id}">Learn it in the feed →</a>
<p class="n" style="margin-top:28px">MJ ENGLISH by Music Japan LLC — real English, in reels.</p>
</main></body></html>`;
}

for (const c of items) {
  const dir = path.join(dist, 'c', c.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(c));
}
// the app shell: absolute share image + canonical (social crawlers ignore relative og:image)
const indexFile = path.join(dist, 'index.html');
let shell = fs.readFileSync(indexFile, 'utf8')
  .replace('<meta property="og:image" content="og.png" />', `<meta property="og:image" content="${SITE}/og.png" />\n  <meta property="og:url" content="${SITE}/" />\n  <link rel="canonical" href="${SITE}/" />`);
if (noindex) shell = shell.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <meta name="robots" content="noindex,nofollow" />');
fs.writeFileSync(indexFile, shell);

const urls = [`${SITE}/`, ...items.map((c) => `${SITE}/c/${c.id}/`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(dist, 'robots.txt'), noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`pages ${items.length} · ${noindex ? 'noindex (preview)' : 'indexable'}`);
