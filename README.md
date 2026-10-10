# RESEARCH 1500 — bounded live API capture benchmark

This isolated test branch is NOT intended to merge into a production branch.
It contains only a generic public-data benchmark and one scoped workflow.
No business data, uploaded private development kit, credentials, or production application files are included.

Run: `python3 benchmarks/capture.py adaptive output/adaptive`

The three arms use the same source corpus, licensing filter, maximum 160 requests and 420 seconds per arm. Single-shot intentionally uses only one search request. Fixed paging keeps its query unchanged. Adaptive recomputes a 24-query portfolio at every exact 250 accepted abstracts, preserving receipts before the next wave.

This independent live-capture harness is NOT the Node/SQLite reference pipeline and does NOT certify its live end-to-end operation. Content is licensed abstracts, not full paper reading. Dataset independence, semantic counterevidence, human relevance precision, and causal two-hop explanations remain unverified. A 1,500 screened count must not be called 1,500 independently human-verified sources.

No Supabase function, denied database operation, or production deployment is performed by this workflow.
