import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const root = join(process.cwd(), "dist");
const origin = "https://secondtake.music-japan.com";
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const target = join(directory, entry);
    if (statSync(target).isDirectory()) walk(target);
    else files.push(target);
  }
}

function localTarget(href, source) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || /^(https?:|mailto:|tel:|data:)/.test(clean)) return null;
  if (clean.startsWith("/")) return join(root, clean);
  return join(dirname(source), clean);
}

function resolves(target) {
  if (existsSync(target) && statSync(target).isFile()) return true;
  return existsSync(join(target, "index.html"));
}

function resolvedFile(target) {
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  return existsSync(index) ? index : null;
}

walk(root);
const errors = [];
for (const file of files.filter((item) => extname(item) === ".html")) {
  const source = readFileSync(file, "utf8");
  const page = relative(root, file);
  const path = page === "index.html" ? "/" : `/${dirname(page)}/`;
  if (!source.includes('<meta name="viewport"')) errors.push(`${relative(root, file)}: viewport is missing`);
  if (!source.includes('<meta name="robots" content="noindex,nofollow">')) errors.push(`${page}: sample noindex is missing`);
  if (!source.includes(`<link rel="canonical" href="${origin}${path}">`)) errors.push(`${page}: canonical is missing or incorrect`);
  for (const marker of [
    'property="og:title"',
    'property="og:description"',
    'property="og:url"',
    'property="og:image"',
    'name="twitter:card"',
    'name="twitter:title"',
    'name="twitter:image"',
    'type="application/rss+xml"'
  ]) {
    if (!source.includes(marker)) errors.push(`${page}: metadata ${marker} is missing`);
  }
  for (const match of source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(match[1]);
      const serialized = JSON.stringify(data);
      if (/"(?:url|image|item)":"\//.test(serialized)) errors.push(`${page}: structured data contains a relative URL`);
    } catch (error) {
      errors.push(`${page}: invalid JSON-LD (${error.message})`);
    }
  }
  const ids = [...source.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicates)) errors.push(`${relative(root, file)}: duplicate id ${id}`);
  for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = localTarget(match[1], file);
    if (target && !resolves(target)) errors.push(`${relative(root, file)}: missing ${match[1]}`);
    const fragment = match[1].includes("#") ? match[1].split("#")[1] : "";
    const targetFile = match[1].startsWith("#") ? file : target ? resolvedFile(target) : null;
    if (fragment && targetFile && extname(targetFile) === ".html") {
      const targetSource = readFileSync(targetFile, "utf8");
      if (!targetSource.includes(`id="${fragment}"`)) errors.push(`${relative(root, file)}: missing fragment ${match[1]}`);
    }
  }
}

for (const file of [
  "assets/site.js",
  "assets/shell.js",
  "assets/articles.js",
  "favicon.svg",
  "manifest.webmanifest",
  "sitemap.xml",
  "feed.xml",
  "llms.txt",
  "_headers",
  "robots.txt"
]) {
  if (!existsSync(join(root, file))) errors.push(`missing ${file}`);
}

for (const file of files.filter((item) => [".html", ".js", ".css", ".xml", ".txt", ".json", ".webmanifest"].includes(extname(item)))) {
  const source = readFileSync(file, "utf8");
  if (source.includes("music-japan.pages.dev") || source.includes("pearly-cedar-3983.chatgpt.site")) {
    errors.push(`${relative(root, file)}: old Music Japan URL remains`);
  }
}

const robots = readFileSync(join(root, "robots.txt"), "utf8");
if (!robots.includes("Disallow: /")) errors.push("robots.txt: sample blocking rule is missing");
if (!robots.includes(`${origin}/sitemap.xml`)) errors.push("robots.txt: sitemap URL is missing");

const headers = readFileSync(join(root, "_headers"), "utf8");
if (!headers.includes("X-Robots-Tag: noindex, nofollow")) errors.push("_headers: sample noindex header is missing");

for (const xmlFile of ["sitemap.xml", "feed.xml"]) {
  const source = readFileSync(join(root, xmlFile), "utf8");
  if (!source.includes(origin)) errors.push(`${xmlFile}: production origin is missing`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Checked ${files.length} files and ${files.filter((item) => extname(item) === ".html").length} pages\n`);
