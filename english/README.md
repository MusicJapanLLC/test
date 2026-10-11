# MJ ENGLISH — Real English, in reels

A phone-first (PC works too) vocabulary app by Music Japan LLC. You swipe through **chunks** (whole phrases people actually say) and **words**, taken from:

| Source | Host robot | What's on the card |
|---|---|---|
| Real Talk | everyone | cafe, bar, pickup, crush, DMs, gym, work, money, travel… |
| Songs | POD | song title + artist, and the phrase taught with our own examples (no lyrics) |
| Movies & TV | TUNE | one famous line (title + year) or a reference only |
| Classic Books | SPIN | an exact public-domain quote, verified against Project Gutenberg |
| Science | REEL | a finding with its citation (paper link) |
| Comedy | MIC | jokes, hacky jokes ("Cringe") and how humor works in English |
| Words | everyone | single words, phrasal verbs, slang and idioms |

No CEFR levels and no "basic/business" split. Cards carry **scene tags** (cafe, pickup, crush, work…), a **Real / Textbook / Cringe** stamp, and **vibes** (warm, chill, flirty, work-safe…).

The robot crew (TUNE / SPIN / POD / REEL / MIC) is drawn with the same pixel engine as music-japan.com. They never talk: no speech bubbles and none of their original lines, only faces, moves and tiny screen icons.

## Learning loop

- Snap-scroll feed. Tap to flip (Japanese meaning is hidden until you ask), double-tap to save.
- A quiz every 3–5 cards: meaning, gap fill, build the phrase, real-or-cringe, vibe, listening (device TTS), word.
- Combo, XP, levels, daily goal ring, streak.
- Saved and missed cards come back on a spaced-repetition schedule (0 → 12h → 2d → 5d → 12d → 30d → 75d) in the feed and in **Review**.
- Search, settings (meaning display, explicit cards, voice speed, auto voice, sounds, daily goal, theme), and export/import of progress as a code. Everything stays in the browser (localStorage); there are no accounts and no tracking.
- PWA: installable, works offline after the first visit.
- Keyboard on PC: ↑/↓ or j/k, Space flip, S save, P listen, 1–4 answer.

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
npm run validate       # content checks (fails on errors, prints warnings)
npm run verify-quotes  # book quotes vs Project Gutenberg texts in .cache/pg/
npm run build          # data → typecheck → vite build → static card pages + sitemap
npm run preview        # http://localhost:4190
```

`npm run build` writes `dist/`: the app, `data/*.json`, one static page per card at `/c/<id>/` (shareable and indexable), `sitemap.xml` and `robots.txt`. Set `MJ_EN_URL` to the public origin (default `https://english.music-japan.com`). Pages are `noindex` unless `VERCEL_ENV=production`, and `*.vercel.app` is always `noindex` (see `vercel.json`).

## Content format

Plain text in `content/`, compiled by `scripts/build-data.mjs` into `public/data/`.

### Chunk cards — `content/cards/*.txt`

```
# Can I get a latte?
@ talk | cafe | real | chill | 3
= ラテください
A: Hi, what can I get you?
B: Can I get an oat latte?
~ kin-ai-get-uh
✗ I want a latte. | textbook | 通じるけど命令っぽい
✓ Can I get a latte? | 一番自然
? Can I get ~? は「〜もらえる？」。注文の定番。
! アメリカのカフェでは名前を聞かれる。
```

| Line | Meaning |
|---|---|
| `# head` | the chunk |
| `@ source \| scenes \| real/textbook/cringe \| vibes \| freq 1–3 [\| rare, explicit]` | metadata |
| `=` / `:` | Japanese meaning / short English meaning |
| `A:`–`D:` or `-` | dialogue lines or example sentences |
| `~` | how it sounds in fast speech |
| `✗ text \| textbook/cringe \| note` / `✓ text \| note` | unnatural vs natural versions (textbook/cringe cards need at least one ✓) |
| `?` / `!` | why it works / culture note (Japanese) |
| `"` + `—` | quote + attribution (Classic Books must have both; ≤ 40 words) |
| `>` | reference (Movies & TV need a quote or a reference; Songs need a reference) |
| `^ citation \| url` | paper citation for Science |
| `ipa /…/` | IPA override |

### Words — `content/words/*.txt`

```
word | pos | 日本語 | short English | example sentence | scene[, explicit]
```

`pos` is one of `n v adj adv phr int prep conj pron det abbr`. The same spelling can appear twice only for a different part of speech or a clearly different sense.

### Pronunciation

American IPA is generated from the CMU Pronouncing Dictionary (downloaded once to `.cache/cmudict.dict`). Slang and new words CMU doesn't know are in `IPA_EXTRA` in `build-data.mjs`; abbreviations said letter by letter (DM, EOD, brb) are spelled out automatically. Texting-only abbreviations (btw, smh, ikr…) have no IPA on purpose.

## Quoting rules

- **Books:** only works in the public domain in both the US and Japan (published 1930 or earlier, author/translator died 1950 or earlier). Every quote must match the Project Gutenberg text word for word (`npm run verify-quotes`).
- **Movies & TV:** one short line per card, quoted for commentary with the title and year. No stills or clips.
- **Songs:** never reproduce lyrics. Name the song and artist, and teach the phrase with original examples.
- **Science:** cite the paper.
- **Everything else:** all example sentences are original. No real people's private names or personal information.

## Assets

`public/icons/*.png` and `public/og.png` are rendered from the robot crew drawing code with headless Chromium. `public/icon.svg` is the favicon.
