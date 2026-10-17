# Music Japan Learning — English

English counterpart to the Korean / Wahran mobile apps, authored for intermediate-to-advanced practical speech. The Korean v1.1 card/dialog/navigation styles are reused in `base.css`; English behavior, curriculum and local storage are independent.

## Scope

`learning/english/**`, `scripts/publish-english.mjs`, English tests and the final publication hook. No private chat/contact/client data is part of the curriculum. Publication target: `MusicJapanLLC/test`, branch `music-japan-production`, official path `https://music-japan.com/english/`.

## Curriculum

- `catalog.json`: version and eight practical situations
- `units.json`: original vocabulary, reusable chunks, conversational grammar, Japanese explanations, examples, IPA and exact contiguous chunks
- `dialogues.json`: original role-play conversations
- `sources.json`: inspected public reference sources and separate retrieval gaps

CEFR labels are editorial estimates. Original lesson examples are not source quotations. Sources do not constitute full curriculum endorsement, native-speaker review, or a population frequency study. Broad US-oriented IPA can differ from connected speech and other accents. Browser speech synthesis availability varies.

## Build / verify

`node scripts/publish-english.mjs` builds `/english/` and eight readable topic pages, sources, guide, sitemap and a convenience `llms.txt` index. It requires the production output skeleton in `deploy-dist/`. The official-site builder runs it after the existing Korean, Wahran and Learning publishers and before the final site SEO audit. The publisher adds an English card to an existing Learning hub, or creates the hub when absent.

`node tests/english-engine.test.mjs` checks the actual shared review/filter/restore logic. Additional acceptance and browser checks exercise authored data and UI behavior. These tests do not certify every pronunciation or an individual's CEFR level.

The English publication workflow runs the whole site suite, builds production output, audits English pages and exercises Chromium and WebKit with Playwright 1.62.1. Speech synthesis is explicitly stubbed for lifecycle checks; actual audio is not certified. On the production branch, a read-only live check waits for the matching revision, compares all app assets byte-for-byte and checks public HTML, sitemap and discovery indexes.

## State

Storage key: `mj-english-progress-v1`. Review grades are user self-assessment. Due-only queues exclude unseen items. JSON import previews the replacement and requires an explicit in-app restore action. Synthesis playback stops on navigation, closing settings, page hide and visibility loss. No microphone or external scoring service is used.

## Release / rollback

Inspect the latest production branch before applying the publication hook, so concurrent learning SEO changes are preserved. Merge/push, build, provider deployment and live checks must be observed separately. To undo this edition, remove its publisher hook and English-only files in a new commit based on current production; do not reset unrelated changes or other learning apps.
