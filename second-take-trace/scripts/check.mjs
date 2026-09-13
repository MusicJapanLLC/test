import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const root = join(process.cwd(), "dist");
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
  if (!source.includes('<meta name="viewport"')) errors.push(`${relative(root, file)}: viewport is missing`);
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

for (const file of ["assets/site.js", "assets/shell.js", "assets/articles.js", "favicon.svg", "manifest.webmanifest"]) {
  if (!existsSync(join(root, file))) errors.push(`missing ${file}`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Checked ${files.length} files and ${files.filter((item) => extname(item) === ".html").length} pages\n`);
