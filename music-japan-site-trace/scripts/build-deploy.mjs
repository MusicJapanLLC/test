// Cloudflare Pages deploy build
// Keep the known-good static copy/reassembly path intact, then rewrite ONLY the six public HTML files.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");
const OLD_SITE_URL = "https://music-japan.pearly-cedar-3983.chatgpt.site";
const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://music-japan.pages.dev").replace(/\/$/, "");

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
// Do not recursively rewrite CSS/JS/JSON/SVG: the previous broad rewrite path was removed after a display failure.
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

console.log(`Prepared static deploy directory: ${output}`);
console.log(`Canonical host: ${SITE_URL}`);
console.log(`Rewrote ${rewrittenReferences} legacy-host references across ${publicHtmlFiles.length} public HTML files.`);
