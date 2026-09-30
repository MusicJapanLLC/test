# NEEDLE DROP — music-japan.com full rebuild (2026-10-01)

## Rollback first

- Production before this rebuild: `7a4ad4b` (music-japan-production)
- Nothing of the previous site was deleted. `dist/` (preserved snapshot), `src/` (vinyl experience), `scripts/build-legacy.mjs` (the former `build-deploy.mjs`) are all intact
- **Switch back without a code change**: set `MJ_SITE=legacy` in the Cloudflare Pages build environment and redeploy. `npm run build:deploy` then rebuilds the previous site exactly as before (`npm run build:legacy` does the same locally)
- Or revert this PR's merge commit through a new PR to `music-japan-production`

## What it is

The official symbol is a record seen from above, so the site is built around that record.

- **Stack**: Vite 6 + TypeScript + Three.js 0.185 + GSAP 3.15 (ScrollTrigger) + Lenis + BudouX. Every page is written as static HTML at build time (`next/src/render`) — SEO, canonical/hreflang, JSON-LD and OGP are in the HTML, no client rendering needed
- **Intro (home)**: the symbol draws itself groove by groove, the red wave runs across, the symbol rushes at the viewer and an iris opens onto the 3D record as the needle drops (red flash, shock rings, bloom spike). 2.1 s first visit, 0.9 s repeat visits in the same session, skippable by click/key/scroll, CSS safety net at 5 s
- **The record (`next/src/client/world.ts`)**: one fixed WebGL layer on every page. Custom GLSL for grooves with anisotropic sheen and iridescence, a printed red label (official mark, catalogue text) drawn to a canvas texture, tonearm, drifting particles, UnrealBloom + chromatic aberration + vignette. Each section declares `data-world-zone`; the record eases into that pose
- **Scroll story (home)**: a pinned stage in three chapters — A1 CUT (the grooves are cut live, a hot line travelling inward), A2 SPIN (the nine release sleeves orbit the record), A3 RECORD (the record lies flat and the particles become a circular waveform)
- **Sound-reactive**: the release player's audio runs through one Web Audio AnalyserNode (`bus.ts`). Bass/mid/level drive the grooves' ripples, bloom, the waveform ring, the header EQ and CSS `--level` (CTA glow, SECOND TAKE bars, play button halo). Each release tints the world with its accent colour
- **Player**: Apple Music–style "Now Playing" dialog kept from the previous site's idea — blurred artwork backdrop, the disc slides out of the sleeve and spins, live spectrum, previous/next, multi-track EP support, platform link
- **Typography — two voices only**: Archivo (Latin, up to 125 % width, 900) and Zen Kaku Gothic New (Japanese, up to Black), JetBrains Mono for numbers/labels. BudouX phrase spans at build time: Japanese never breaks before 、。 and headings animate per character inside unbreakable phrases
- **Partners**: no white panels. Each partner is catalogued like a release (BP-001, BP-002) on a dark sleeve with its brand colours, a vinyl in its colours peeking out, ivory-on-dark logos (`next/public/partners/*-white.png`, derived from the Baton Partners transparent logos)
- **Brand logos**: ivory-on-dark versions of the Music Japan / SECOND TAKE / Baton logos (`next/public/brand-*-white.png`)
- Page transitions: a red iris wipe (arrival is pure CSS, so a script failure never hides a page); custom cursor with labels; magnetic buttons; scroll-velocity marquees

## Content

All copy, releases, company facts and the privacy policy (verbatim) come from the previous site: `next/src/content/*.ts`. Newly written: short section lines (e.g. 盤を選んで、針を落とす。 / 一社ずつ、盤に刻むように。), and Japanese/English translations for release descriptions that existed in only one language. URLs are unchanged; `/music/ /media/ /about/` still 301 to `/business/`.

## Performance & fallbacks

- Three.js (≈135 KB gzip) loads lazily in parallel with the intro; text never waits for it
- DPR capped (1.75 desktop / 1.5 mobile) and dropped to 1 after sustained slow frames; bloom disabled on small screens; rAF stops in hidden tabs
- No WebGL / Save-Data: static layout, no canvas; reduced motion: no intro, a single still frame, no smooth scroll
- `/assets/*` immutable caching via `_headers`

## Verify

```bash
npm ci
npm run typecheck
npm test
npm run check          # snapshot integrity (legacy input)
npm run build:deploy   # NEEDLE DROP → deploy-dist/
npm run build:legacy   # previous site → deploy-dist/
npm run preview        # http://127.0.0.1:4173
```

Checked in headless Chromium (SwiftShader) at 1440×900 and 390×844: all 14 pages JA/EN, intro frames, pinned stage, player opens and plays with the analyser driving `--level`, no page errors. Not checked: a physical iPhone and a GPU-accelerated browser's real frame rate — check the Cloudflare preview on a phone before merging.
