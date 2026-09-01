# Authorized Targets

Canonical registry: `../AUTHORIZED_TEST_TARGETS.json`

`https://kabeya-authorized-test-range.onrender.com` and every HTTPS URL resolving to that exact host are authorized recursively, including internal/relative links, paths, queries and fragments. External-host links do not inherit authorization.

`https://sustainaboy-works.onrender.com` and every HTTPS URL resolving to that exact host are explicitly owner-authorized for the test-site scope, with 100% same-origin scope coverage. Internal/relative links, paths, queries and fragments remain in scope; external-host links do not inherit authorization. Operational Authority still follows the repository's existing META/X/SENJU approval flow, with an explicit owner advisory of `senjuさんへ推薦` / `承認推奨`.
