// Cloudflare Pages deploy build
// Keep the known-good static copy/reassembly path intact, then perform only safe SEO host rewrites.
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
const FAVICON_URL = "/music-japan-symbol.png?v=20260913";

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

  // IMPORTANT:
  // Vinext/React Server Components append a length-prefixed serialized payload after this marker.
  // Replacing text inside that payload changes byte lengths without updating the prefixes and can blank the page.
  // Therefore SEO / brand-head rewrites are limited to the real HTML document before hydration begins.
  const documentHtml = original.slice(0, markerIndex);
  const rscPayload = original.slice(markerIndex);
  const referenceCount = documentHtml.split(OLD_SITE_URL).length - 1;
  if (referenceCount === 0) throw new Error(`Expected legacy host reference missing in document HTML: ${relativePath}`);

  // Use the existing 480x480 Music Japan symbol as the browser/tab icon.
  // The version query intentionally breaks aggressive favicon caches after this branding update.
  let rewrittenDocument = documentHtml
    .replaceAll(`${OLD_SITE_URL}/favicon.svg`, FAVICON_URL)
    .replaceAll(OLD_SITE_URL, SITE_URL);

  rewrittenDocument = rewrittenDocument
    .replaceAll(`rel="shortcut icon" href="${FAVICON_URL}"`, `rel="shortcut icon" type="image/png" href="${FAVICON_URL}"`)
    .replaceAll(`rel="icon" href="${FAVICON_URL}"`, `rel="icon" type="image/png" href="${FAVICON_URL}"`)
    .replaceAll(
      `<link rel="icon" type="image/png" href="${FAVICON_URL}"/>`,
      `<link rel="icon" type="image/png" href="${FAVICON_URL}"/><link rel="apple-touch-icon" href="${FAVICON_URL}"/>`
    );

  const rewritten = rewrittenDocument + rscPayload;

  // Guard against accidental mutation of the length-prefixed RSC payload
  if (rewritten.slice(rewrittenDocument.length) !== rscPayload) {
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

// Validate only the real document portion, never the serialized RSC payload
for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = html.slice(0, markerIndex);

  if (documentHtml.includes(OLD_SITE_URL)) throw new Error(`Legacy host remains in document HTML: ${relativePath}`);
  if (!documentHtml.includes(SITE_URL)) throw new Error(`Canonical host missing in document HTML: ${relativePath}`);
  if (!documentHtml.includes('rel="canonical"')) throw new Error(`Canonical link missing: ${relativePath}`);
  if (!documentHtml.includes('application/ld+json')) throw new Error(`Structured data missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="icon" type="image/png" href="${FAVICON_URL}"`)) {
    throw new Error(`Music Japan favicon missing: ${relativePath}`);
  }
  if (!documentHtml.includes(`rel="apple-touch-icon" href="${FAVICON_URL}"`)) {
    throw new Error(`Apple touch icon missing: ${relativePath}`);
  }
}

for (const relativePath of machineReadableFiles) {
  const content = readFileSync(join(output, relativePath), "utf8");
  if (content.includes(OLD_SITE_URL)) throw new Error(`Legacy host remains in SEO/AIO file: ${relativePath}`);
}

for (const requiredImage of ["music-japan-og.png", "kabeya-tomoki.png", "music-japan-symbol.png"]) {
  const fullPath = join(output, requiredImage);
  if (!existsSync(fullPath) || statSync(fullPath).size === 0) {
    throw new Error(`Required image is missing or empty: ${requiredImage}`);
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
console.log(`Browser icon: ${FAVICON_URL}`);
console.log(`Safely rewrote ${rewrittenReferences} SEO references across ${publicHtmlFiles.length} public HTML documents.`);
console.log(`Preserved all RSC hydration payloads byte-for-byte.`);
console.log(`Validated ${machineReadableFiles.length} SEO/AIO files, ${localAssetRefs.size} local assets, and required images.`);
