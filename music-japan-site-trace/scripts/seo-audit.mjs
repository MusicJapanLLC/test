// SEO / AIO gate for the built site. Runs at the end of build:deploy and on its own via
// `npm run seo:audit`. Errors fail the build; warnings are printed for a human to judge.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://music-japan.com";

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const metas = (html) => {
  const out = {};
  for (const [tag] of html.matchAll(/<meta [^>]+>/g)) {
    const key = attr(tag, "property") ?? attr(tag, "name");
    if (key) out[key] = attr(tag, "content");
  }
  return out;
};
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const text = (s) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** URL path → built file (directories resolve to index.html). */
function fileFor(out, p) {
  const clean = decodeURI(p.split(/[?#]/)[0]);
  if (clean.endsWith("/")) return join(out, clean, "index.html");
  return join(out, clean);
}

export function audit(out) {
  const errors = [];
  const warnings = [];
  const err = (p, m) => errors.push(`${p}: ${m}`);
  const warn = (p, m) => warnings.push(`${p}: ${m}`);

  const sitemap = readFileSync(join(out, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (new Set(locs).size !== locs.length) err("sitemap.xml", "duplicate <loc>");
  const robots = readFileSync(join(out, "robots.txt"), "utf8");
  if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) err("robots.txt", "Sitemap line missing");
  if (/^Disallow: \/\s*$/m.test(robots)) err("robots.txt", "blocks the whole site");

  // every built page must be either in the sitemap or explicitly noindex
  const built = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const f = join(dir, name);
      if (statSync(f).isDirectory()) { if (!["assets", "audio", "artwork", "og"].includes(name)) walk(f); }
      else if (name === "index.html") built.push("/" + f.slice(out.length + 1, -"index.html".length).replaceAll("\\", "/"));
    }
  };
  walk(out);

  const titles = new Map();
  const descriptions = new Map();
  const heads = new Map();
  for (const p of built) {
    const html = readFileSync(fileFor(out, p), "utf8");
    const m = metas(html);
    const noindex = /noindex/.test(m.robots ?? "");
    const url = `${SITE_URL}${p}`;
    if (noindex) { if (locs.includes(url)) err(p, "noindex page listed in sitemap"); continue; }
    if (!locs.includes(url)) err(p, "indexable page missing from sitemap");

    // head essentials
    const title = text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    if (!title) err(p, "no <title>");
    else if (title.length > 70) warn(p, `title is ${title.length} chars`);
    if (titles.has(title)) err(p, `duplicate title with ${titles.get(title)}`); else titles.set(title, p);
    const desc = decode(m.description ?? "");
    if (desc.length < 30) err(p, "meta description missing or too short");
    else if (desc.length > 160) warn(p, `description is ${desc.length} chars`);
    if (descriptions.has(desc)) err(p, `duplicate description with ${descriptions.get(desc)}`); else descriptions.set(desc, p);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (canonical !== url) err(p, `canonical ${canonical} ≠ ${url}`);
    const lang = html.match(/<html lang="([^"]+)"/)?.[1];
    if (!lang) err(p, "no <html lang>");

    // hreflang must be complete and reciprocal
    const alts = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((a) => [a[1], a[2]]));
    for (const h of ["ja-JP", "en", "x-default"]) if (!alts[h]) err(p, `hreflang ${h} missing`);
    if (alts["ja-JP"] !== url && alts.en !== url) err(p, "hreflang set does not include itself");
    for (const h of ["ja-JP", "en"]) {
      const other = alts[h]?.replace(SITE_URL, "");
      if (!other || other === p) continue;
      const f = fileFor(out, other);
      if (!existsSync(f)) { err(p, `hreflang ${h} target missing: ${other}`); continue; }
      if (!readFileSync(f, "utf8").includes(`hreflang="${h === "en" ? "ja-JP" : "en"}" href="${url}"`)) err(p, `hreflang not reciprocated by ${other}`);
    }

    // social cards
    for (const k of ["og:title", "og:description", "og:url", "og:image", "og:image:alt", "twitter:card"]) if (!m[k]) err(p, `${k} missing`);
    if (m["og:url"] && m["og:url"] !== url) err(p, "og:url ≠ canonical");
    if (m["og:image"]?.startsWith(SITE_URL) && !existsSync(fileFor(out, m["og:image"].slice(SITE_URL.length)))) err(p, `og:image file missing: ${m["og:image"]}`);

    // content structure
    const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
    if (h1s !== 1) err(p, `${h1s} <h1> elements`);
    const bodyText = text(html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, "").match(/<main[\s\S]*<\/main>/)?.[0] ?? "");
    if (bodyText.length < 250) warn(p, `thin content (${bodyText.length} chars in <main>)`);
    heads.set(p, html);
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) if (attr(tag, "alt") === undefined) err(p, `img without alt: ${tag.slice(0, 80)}`);
    if (!/<nav class="crumbs"/.test(html) && p !== "/" && p !== "/en/") err(p, "no visible breadcrumb");

    // structured data
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (blocks.length !== 1) { err(p, `${blocks.length} JSON-LD blocks`); continue; }
    let graph;
    try { graph = JSON.parse(blocks[0][1])["@graph"]; } catch (e) { err(p, `JSON-LD does not parse: ${e.message}`); continue; }
    const defined = new Set();
    const refs = new Set();
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      const keys = Object.keys(node);
      if (node["@id"] && keys.length === 1) refs.add(node["@id"]);
      else if (node["@id"]) defined.add(node["@id"]);
      keys.forEach((k) => visit(node[k]));
    };
    visit(graph);
    for (const r of refs) if (!defined.has(r)) err(p, `JSON-LD references undefined @id ${r}`);
    const types = new Set(graph.map((n) => n["@type"]));
    for (const t of ["Corporation", "WebSite"]) if (!types.has(t)) err(p, `JSON-LD ${t} missing`);
    if (p !== "/" && p !== "/en/" && !types.has("BreadcrumbList")) err(p, "JSON-LD BreadcrumbList missing");
    const page = graph.find((n) => n["@id"] === `${url}#webpage`);
    if (!page) err(p, "JSON-LD WebPage node missing");

    // internal links resolve
    for (const [, href] of html.matchAll(/href="(\/(?!\/)[^"]*)"/g)) {
      if (!existsSync(fileFor(out, href))) err(p, `broken internal link ${href}`);
    }
  }
  for (const loc of locs) if (!existsSync(fileFor(out, loc.replace(SITE_URL, "")))) err("sitemap.xml", `lists a page that was not built: ${loc}`);
  for (const f of ["llms.txt", "llms-full.txt"]) {
    const t = readFileSync(join(out, f), "utf8");
    for (const [, u] of t.matchAll(/\((https:\/\/music-japan\.com[^)\s]*)\)/g)) if (!existsSync(fileFor(out, u.replace(SITE_URL, "") || "/"))) err(f, `links to a missing page: ${u}`);
  }
  return { errors, warnings, pages: heads.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? join(fileURLToPath(new URL("..", import.meta.url)), "deploy-dist");
  const { errors, warnings, pages } = audit(out);
  for (const w of warnings) console.warn(`warn  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`SEO audit: ${pages} indexable pages, ${errors.length} errors, ${warnings.length} warnings`);
  if (errors.length) process.exit(1);
}
