# Daily Japan News

Premium, mobile-first bilingual news publication prototype for Music Japan LLC.

## Principles

- Japanese and English are first-class editions (`/ja/` and `/en/`)
- Every article begins with five key points for fast understanding
- Static-first for speed, resilience and easy hosting migration
- Source types are visible on each article
- Search, category filtering, popular stories and reading time are built in
- `NewsArticle`, `hreflang`, canonical URLs, sitemap and robots are generated at build time

## Local preview

```bash
npm run build
npm run preview
```

Open `http://localhost:4173/ja/` or `http://localhost:4173/en/`.

## Production build

Set the public origin so canonical URLs, sitemap and structured data are correct:

```bash
SITE_URL="https://your-domain.example" npm run build
```

Publish the generated `dist/` directory to any static host such as Cloudflare Pages, GitHub Pages, Netlify or Vercel.

## Content model

Edit `content/articles.json`. Each story contains shared metadata plus `ja` and `en` editorial fields. Running the build generates one SEO-addressable page per language and article.
