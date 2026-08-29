# Portfolio Delivery Contract

## Purpose
`#portfolio` is the owner-visible stream of things THE WORLD actually made. It is intentionally separate from R&D discussion, TOMOKI supervision and CEO exception reporting.

## Allowed posts
A post must represent a human-inspectable artifact such as:
- deployed website or web app;
- dashboard;
- interactive demo;
- report/PDF;
- Slack Canvas or equivalent readable artifact;
- screenshot/video of a working system with evidence link;
- packaged customer deliverable.

## Not allowed as the artifact
- source-code file by itself;
- raw diff;
- commit hash by itself;
- issue/PR by itself;
- internal log dump;
- idea, plan or architecture with no inspectable output.

Code, PRs and commits may be attached only as **evidence** behind a viewable artifact.

## Required fields
Every portfolio event must include:
- `title`
- `artifact_type`
- `artifact_url`
- `status` (`EXPERIMENT`, `BUILDING`, `VERIFIED`)
- `what_it_is`
- `why_it_matters`
- `proof`
- `source_system`
- `owner`

## Routing
- R&D research discussion -> `#R&D`
- worker supervision / verification / recovery -> `#tomoki`
- unresolved owner decision -> `#ai-ceo-brief`
- inspectable artifact -> `#portfolio`

One artifact may have evidence in multiple internal systems, but its portfolio entry should be a single concise owner-facing post.

## Status rule
`VERIFIED` means the artifact is accessible and its claimed core behavior has evidence. A code-complete but inaccessible result remains `BUILDING`.
