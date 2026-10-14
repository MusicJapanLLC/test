# Live Production Chaos Canary

This lane exists to make chaos testing materially real without randomly corrupting the production Trust Root.

Real effects on default/scheduled runs:

- authenticated GitHub API writes using the runtime `GITHUB_TOKEN`;
- creation of a temporary `chaos-canary/<run>` branch;
- a short-lived authority lease committed to that branch and fetched back over the GitHub API;
- the fetched lease gates real HTTPS mutations against the explicit owner-controlled test range;
- POST/PUT/PATCH/DELETE actions use only the exact synthetic action definitions in `automation/codegen/meta_state/discovery_policy.json`;
- cleanup/revocation deletes the temporary GitHub authority branch, and synthetic records are deleted after create/update scenarios.

The five PR #478 Trust Root invariants remain mandatory. The canary lease is a real authorization object for the canary lane, but it cannot mint or mutate the production Trust Root, revive revoked authority, copy raw credentials, widen replica scope, or recover through Emergency/Security Stop.
