import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Locale } from '../content/releases';
import { path, type PageKey } from '../content/site';
import { renderHome } from './pages/home';
import { renderBusiness, renderCompany, renderContact, renderOfficial, renderPartners, renderPrivacy, renderProfile } from './pages/inner';

export type GeneratedPage = { key: string; path: string; file: string };

const renderers: Record<PageKey, (l: Locale) => string> = {
  home: renderHome,
  business: renderBusiness,
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
  }
  out.push({ key: 'official', path: '/official/', html: renderOfficial() });
  return out.map(({ key, path: p, html }) => {
    const file = resolve(root, `.${p}`, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return { key, path: p, file };
  });
}
