# Refined edition — 2026-09-30

## Baseline and rollback

- Production before this edition: `c78771c` (music-japan-production, "feat: publish Music Japan partner directory")
- Working branch: `claude/confident-darwin-jwk54j`
- Three ways back, fastest first:
  1. **Switch off without a code change**: set the Cloudflare Pages build variable `MJ_REFINE=off` and redeploy. The pages drop the fonts, the refine stylesheet and the artwork fallback; HTML/CSS output is byte-identical to the baseline build apart from asset version hashes (verified by diffing both `deploy-dist/` trees)
  2. Revert this edition's merge commit through a new PR to `music-japan-production`
  3. Redeploy the baseline commit above
- Do not reset or force-push production

## What changes

- **Brand mark**: the red placeholder glyph (`.frequency-mark`, two arcs + dot + dash) that the first edition generated is replaced everywhere by the official record-groove symbol, redrawn as `src/brand/music-japan-mark.svg` for dark backgrounds — header, loader curtain, footer, contact panel and artwork fallback. On the hero record the glyph becomes a spindle hole
- **Typography** (Google Fonts, `display=swap`)
  - Japanese headings: Shippori Mincho B1 with proportional kana (`palt`)
  - Japanese body and UI: Zen Kaku Gothic New
  - Latin display: Archivo (expanded width on desktop hero, footer and card titles)
  - Labels, dates, indices: IBM Plex Mono instead of tracked-out bold caps
  - Japanese navigation no longer letter-spaced; English text keeps zero tracking
- **Japanese line breaking**: headings were animated by splitting every character into its own inline-block, which broke kinsoku (lines starting with 「、」「を」) and ignored authored `\n` breaks. `src/typeset.js` groups characters into phrases (Intl.Segmenter + particle/punctuation rules) so lines only break between phrases; motion keeps its per-character wave inside each phrase. Static headings get the same treatment, plus `word-break: auto-phrase` for no-JS
- **Contact page**: no repeated kicker or lead in the red panel, shorter hero, TimeRex card title/note stacked (the old rule targeted the screen-reader span), plain 必須/任意 labels
- **Release artwork**: if Apple's CDN image fails, the identical backup from the snapshot is served from `/artwork/` before React falls back to a placeholder (the snapshot's `media/` path collides with the retired `/media/` page, which the build deletes)
- The Apple Music–style release player, audio previews, record hero, WebGL/GSAP/Lenis motion, copy, URLs and SEO metadata are unchanged

## Implementation notes

- `src/music-japan-refine.css` is the whole visual layer. Rules use a `:root` prefix for specificity only; the layer is switched by whether the stylesheet is linked. The `data-mj-refine` attribute on `<html>` is informational: React removes it on the English homepage while recovering from the pre-existing hydration warning (#418), which is why nothing depends on it
- `scripts/build-deploy.mjs`: `MJ_REFINE`, `renderRefineHead()`, artwork map, and validations (layer present when on / absent when off, backup files present, fallback script parses)
- `tests/typeset.test.mjs` covers phrase grouping

## Verification

- `npm test` (9 passing), `npm run check`, `npm run build:deploy`, `MJ_REFINE=off npm run build:deploy`
- Headless Chromium at 1440×900 and 390×844: Japanese/English home, business, company, profile, partners, contact; release player dialog opens with a working play control; no new page errors (the English React #418 warning exists on the baseline too)
- Not verified here: physical iPhone rendering and live Cloudflare preview — check the branch preview before merging
