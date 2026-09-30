import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Locale } from '../content/releases';
import { path, workPath, type PageKey } from '../content/site';
import { renderHome } from './pages/home';
import { renderRelease, renderWorks } from './pages/works';
import { releases } from '../content/releases';
import { renderBusiness, renderCompany, renderContact, renderNotFound, renderOfficial, renderPartners, renderPrivacy, renderProfile } from './pages/inner';

export type GeneratedPage = { key: string; path: string; file: string };

const renderers: Record<PageKey, (l: Locale) => string> = {
  home: renderHome,
  business: renderBusiness,
  works: renderWorks,
  company: renderCompany,
  profile: renderProfile,
  partners: renderPartners,
  contact: renderContact,
  privacy: renderPrivacy,
};

/** Writes every page's index.html under next/ (git-ignored) for Vite to bundle. */
export function generatePages(root: string): GeneratedPage[] {
  const out: { key: string; path: string; html: string }[] = [];
  for (const locale of ['ja', 'en'] as Locale[]) {
    for (const key of Object.keys(renderers) as PageKey[]) {
      out.push({ key: `${locale}-${key}`, path: path(locale, key), html: renderers[key](locale) });
    }
    releases.forEach((r, i) => out.push({ key: `${locale}-work-${r.id}`, path: workPath(locale, r.id), html: renderRelease(locale, i) }));
  }
  out.push({ key: 'official', path: '/official/', html: renderOfficial() });
  out.push({ key: '404', path: '/404.html', html: renderNotFound() });
  return out.map(({ key, path: p, html }) => {
    const file = p.endsWith('.html') ? resolve(root, `.${p}`) : resolve(root, `.${p}`, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return { key, path: p, file };
  });
}
