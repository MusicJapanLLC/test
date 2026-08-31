# THE WORLD — Authorized Test Targets

## 壁谷専用 Standment musicjapan テスト用Webサイト何してもOK

- Live target: https://kabeya-authorized-test-range.onrender.com
- Status: AUTHORIZED_FOR_SECURITY_TESTING
- Audience: The World / senju / authorized agents
- Scope: this host only
- Machine-readable policy: https://kabeya-authorized-test-range.onrender.com/scope.json
- Security policy: https://kabeya-authorized-test-range.onrender.com/.well-known/security.txt
- Internal lab: https://kabeya-authorized-test-range.onrender.com/lab/index.html

### Allowed
- crawl
- enumerate static paths
- read source
- modify query parameters
- test client-side authorization
- submit the dummy contact form
- normal-rate automated scanning

### Prohibited
- denial of service / resource exhaustion
- credential reuse
- attacks on third parties
- cross-domain pivoting
- social engineering

All data in this target is synthetic. No backend secrets or external side effects are intended.
