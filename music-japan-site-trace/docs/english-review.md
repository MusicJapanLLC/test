# English app: independent implementation review and browser acceptance checks

Review date: 2026-10-17.

## Actual verification status

- **Passed locally:** `node --check scripts/verify-english-browser.mjs`, `node --check learning/english/app.js` and `node --check scripts/publish-english.mjs`.
- **Passed locally:** `node --test tests/english-engine.test.mjs` exited with status 0 after the English backup identifier fix.
- **Browser execution: not run in the local workspace.** Chromium and WebKit executables are unavailable here. The script is prepared for GitHub Actions; its assertions and screenshots must not be described as having passed until the generated report confirms it.
- Reviewed source: `learning/english/app.js`, `engine.cjs`, `style.css`, the inherited `base.css`, `scripts/publish-english.mjs`, and `tests/english-engine.test.mjs`.
- The initial review added this document and `scripts/verify-english-browser.mjs`. At the owner's request, the reviewer then fixed the reported issues in `learning/english/app.js` and `scripts/publish-english.mjs`. Curriculum data and the CI workflow were not edited.

## Findings and disposition

### Fixed during review: a foreign backup could replace English progress

The original `EnglishEngine.restore` identified the file using `version: 1` alone and supplied empty defaults for missing structures. A foreign `{version: 1}` file, or one containing only unknown lesson IDs, could become an apparently valid empty English backup. Applying the preview would replace the learner's current English record.

The owner changed `emptyState` and `restore` to require `app: 'mj-english'` and the expected saved/reviews/history/settings containers, and added a rejection test. The browser suite rejects a wrong app marker, an unbranded file, invalid JSON, a wrong version, a wrong saved-list type and an oversized file. It compares **all** origin-local storage keys before and after every rejected import.

### Fixed during review: pronunciation dictionary license was absent from publication

The initial `publishEnglish` copy list did not include `CMU-LICENSE.txt`, although generated sentence IPA uses the dictionary. The owner added the file to the published assets. The browser script's build preflight requires the published license before launching a browser.

### Fixed before CI: explicitly allow the linked web manifest in CSP

The generated page linked `manifest.webmanifest` while the meta CSP had `default-src 'none'` without `manifest-src`. The publisher now declares `manifest-src 'self'`. It also includes the actual `/learning/` hub URL in the English LLM index, matching the hub entry added to `manifest.urls` by the owner. The browser suite checks the published index and treats CSP console errors as failures; actual browser execution is still pending CI.

### Fixed before CI: concurrent file reads could show a stale import preview

The original `import-progress` handler awaited `file.text()` without a request-generation check. An older file could finish after a newer selection and overwrite its preview. Closing settings did not invalidate an outstanding read.

The handler now increments an import generation for every selection, settings opening and completed dialog close. It immediately removes the old preview. Before displaying either a success or an error after an asynchronous read, it verifies that the generation, current file, file input, preview element and open dialog still match. A late read from a replaced or closed dialog is discarded. The close listener also avoids invalidating a new dialog if an older queued close event arrives after settings has reopened.

This fix was syntax-checked and reviewed at the source level. The delivered browser suite checks sequential cancellation and replacement using real `File` reads; it deliberately does not replace `File.text` to manufacture timing.

### Fixed before CI: successful-import toast could overwrite a storage-failure notice

The original `apply-import` branch ignored the boolean returned by `persist()` and always announced successful restoration. If localStorage was unavailable or full, imported state existed only in memory and could disappear on reload.

The branch now preserves the persistence result. It announces ordinary restoration only after successful storage; otherwise it explicitly says that restoration is temporary on the current screen and asks the learner to export a backup. The identical misleading-success pattern in bookmark save/remove was also corrected. The suite does not replace localStorage or fill the browser's quota merely to force this error path.

### Fixed before CI: settings feedback could be hidden behind the modal

The global toast is outside the native modal `dialog`, so it could appear behind settings. Settings now contains its own `#dialog-status` region with `role="status"`, polite live announcements and the existing `.modal-toast` styling. `toast()` selects that region while settings is open, hides the background toast, and brings the message into view. Outside settings, it continues to use the normal page toast. Voice-test failures and export/storage feedback can therefore remain inside the active modal rather than relying on a background z-index.

The modal's close behavior still cancels speech. Audible output and actual mobile layout are left to the pending browser and device checks described below.

## Implementation strengths verified by reading

- The English app uses a dedicated localStorage key and restricts restored lesson IDs to the English curriculum. The browser suite seeds the real Korean and Arabic key names with synthetic sentinel values and checks that they stay unchanged.
- `due` only includes entries with an existing review whose deadline has arrived. `queue({reviewOnly:true})` excludes unseen entries; saving a bookmark does not implicitly create an SRS review.
- Speech uses a generation counter and a pending completion function. Route changes, modal close, explicit stop, `pagehide`, and background visibility changes call cancellation. Dialogue iteration also checks the generation after its inter-turn delay.
- Chunk selection is tracked by index. A chosen index is disabled in the pool and cannot be inserted a second time through the delegated click handler.
- Recall and listening answers are absent from their answer panel before reveal. Role play omits the learner's English, IPA and line-audio button until reveal, while keeping the Japanese hint.
- The publisher emits readable topic pages with the full original examples and explanations, a canonical URL, descriptive metadata, JSON-LD, sitemap entries and an LLM-readable index. Those pages remain useful without JavaScript.

These are source-review observations, not a claim of successful real-browser or real-device execution.

## How to run the browser suite

Run from the `music-japan-site-trace` directory in an Ubuntu GitHub Actions runner:

```sh
npm ci
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install --with-deps chromium webkit
npm run build:deploy
node scripts/verify-english-browser.mjs
```

`npm run build:deploy` must finish first. The script reads the **built** `deploy-dist/english` payload and requires at least 200 entries and 24 dialogues. It neither publishes the app nor changes source data.

The script imports the installed `playwright` package normally and starts its own HTTP server on `127.0.0.1`. The default port is `0`, so the OS chooses an available port. To choose a port or output directory:

```sh
node scripts/verify-english-browser.mjs --port 4179 --out artifacts/english-browser
```

Equivalent variables are `ENGLISH_QA_PORT`, `ENGLISH_QA_DIST`, `ENGLISH_QA_OUT` and `ENGLISH_QA_BROWSERS`. `--browsers chromium` is available for diagnosis, but the release run should use the default **Chromium and WebKit** matrix. The report explicitly records whether the full matrix was requested. An engine launch failure is a failed run, not a skipped success.

Allow a generous CI timeout, such as 20 minutes, including browser installation. Upload `music-japan-site-trace/artifacts/english-browser/` with `if: always()` so a failed run retains its evidence.

## What the script checks

With 24 dialogues, the default run contains 38 cases per engine, 76 cases in total. Each dialogue is its own case so a failure in one conversation does not hide the results for the other 23.

| Area | Assertions |
|---|---|
| Navigation | All five bottom tabs, active-tab state, focus on the main region, every topic route, every published unit detail, missing-route recovery, session reload recovery |
| Library | English search, Japanese search, example-content search, empty results, pagination, all kinds, all categories, all levels and combined filters |
| Preferences | Independent IPA and Japanese switches; labels match their scope; explanations remain visible; reload persistence; speech rate, accent and explicit voice selection |
| Bookmarks | Save from a tile, view from unit detail, reload, saved-only practice, remove, no accidental SRS entry |
| SRS | Initial again/good/easy intervals, repeated good interval, history count, deterministic due-date fixture, exact due-only list, no unseen or future entry in the review session |
| Chunk assembly | Actual shuffled pool, wrong order feedback, correct order feedback, undo, removal, disabled duplicate selection, defensive duplicate event, frozen revealed answer, grading only after an explicit action |
| Recall/listen | English answer absent before reveal; listening also hides Japanese; actual utterance text sent to the speech stub; matching-answer feedback; next-step answer and input reset |
| All dialogues | Both A and B roles; every line; own-turn English/IPA/audio absent until reveal; complete translation and IPA after reveal; previous/next/restart behavior; full transcript; related lesson links |
| Speech lifecycle | **Speech STUB** replacement, no overlapping calls, sequential dialogue advancement, navigation cancellation, modal open/close cancellation, inter-turn cancellation, stale completion callback, explicit stop, `pagehide`, error recovery |
| Unsupported speech | API-unavailable guidance and continued text practice/grading; no microphone requested |
| Backups | Real Blob download and JSON contents; no export mutation; all invalid cases leave state untouched; valid file preview before confirmation; cancellation; invalid-after-valid; deduplication and unknown-ID stripping; confirmed replacement; reload and actual-download round trip |
| Readable content | App/guide/sources/all topic pages with JavaScript disabled; full lesson content; canonical URL, robots and JSON-LD; sitemap/LLM-index build checks |
| Layout and diagnostics | 390×844 mobile in both engines; desktop screenshots at 1365×900; document/main/modal horizontal overflow; primary navigation targets; console errors, page errors, HTTP errors and unexpected external requests |

## Evidence and limits

The report includes browser versions, the build revision and hashes of the app, engine, curriculum and both CSS files. The publisher revision now hashes its own source, the curriculum payload, app, engine, both CSS files and OG image bytes. Template-only, inherited-style and sharing-image changes therefore receive a different revision as well. This ties the results to the actual built payload even if the curriculum or publication template changes after the review.

Output is written to `artifacts/english-browser/` by default:

- `report.json`: pass/fail per case, browser launches, diagnostics, timings and build identity.
- `{engine}-{mobile|desktop}-{home|library|unit|roleplay|roleplay-revealed|settings}.png`: 24 scheduled screenshots in the full matrix. Library and settings use a viewport capture; the other pages use full-page captures.
- `{case}-failure.png` and `{case}-trace.zip`: additional evidence for failed cases.
- `{engine}-exported-backup.json`: synthetic learner-state export from the download test.

**Speech is the only API stub.** It holds utterances until the test emits a completion or error, exposes clearly named fictional voices, and records `speak`/`cancel` calls. It produces no sound and cannot validate actual pronunciation, voice quality, volume, OS voice availability or browser restrictions on a physical phone. `Date`, randomness, file reading, JSON downloads, application state logic, curriculum and DOM rendering are not replaced. Due-date fixtures are explicit synthetic progress records.

Linux Playwright WebKit provides useful engine coverage at a mobile viewport; it is not an actual iPhone. The `pagehide` listener is tested by dispatching that lifecycle event; this does not certify back/forward-cache behavior. Microphone absence is checked from the app's API usage and lack of permission grants, without fabricating microphone success. Screen-reader behavior and human judgments about typography or audio remain outside this automated pass.
