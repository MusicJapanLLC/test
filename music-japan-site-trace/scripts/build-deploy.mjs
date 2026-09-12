// Cloudflare Pages deploy build
// Keep the known-good static copy/reassembly path intact, then perform only explicit SEO host rewrites.
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");
const OLD_SITE_URL = "https://music-japan.pearly-cedar-3983.chatgpt.site";
const DEFAULT_SITE_URL = "https://music-japan.pages.dev";
const SITE_URL = (process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");

rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });

const virtualFiles = new Map([
  [
    "music-japan-og.png",
    [
      "archive-parts/music-japan-og.png.part-000",
      "archive-parts/music-japan-og.png.part-001",
      "archive-parts/music-japan-og.png.part-002",
      "archive-parts/music-japan-og.png.part-003"
    ]
  ],
  [
    "kabeya-tomoki.png",
    [
      "archive-parts/kabeya-tomoki.png.part-000",
      "archive-parts/kabeya-tomoki.png.part-001",
      "archive-parts/kabeya-tomoki.png.part-002"
    ]
  ]
]);

for (const [target, parts] of virtualFiles) {
  const buffers = parts.map((part) => readFileSync(join(source, part)));
  writeFileSync(join(output, target), Buffer.concat(buffers));
}

rmSync(join(output, "archive-parts"), { recursive: true, force: true });

// Exact, deliberately narrow migration rewrite.
// Do not recursively rewrite CSS/JS/JSON/SVG: a broad rewrite path previously caused a display failure.
const publicHtmlFiles = [
  "index.html",
  "en/index.html",
  "company/index.html",
  "en/company/index.html",
  "privacy/index.html",
  "en/privacy/index.html"
];

let rewrittenReferences = 0;

for (const relativePath of publicHtmlFiles) {
  const fullPath = join(output, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing public HTML during deploy: ${relativePath}`);
  }

  const original = readFileSync(fullPath, "utf8");
  const referenceCount = original.split(OLD_SITE_URL).length - 1;

  if (referenceCount === 0) {
    throw new Error(`Expected legacy host reference was not found in: ${relativePath}`);
  }

  const rewritten = original.replaceAll(OLD_SITE_URL, SITE_URL);
  writeFileSync(fullPath, rewritten);
  rewrittenReferences += referenceCount;
}

// Keep machine-readable discovery files on the same canonical host.
// This also makes a future custom-domain move a single PUBLIC_SITE_URL setting instead of another code rewrite.
const machineReadableFiles = ["robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"];

for (const relativePath of machineReadableFiles) {
  const fullPath = join(output, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing SEO/AIO file during deploy: ${relativePath}`);
  }

  const original = readFileSync(fullPath, "utf8");
  const rewritten = original.replaceAll(DEFAULT_SITE_URL, SITE_URL);
  writeFileSync(fullPath, rewritten);
}

// Fail the build before Cloudflare publishes anything if a critical migration condition is broken.
for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");

  if (html.includes(OLD_SITE_URL)) {
    throw new Error(`Legacy canonical host still present after rewrite: ${relativePath}`);
  }
  if (!html.includes(SITE_URL)) {
    throw new Error(`Canonical host missing after rewrite: ${relativePath}`);
  }
  if (!html.includes('rel="canonical"')) {
    throw new Error(`Canonical link missing: ${relativePath}`);
  }
  if (!html.includes('application/ld+json')) {
    throw new Error(`Structured data missing: ${relativePath}`);
  }
}

for (const relativePath of machineReadableFiles) {
  const content = readFileSync(join(output, relativePath), "utf8");
  if (content.includes(OLD_SITE_URL)) {
    throw new Error(`Legacy host remains in SEO/AIO file: ${relativePath}`);
  }
}

for (const requiredImage of ["music-japan-og.png", "kabeya-tomoki.png"]) {
  const fullPath = join(output, requiredImage);
  if (!existsSync(fullPath) || statSync(fullPath).size === 0) {
    throw new Error(`Required reconstructed image is missing or empty: ${requiredImage}`);
  }
}

// Verify that local CSS/JS assets referenced by the public HTML still exist after the build.
const localAssetRefs = new Set();
for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  for (const match of html.matchAll(/(?:href|src)="\/(assets\/[^"?#]+)"/g)) {
    localAssetRefs.add(match[1]);
  }
}
for (const assetPath of localAssetRefs) {
  if (!existsSync(join(output, assetPath))) {
    throw new Error(`Referenced local asset is missing: /${assetPath}`);
  }
}

console.log(`Prepared static deploy directory: ${output}`);
console.log(`Canonical host: ${SITE_URL}`);
console.log(`Rewrote ${rewrittenReferences} legacy-host references across ${publicHtmlFiles.length} public HTML files.`);
console.log(`Validated ${machineReadableFiles.length} SEO/AIO files, ${localAssetRefs.size} local assets, and reconstructed images.`);
