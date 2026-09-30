// Builds the NEEDLE DROP site into deploy-dist/ and adds the static files it needs from
// the preserved snapshot in dist/ (audio previews, artwork backups, logos, portrait).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { audit } from "./seo-audit.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");

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

// ── routing, caching and response headers (sitemap, robots, llms and the IndexNow key are emitted by vite) ──
writeFileSync(join(output, "_redirects"), ["", "/en"].flatMap((prefix) => ["music", "media", "about"].flatMap((page) => [`${prefix}/${page} ${prefix}/business/ 301`, `${prefix}/${page}/ ${prefix}/business/ 301`])).join("\n") + "\n");
writeFileSync(join(output, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000
https://:project.pages.dev/*
  X-Robots-Tag: noindex
https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/artwork/*
  Cache-Control: public, max-age=2592000
/audio/*
  Cache-Control: public, max-age=2592000
  X-Robots-Tag: noindex
/og/*
  Cache-Control: public, max-age=604800
/llms.txt
  Content-Type: text/plain; charset=utf-8
/llms-full.txt
  Content-Type: text/plain; charset=utf-8
`);

// ── validation: fail the build rather than publish a broken site ──
for (const f of ["sitemap.xml", "robots.txt", "llms.txt", "llms-full.txt", "404.html", "official/index.html"]) if (!existsSync(join(output, f))) throw new Error(`${f} missing`);
for (const f of readdirSync(join(output, "audio"))) if (!statSync(join(output, "audio", f)).size) throw new Error(`empty audio ${f}`);
for (const [, ref] of readFileSync(join(output, "index.html"), "utf8").matchAll(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)">/g)) if (!existsSync(join(output, ref))) throw new Error(`client bundle missing: ${ref}`);
const { errors, warnings, pages } = audit(output);
for (const w of warnings) console.warn(`warn  ${w}`);
if (errors.length) throw new Error(`SEO audit failed:\n${errors.join("\n")}`);
mkdirSync(join(output, "assets"), { recursive: true });
console.log(`NEEDLE DROP built: ${pages} indexable pages → ${output} (SEO audit: 0 errors, ${warnings.length} warnings)`);
