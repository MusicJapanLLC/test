import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const required = [
  "index.html",
  "en/index.html",
  "company/index.html",
  "en/company/index.html",
  "privacy/index.html",
  "en/privacy/index.html",
  "robots.txt",
  "sitemap.xml",
  "favicon.svg",
  "music-japan-symbol.png",
  "music-japan-logo.png",
  "assets/index-DjF1m6Ft.css",
  "assets/index-D85UUJ7Q.js",
  "assets/MusicJapanSite-CUHG0yGo.js",
  "assets/RedFrequencyScene-ChWKxE7Y.js",
  "assets/gsap-DlCALkUl.js",
  "assets/ScrollTrigger-DZQrbmfv.js",
  "audio/tokyo-junkies-preview.mp3",
  "audio/kokoni-aru-preview.mp3",
  "audio/beach-sunset-preview.mp3",
  "audio/i-know-but-tried-preview.mp3",
  "audio/like-a-drug-dream-preview.mp3",
  "audio/like-a-drug-to-our-future-preview.mp3",
  "audio/like-a-drug-u-can-preview.mp3",
  "audio/all-i-need-preview.mp3",
  "audio/jazz-preview.mp3",
  "audio/classical-preview.mp3",
  "audio/deep-sleep-preview.mp3"
];

const multipartAssets = [
  {
    name: "music-japan-og.png",
    parts: 4,
    sha256: "7da07392a26294984027d0f740ca7f8a6f0b53dae8cda3788f902dc66a1230ef"
  },
  {
    name: "kabeya-tomoki.png",
    parts: 3,
    sha256: "79bb85f3b35d89ccf9b425d5c660bdab756d884d73427597cc4a715a3432478b"
  }
];

for (const asset of multipartAssets) {
  for (let index = 0; index < asset.parts; index += 1) {
    required.push(`archive-parts/${asset.name}.part-${String(index).padStart(3, "0")}`);
  }
}

const artworkNames = [
  "tokyo-junkies",
  "kokoni-aru",
  "beach-sunset",
  "i-know-but-tried",
  "like-a-drug",
  "all-i-need",
  "late-night-jazz",
  "fairytale-classical",
  "soft-rain-piano"
];

for (const name of artworkNames) {
  for (const size of [480, 800, 1200]) {
    required.push(`media/${name}-${size}x${size}bb.jpg`);
  }
}

for (const path of required) {
  await access(join(root, path));
  const info = await stat(join(root, path));
  if (!info.isFile() || info.size === 0) throw new Error(`Invalid snapshot file: ${path}`);
}

for (const asset of multipartAssets) {
  const hash = createHash("sha256");
  for (let index = 0; index < asset.parts; index += 1) {
    hash.update(
      await readFile(
        join(root, "archive-parts", `${asset.name}.part-${String(index).padStart(3, "0")}`)
      )
    );
  }
  if (hash.digest("hex") !== asset.sha256) throw new Error(`Multipart checksum failed: ${asset.name}`);
}

const pages = required.filter((path) => path.endsWith(".html"));
for (const path of pages) {
  const html = await readFile(join(root, path), "utf8");
  for (const marker of [
    "合同会社Music Japan",
    "/assets/index-DjF1m6Ft.css",
    "/assets/index-D85UUJ7Q.js",
    "application/ld+json"
  ]) {
    if (!html.includes(marker)) throw new Error(`${path} is missing ${marker}`);
  }

  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    JSON.parse(match[1]);
  }
}

const bundles = (await readdir(join(root, "assets"))).filter((path) => path.endsWith(".js"));
for (const bundle of bundles) {
  const source = await readFile(join(root, "assets", bundle), "utf8");
  for (const match of source.matchAll(/\.\/([A-Za-z0-9_.-]+\.js)/g)) {
    await access(join(root, "assets", match[1]));
  }
}

console.log(
  `Snapshot check passed: ${required.length} required files, ${pages.length} pages, ${bundles.length} JavaScript bundles`
);
