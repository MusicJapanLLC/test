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

// Publish the public learning directory and advertise the final canonical app URLs.
const { publishLearning } = await import("./publish-learning.mjs");
publishLearning();

// Add English lessons and hub discovery before auditing the complete deploy output.
const { publishEnglish } = await import("./publish-english.mjs");
publishEnglish();

// Audit the files that will actually ship, including all learning apps and their headers.
// The legacy edition retains its existing edition-specific validation.
if (process.env.MJ_SITE !== "legacy") {
  const { audit } = await import("./seo-audit.mjs");
  const { fileURLToPath } = await import("node:url");
  const { errors, warnings, pages } = audit(fileURLToPath(new URL("../deploy-dist", import.meta.url)));
  for (const warning of warnings) console.warn(`warn  ${warning}`);
  if (errors.length) throw new Error(`Final SEO audit failed:\n${errors.join("\n")}`);
  console.log(`Final SEO audit: ${pages} indexable pages, 0 errors, ${warnings.length} warnings`);
}
