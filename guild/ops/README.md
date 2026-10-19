# Public game route analytics

These are the Cloudflare Worker sources published on 2026-10-20 in the existing Music Japan account. They preserve each upstream release, redirect, asset response and credential stripping, and add GA4 plus a privacy link only to successful GET HTML responses.

- `world-proxy.mjs`: `music-japan-world-proxy`, active version `d6e0c2e4`, route `game.music-japan.com/world*`.
- `fire-proxy.mjs`: `music-japan-fire-proxy`, active version `9f129ae6`, route `game.music-japan.com/fire*`.
- `/lantern-journey` is an alias redirected by `guild/vercel.json` to `/fire/`, so its relative game assets and analytics use the same release.

The Workers are maintained separately from the Vercel deployment. Commit these files when changing their live code; pushing the repository does not deploy the Workers. The shared `/analytics.js` is served by the guild Vercel project and guarded to the production game hostname. Local/offline/preview copies do not send analytics.

Verify the HTML-only transform, unchanged JS assets, upstream credential stripping, and path redirects with `node guild/ops/check-proxies.mjs`.
