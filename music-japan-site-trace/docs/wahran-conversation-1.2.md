# Wahran 1.2 — approved conversation profiles + Japanese teaching help

User approved implementation and public deployment, 2026-10-11.
Keep existing English UI, visual theme, audio, IDs, 500 words and 10,000 combinations.
Add explicit speaker/listener form selection (m/f × m/f), simple vector portraits,
Japanese meaning after English and a Japanese usage explanation below each learning item.
Filter all training pools and entry routes; shared expressions remain visible.
Noun gender and third-party gender must NOT be treated as speaker/listener gender.
Source Arabic, IPA and hosted MP3s are not automatically rewritten. Missing opposite
forms are omitted, not silently fabricated. Existing authored paired lines can substitute
in guided scenes. Active counts are separate from full-course counts.
Quiz answers/translation/usage remain hidden until submission to preserve recall practice.
Profiles persist with progress, old backups remain readable; profile changes preserve reviews.
Private recordings and personal context must not be included in publication files.

Primary language reference retrieved: Jairo Guerrero, CORVAM (Oran Arabic),
https://corvam.unizar.es/en/localities/oran/ (2026-10-11), which distinguishes 2nd-person
singular gender, not a validation of each generated exercise or Japanese explanation.
Scope: existing course explanations translated and explicit labels assigned; no native audit claimed.

Deployment: additive files under existing /wahran/, isolated branch + PR, build then live checks.
Current published source has newer bundled audio (#1031/#1032). Preserve these changes.
Container internet unavailable. Use connected GitHub CI for current-tree build/live verification.
