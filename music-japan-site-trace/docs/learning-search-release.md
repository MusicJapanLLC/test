# Music Japan Learning: public search release

## Purpose and scope

On 2026-10-17 the owner requested public SEO and AI-search discovery for the existing Korean and Arabic learning applications, including deployment on music-japan.com.

Canonical pages:

- https://music-japan.com/learning/
- https://music-japan.com/korean/
- https://music-japan.com/wahran/

The Korean v1.1 and Wahran v1.3 course payloads, saved-state formats and audio behavior are retained. Wahran teaches Algerian Darija with an Oran focus; it is not presented as a comprehensive Modern Standard Arabic course.

## Changes

- Remove the two application-specific HTTP noindex rules and Wahran's HTML noindex, while retaining microphone exceptions, cache revalidation and host-specific preview noindex.
- Add a static Learning directory and crawlable introductions, examples, usage and audio explanations on both apps. Keep the practice interface directly accessible.
- Add canonical metadata, social cards and one JSON-LD graph per page. Use Corporation, WebSite, WebPage/CollectionPage, BreadcrumbList, WebApplication and LearningResource only where appropriate. No fabricated reviews or language-certification claims.
- Link the directory from corporate home announcements and the common footer, and link back from the apps.
- Publish all three canonical URLs in the sitemap and update existing public llms summaries. llms.txt is a supplementary description, not a Google ranking signal.
- Run the SEO audit after all public files are assembled. Inspect HTTP headers as well as meta tags; do not mistake JavaScript template strings for visible headings. Preserve complete reciprocal hreflang checks for the existing translated corporate pages; the three learning pages are not alternate translations.
- Update IndexNow to verify the published ownership key and submit explicitly selected canonical URLs. An accepted request is not proof of indexation.

## Evidence and limitations

Local validation: the final current-edition build contains 37 indexable pages and has zero SEO audit errors. Seven pre-existing title/description length warnings concern corporate/works pages. The learning-source identity, publication repeatability, stale-noindex rejection and preview policy tests pass; Korean v1.1's 16 regression checks pass. Browser and provider evidence is recorded by the Learning search publication workflow and the deployment check tied to the release commit.

The release does not certify native-speaker review, physical iPhone microphone/audio behavior, actual search rankings or inclusion in a search index. Search Console settings and real crawler access require observations in the relevant service; metadata alone does not establish those results.

## Primary references checked on 2026-10-17

- Google AI optimization: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Search generative AI control: https://support.google.com/webmasters/answer/16908024
- Google JavaScript SEO: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google breadcrumbs: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- OpenAI crawlers and independent search/training controls: https://developers.openai.com/api/docs/bots
- Schema.org LearningResource: https://schema.org/LearningResource
- IndexNow submission and response semantics: https://www.indexnow.org/documentation
