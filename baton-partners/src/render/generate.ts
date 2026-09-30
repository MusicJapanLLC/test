import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { routes } from '../config/site';
import { bpMark } from './logo';
import { partners } from '../partners';
import type { BuildEnv } from './layout';
import { renderAbout } from './pages/about';
import { renderContact } from './pages/contact';
import { renderInsight } from './pages/insight';
import { renderIndex, renderPrivacy } from './pages/misc';
import { renderService } from './pages/service';
import { renderTop } from './pages/top';

export type GeneratedPage = { key: string; path: string; file: string };

/**
 * src/ のテンプレートと企業データから、各ページの index.html を書き出す。
 * 書き出したファイルは .gitignore 済み。直接編集しない。
 */
export async function generatePages(root: string, env: BuildEnv): Promise<GeneratedPage[]> {
  const out: { key: string; path: string; html: string }[] = [
    { key: 'index', path: '/', html: renderIndex(partners, env) },
    { key: 'privacy', path: routes.privacy(), html: renderPrivacy(env) },
  ];

  for (const p of partners) {
    out.push(
      { key: `${p.slug}-top`, path: routes.top(p.slug), html: renderTop(p, env) },
      { key: `${p.slug}-about`, path: routes.about(p.slug), html: renderAbout(p, env) },
      { key: `${p.slug}-insight`, path: routes.insight(p.slug, p.insight.slug), html: renderInsight(p, env) },
      { key: `${p.slug}-service`, path: routes.service(p.slug), html: renderService(p, env) },
      { key: `${p.slug}-contact`, path: routes.contact(p.slug), html: await renderContact(p, env) },
    );
  }

  writeBrandFiles(root);

  return out.map(({ key, path, html }) => {
    const file = resolve(root, `.${path}`, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return { key, path, file };
  });
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
