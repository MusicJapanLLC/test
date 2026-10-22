# Public game route analytics

These are the Cloudflare Worker sources published on 2026-10-20 in the existing Music Japan account. They preserve each upstream release, redirect, asset response and credential stripping, and add GA4 plus a privacy link only to successful GET HTML responses.

- `world-proxy.mjs`: `music-japan-world-proxy`, active version `d6e0c2e4`, route `game.music-japan.com/world*`.
- `fire-proxy.mjs`: `music-japan-fire-proxy`, route `game.music-japan.com/fire*`. 灯の旅路は 2026-10-22 から非公開。配信元の `lantern-journey.vocal-shore-1441.chatgpt.site` が停止し（ChatGPT アカウントの無効化）、画像・音声の素材も GitHub に無いため、このソースは `/fire` 以下をすべて `https://store.music-japan.com/games/` へ 302 で返す。ライブの Worker はまだ旧版（上流へ中継して 403 を返す）なので、ダッシュボードでこのソースに置き換えるか、`/fire*` のルートを外す。
- `/lantern-journey` は `guild/vercel.json` で `https://store.music-japan.com/games/` へ 302（以前は `/fire/` へ転送していた）。

The Workers are maintained separately from the Vercel deployment. Commit these files when changing their live code; pushing the repository does not deploy the Workers. The shared `/analytics.js` is served by the guild Vercel project and guarded to the production game hostname. Local/offline/preview copies do not send analytics.

Verify the HTML-only transform, unchanged JS assets, upstream credential stripping, and path redirects (and that `/fire` is closed) with `node guild/ops/check-proxies.mjs`.
