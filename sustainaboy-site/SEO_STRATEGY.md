# SUSTAINABOY WORKS — SEO / Search Strategy

Last updated: 2026-08-30

## Non-negotiable design rule

The current public visual design is approved and frozen. SEO work must not redesign the homepage hero, paper/sticky-note world, typography system, colors, spacing rhythm, or premium subpage design. Recovery branch: `sustainaboy-design-lock-2026-08-30`.

## Search objectives

### Brand/entity queries

| Query / intent | Canonical owner | Goal |
|---|---|---|
| SUSTAINABOY WORKS | `/` | #1 brand result |
| サスティナボーイワークス | `/` + `/about/` | #1 brand result |
| SBW + context | `/` | brand association |
| 壁谷望 | `/story/` | official person/entity result |
| 壁谷 望 | `/story/` | official person/entity result |
| Nozomi Kabeya | `/story/` | entity association |
| サスティナブル ワーク | `/about/` | capture mistaken brand lookup without claiming this generic term as the official name |
| サスティナブルワーク | `/about/` | same as above |

Important: `サスティナブルワーク` is also a generic term for sustainable work. Do not use it as an Organization alternateName or pretend the brand owns the generic concept. Use disambiguation copy only.

### Service/commercial queries

| Query cluster | Canonical owner |
|---|---|
| 思考整理 ワーク / 思考整理 オンライン / ニュートラル思考整理ワーク | `/neutral-thought-work/` |
| 思考整理 料金 / 思考整理 体験 / オンライン 思考整理 | `/neutral-thought-work/` |

### Informational queries

| Query cluster | Canonical owner |
|---|---|
| 頭の中を整理する / 頭の整理 方法 / 考えがまとまらない | `/thinking-organize/` |
| 考えすぎ / 頭がいっぱい / 頭がごちゃごちゃ / モヤモヤ 整理 | `/overthinking/` |
| 素材 / ニュートラル / 北極星 / 主導権 / 1ミリ as SBW concepts | `/method/` |

## Cannibalization rules

1. Do not create another page targeting the exact primary intent of an existing canonical owner.
2. Do not create one page for every keyword variation.
3. Expand existing pages with examples, first-hand evidence, FAQs and original explanations before adding new URLs.
4. Keep internal link labels natural for humans: `思考整理ワーク`, `考え方`, `ブランドについて`, `ストーリー`, `頭の整理`.
5. Do not use internal jargon in navigation if a plain Japanese label is clearer.

## Google Search requirements

- All 9 canonical HTML pages return HTTP 200.
- Self-referencing canonical on every page.
- `index,follow` robots meta on canonical pages.
- `robots.txt` permits Googlebot and Googlebot-Image.
- XML sitemap includes all canonical pages and meaningful images.
- Important pages are linked internally.
- Structured data must match visible content.
- Core Web Vitals and mobile usability must stay strong.
- Search Console URL-prefix property should be verified for `https://sustainaboy-works.onrender.com/`.
- Submit `https://sustainaboy-works.onrender.com/sitemap.xml` in Search Console.
- Use URL Inspection / Request indexing for `/`, `/story/`, `/about/`, `/neutral-thought-work/`, `/thinking-organize/`, `/overthinking/` after verification.

## AI / generative search

Google AI Overviews / AI Mode use the Google Search index; indexing and core SEO remain the prerequisite. No special Google AI schema is required.

Additional non-Google machine-readable assets maintained for broader AI agents:
- `/llms.txt`
- `/llms-full.txt`
- `/AGENTS.md`
- `/sitemap.md`
- Markdown mirrors for core content pages

AI crawler policy is in `/robots.txt`.

## Entity strategy: 壁谷望

`/story/` is the canonical official person page.

Required signals:
- static HTML title begins with `壁谷望`
- description includes `壁谷望（かべや のぞみ）`
- Person JSON-LD with `name`, `alternateName`, `jobTitle`, `worksFor`, `url`, `image`, `knowsAbout`
- ProfilePage JSON-LD with the Person as `mainEntity`
- visible profile facts include the name and relevant first-hand career facts
- portrait alt identifies the person

External authority opportunity: after confirming official social/profile URLs, add those URLs to Person `sameAs` and link those profiles back to the official Story page where possible. Never guess `sameAs` identities.

## Brand spelling strategy

Official name is `SUSTAINABOY WORKS` / `サスティナボーイワークス`.

`/about/` contains a concise spelling/disambiguation statement for visitors who searched `サスティナブル ワーク` or `サスティナブルワーク`. The Organization schema uses a `disambiguatingDescription`; the generic phrase is not an official alternateName.

## Measurement milestones

### Phase 1 — discovery/indexing
- Search Console verified
- sitemap accepted
- 9/9 canonical URLs discovered
- priority pages indexed

### Phase 2 — branded visibility
- `SUSTAINABOY WORKS`: #1
- `サスティナボーイワークス`: #1
- `壁谷望`: Story page reaches first page, then top 3 / #1

### Phase 3 — non-branded growth
Use Search Console query data to improve impressions, CTR and average position for:
- 思考整理
- 頭の整理
- 頭の中を整理する
- 考えがまとまらない
- 考えすぎ
- 頭がいっぱい
- モヤモヤ 整理

Do not optimize from invented keyword-volume numbers. Ahrefs keyword/project APIs are currently unavailable on the connected plan, so use live SERP research and Search Console first-party data until a compatible Ahrefs plan is available.

## Automated safeguards

- `.github/workflows/sbw-indexnow.yml` handles IndexNow-compatible discovery.
- `.github/workflows/sbw-seo-regression.yml` validates required SEO files, page metadata, sitemap/crawler policy, brand/person signals, and runs scheduled live endpoint checks.
