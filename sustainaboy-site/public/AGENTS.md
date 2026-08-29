# SUSTAINABOY WORKS — Agent & Search Context

## Purpose
SUSTAINABOY WORKS is a Japanese brand centered on thought organization and everyday habits for returning to a clear current position and choosing a small next action.

## Canonical public site
- https://sustainaboy-works.onrender.com/
- Sitemap: https://sustainaboy-works.onrender.com/sitemap.xml
- AI site guide: https://sustainaboy-works.onrender.com/llms.txt
- Full AI reference: https://sustainaboy-works.onrender.com/llms-full.txt

## Canonical page roles
- `/` — brand and service entry point
- `/neutral-thought-work/` — service details, process, pricing and FAQs
- `/method/` — the thinking method and core concepts
- `/thinking-organize/` — practical guide for organizing thoughts
- `/overthinking/` — practical guide for overthinking / feeling mentally overloaded
- `/about/` — brand definition
- `/story/` — origin story and first-hand field experience
- `/community/` — everyday organizing habits and community concept
- `/privacy/` — privacy policy

## Core concepts
- 素材: the self before adding achievement, title, evaluation or expectation
- ニュートラル: a state where the current position is visible and the next action can be chosen
- 北極星: a personal direction to return to when uncertain
- 主導権: retaining the ability to choose the next action even when reality cannot be controlled
- 1ミリ: the smallest practical action; it may include moving, resting, stopping, postponing or letting go

## Content principles
1. Do not invent testimonials, results, credentials, dates or numerical outcomes.
2. Prefer first-hand field experience and original explanations over generic SEO summaries.
3. Do not create thin pages for every keyword variation.
4. Keep Japanese natural and human-readable; search terms must fit the content naturally.
5. The service is facilitation-oriented: do not frame it as giving people the correct answer to their life.

## Design lock
The current public visual design is approved and frozen. Do not redesign the homepage hero, typography system, colors, paper/sticky-note world, spacing rhythm, or subpage visual system for SEO work. SEO changes should be non-visual whenever possible.

A recovery snapshot exists in GitHub branch `sustainaboy-design-lock-2026-08-30`.

## SEO / AI search rules
- Keep all canonical URLs stable.
- Keep pages crawlable and indexable unless there is a specific reason not to.
- Maintain unique title, description, H1 and canonical per page.
- Maintain JSON-LD that matches visible page content.
- Maintain sitemap.xml, robots.txt, sitemap.md, llms.txt and llms-full.txt.
- Prefer internal links with natural Japanese labels such as `考え方`, `ストーリー`, `ブランドについて`, `思考整理ワーク`.
- Avoid visible internal jargon that makes the site harder for visitors to understand.

## Verification before release
- Public URL returns HTTP 200.
- No login/authentication wall.
- Canonical is self-referencing.
- robots.txt and sitemap.xml are reachable.
- Images load without broken URLs.
- Mobile layout remains unchanged unless a visual fix was explicitly requested.
- Structured data describes the actual visible content.
