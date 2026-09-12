import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
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

const textExtensions = new Set([".html", ".xml", ".txt", ".json", ".svg"]);

function rewriteUrls(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      rewriteUrls(fullPath);
      continue;
    }

    if (!entry.isFile() || !textExtensions.has(extname(entry.name).toLowerCase())) continue;

    let content = readFileSync(fullPath, "utf8");
    content = content.replaceAll(OLD_SITE_URL, SITE_URL);

    if (entry.name.endsWith(".html")) {
      content = content.replaceAll(`${SITE_URL}/music-japan-og.png`, `${SITE_URL}/music-japan-logo.png`);
      content = content.replaceAll('property="og:image:width" content="1734"', 'property="og:image:width" content="1500"');
      content = content.replaceAll('property="og:image:height" content="907"', 'property="og:image:height" content="500"');
      content = content.replaceAll('property="og:image:alt" content="Music Japan LLC — Red Frequency"', 'property="og:image:alt" content="Music Japan LLC logo"');
    }

    writeFileSync(fullPath, content);
  }
}

rewriteUrls(output);

console.log(`Prepared static deploy directory: ${output}`);
console.log(`Canonical base: ${SITE_URL}`);
