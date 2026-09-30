// Builds the NEEDLE DROP site into deploy-dist/ and adds the static files it needs from
// the preserved snapshot in dist/ (audio previews, artwork backups, logos, portrait).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");
const SITE_URL = "https://music-japan.com";

rmSync(output, { recursive: true, force: true });
await build({ configFile: join(root, "next/vite.config.ts"), logLevel: "warn" });

// ── static files carried over from the snapshot ──
cpSync(join(source, "audio"), join(output, "audio"), { recursive: true });
cpSync(join(source, "media"), join(output, "artwork"), { recursive: true });
cpSync(join(source, "partners"), join(output, "partners"), { recursive: true, force: false, errorOnExist: false });
for (const file of ["music-japan-logo.png", "music-japan-symbol.png", "favicon-music-japan.svg", "favicon.svg", "second-take-logo.png", "baton-logo.png", "baton-wordmark-v2.png", "llms.txt", "llms-full.txt"]) {
  cpSync(join(source, file), join(output, file));
}
// two large PNGs are stored split into parts in the snapshot
for (const [target, count] of [["music-japan-og.png", 4], ["kabeya-tomoki.png", 3]]) {
  const parts = Array.from({ length: count }, (_, i) => readFileSync(join(source, "archive-parts", `${target}.part-${String(i).padStart(3, "0")}`)));
  writeFileSync(join(output, target), Buffer.concat(parts));
}

// ── machine-readable files ──
const pairs = [["/", "/en/"], ...["business", "company", "profile", "partners", "contact", "privacy"].map((p) => [`/${p}/`, `/en/${p}/`])];
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pairs.flatMap(([ja, en]) => [ja, en].map((loc) => `  <url>
    <loc>${SITE_URL}${loc}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="ja-JP" href="${SITE_URL}${ja}" />
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${ja}" />
  </url>`)).join("\n")}
</urlset>
`);
writeFileSync(join(output, "robots.txt"), readFileSync(join(source, "robots.txt"), "utf8"));
for (const file of ["llms.txt", "llms-full.txt"]) {
  const text = readFileSync(join(output, file), "utf8")
    .replace(/^- 音楽: .*\n/m, "").replace(/^- メディア: .*\n/m, "")
    .replace(/^- 私たちについて: .*\n/m, "- 事業概要: https://music-japan.com/business/\n- パートナー: https://music-japan.com/partners/\n");
  writeFileSync(join(output, file), text);
}
writeFileSync(join(output, "_redirects"), ["", "/en"].flatMap((prefix) => ["music", "media", "about"].flatMap((page) => [`${prefix}/${page} ${prefix}/business/ 301`, `${prefix}/${page}/ ${prefix}/business/ 301`])).join("\n") + "\n");
writeFileSync(join(output, "_headers"), `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/artwork/*
  Cache-Control: public, max-age=2592000
/audio/*
  Cache-Control: public, max-age=2592000
  X-Robots-Tag: noindex
`);

// ── validation: fail the build rather than publish a broken site ──
const pages = pairs.flat().concat(["/official/"]);
const missing = [];
for (const p of pages) {
  const file = join(output, p, "index.html");
  if (!existsSync(file)) { missing.push(p); continue; }
  const html = readFileSync(file, "utf8");
  if (p !== "/official/") {
    if (!html.includes(`<link rel="canonical" href="${SITE_URL}${p}">`)) throw new Error(`canonical missing: ${p}`);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ld) throw new Error(`JSON-LD missing: ${p}`);
    JSON.parse(ld[1].replaceAll("\\u003c", "<"));
    if (!/<script type="module" crossorigin src="\/assets\/[^"]+\.js">/.test(html)) throw new Error(`client bundle missing: ${p}`);
  }
  for (const m of html.matchAll(/(?:src|href)="(\/(?!\/)[^"#?]*)/g)) {
    const ref = m[1];
    if (ref.endsWith("/")) continue;
    if (!existsSync(join(output, ref))) throw new Error(`${p} references a missing file: ${ref}`);
  }
}
if (missing.length) throw new Error(`pages missing: ${missing.join(", ")}`);
for (const f of readdirSync(join(output, "audio"))) if (!statSync(join(output, "audio", f)).size) throw new Error(`empty audio ${f}`);
mkdirSync(join(output, "assets"), { recursive: true });
console.log(`NEEDLE DROP built: ${pages.length} pages → ${output}`);
