import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "deploy-dist");
const officialLogo = join(output, "music-japan-logo.png");
const shareImageName = "music-japan-share-20260921.png";
const shareImage = join(output, shareImageName);

if (!existsSync(output)) {
  throw new Error("deploy-dist is missing; run build-deploy.mjs first");
}

if (!existsSync(officialLogo)) {
  throw new Error("Official Music Japan logo is missing from deploy-dist");
}

// Use the official company logo as the social card image. A new filename is
// intentional: social platforms cache og:image aggressively, so changing the
// URL helps retire the old red/black artwork immediately on the next crawl.
copyFileSync(officialLogo, shareImage);

function rewriteMetaContent(html, key, value) {
  const keyPattern = new RegExp(`(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
  return html.replace(/<meta\b[^>]*>/gi, (tag) => {
    if (!keyPattern.test(tag)) return tag;
    if (/content=["'][^"']*["']/i.test(tag)) {
      return tag.replace(/content=["'][^"']*["']/i, `content="${value}"`);
    }
    return tag.replace(/\s*\/>$/, ` content="${value}" />`).replace(/>$/, ` content="${value}">`);
  });
}

let htmlFiles = 0;
let rewrittenFiles = 0;
let oldImageReferences = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const info = statSync(fullPath);
    if (info.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!name.endsWith(".html")) continue;

    htmlFiles += 1;
    let html = readFileSync(fullPath, "utf8");
    const before = html;
    const matches = html.match(/music-japan-og\.png/g);
    oldImageReferences += matches?.length || 0;

    html = html.replaceAll("music-japan-og.png", shareImageName);
    html = rewriteMetaContent(html, "og:image:width", "1500");
    html = rewriteMetaContent(html, "og:image:height", "500");

    if (html !== before) {
      writeFileSync(fullPath, html);
      rewrittenFiles += 1;
    }
  }
}

walk(output);

if (oldImageReferences === 0) {
  throw new Error("No music-japan-og.png references found; social metadata format may have changed");
}

console.log(
  `Social share image fixed: ${oldImageReferences} references across ${rewrittenFiles}/${htmlFiles} HTML files -> /${shareImageName}`
);
