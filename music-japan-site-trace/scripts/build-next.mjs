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
for (const file of ["music-japan-logo.png", "music-japan-symbol.png", "favicon-music-japan.svg", "favicon.svg", "second-take-logo.png", "baton-logo.png", "baton-wordmark-v2.png"]) {
  cpSync(join(source, file), join(output, file));
}
// two large PNGs are stored split into parts in the snapshot
for (const [target, count] of [["music-japan-og.png", 4], ["kabeya-tomoki.png", 3]]) {
  const parts = Array.from({ length: count }, (_, i) => readFileSync(join(source, "archive-parts", `${target}.part-${String(i).padStart(3, "0")}`)));
  writeFileSync(join(output, target), Buffer.concat(parts));
}

// ── routing + caching (sitemap, robots, llms and the IndexNow key are emitted by vite) ──
const pairs = [["/", "/en/"], ...["business", "company", "profile", "partners", "contact", "privacy"].map((p) => [`/${p}/`, `/en/${p}/`])];
writeFileSync(join(output, "_redirects"), ["", "/en"].flatMap((prefix) => ["music", "media", "about"].flatMap((page) => [`${prefix}/${page} ${prefix}/business/ 301`, `${prefix}/${page}/ ${prefix}/business/ 301`])).join("\n") + "\n");
writeFileSync(join(output, "_headers"), `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/artwork/*
  Cache-Control: public, max-age=2592000
/audio/*
  Cache-Control: public, max-age=2592000
  X-Robots-Tag: noindex
/og/*
  Cache-Control: public, max-age=604800
/llms*.txt
  Content-Type: text/plain; charset=utf-8
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
for (const f of ["sitemap.xml", "robots.txt", "llms.txt", "llms-full.txt"]) if (!existsSync(join(output, f))) throw new Error(`${f} missing`);
for (const p of pairs.flat()) {
  const og = readFileSync(join(output, p, "index.html"), "utf8").match(/<meta property="og:image" content="https:\/\/music-japan\.com(\/og\/[^"?]+)/);
  if (!og || !existsSync(join(output, og[1]))) throw new Error(`OG image missing for ${p}`);
}
if (missing.length) throw new Error(`pages missing: ${missing.join(", ")}`);
for (const f of readdirSync(join(output, "audio"))) if (!statSync(join(output, "audio", f)).size) throw new Error(`empty audio ${f}`);
mkdirSync(join(output, "assets"), { recursive: true });
console.log(`NEEDLE DROP built: ${pages.length} pages → ${output}`);
