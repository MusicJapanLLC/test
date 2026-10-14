// Pulls the Baton Partners list (partners.music-japan.com/partners.json) into the official site
// before every build, so the partner section on music-japan.com follows the partner site.
//
//   next/src/content/partners.json … the committed copy the pages are built from
//   next/public/partners/<slug>/…   … the logos, mirrored at the same paths as on the partner site
//
// If the feed cannot be fetched or does not pass the checks below, the committed copy is kept and the
// build continues (the site never goes down because the partner site is). MJ_PARTNERS_STRICT=1 makes
// that a build failure instead; MJ_PARTNERS_SYNC=off skips the fetch entirely.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const FEED_URL = process.env.MJ_PARTNERS_FEED || "https://partners.music-japan.com/partners.json";
const ORIGIN = "https://partners.music-japan.com";
const SNAPSHOT = join(root, "next/src/content/partners.json");
const PUBLIC = join(root, "next/public");
const MAX_LOGO_BYTES = 2_000_000;

const fail = (msg) => {
  throw new Error(msg);
};
const str = (v, where) => (typeof v === "string" && v.trim() ? v : fail(`${where}: expected text`));
const l10n = (v, where) => ({ ja: str(v?.ja, `${where}.ja`), en: str(v?.en, `${where}.en`) });

/** Everything in the feed ends up in HTML attributes or styles, so only accept the shapes we expect. */
export function validate(feed) {
  if (feed?.version !== 1) fail("unsupported feed version");
  if (feed.preview) fail("feed comes from a preview build");
  if (!Array.isArray(feed.partners) || feed.partners.length === 0) fail("no partners");
  const ids = new Set();
  const entry = (p, where) => {
    const id = str(p?.id, `${where}.id`);
    if (!/^[a-z0-9-]{1,40}$/.test(id)) fail(`${where}.id: ${id}`);
    if (ids.has(id)) fail(`${where}.id: duplicate ${id}`);
    ids.add(id);
    if (!/^BP-\d{3}$/.test(p.no)) fail(`${where}.no: ${p.no}`);
    if (!str(p.href, `${where}.href`).startsWith(`${ORIGIN}/`)) fail(`${where}.href: ${p.href}`);
    for (const k of ["name", "base", "category", "title", "body"]) l10n(p[k], `${where}.${k}`);
    if (p.service !== null && typeof p.service !== "string") fail(`${where}.service`);
    if (!Array.isArray(p.colors) || p.colors.length < 2 || !p.colors.every((c) => /^#[0-9a-fA-F]{3,8}$/.test(c))) fail(`${where}.colors`);
    if (!Array.isArray(p.logos) || p.logos.length === 0) fail(`${where}.logos`);
    for (const l of p.logos) {
      const url = new URL(str(l?.src, `${where}.logos.src`));
      if (url.origin !== ORIGIN || !/^\/partners\/[a-z0-9-]+\/[a-z0-9._-]+\.(png|webp|jpg|svg)$/.test(url.pathname)) fail(`${where}.logos.src: ${l.src}`);
      if (!(Number.isInteger(l.width) && Number.isInteger(l.height) && l.width > 0 && l.height > 0)) fail(`${where}.logos.size`);
      str(l.alt, `${where}.logos.alt`);
    }
  };
  entry(feed.operator, "operator");
  feed.partners.forEach((p, i) => entry(p, `partners[${i}]`));
  return feed;
}

async function get(url, timeoutMs = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "music-japan.com build (sync-partners)" } });
  if (!res.ok) fail(`${url}: HTTP ${res.status}`);
  return res;
}

export async function syncPartners() {
  if (process.env.MJ_PARTNERS_SYNC === "off") return console.log("partners: sync skipped (MJ_PARTNERS_SYNC=off)");
  try {
    const feed = validate(await (await get(FEED_URL)).json());
    // download every logo first; only write anything once the whole set is in hand
    const logos = [];
    for (const p of [feed.operator, ...feed.partners]) {
      for (const l of p.logos) {
        const path = new URL(l.src).pathname;
        const res = await get(l.src);
        if (!/^image\//.test(res.headers.get("content-type") ?? "")) fail(`${l.src}: not an image`);
        const body = Buffer.from(await res.arrayBuffer());
        if (!body.length || body.length > MAX_LOGO_BYTES) fail(`${l.src}: ${body.length} bytes`);
        logos.push({ file: join(PUBLIC, path), body });
      }
    }
    for (const { file, body } of logos) {
      mkdirSync(dirname(file), { recursive: true });
      if (!existsSync(file) || !readFileSync(file).equals(body)) writeFileSync(file, body);
    }
    const next = `${JSON.stringify(feed, null, 2)}\n`;
    const changed = !existsSync(SNAPSHOT) || readFileSync(SNAPSHOT, "utf8") !== next;
    if (changed) writeFileSync(SNAPSHOT, next);
    console.log(`partners: ${feed.partners.length} companies from ${FEED_URL}${changed ? " (updated)" : " (no change)"}`);
  } catch (error) {
    if (process.env.MJ_PARTNERS_STRICT === "1") throw error;
    const kept = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    console.warn(`partners: could not sync (${error.message}); building from the committed copy (${kept.partners.length} companies, ${kept.updated})`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await syncPartners();
