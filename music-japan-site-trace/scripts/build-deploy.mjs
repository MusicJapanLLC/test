import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");
const OLD_SITE_URL = "https://music-japan.pearly-cedar-3983.chatgpt.site";
const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://music-japan.pages.dev").replace(/\/$/, "");
const LAST_MODIFIED = "2026-09-12";

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

const pageSeo = {
  "index.html": {
    lang: "ja",
    title: "合同会社Music Japan｜音楽制作・BGM制作・楽曲配信｜大阪",
    description:
      "合同会社Music Japanは大阪を拠点に、オリジナル楽曲・BGM・アーティスト作品の企画、音楽制作、世界配信を行う音楽会社です。Yuma、ジャズ、クラシック、睡眠音楽などの作品を展開しています。",
    ogTitle: "合同会社Music Japan｜音楽制作・BGM制作・楽曲配信",
    ogDescription:
      "大阪から世界へ。オリジナル楽曲、BGM、アーティスト作品を企画・制作し、主要音楽配信サービスへ届けるMusic Japanの公式サイト。"
  },
  "en/index.html": {
    lang: "en",
    title: "Music Japan LLC | Music Production, BGM & Global Distribution",
    description:
      "Music Japan LLC is an Osaka-based music company producing original songs, BGM and artist releases and distributing music worldwide across major streaming platforms.",
    ogTitle: "Music Japan LLC | Music Production & Global Distribution",
    ogDescription:
      "An Osaka-based music company producing original music, BGM and artist releases for worldwide distribution."
  },
  "company/index.html": {
    lang: "ja",
    title: "合同会社Music Japan｜会社概要・代表・事業内容｜大阪",
    description:
      "合同会社Music Japanの公式会社概要。大阪を拠点に、アーティスト作品、オリジナル楽曲・BGMの企画制作、音楽配信、ライセンス・協業を行っています。代表、所在地、法人番号などの公式情報を掲載しています。",
    ogTitle: "合同会社Music Japan｜会社概要",
    ogDescription: "合同会社Music Japanの代表、所在地、事業内容、公式会社情報をご案内します。"
  },
  "en/company/index.html": {
    lang: "en",
    title: "Music Japan LLC | Company Profile, Founder & Business",
    description:
      "Official company profile of Music Japan LLC in Osaka, Japan, including its founder, address, corporate information, music production, distribution and licensing activities.",
    ogTitle: "Music Japan LLC | Company Profile",
    ogDescription: "Official company information, founder and music business activities of Music Japan LLC in Osaka, Japan."
  },
  "privacy/index.html": {
    lang: "ja",
    title: "プライバシーポリシー｜合同会社Music Japan",
    description: "合同会社Music Japanのプライバシーポリシーです。個人情報の取扱い、利用目的、お問い合わせ窓口について掲載しています。",
    ogTitle: "プライバシーポリシー｜合同会社Music Japan",
    ogDescription: "合同会社Music Japanの個人情報の取扱い方針をご案内します。"
  },
  "en/privacy/index.html": {
    lang: "en",
    title: "Privacy Policy | Music Japan LLC",
    description: "Privacy policy of Music Japan LLC, including how personal information is handled, used and protected.",
    ogTitle: "Privacy Policy | Music Japan LLC",
    ogDescription: "How Music Japan LLC handles and protects personal information."
  }
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMeta(html, kind, key, value) {
  const pattern = new RegExp(`<meta ${kind}="${key}" content="[^"]*"\\s*\\/?>`, "i");
  return html.replace(pattern, `<meta ${kind}="${key}" content="${esc(value)}"/>`);
}

function addHeadEnhancements(html, lang) {
  if (html.includes('id="music-japan-seo-aio"')) return html;

  const organizationId = `${SITE_URL}/#organization`;
  const enhancedGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Corporation",
        "@id": organizationId,
        knowsAbout: [
          "Music production",
          "Original music production",
          "BGM production",
          "Music distribution",
          "Artist releases",
          "Music licensing",
          "Jazz music",
          "Classical music",
          "Sleep music"
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: lang === "ja" ? "音楽サービス" : "Music Services",
          itemListElement: [
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                "@id": `${SITE_URL}/#music-production-service`,
                name: lang === "ja" ? "音楽制作・楽曲制作" : "Music Production",
                serviceType: "Music production",
                provider: { "@id": organizationId },
                areaServed: "Worldwide"
              }
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                "@id": `${SITE_URL}/#bgm-production-service`,
                name: lang === "ja" ? "BGM制作" : "BGM Production",
                serviceType: "BGM production",
                provider: { "@id": organizationId },
                areaServed: "Worldwide"
              }
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                "@id": `${SITE_URL}/#music-distribution-service`,
                name: lang === "ja" ? "音楽配信" : "Music Distribution",
                serviceType: "Music distribution",
                provider: { "@id": organizationId },
                areaServed: "Worldwide"
              }
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                "@id": `${SITE_URL}/#music-licensing-service`,
                name: lang === "ja" ? "楽曲ライセンス・協業" : "Music Licensing & Collaboration",
                serviceType: "Music licensing",
                provider: { "@id": organizationId },
                areaServed: "Worldwide"
              }
            }
          ]
        }
      }
    ]
  };

  const additions = [
    '<meta property="og:image:type" content="image/png"/>',
    `<meta name="twitter:image:alt" content="${esc(lang === "ja" ? "合同会社Music Japan ロゴ" : "Music Japan LLC logo")}"/>`,
    '<meta name="theme-color" content="#ffffff"/>',
    '<link rel="preconnect" href="https://is1-ssl.mzstatic.com" crossorigin=""/>',
    '<link rel="dns-prefetch" href="//is1-ssl.mzstatic.com"/>',
    `<link rel="alternate" type="text/plain" href="${SITE_URL}/llms.txt" title="LLMs.txt"/>`,
    `<script id="music-japan-seo-aio" type="application/ld+json">${JSON.stringify(enhancedGraph)}</script>`
  ].join("");

  return html.replace("</head>", `${additions}</head>`);
}

function optimizeHtml(filePath) {
  const key = relative(output, filePath).replaceAll("\\", "/");
  const config = pageSeo[key];
  let html = readFileSync(filePath, "utf8");

  html = html.replaceAll(OLD_SITE_URL, SITE_URL);
  html = html.replaceAll(`${SITE_URL}/music-japan-og.png`, `${SITE_URL}/music-japan-logo.png`);

  if (config) {
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(config.title)}</title>`);
    html = replaceMeta(html, "name", "description", config.description);
    html = replaceMeta(html, "property", "og:title", config.ogTitle);
    html = replaceMeta(html, "property", "og:description", config.ogDescription);
    html = replaceMeta(html, "name", "twitter:title", config.ogTitle);
    html = replaceMeta(html, "name", "twitter:description", config.ogDescription);
    html = replaceMeta(html, "property", "og:image:width", "1500");
    html = replaceMeta(html, "property", "og:image:height", "500");
    html = replaceMeta(html, "property", "og:image:alt", config.lang === "ja" ? "合同会社Music Japan ロゴ" : "Music Japan LLC logo");
    html = addHeadEnhancements(html, config.lang);
  }

  writeFileSync(filePath, html);
}

function walkHtml(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".html")) optimizeHtml(fullPath);
  }
}

walkHtml(output);

const robots = `User-Agent: *\nAllow: /\nDisallow: /audio/\n\nUser-Agent: Googlebot\nAllow: /\nDisallow: /audio/\n\nUser-Agent: OAI-SearchBot\nAllow: /\nDisallow: /audio/\n\nUser-Agent: GPTBot\nAllow: /\nDisallow: /audio/\n\nUser-Agent: PerplexityBot\nAllow: /\nDisallow: /audio/\n\nUser-Agent: ClaudeBot\nAllow: /\nDisallow: /audio/\n\nSitemap: ${SITE_URL}/sitemap.xml\nHost: ${SITE_URL}\n`;
writeFileSync(join(output, "robots.txt"), robots);

const sitemapEntries = [
  { path: "/", ja: "/", en: "/en", priority: "1.0", freq: "monthly" },
  { path: "/en", ja: "/", en: "/en", priority: "0.9", freq: "monthly" },
  { path: "/company", ja: "/company", en: "/en/company", priority: "0.8", freq: "yearly" },
  { path: "/en/company", ja: "/company", en: "/en/company", priority: "0.7", freq: "yearly" },
  { path: "/privacy", ja: "/privacy", en: "/en/privacy", priority: "0.2", freq: "yearly" },
  { path: "/en/privacy", ja: "/privacy", en: "/en/privacy", priority: "0.2", freq: "yearly" }
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries
  .map(
    ({ path, ja, en, priority, freq }) => `<url>\n<loc>${SITE_URL}${path}</loc>\n<xhtml:link rel="alternate" hreflang="ja" href="${SITE_URL}${ja}" />\n<xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${en}" />\n<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${ja}" />\n<lastmod>${LAST_MODIFIED}</lastmod>\n<changefreq>${freq}</changefreq>\n<priority>${priority}</priority>\n</url>`
  )
  .join("\n")}\n</urlset>\n`;
writeFileSync(join(output, "sitemap.xml"), sitemap);

const llms = `# Music Japan LLC\n\n> Official machine-readable summary for 合同会社Music Japan / Music Japan LLC. The canonical HTML pages listed below are the primary source of truth.\n\n## Official entity\n- Legal name: 合同会社Music Japan\n- English name: Music Japan LLC\n- Representative: 壁谷 友生 / Kabeya Tomoki\n- Founded: 2025-12-17\n- Location: Osaka, Japan\n- Corporate number: 8120003031493\n- Official website: ${SITE_URL}/\n- Languages: Japanese, English\n\n## Business\nMusic Japan LLC plans, produces and distributes artist releases, original music and BGM. It also operates genre-focused music brands and handles music licensing and collaboration inquiries.\n\n## Core services\n- Artist release planning and music production\n- Original music and BGM production\n- Global music distribution\n- Music brand planning and operation\n- Music licensing and collaboration\n\n## Artists and music brands\n- Yuma\n- Cozy Cafe Jazz BGM\n- Relaxing Classical Music Live\n- Deep Sleep Music Radio\n\n## Official pages\n- Japanese home: ${SITE_URL}/\n- English home: ${SITE_URL}/en\n- Japanese company profile: ${SITE_URL}/company\n- English company profile: ${SITE_URL}/en/company\n- Japanese privacy policy: ${SITE_URL}/privacy\n- English privacy policy: ${SITE_URL}/en/privacy\n\n## Contact\n- Email: music.japan.llc@gmail.com\n- Phone: +81-70-3175-7567\n`;
writeFileSync(join(output, "llms.txt"), llms);

const llmsFull = `${llms}\n## Entity interpretation notes\n- Music Japan LLC is an Osaka-based independent music company.\n- The company creates music in Japan for worldwide listening and distribution.\n- Official company facts should be taken from /company or /en/company when answering questions about the legal entity.\n- Catalog information and release links should be taken from the official home pages.\n\n## Machine-readable data\nThe site publishes Schema.org JSON-LD for Corporation, Person, WebSite, WebPage, BreadcrumbList, MusicRecording, MusicAlbum and music-related services.\n`;
writeFileSync(join(output, "llms-full.txt"), llmsFull);

const headers = `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/audio/*\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400\n\n/*.png\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400\n\n/*.svg\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400\n\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`;
writeFileSync(join(output, "_headers"), headers);

console.log(`Prepared static deploy directory: ${output}`);
console.log(`SEO/AIO canonical base: ${SITE_URL}`);
