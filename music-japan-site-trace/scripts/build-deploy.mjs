// Cloudflare Pages entry point (`npm run build:deploy` → deploy-dist/).
// Default: the NEEDLE DROP site built from next/ (Vite + TypeScript + Three.js + GSAP).
// Rollback without a code change: set MJ_SITE=legacy in the Pages build environment and
// redeploy — the previous preserved-snapshot site is rebuilt by build-legacy.mjs, untouched.
if (process.env.MJ_SITE === "legacy") {
  await import("./build-legacy.mjs");
} else {
  await import("./build-next.mjs");
}

// Keep the mobile learning app available with either official-site edition.
const { publishWahran } = await import("./publish-wahran.mjs");
publishWahran();

// Keep Korean available in both production site editions.
const { publishKorean } = await import("./publish-korean.mjs");
publishKorean();
