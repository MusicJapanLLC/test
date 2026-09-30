// Renders the 1200×630 share cards (next/public/og/{ja|en}-{page}.png) from the built pages.
// Run after a build, whenever a page title changes:  npm run build:deploy && npm run og
// Needs Playwright + Chromium on the machine (not a site dependency). Then bump OG_VERSION
// in next/src/render/layout.ts so SNS caches pick up the new cards.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const built = join(root, "deploy-dist");
const out = join(root, "next/public/og");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const PAGES = ["home", "business", "company", "profile", "partners", "contact", "privacy"];
const WORD = { home: "MUSIC JAPAN", business: "BUSINESS", company: "COMPANY", profile: "PROFILE", partners: "PARTNERS", contact: "CONTACT", privacy: "PRIVACY" };
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function card(locale, key, html) {
  const title = decode(html.match(/<meta property="og:title" content="([^"]*)"/)[1]);
  const [lead, ...rest] = title.split(/\s*[|｜]\s*/);
  const mark = html.match(/<svg class="mj-mark"[\s\S]*?<\/svg>/)[0].replace('class="mj-mark"', 'class="mk"');
  const no = String(PAGES.indexOf(key)).padStart(2, "0");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=JetBrains+Mono:wght@400;500&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=block">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:630px;background:#060607;color:#efe9e0;overflow:hidden}
body{position:relative;font-family:"Zen Kaku Gothic New",sans-serif}
.glow{position:absolute;inset:0;background:radial-gradient(60% 80% at 82% 50%,rgba(225,34,47,.22),transparent 60%),radial-gradient(40% 50% at 10% 110%,rgba(225,34,47,.12),transparent 70%)}
.grooves{position:absolute;width:760px;height:760px;right:-250px;top:-65px;border-radius:50%;background:repeating-radial-gradient(circle,#101014 0 3px,#0a0a0d 3px 6px);box-shadow:0 0 120px rgba(0,0,0,.8) inset}
.mk{position:absolute;width:560px;height:560px;right:-150px;top:35px;color:#efe9e0;--red:#e1222f}
.grain{position:absolute;inset:0;background:linear-gradient(90deg,#060607 0,#060607 38%,rgba(6,6,7,.75) 58%,transparent 80%)}
.top{position:absolute;left:72px;top:64px;right:72px;display:flex;justify-content:space-between;font:500 17px "JetBrains Mono",monospace;letter-spacing:.18em;color:rgba(239,233,224,.7)}
.top b{color:#e1222f;font-weight:500}
.word{position:absolute;left:66px;top:150px;font:900 ${WORD[key].length > 9 ? 104 : 128}px/0.9 "Archivo",sans-serif;font-stretch:125%;letter-spacing:-.02em;text-transform:uppercase}
.word i{font-style:normal;color:#e1222f}
.lead{position:absolute;left:72px;top:${WORD[key].length > 9 ? 290 : 312}px;max-width:640px;font-weight:700;font-size:${lead.length > 26 ? 34 : 42}px;line-height:1.35;letter-spacing:.01em}
.sub{position:absolute;left:72px;bottom:68px;max-width:620px;font:500 20px/1.5 "Zen Kaku Gothic New",sans-serif;color:rgba(239,233,224,.62)}
.url{position:absolute;right:72px;bottom:64px;font:500 17px "JetBrains Mono",monospace;letter-spacing:.14em;color:rgba(239,233,224,.8)}
.bar{position:absolute;left:72px;top:118px;width:56px;height:3px;background:#e1222f}
</style></head><body>
<div class="glow"></div><div class="grooves"></div>${mark}<div class="grain"></div>
<div class="top"><span><b>MJ-${no}</b>&nbsp;&nbsp;${locale === "ja" ? "合同会社MUSIC JAPAN" : "MUSIC JAPAN LLC"}</span><span>OSAKA — JAPAN</span></div>
<div class="bar"></div>
<div class="word">${esc(WORD[key])}<i>.</i></div>
<p class="lead">${esc(lead)}</p>
<p class="sub">${esc(rest.join(" / ") || (locale === "ja" ? "音楽制作・Podcast・インタビュー" : "Music, podcasts & interviews"))}</p>
<div class="url">MUSIC-JAPAN.COM</div>
</body></html>`;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
if (process.env.MJ_OG_ROUTE) await (await import(process.env.MJ_OG_ROUTE)).routeFonts(ctx);
const page = await ctx.newPage();
for (const locale of ["ja", "en"]) {
  for (const key of PAGES) {
    const rel = `${locale === "en" ? "en/" : ""}${key === "home" ? "" : `${key}/`}index.html`;
    await page.setContent(card(locale, key, readFileSync(join(built, rel), "utf8")), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, `${locale}-${key}.png`) });
    console.log(`og/${locale}-${key}.png`);
  }
}
await browser.close();
