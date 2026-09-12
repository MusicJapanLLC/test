// Cloudflare Pages deploy build
// Keep the known-good static copy/reassembly path intact, then perform only safe SEO and favicon-head rewrites.
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");
const OLD_SITE_URL = "https://music-japan.pearly-cedar-3983.chatgpt.site";
const DEFAULT_SITE_URL = "https://music-japan.pages.dev";
const SITE_URL = (process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
const RSC_MARKER = '<script id="_R_">';
const FAVICON_URL = "/favicon-music-japan.svg?v=20260913-final";
const APPLE_ICON_URL = "/music-japan-symbol.png?v=20260913-final";

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
  if (!existsSync(fullPath)) throw new Error(`Missing public HTML during deploy: ${relativePath}`);

  const original = readFileSync(fullPath, "utf8");
  const markerIndex = original.indexOf(RSC_MARKER);
  if (markerIndex === -1) throw new Error(`RSC marker missing: ${relativePath}`);

  // Vinext/React Server Components append a length-prefixed serialized payload after this marker.
  // Never mutate that payload. All SEO/favicon rewrites stay inside the real document HTML only.
  let documentHtml = original.slice(0, markerIndex);
  const rscPayload = original.slice(markerIndex);
  const referenceCount = documentHtml.split(OLD_SITE_URL).length - 1;
  if (referenceCount === 0) throw new Error(`Expected legacy host reference missing in document HTML: ${relativePath}`);

  // Canonical/OGP/JSON-LD host migration
  documentHtml = documentHtml.replaceAll(OLD_SITE_URL, SITE_URL);

  // Remove every pre-existing favicon declaration so Chrome has one unambiguous browser-tab icon.
  documentHtml = documentHtml
    .replace(/<link\s+rel="shortcut icon"[^>]*\/>/gi, "")
    .replace(/<link\s+rel="icon"[^>]*\/>/gi, "")
    .replace(/<link\s+rel="apple-touch-icon"[^>]*\/>/gi, "");

  const faviconTags = `<link rel="icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="apple-touch-icon" href="${APPLE_ICON_URL}"/>`;
  if (!documentHtml.includes("</head>")) throw new Error(`Head close tag missing: ${relativePath}`);
  documentHtml = documentHtml.replace("</head>", `${faviconTags}\n</head>`);

  const rewritten = documentHtml + rscPayload;

  // Byte-for-byte protection for hydration data
  if (rewritten.slice(documentHtml.length) !== rscPayload) {
    throw new Error(`RSC payload changed unexpectedly: ${relativePath}`);
  }

  writeFileSync(fullPath, rewritten);
  rewrittenReferences += referenceCount;
}

const machineReadableFiles = ["robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"];
for (const relativePath of machineReadableFiles) {
  const fullPath = join(output, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Missing SEO/AIO file during deploy: ${relativePath}`);
  const original = readFileSync(fullPath, "utf8");
  writeFileSync(fullPath, original.replaceAll(DEFAULT_SITE_URL, SITE_URL));
}

for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = html.slice(0, markerIndex);

  if (documentHtml.includes(OLD_SITE_URL)) throw new Error(`Legacy host remains in document HTML: ${relativePath}`);
  if (!documentHtml.includes(SITE_URL)) throw new Error(`Canonical host missing in document HTML: ${relativePath}`);
  if (!documentHtml.includes('rel="canonical"')) throw new Error(`Canonical link missing: ${relativePath}`);
  if (!documentHtml.includes('application/ld+json')) throw new Error(`Structured data missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="icon" type="image/svg+xml" href="${FAVICON_URL}"`)) throw new Error(`New favicon missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"`)) throw new Error(`New shortcut favicon missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="apple-touch-icon" href="${APPLE_ICON_URL}"`)) throw new Error(`Apple touch icon missing: ${relativePath}`);
}

for (const relativePath of machineReadableFiles) {
  const content = readFileSync(join(output, relativePath), "utf8");
  if (content.includes(OLD_SITE_URL)) throw new Error(`Legacy host remains in SEO/AIO file: ${relativePath}`);
}

for (const requiredFile of ["music-japan-og.png", "kabeya-tomoki.png", "music-japan-symbol.png", "favicon-music-japan.svg"]) {
  const fullPath = join(output, requiredFile);
  if (!existsSync(fullPath) || statSync(fullPath).size === 0) {
    throw new Error(`Required branding/SEO file is missing or empty: ${requiredFile}`);
  }
}

const localAssetRefs = new Set();
for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = html.slice(0, markerIndex);
  for (const match of documentHtml.matchAll(/(?:href|src)="\/(assets\/[^"?#]+)"/g)) {
    localAssetRefs.add(match[1]);
  }
}
for (const assetPath of localAssetRefs) {
  if (!existsSync(join(output, assetPath))) throw new Error(`Referenced local asset is missing: /${assetPath}`);
}

console.log(`Prepared static deploy directory: ${output}`);
console.log(`Canonical host: ${SITE_URL}`);
console.log(`Chrome/tab favicon: ${FAVICON_URL}`);
console.log(`Safely rewrote ${rewrittenReferences} SEO references across ${publicHtmlFiles.length} public HTML documents.`);
console.log(`Preserved all RSC hydration payloads byte-for-byte.`);
console.log(`Validated ${machineReadableFiles.length} SEO/AIO files, ${localAssetRefs.size} local assets, and required branding files.`);
