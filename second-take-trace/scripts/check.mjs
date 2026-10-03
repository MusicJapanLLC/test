// Validates the built site in dist/. Used as the Cloudflare Pages build command.
//   npm run check
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const root = join(process.cwd(), "dist");
const files = [];
const errors = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const target = join(directory, entry);
    if (statSync(target).isDirectory()) walk(target);
    else files.push(target);
  }
}

function resolves(href, source) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return true;
  const target = clean.startsWith("/") ? join(root, clean) : join(dirname(source), clean);
  if (existsSync(target) && statSync(target).isFile()) return true;
  return existsSync(join(target, "index.html"));
}

walk(root);
const pages = files.filter((file) => extname(file) === ".html");

for (const file of pages) {
  const html = readFileSync(file, "utf8");
  const page = relative(root, file).replaceAll("\\", "/");
  const fail = (message) => errors.push(`${page}: ${message}`);

  if (!html.startsWith("<!doctype html>")) fail("missing doctype");
  if (!/<html lang="(ja|en)">/.test(html)) fail("missing lang attribute");
  if (!html.includes('<meta name="viewport"')) fail("missing viewport");
  if (!/<title>[^<]+<\/title>/.test(html)) fail("missing title");
  if (!/<meta name="description" content="[^"]+">/.test(html)) fail("missing description");
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail("expected exactly one h1");
  if (/undefined|NaN|\[object Object\]/.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) fail("template leak (undefined/NaN)");

  for (const [, tag] of html.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\salt="/.test(tag)) fail(`image without alt: ${tag.slice(0, 80)}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) {
      if (!/data-float-img/.test(tag) && !/frame__still/.test(tag)) fail(`image without dimensions: ${tag.slice(0, 80)}`);
    }
  }

  for (const [, attr, value] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|data:)/.test(value)) continue;
    if (!resolves(value, file)) fail(`broken ${attr}: ${value}`);
  }

  if (page !== "404.html") {
    for (const lang of ["ja", "en"]) {
      const match = html.match(new RegExp(`hreflang="${lang}" href="https://secondtake\\.music-japan\\.com([^"]+)"`));
      if (!match) fail(`missing hreflang ${lang}`);
      else if (!resolves(match[1], file)) fail(`hreflang ${lang} points to a missing page: ${match[1]}`);
    }
  }

  if (!html.includes('content="noindex,nofollow"')) fail("sample site must stay noindex until real articles are published");
}

// Every Japanese page needs an English twin and vice versa.
const ja = pages.map((f) => relative(root, f).replaceAll("\\", "/")).filter((p) => !p.startsWith("en/") && p !== "404.html");
const en = pages.map((f) => relative(root, f).replaceAll("\\", "/")).filter((p) => p.startsWith("en/"));
for (const p of ja) if (!en.includes(`en/${p}`)) errors.push(`${p}: no English version`);
for (const p of en) if (!ja.includes(p.slice(3))) errors.push(`${p}: no Japanese version`);

for (const required of ["_headers", "robots.txt", "sitemap.xml", "feed.xml", "en/feed.xml", "assets/styles.css", "assets/site.js", "assets/fonts.css", "assets/search-ja.json", "assets/search-en.json"]) {
  if (!existsSync(join(root, required))) errors.push(`missing ${required}`);
}

const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
for (const [, url] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const path = new URL(url).pathname;
  const file = join(root, path, "index.html");
  if (!existsSync(file)) errors.push(`sitemap: missing page ${url}`);
  else if (/name="robots"[^>]*content="[^"]*noindex/i.test(readFileSync(file, "utf8"))) errors.push(`sitemap: noindex page ${url}`);
}
for (const feed of ["feed.xml", "en/feed.xml"]) {
  if (/<item>/.test(readFileSync(join(root, feed), "utf8"))) errors.push(`${feed}: sample articles must not be syndicated`);
}
const full = readFileSync(join(root, "llms-full.txt"), "utf8");
if (/\/(?:en\/)?articles\//.test(full)) errors.push("llms-full.txt: sample article export");

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`check: ${pages.length} pages OK (ja ${ja.length} / en ${en.length} + 404)\n`);
