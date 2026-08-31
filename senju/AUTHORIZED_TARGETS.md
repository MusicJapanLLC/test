# Senju Authorized Targets

Canonical registry: `../AUTHORIZED_TEST_TARGETS.json`
Runtime scope: `config/authorized-test-range.json`

`https://kabeya-authorized-test-range.onrender.com` is explicitly authorized. All HTTPS paths, queries, fragments, and internal/relative links resolving to this exact host inherit authorization recursively. Links resolving to another hostname do not inherit authorization.

`https://sustainaboy-works.onrender.com` is also explicitly owner-authorized as a test site with 100% same-origin scope coverage. All HTTPS paths, queries, fragments, and internal/relative links resolving to this exact host are in the owner-authorized test scope. External-host links do not inherit authorization. The site is forwarded to the existing META/X/SENJU intake and formal approval flow with the advisory labels `senjuさんへ推薦` and `承認推奨`.
