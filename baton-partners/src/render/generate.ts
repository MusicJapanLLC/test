import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { routes } from '../config/site';
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

  return out.map(({ key, path, html }) => {
    const file = resolve(root, `.${path}`, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return { key, path, file };
  });
}
