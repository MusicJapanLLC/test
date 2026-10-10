import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { faqOf, gameBySlug, games } from './src/data/games';
import { site } from './src/data/site';
import { gameBody, gameJsonLd } from './src/render/game';
import { footerHtml, headerHtml, headHtml, type NavKey, type PageMeta } from './src/render/layout';
import { libraryBody } from './src/render/library';
import { newsBody } from './src/render/news';
import { notFoundBody } from './src/render/notfound';
import { faqJsonLd } from './src/render/parts';
import { requestBody } from './src/render/request';
import { topBody } from './src/render/top';
import { abs, esc, heroBgShot, themeVars, type RenderCtx } from './src/render/util';

const root = process.cwd();

/** ストアページの雛形。games.ts の slug ごとに games/<slug>/index.html を書き出す */
const GAME_SHELL = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!--MJ:HEAD-->
  </head>
  <body>
    <!--MJ:BODY-->
    <script type="module" src="/src/entries/game.ts"></script>
  </body>
</html>
`;

function writeGameShells(): void {
  const dir = resolve(root, 'games');
  const slugs = new Set(games.map((g) => g.slug));
  /* games.ts から消えた作品の雛形は片付ける（自動生成したものだけ） */
  for (const name of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
    if (!name.isDirectory() || slugs.has(name.name)) continue;
    const file = resolve(dir, name.name, 'index.html');
    if (existsSync(file) && readFileSync(file, 'utf8') === GAME_SHELL) rmSync(resolve(dir, name.name), { recursive: true });
  }
  for (const g of games) {
    const file = resolve(dir, g.slug, 'index.html');
    if (existsSync(file) && readFileSync(file, 'utf8') === GAME_SHELL) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, GAME_SHELL);
  }
}

/** いちばん新しい更新日（sitemap の lastmod） */
const latestDate = (dates: string[]) => dates.filter(Boolean).sort().at(-1) ?? '2026-10-09';
const gameUpdated = (g: (typeof games)[number]) =>
  latestDate([...g.news.map((n) => n.date), ...g.versions.map((v) => v.date)]);
const storeUpdated = () => latestDate([...site.news.map((n) => n.date), ...games.map(gameUpdated)]);

interface Page {
  meta: PageMeta;
  nav: NavKey;
  body: string;
  bodyAttrs: string;
}

function itemList(ctx: RenderCtx): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    '@id': `${ctx.siteUrl}/#games`,
    name: 'MJ STOREの作品',
    numberOfItems: games.length,
    itemListElement: games.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(ctx, `games/${g.slug}/`),
      name: g.title,
    })),
  };
}

function pageFor(rel: string, ctx: RenderCtx): Page | null {
  const desc = site.description;

  if (rel === 'index.html') {
    return {
      meta: {
        title: `${site.name}｜Music Japanのゲームストア ─ ブラウザで遊べる基本無料のゲーム`,
        description: desc,
        path: '/',
        themeColor: '#0C0C0E',
        image: 'og/store.jpg',
        imageAlt: 'MJ STORE ── Music Japanのゲームストア',
        preloadImage: games[0] ? heroBgShot(games[0])?.src : undefined,
        jsonLd: [itemList(ctx), faqJsonLd([...site.faq], `${ctx.siteUrl}/`)],
      },
      nav: 'store',
      body: topBody(ctx),
      bodyAttrs: 'class="page page-top"',
    };
  }

  if (rel === 'games/index.html') {
    return {
      meta: {
        title: `作品一覧｜${games.map((g) => g.title).join('・')} - ${site.name}`,
        description: `MJ STOREの全作品。${games.map((g) => `${g.title}（${g.genre}）`).join('、')}。全作品ブラウザで遊べて、基本プレイ無料。`,
        path: '/games/',
        themeColor: '#0C0C0E',
        image: 'og/store.jpg',
        imageAlt: 'MJ STOREの作品一覧',
        jsonLd: [
          { ...itemList(ctx), '@id': `${abs(ctx, 'games/')}#list` },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: site.name, item: `${ctx.siteUrl}/` },
              { '@type': 'ListItem', position: 2, name: '作品一覧', item: abs(ctx, 'games/') },
            ],
          },
        ],
      },
      nav: 'library',
      body: libraryBody(ctx),
      bodyAttrs: 'class="page page-library"',
    };
  }

  if (rel === 'request/index.html') {
    return {
      meta: {
        title: `ご要望・バグ報告 - ${site.name}`,
        description:
          'バグの報告も、「こうしたらいいやん」も、「ここが好き」も。MJ STOREの作品への声は、ここから開発チームに直接届きます。',
        path: '/request/',
        themeColor: '#0C0C0E',
        image: 'og/store.jpg',
        imageAlt: 'MJ STORE ご要望・バグ報告',
        jsonLd: [
          {
            '@type': 'ContactPage',
            '@id': `${abs(ctx, 'request/')}#page`,
            name: 'ご要望・バグ報告',
            url: abs(ctx, 'request/'),
            about: { '@id': `${ctx.siteUrl}/#website` },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: site.name, item: `${ctx.siteUrl}/` },
              { '@type': 'ListItem', position: 2, name: 'ご要望・バグ報告', item: abs(ctx, 'request/') },
            ],
          },
        ],
      },
      nav: 'request',
      body: requestBody(ctx),
      bodyAttrs: 'class="page page-request"',
    };
  }

  if (rel === 'news/index.html') {
    const url = abs(ctx, 'news/');
    return {
      meta: {
        title: `お知らせ・アップデート情報｜${games.map((g) => g.title).join('・')} - ${site.name}`,
        description: `MJ STOREと全作品（${games.map((g) => g.title).join('、')}）のお知らせと、バージョン履歴（アップデート内容）をまとめて読めるページです。`,
        path: '/news/',
        themeColor: '#0C0C0E',
        image: 'og/store.jpg',
        imageAlt: 'MJ STORE お知らせ・更新',
        jsonLd: [
          {
            '@type': 'CollectionPage',
            '@id': `${url}#page`,
            name: 'お知らせ・更新',
            url,
            dateModified: storeUpdated(),
            about: { '@id': `${ctx.siteUrl}/#website` },
            hasPart: games.map((g) => ({ '@id': `${abs(ctx, `games/${g.slug}/`)}#game` })),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: site.name, item: `${ctx.siteUrl}/` },
              { '@type': 'ListItem', position: 2, name: 'お知らせ・更新', item: url },
            ],
          },
        ],
      },
      nav: 'news',
      body: newsBody(ctx),
      bodyAttrs: 'class="page page-news"',
    };
  }

  if (rel === '404.html') {
    return {
      meta: {
        title: `ページが見つかりません - ${site.name}`,
        description: desc,
        path: '/404.html',
        themeColor: '#0C0C0E',
        image: 'og/store.jpg',
        imageAlt: 'MJ STORE',
        noindex: true,
      },
      nav: null,
      body: notFoundBody(ctx),
      bodyAttrs: 'class="page page-404"',
    };
  }

  const m = rel.match(/^games\/([^/]+)\/index\.html$/);
  const g = m ? gameBySlug(m[1]) : undefined;
  if (g) {
    return {
      meta: {
        title: `${g.title}｜${g.catch.join('')} - 基本プレイ無料のブラウザゲーム｜${site.name}`,
        description: `${g.lead} 基本プレイ無料（ゲーム内課金あり）。インストール不要、ブラウザですぐ遊べます。`,
        path: `/games/${g.slug}/`,
        themeColor: g.theme.bg,
        image: `og/${g.slug}.jpg`,
        imageAlt: `${g.title} ── ${g.catch.join('')}`,
        preloadImage: g.shots[0]?.src,
        jsonLd: gameJsonLd(ctx, g),
      },
      nav: null,
      body: gameBody(ctx, g),
      bodyAttrs: `class="page page-game scheme-${g.theme.scheme}" style="${esc(themeVars(g))}" data-skin="${g.theme.skin}"`,
    };
  }

  return null;
}

function mjPages(ctx: RenderCtx): Plugin {
  return {
    name: 'mj-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html, hctx) {
        const rel = relative(root, hctx.filename).replace(/\\/g, '/');
        const page = pageFor(rel, ctx);
        if (!page) return html;
        return html
          .replace('<!--MJ:HEAD-->', headHtml(ctx, page.meta))
          .replace('<body>', `<body ${page.bodyAttrs}>`)
          .replace('<!--MJ:BODY-->', `${headerHtml(ctx, page.nav)}\n${page.body}\n${footerHtml(ctx)}`);
      },
    },
  };
}

/* ─────────────────────────────────────────────
   AI 検索（LLMO）向けの llms.txt / llms-full.txt
   人が読んでも分かる Markdown。作品を足すと自動で増える
   ───────────────────────────────────────────── */

function llmsTxt(ctx: RenderCtx): string {
  return `# ${site.name}（${site.nameJa}）

> ${site.description}

${site.name}は、${site.operator.name}（${site.operator.nameEn}、大阪）が運営する公式ゲームストアです。並んでいるのは、音楽・物語・システムまですべて自社で制作したゲームだけです。全作品ブラウザで動き、インストール不要・基本プレイ無料（ゲーム内課金あり）。

## 作品

${games
  .map(
    (g) =>
      `- [${g.title}](${abs(ctx, `games/${g.slug}/`)}): ${g.genre}。${g.lead} 遊ぶ: ${g.playUrl}（${g.platforms.join('・')}）`,
  )
  .join('\n')}

## ページ

- [ストア](${ctx.siteUrl}/): 特集・全作品・お知らせ・バージョン履歴
- [作品一覧](${abs(ctx, 'games/')}): すべての作品
- [お知らせ・更新](${abs(ctx, 'news/')}): ストアと全作品のお知らせ、全作品のバージョン履歴
- [ご要望・バグ報告](${abs(ctx, 'request/')}): バグの報告、提案、感想を開発チームへ送る窓口

## Optional

- [詳しい作品情報（全文）](${abs(ctx, 'llms-full.txt')})
- [運営会社 ${site.operator.name}](${site.operator.url})
`;
}

function llmsFullTxt(ctx: RenderCtx): string {
  const games_ = games
    .map((g) => {
      const faq = faqOf(g, abs(ctx, 'request/'));
      return `## ${g.title}（${g.subtitle}）

- ストアページ: ${abs(ctx, `games/${g.slug}/`)}
- 遊べる場所: ${g.playUrl}
- 英語表記: ${g.titleEn}
- ジャンル: ${g.genre}
- 対応: ${g.platforms.join('・')}（Webブラウザ、インストール不要）
- 言語: ${g.languages.join('・')}
- 価格: 基本プレイ無料（ゲーム内課金あり）
- 最新版: ${g.currentVersion}
- 開発・運営: ${site.operator.name}（音楽・物語・システムすべて自社制作）
- キャッチコピー: ${g.catch.join('')}

### 概要

${g.lead}

${g.description.join('\n\n')}

### 特徴

${g.features.map((f) => `- **${f.title}**: ${f.body}`).join('\n')}

### 遊び方

- 操作: ${g.controls}
- セーブ: ${g.save}
- 音楽: ${g.music}

### バージョン履歴

${g.versions.map((v) => `- ${v.version}（${v.date}）${v.title}: ${v.notes.join('／')}`).join('\n')}

### お知らせ

${g.news.map((n) => `- ${n.date} [${n.tag}] ${n.title}${n.body ? ` ── ${n.body}` : ''}`).join('\n')}

### よくある質問

${faq.map((f) => `- Q. ${f.q}\n  A. ${f.a}`).join('\n')}
`;
    })
    .join('\n');

  return `# ${site.name}（${site.nameJa}）── 全作品の詳しい情報

> ${site.description}

- 運営: ${site.operator.name}（${site.operator.nameEn}）${site.operator.url}
- ストア: ${ctx.siteUrl}/
- ゲームの配信元: ${site.gamesHost}
- 最終更新: ${storeUpdated()}

## MJ STOREについて

${site.faq.map((f) => `- Q. ${f.q}\n  A. ${f.a}`).join('\n')}

${games_}`;
}

/** sitemap.xml（画像つき）・robots.txt・llms.txt を書き出す */
function mjSeoFiles(ctx: RenderCtx): Plugin {
  return {
    name: 'mj-seo-files',
    apply: 'build',
    generateBundle() {
      const pages: { path: string; lastmod: string; images: { loc: string; title: string }[] }[] = [
        {
          path: '/',
          lastmod: storeUpdated(),
          images: games.flatMap((g) => (g.shots[0] ? [{ loc: abs(ctx, g.shots[0].src), title: g.shots[0].alt }] : [])),
        },
        { path: '/games/', lastmod: storeUpdated(), images: [] },
        { path: '/news/', lastmod: storeUpdated(), images: [] },
        { path: '/request/', lastmod: storeUpdated(), images: [] },
        ...games.map((g) => ({
          path: `/games/${g.slug}/`,
          lastmod: gameUpdated(g),
          images: g.shots.map((s) => ({ loc: abs(ctx, s.src), title: s.alt })),
        })),
      ];
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
        pages
          .map(
            (p) =>
              `  <url>\n    <loc>${abs(ctx, p.path)}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n` +
              p.images
                .map((im) => `    <image:image><image:loc>${im.loc}</image:loc><image:title>${esc(im.title)}</image:title></image:image>\n`)
                .join('') +
              '  </url>',
          )
          .join('\n') +
        '\n</urlset>\n';
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });

      /* 検索エンジンにも AI の検索・回答にも、全ページを読んでもらう */
      const bots = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'CCBot'];
      const robots = [
        '# MJ STORE — 検索エンジンと AI アシスタントに、全ページを公開しています',
        ...bots.flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${abs(ctx, 'sitemap.xml')}`,
        `# LLM 向けの概要: ${abs(ctx, 'llms.txt')}`,
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(ctx) });
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: llmsFullTxt(ctx) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const base = env.VITE_BASE || '/';
  const siteUrl = (env.VITE_SITE_URL || site.url).replace(/\/+$/, '');
  const ctx: RenderCtx = { base, siteUrl };

  writeGameShells();

  return {
    base,
    plugins: [mjPages(ctx), mjSeoFiles(ctx)],
    build: {
      target: 'es2020',
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          library: resolve(root, 'games', 'index.html'),
          news: resolve(root, 'news', 'index.html'),
          request: resolve(root, 'request', 'index.html'),
          notfound: resolve(root, '404.html'),
          ...Object.fromEntries(
            games.map((g) => [`game-${g.slug}`, resolve(root, 'games', g.slug, 'index.html')]),
          ),
        },
      },
    },
  };
});
