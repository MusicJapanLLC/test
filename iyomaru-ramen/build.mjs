#!/usr/bin/env node
// Zero-dependency static site builder for the Iyomaru Suisan ramen site.
// Usage:
//   node build.mjs            build once into dist/
//   node build.mjs --serve    build, then serve dist/ on http://localhost:5173
//
// Env overrides (used by the GitHub Pages CI build so the preview deploy
// resolves correctly at its project-page subpath — see config/site.json for
// the real production defaults):
//   SITE_URL       overrides config.siteUrl
//   SITE_BASE_PATH overrides config.basePath

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { renderPage } from './src/template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function normalizeBase(base) {
  let b = base || '/';
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  return b;
}

function build() {
  const config = readJson(path.join(ROOT, 'config', 'site.json'));
  const siteUrl = (process.env.SITE_URL || config.siteUrl).replace(/\/+$/, '');
  const basePath = normalizeBase(process.env.SITE_BASE_PATH || config.basePath);

  const localeData = Object.fromEntries(
    config.locales.map((locale) => [locale, readJson(path.join(ROOT, 'locales', `${locale}.json`))])
  );

  // path (relative to site root, no leading slash) -> absolute root-relative URL
  const url = (suffix = '') => basePath + suffix;
  const localePath = (locale) => (locale === config.defaultLocale ? '' : `${locale}/`);

  const alternates = config.locales.map((locale) => ({
    locale,
    hreflang: { ja: 'ja', en: 'en', zh: 'zh-Hans', ko: 'ko' }[locale],
    href: `${siteUrl}${url(localePath(locale))}`,
  }));

  const ogImageUrl = `${siteUrl}${url('assets/img/og-image.jpg')}`;

  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  for (const locale of config.locales) {
    const data = localeData[locale];
    const canonicalUrl = `${siteUrl}${url(localePath(locale))}`;
    const html = renderPage({ locale, data, config, url, canonicalUrl, ogImageUrl, alternates });
    const outDir = path.join(DIST, localePath(locale));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    console.log(`✓ built ${localePath(locale) || '/'}index.html`);
  }

  // Static assets
  mkdirSync(path.join(DIST, 'assets', 'css'), { recursive: true });
  mkdirSync(path.join(DIST, 'assets', 'js'), { recursive: true });
  cpSync(path.join(ROOT, 'src', 'styles.css'), path.join(DIST, 'assets', 'css', 'styles.css'));
  cpSync(path.join(ROOT, 'src', 'main.js'), path.join(DIST, 'assets', 'js', 'main.js'));
  const publicDir = path.join(ROOT, 'public');
  if (existsSync(publicDir)) cpSync(publicDir, DIST, { recursive: true });

  // robots.txt + sitemap.xml
  writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${siteUrl}${url('sitemap.xml')}\n`,
    'utf8'
  );

  const urlEntries = config.locales
    .map((locale) => {
      const loc = `${siteUrl}${url(localePath(locale))}`;
      const alts = alternates
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
        .join('\n');
      return `  <url>\n    <loc>${loc}</loc>\n${alts}\n  </url>`;
    })
    .join('\n');
  writeFileSync(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlEntries}\n</urlset>\n`,
    'utf8'
  );

  console.log(`\nBuild complete → ${path.relative(ROOT, DIST)}/`);
  console.log(`  siteUrl:   ${siteUrl}`);
  console.log(`  basePath:  ${basePath}`);
}

function serve(port = 5173) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8',
  };
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath.endsWith('/')) reqPath += 'index.html';
    let filePath = path.join(DIST, reqPath);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!existsSync(filePath)) {
      const withHtml = `${filePath}.html`;
      if (existsSync(withHtml)) {
        filePath = withHtml;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  server.listen(port, () => {
    console.log(`\nServing dist/ → http://localhost:${port}/`);
  });
}

const args = process.argv.slice(2);
build();
if (args.includes('--serve')) {
  serve(Number(process.env.PORT) || 5173);
}
