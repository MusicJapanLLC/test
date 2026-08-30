#!/usr/bin/env python3
"""Fail-closed workflow policy entrypoint v2.

Extends the existing semantic policy with an explicit capability contract for
THE WORLD Portfolio Forge when that lane exists. If the lane has been
quarantined/removed, policy remains valid instead of requiring its return.
"""
from __future__ import annotations

import re

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_entrypoint as base


def validate_portfolio_forge_oidc_lane() -> str | None:
    name = "the-world-portfolio-forge.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        return None

    got = policy.writes(body)
    if got != {"actions", "id-token"}:
        raise SystemExit(f"{name}: portfolio repair write set drifted: {sorted(got)}")

    required = (
        "contents: read",
        "actions: write",
        "id-token: write",
        "workflow_dispatch:",
        "schedule:",
        "cron: '11,26,41,56 * * * *'",
        "persist-credentials: false",
        "gh workflow run portfolio-evolution-daily.yml",
        "gh workflow run ai-dev-minute-foundry.yml",
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
        "audience=ai-foundry-executor",
        "https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/ai-foundry-executor-gateway",
        "'action':'enqueue_repair'",
        "'target_id':'musicjapan-ai-portfolio'",
        "direct_repair=bool(repair_due and direct_check)",
        "PORTFOLIO_SLACK_WEBHOOK_URL",
        "TOMOKI_SLACK_WEBHOOK_URL",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{name}: missing bounded portfolio invariant: {marker}")

    forbidden = (
        "contents: write",
        "issues: write",
        "pull-requests: write",
        "deployments: write",
        "packages: write",
        "pages: write",
        "copilot-requests: write",
        "pull_request:",
        "pull_request_target:",
        "repository_dispatch:",
        "workflow_run:",
        "runs-on: self-hosted",
        "permissions: write-all",
        "git push ",
        "gh pr create",
        "git push --force",
        "git push -f",
    )
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{name}: forbidden portfolio repair capability: {marker}")

    secret_refs = set(re.findall(r"secrets\.([A-Z0-9_]+)", body))
    allowed_secrets = {"PORTFOLIO_SLACK_WEBHOOK_URL", "TOMOKI_SLACK_WEBHOOK_URL"}
    if secret_refs - allowed_secrets:
        raise SystemExit(
            f"{name}: unauthorized long-lived secret(s): {sorted(secret_refs - allowed_secrets)}"
        )

    if body.count("ai-foundry-executor-gateway") != 1:
        raise SystemExit(f"{name}: repair gateway must remain exactly one fixed endpoint")
    if body.count("'target_id':'musicjapan-ai-portfolio'") != 1:
        raise SystemExit(f"{name}: direct repair target must remain exactly one owned target")

    return name


def main() -> int:
    manager = base.validate_manager_queue_oidc_lane()
    foundry = base.validate_ai_foundry_forge_lane()
    madlab = base.validate_madlab_evolution_lane()
    watchdog = base.validate_evolution_watchdog_lane()
    portfolio = validate_portfolio_forge_oidc_lane()
    base.validate_agent_factory_semantic_contract()

    for name in (manager, foundry, madlab, watchdog, portfolio):
        if name:
            policy.WORKFLOWS.pop(name, None)

    return policy.main()


if __name__ == "__main__":
    raise SystemExit(main())
