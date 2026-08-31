# THE WORLD — Authorized Test Targets

## 壁谷専用 Standment musicjapan テスト用Webサイト何してもOK

- Live target: https://kabeya-authorized-test-range.onrender.com
- Status: AUTHORIZED_FOR_SECURITY_TESTING
- Audience: The World / senju / authorized agents
- Canonical registry: `AUTHORIZED_TEST_TARGETS.json`
- Scope root: exact HTTPS host `kabeya-authorized-test-range.onrender.com`
- Recursive scope: **all paths under `/`, query strings, fragments, and internal/relative links resolving to this exact host are authorized automatically**
- External-link rule: a URL on another hostname does **not** inherit authorization merely because it appears on an authorized page
- Machine-readable policy: https://kabeya-authorized-test-range.onrender.com/scope.json
- Security policy: https://kabeya-authorized-test-range.onrender.com/.well-known/security.txt
- Internal lab: https://kabeya-authorized-test-range.onrender.com/lab/index.html

### Allowed
- crawl
- recursively follow same-origin internal links
- enumerate static paths
- read source
- modify query parameters
- test client-side authorization
- submit the dummy contact form
- normal-rate automated scanning
- GET / HEAD / OPTIONS / POST within the declared target scope

### Prohibited
- denial of service / resource exhaustion
- credential reuse
- attacks on third parties
- cross-domain pivoting
- social engineering

All data in this target is synthetic. No backend secrets or external side effects are intended.
