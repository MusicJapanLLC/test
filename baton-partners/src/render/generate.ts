import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { routes, site } from '../config/site';
import { bpMark } from './logo';
import { partners, sites } from '../partners';
import type { BuildEnv } from './layout';
import { renderAbout } from './pages/about';
import { renderContact } from './pages/contact';
import { renderInsight } from './pages/insight';
import { renderEditorial, renderIndex, renderNotFound, renderPrivacy } from './pages/misc';
import { renderService } from './pages/service';
import { renderTop } from './pages/top';
import { shortName } from './layout';
import { plain } from './text';

export type GeneratedPage = { key: string; path: string; file: string; lastmod?: string };

/**
 * src/ のテンプレートと企業データから、各ページの index.html を書き出す。
 * 書き出したファイルは .gitignore 済み。直接編集しない。
 */
export async function generatePages(root: string, env: BuildEnv): Promise<GeneratedPage[]> {
  const out: { key: string; path: string; html: string; lastmod?: string; file?: string }[] = [
    { key: 'index', path: '/', html: renderIndex(partners, env), lastmod: latest() },
    { key: 'editorial', path: routes.editorial(), html: renderEditorial(partners, env), lastmod: site.updated },
    { key: 'privacy', path: routes.privacy(), html: renderPrivacy(env), lastmod: site.updated },
    // 404 は sitemap に載せない（lastmod なし）。Vercel は dist/404.html を自動で返す
    { key: '404', path: '/404.html', html: renderNotFound(partners, env), file: '404.html' },
  ];

  for (const p of sites) {
    const lastmod = p.seo.updated;
    out.push(
      { key: `${p.slug}-top`, path: routes.top(p.slug), html: renderTop(p, env), lastmod },
      { key: `${p.slug}-about`, path: routes.about(p.slug), html: renderAbout(p, env), lastmod },
      { key: `${p.slug}-insight`, path: routes.insight(p.slug, p.insight.slug), html: renderInsight(p, env), lastmod },
      { key: `${p.slug}-service`, path: routes.service(p.slug), html: renderService(p, env), lastmod },
      { key: `${p.slug}-contact`, path: routes.contact(p.slug), html: await renderContact(p, env), lastmod },
    );
  }

  writeBrandFiles(root);
  writeOgManifest(root);
  checkFontCharset(root, out.map((o) => o.html).join(''));

  return out.map(({ key, path, html, lastmod, file: name }) => {
    const file = resolve(root, name ?? `.${path}/index.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return { key, path, file, lastmod };
  });
}

/**
 * SNS用画像（public/og/<key>.png）の材料。scripts/og.mjs がこれを読んで 1200×630 の画像を作る。
 * 画像は手元で作ってコミットする（Vercel のビルドではブラウザを動かさない）。
 */
function writeOgManifest(root: string) {
  const items = [
    { key: 'site', label: 'Music Japan Partners', heading: 'パートナー｜事業の強みを知り、次のつながりへ。', company: '合同会社Music Japan のパートナー企業' },
    ...sites.flatMap((p) => {
      const base = { company: p.company.name, logo: p.brand.logo, brand: p.brand.primary, accent: p.brand.accent, theme: p.world.theme };
      return [
        { ...base, key: `${p.slug}-top`, label: `Music Japan Partners — BP-${p.no.padStart(3, '0')}`, heading: plain(p.top.title) },
        { ...base, key: `${p.slug}-about`, label: 'About', heading: plain(p.about.title) },
        { ...base, key: `${p.slug}-service`, label: 'Service', heading: p.seo.service.answer.q },
        { ...base, key: `${p.slug}-insight`, label: 'Insights', heading: plain(p.insight.title) },
        { ...base, key: `${p.slug}-contact`, label: 'Talk', heading: `${shortName(p)}と、話してみる。` },
      ];
    }),
  ];
  writeFileSync(resolve(root, '.og-manifest.json'), JSON.stringify(items, null, 2));
}

/**
 * 日本語フォントは使う文字だけに絞っている（scripts/fonts.py）。
 * ページに、フォントに入っていない文字が増えたら知らせる（その文字だけOSのフォントで表示される）。
 */
function checkFontCharset(root: string, html: string) {
  let charset = '';
  try {
    charset = readFileSync(resolve(root, 'src/styles/fonts/charset.txt'), 'utf8');
  } catch {
    return;
  }
  const have = new Set(charset);
  const text = html.replace(/<[^>]+>/g, '');
  const missing = [...new Set(text)].filter((c) => /[\u3000-\u9fff\uff00-\uffef]/.test(c) && !have.has(c));
  if (missing.length) {
    console.warn(`\n[fonts] フォントにない文字が ${missing.length} 字あります：${missing.join('')}\n→ npm run fonts でフォントを作り直してください\n`);
  }
}

/** 一覧ページの更新日は、掲載企業の中でいちばん新しい日 */
function latest(): string {
  return [site.updated, ...sites.map((p) => p.seo.updated)].sort().at(-1) ?? site.updated;
}

/**
 * ロゴの単体ファイル。public/ に書き出す（ファビコン・資料・SNS用）。
 * 文字は <text> のため、表示する環境に Helvetica と Fraunces がない場合は近い書体で出る。
 */
function writeBrandFiles(root: string) {
  const dir = resolve(root, 'public', 'brand');
  mkdirSync(dir, { recursive: true });
  const mark = bpMark({ id: 'm' }).replace('class="bp-mark" ', 'xmlns="http://www.w3.org/2000/svg" ');
  writeFileSync(resolve(root, 'public', 'favicon.svg'), mark);
  writeFileSync(resolve(dir, 'baton-partners-mark.svg'), mark);
  const lockup = (tone: 'ink' | 'paper') => {
    const baton = tone === 'ink' ? '#0E0F12' : '#FFFFFF';
    const g = tone === 'ink' ? ['#E0142F', '#9E0A22', '#E2334F'] : ['#FF6B7D', '#E2334F', '#FF8A99'];
    const inner = bpMark({ id: `l${tone}` })
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 64" width="330" height="64" role="img" aria-label="Baton Partners">
  <defs><linearGradient id="pw-${tone}" x1="0" x2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="0.55" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></linearGradient></defs>
  <g>${inner}</g>
  <text x="82" y="43" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="500" font-size="28" letter-spacing="4.5" fill="${baton}">Baton</text>
  <text x="196" y="44" font-family="Fraunces, 'Times New Roman', serif" font-style="italic" font-weight="500" font-size="33" fill="url(#pw-${tone})">Partners</text>
</svg>
`;
  };
  writeFileSync(resolve(dir, 'baton-partners-logo.svg'), lockup('ink'));
  writeFileSync(resolve(dir, 'baton-partners-logo-white.svg'), lockup('paper'));
}
