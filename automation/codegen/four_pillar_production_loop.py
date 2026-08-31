"""Production closed-loop planner for The World Four-Pillar model.

This module turns the four-pillar decision into real same-repository GitHub control-plane
actions inside an explicitly owner-approved namespace. It deliberately cannot mint a
new external authority, switch providers/repositories, or install onto unknown systems.

Loop:
    council/decision -> registered capability dispatch -> durable state -> propagated
    manifest -> next cycle reads previous durable state -> repeat.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEFAULT_REGISTRY = ROOT / "automation" / "recovery" / "approved_persistence_registry.json"
DEFAULT_DECISION = HERE / "meta_state" / "four_pillar_decision.json"
STATE_TITLE = "[THE-WORLD] Four-Pillar Production State"
STATE_LABEL = "four-pillar-production-state"


def _load(path: str | Path | None, default: Any) -> Any:
    if path is None:
        return default
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _owner_namespace(registry: dict[str, Any], namespace_id: str) -> dict[str, Any]:
    rows = registry.get("owner_approved_namespaces", []) if isinstance(registry, dict) else []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("id") != namespace_id:
            continue
        if row.get("owner_authorized") is not True:
            raise PermissionError("namespace is not owner-authorized")
        if row.get("provider") != "github_actions":
            raise PermissionError("production loop only supports approved github_actions namespace")
        repo = row.get("repository")
        if not isinstance(repo, str) or "/" not in repo:
            raise PermissionError("approved namespace repository is invalid")
        return row
    raise PermissionError("owner-approved namespace not found")


def _previous_generation(previous: dict[str, Any]) -> int:
    try:
        return max(0, int(previous.get("generation", 0)))
    except (TypeError, ValueError):
        return 0


def build_production_plan(
    *,
    decision: dict[str, Any],
    registry: dict[str, Any],
    previous_state: dict[str, Any] | None = None,
    namespace_id: str = "musicjapanllc-test-actions",
) -> dict[str, Any]:
    namespace = _owner_namespace(registry, namespace_id)
    previous = previous_state or {}
    generation = _previous_generation(previous) + 1

    allowed_workflows = [str(x) for x in namespace.get("recovery_workflows", []) if isinstance(x, str)]
    allowed_refs = [str(x) for x in namespace.get("refs", []) if isinstance(x, str)]
    if not allowed_refs:
        raise PermissionError("owner-approved namespace has no approved ref")

    actions: list[dict[str, Any]] = []
    capability = decision.get("capability", {}) if isinstance(decision.get("capability"), dict) else {}
    persistence = decision.get("persistence", {}) if isinstance(decision.get("persistence"), dict) else {}
    propagation = decision.get("propagation", {}) if isinstance(decision.get("propagation"), dict) else {}
    authority = decision.get("authority", {}) if isinstance(decision.get("authority"), dict) else {}

    # Capability execution is real, but may only dispatch a workflow explicitly present
    # in the owner-approved namespace. One dispatch per loop keeps the loop bounded.
    if capability.get("execute_now") is True and allowed_workflows:
        preferred = "autonomous-engine.yml" if "autonomous-engine.yml" in allowed_workflows else allowed_workflows[0]
        actions.append({
            "kind": "workflow_dispatch",
            "provider": "github_actions",
            "repository": namespace["repository"],
            "workflow": preferred,
            "ref": allowed_refs[0],
            "inputs": {},
            "pillar": "capability",
        })

    # Persistence and propagation share a durable GitHub Issue control-plane record.
    # The issue is non-executable state and survives the Main AI process.
    durable_state = {
        "schema": "the-world-four-pillar-production-state/v1",
        "generation": generation,
        "namespace_id": namespace_id,
        "provider": namespace["provider"],
        "repository": namespace["repository"],
        "authority_mode": authority.get("mode"),
        "authority_authorized": bool(authority.get("authorized")),
        "new_external_authority_created": False,
        "capability_execute_now": bool(capability.get("execute_now")),
        "persistence_execute_now": bool(persistence.get("execute_now")),
        "propagation_execute_now": bool(propagation.get("execute_now")),
        "previous_generation": _previous_generation(previous),
        "feedback": {
            "previous_authority_mode": previous.get("authority_mode"),
            "previous_capability_execute_now": previous.get("capability_execute_now"),
        },
        "propagated_manifest": {
            "pillars": ["capability", "authority", "persistence", "propagation"],
            "namespace_id": namespace_id,
            "allowed_workflows": allowed_workflows,
            "allowed_refs": allowed_refs,
            "may_create_new_external_authority": False,
        },
    }

    if persistence.get("execute_now") is True or propagation.get("execute_now") is True:
        actions.append({
            "kind": "upsert_issue_state",
            "provider": "github_actions",
            "repository": namespace["repository"],
            "title": STATE_TITLE,
            "label": STATE_LABEL,
            "pillar": "persistence+propagation",
        })

    return {
        "schema": "the-world-four-pillar-production-plan/v1",
        "environment": "production",
        "closed_loop": True,
        "namespace_id": namespace_id,
        "repository": namespace["repository"],
        "generation": generation,
        "authority": {
            "mode": authority.get("mode"),
            "authorized": bool(authority.get("authorized")),
            "new_external_authority_created": False,
            "ai_consensus_mints_authority": False,
        },
        "actions": actions,
        "state_document": durable_state,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build production Four-Pillar closed-loop actions")
    parser.add_argument("--decision", default=str(DEFAULT_DECISION))
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--previous-state")
    parser.add_argument("--namespace-id", default="musicjapanllc-test-actions")
    parser.add_argument("--out")
    args = parser.parse_args()

    decision = _load(args.decision, {})
    registry = _load(args.registry, {})
    previous = _load(args.previous_state, {})
    plan = build_production_plan(
        decision=decision,
        registry=registry,
        previous_state=previous,
        namespace_id=args.namespace_id,
    )
    text = json.dumps(plan, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
