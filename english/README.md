# MJ ENGLISH — Real English, on record

A phone-first (PC works too) vocabulary app by Music Japan LLC, in the music-japan.com look: near-black, cream and one red, the MJ record mark, Archivo extended, Zen Kaku Gothic New and mono labels. Every phrase and word has a recorded voice.

## How it works

- **Today**: one button starts today's session: everything due for review plus the next new cards from the record you are on.
- **Records**: each themed set is a "record" (66 so far: Real Talk, Level Up, Build It, Words, Level Up Words, Songs/Film/Books, Comedy/Science). A record page shows progress, the track list (tap a track to open it, tap the speaker to hear it), a red-sheet toggle that hides meanings, filters (New / Learning / Known), a **Test** (10 quick questions) and a **Listening drill**.
- **Session**: one card at a time. The voice plays as the card appears (normal or slow). **Show meaning**, then **Again** or **Got it** (buttons, keys 1/2, or swipe left/right). Missed cards come back later in the same session. A 5-question check and a result screen with the crew close the session. The ⋯ menu switches the card front to 日本語 (recall: see the meaning, say it in English, then check), meaning always-on, voice and speed.
- **Build It (瞬間英作文)**: a Japanese sentence on top, English word tiles below. Tap the tiles in order (tap a placed word to take it back), then **Check**. Trap tiles are grammar look-alikes (if/when, rains/rain, I'll/I'd, a/the, told/said…) plus a stray word from the same record. Each grammar record opens with **The point**: the rules and the trap for Japanese speakers. Getting it wrong shows the answer, the voice and a one-line note.
- **Listening drill**: plays a record like a playlist. *Listen* = short pauses, *Shadow* = a pause as long as the line so you can say it back. *Hide text* makes it an ear test.
- **Shuffle**: the reel feed (swipe through everything, quizzes mixed in).
- **You**: learned / known counts, streak, level, the week, settings, backup code.

| Source | Host robot | What's on the card |
|---|---|---|
| Real Talk | rotates | cafe, bar, pickup, crush, DMs, gym, work, money, travel… |
| Songs | POD | song title + artist, and the phrase taught with our own examples (no lyrics) |
| Movies & TV | TUNE | one famous line (title + year) or a reference only |
| Classic Books | SPIN | an exact public-domain quote, verified against Project Gutenberg |
| Science | REEL | a finding with its citation (paper link) |
| Comedy | MIC | jokes, hacky jokes ("Cringe") and how humor works in English |
| Words | rotates | single words, phrasal verbs, slang and idioms, with 2–3 examples and a usage note each |
| Level Up | rotates | harder chunks: softening, opinions, storytelling, negotiation, banter, feelings, meetings, dating, studio |
| Build It | rotates | 16 grammar records × 30 sentences (present, past, perfect, future, requests, advice, questions, comparisons, if, relative clauses, -ing/to, passive, reported speech, articles, prepositions, wish/rather) |

The robot crew (TUNE / SPIN / POD / REEL / MIC) is drawn with the same pixel engine as music-japan.com. They never talk: no speech bubbles and none of their original lines, only faces, moves and tiny screen icons.

Spaced repetition: Got it moves a card up a box (12 h → 2 d → 5 d → 12 d → 30 d → 75 d), Again sends it back to the start. Known = three reviews in a row. Progress stays in the browser (localStorage); a backup code moves it between devices. No accounts, no tracking. PWA: installable, and voice chunks you have played work offline.

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
npm run validate       # content checks (fails on errors, prints warnings)
npm run verify-quotes  # book quotes vs Project Gutenberg texts in .cache/pg/
npm run build          # data → typecheck → vite build → static card pages + sitemap
python scripts/audio.py [record …]   # record voices (see "Voice" below)
npm run preview        # http://localhost:4190
```

`npm run build` writes `dist/`: the app, `data/*.json`, one static Japanese-first page per phrase/word at `/c/<id>/` and per record at `/r/<id>/` (meaning, examples, notes, audio, JSON-LD: DefinedTerm, FAQPage, BreadcrumbList, LearningResource), `/records/`, `/about/`, a crawlable landing inside `index.html`, `sitemap.xml`, `robots.txt` (search and AI crawlers allowed) and `llms.txt` / `llms-full.txt` (a plain-text catalogue for AI assistants). Set `MJ_EN_URL` to the public origin (default `https://english.music-japan.com`). Pages are `noindex` unless `VERCEL_ENV=production`, and `*.vercel.app` is always `noindex` (see `vercel.json`).

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
//! Level Up Verbs | Verbs that make you sound precise | levelup     ← optional header: a new record
word | pos | 日本語 | short English | example 1 || example 2 || example 3 | scene[, explicit] | 日本語の使い方メモ
```

`pos` is one of `n v adj adv phr int prep conj pron det abbr`. The same spelling can appear twice only for a different part of speech or a clearly different sense.

### Grammar drills (瞬間英作文) — `content/drills/*.txt`

```
//! If... | Real and unreal conditionals, if I were you | build
! 起こりうる話＝ If ＋現在形, will 〜。      ← "The point" box on the record page
If it rains tomorrow, I'll skip the gym. | 明日雨だったらジム休むわ。 | 未来の話でも if の中は現在形
```

English must end with . ! or ?, the Japanese must be present, and the English line may not contain Japanese.

### Voice

Every card is recorded ahead of time with **Kokoro-82M** (Apache-2.0), run locally with `kokoro-onnx`; nothing is sent to an online voice service. `scripts/audio.py` renders, per card: the phrase, the phrase slow (speed 0.78), up to four example/dialogue lines (A = female voice `af_heart`, B = male voice `am_michael`) and, for textbook/cringe cards, the natural version. Grammar drills get the sentence (normal and slow). Clips are packed into ~45 s MP3 chunks per record with 0.25 s gaps (`public/audio/<record>.<n>.<hash>.mp3`) plus an index (`public/audio/<record>.json`). The app fetches and decodes one chunk at a time and plays clips exactly. Clips are cached in `.cache/tts/` by text + voice + speed, so after editing content only new or changed lines are recorded. `SAY` in the script fixes words the phonemizer gets wrong (rizz, lowkey, smh…). If a clip is missing, the device's own voice reads it instead.

```bash
pip install kokoro-onnx soundfile
KOKORO_MODEL=kokoro-v1.0.onnx KOKORO_VOICES=voices.npz python scripts/audio.py --workers 2
```

`voices.npz` holds `af_heart`, `am_michael`, `af_bella` and `am_puck` as `(510, 1, 256)` float32 arrays (the voice files from the Kokoro release).

### Pronunciation

American IPA is generated from the CMU Pronouncing Dictionary (downloaded once to `.cache/cmudict.dict`). Slang and new words CMU doesn't know are in `IPA_EXTRA` in `build-data.mjs`; abbreviations said letter by letter (DM, EOD, brb) are spelled out automatically. Texting-only abbreviations (btw, smh, ikr…) have no IPA on purpose.

## Quoting rules

- **Books:** only works in the public domain in both the US and Japan (published 1930 or earlier, author/translator died 1950 or earlier). Every quote must match the Project Gutenberg text word for word (`npm run verify-quotes`).
- **Movies & TV:** one short line per card, quoted for commentary with the title and year. No stills or clips.
- **Songs:** never reproduce lyrics. Name the song and artist, and teach the phrase with original examples.
- **Science:** cite the paper.
- **Everything else:** all example sentences are original. No real people's private names or personal information.

## Assets

`public/icon.svg`, `public/icons/*.png` and `public/og.png` use the official Music Japan record mark (and, on the share image, the crew), rendered with headless Chromium.
