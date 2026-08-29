# Security Policy

## Supported branch

Security fixes are applied to the repository's default branch.

## Reporting a vulnerability

Please do not publish credentials, personal data, exploit payloads, or step-by-step abuse instructions in a public issue.

If GitHub private vulnerability reporting is available for this repository, use a private Security Advisory.
Otherwise, open a minimal public issue stating that you found a security concern and request a private contact channel. Include no sensitive technical details in that issue.

## Secrets

Never commit real credentials, API keys, OAuth tokens, private keys, service-account JSON, `.env` files, or production database files.

Use GitHub Actions secrets, deployment environment secrets, or the deployment platform's secret store for non-public values.

Values prefixed with `VITE_` are compiled into browser assets and must be treated as public information.

## GitHub Actions

- Keep workflow permissions at the minimum required level.
- Do not use `pull_request_target` without a documented security review.
- Pin third-party and GitHub-authored actions to a full commit SHA.
- Do not expose secrets to workflows that execute untrusted code.
- Require security checks to pass before protected-branch merges.

## Incident response

If a credential is committed, treat it as compromised even if the commit is later deleted:

1. Revoke or rotate the credential immediately.
2. Check provider and GitHub audit logs for unexpected use.
3. Remove the secret from current files and repository history where appropriate.
4. Re-run code scanning, dependency review, and secret scanning.
5. Document the cause and add a preventive control.
