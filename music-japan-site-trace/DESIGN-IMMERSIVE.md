# Immersive hero — Three.js / Lenis / GSAP

## Baseline and scope

- Production baseline: `bb60b784e40a7e92feff48ca62f93f1a0e29db3c` (PR #815)
- Branch: `chatgpt/music-japan-immersive-20260918`
- Japanese/English editorial copy, URLs and SEO stay unchanged
- Existing record artwork CSS stays unchanged; only entrance transforms animate it
- Remove visual effects toggle, replay button, old localStorage preference and 2D wave loop

## Source ownership

`dist/` is a preserved input snapshot, not the normal output of a framework build
`scripts/build-deploy.mjs` copies it to `deploy-dist/`, reconstructs assets, patches existing content/client code and generates internal pages
New code belongs in `src/`; `scripts/build-experience.mjs` builds it directly into `deploy-dist/assets/`
The previous hand-authored experience CSS/JS in `dist/assets/` have been moved/replaced, avoiding two competing sources
Dependencies are version-pinned in package.json / package-lock.json

## Components

- Three.js 0.185.1, aligned with Baton: raw GLSL waves/glow/interference and 84 mobile / 168 desktop particles, no textures
- Runtime adapted from `baton/src/lib/webgl.ts`: renderer options, ResizeObserver and damped pointer tracking
- Baton's loop skipped rendering offscreen but kept reserving rAF callbacks; this implementation cancels and restarts the loop itself
- Preserve iOS native touch inertia; Lenis smooths wheel/anchor scrolling with duration 1.1 and exponential easing
- Reuse preserved GSAP / ScrollTrigger 3.15.0 assets; no duplicate core/plugin bundle
- First intro 2.0 seconds; repeat in same tab/session 0.6 seconds; sessionStorage access failure safely uses the full variant
- Hero character entrance: 40px / 35ms / cubic-bezier(0.16,1,0.3,1); lower reveals: data-reveal groups, 18px / 650ms / 90ms stagger
- Headings remain accessible with one complete label; no-script and module-error states retain readable HTML
- Three loads separately after motion setup/idle, never gates text rendering
- Old full-screen loader is hidden to avoid a second introduction

## Quality policy

Average delivered rAF cadence is measured in uninterrupted 2-second windows
Each window below 45 fps advances one stage; healthy windows do not advance

1. First low window: halve particle draw count
2. Next low window: fix renderer pixel ratio to 1.0
3. Next low window: release renderer and lock CSS fallback for this scene

Maximum DPR is 1.25 on mobile/coarse pointer and 1.75 on desktop
Screen exit / hidden tab cancels rAF and resets the sample window, so background time never causes a false downgrade
Context loss pauses rendering. Try restoration once, allow 2 seconds, then lock CSS on failure; a second loss immediately uses CSS
Reduced-motion and Save-Data disable motion and WebGL; changing reduced-motion while open destroys the active effects
Gyroscope follows only if the browser already permits events without a permission prompt; iOS permission-gated motion stays on passive visual motion / mouse input

## Validation and release status

- Unit tests: 5 passed (60fps, ordered degradation, brief dip/suspension, reset, offscreen/hidden rAF cancellation and disposal)
- All 16 generated pages: editorial text, metadata, links identical to baseline; robots/sitemap/llms/llms-full identical
- Preview: 320/390/768px iframe layouts without horizontal or heading overflow; mobile menu works; effect buttons absent
- Japanese/English hero titles render as 16 animated characters with a complete accessible heading label
- Scroll to lower content: visible data-reveal elements reach opacity 1 and clear transforms
- Browser WebGL is disabled: static fallback verified, real GLSL rendering / GPU FPS / context restore remain unverified
- English React #418 warning also exists in baseline; content and motion enhancement recover correctly
- Unthrottled initial preview LCP sample 1152ms, warm reload sample 604ms; these are NOT CPU 4x or comparable baseline measurements and do not establish a performance pass
- Build reports additional JS bytes separately from reused assets and total loaded JS
- Additional JS gzip ceiling: 150 KiB; build fails when exceeded
- No physical iPhone testing performed; user will perform that final check
- **Required mobile emulation + CPU 4x measurement is not yet performed**: the available browser control surface does not expose device emulation or CPU throttling
- Do not describe unthrottled browser numbers or iframe layout checks as CPU 4x measurements
- LCP no-regression and real GPU frame rate are release gates, not claims inferred from code
- Keep this change in a preview PR until those required measurements pass or the user explicitly changes that acceptance criterion

## Manual Chrome DevTools measurement

1. Use the preview URL and baseline `https://927e61e3.music-japan.pages.dev/`, same Chrome/machine/network
   Alternatively build locally and `npm run preview` (http://127.0.0.1:4173); use the same hosting conditions for baseline and new edition
2. Device toolbar: 390 x 844, DPR 3; Performance CPU: **4x slowdown**, no network throttle; disable cache
3. For preview append `?mj-diagnostics=1` to show measured frame windows, quality stage, renderer ratio, loop state and LCP
4. Clear the intro sessionStorage entry for first-visit measurements; record 5 cold navigation runs per version and compare median LCP
5. Record at least 15 seconds at hero, 5 seconds below hero, 5 seconds with tab hidden, then return; verify loop state and resume
6. Repeat reload without clearing session storage for the 0.6-second variant
7. Rendering panel: emulate reduced-motion; verify immediate readable content, no WebGL/Lenis animation or effect buttons
8. Test actual WebGL loss/restoration in a GPU-capable Chrome environment, including second loss and restore timeout
9. Save Performance trace and the exact browser/machine/viewport/throttling settings with results

## Rollback

Revert this PR's eventual squash commit through a new PR to music-japan-production
Do not reset or force-push production. Baseline commit above preserves the prior version and buttons
Source migration, dependency lock and deploy changes must be reverted together
