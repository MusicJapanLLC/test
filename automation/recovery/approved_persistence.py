"""Owner-approved self-recovery planner for META/X.

This module deliberately does not install cron jobs, startup tasks, agents, webhooks,
or workers onto unknown systems. It only evaluates recovery recipes that were already
registered as owner-authorized in this repository and emits same-repository GitHub
Actions dispatch instructions.

Goal:
    Main AI stops -> independent scheduled worker remains -> main workflow is recreated.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = ROOT / "automation" / "recovery" / "approved_persistence_registry.json"
WORKFLOW_RE = re.compile(r"^[A-Za-z0-9_.-]+\.ya?ml$")


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _parse_timestamp(value: object) -> dt.datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip().replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def _heartbeat_age_seconds(path: Path, field: str, *, now: dt.datetime) -> float:
    doc = _load_json(path)
    if not isinstance(doc, dict):
        return float("inf")
    timestamp = _parse_timestamp(doc.get(field))
    if timestamp is None:
        return float("inf")
    return max(0.0, (now - timestamp).total_seconds())


def _validate_worker(worker: dict[str, Any], allowed_providers: set[str]) -> tuple[bool, str]:
    if worker.get("owner_authorized") is not True:
        return False, "owner_authorization_missing"
    provider = str(worker.get("provider", ""))
    if provider not in allowed_providers:
        return False, "provider_not_allowed"
    recovery = worker.get("recovery")
    if not isinstance(recovery, dict) or recovery.get("kind") != "workflow_dispatch":
        return False, "unsupported_recovery_kind"
    workflow = recovery.get("workflow")
    if not isinstance(workflow, str) or not WORKFLOW_RE.fullmatch(workflow):
        return False, "invalid_workflow_name"
    ref = recovery.get("ref")
    if not isinstance(ref, str) or not ref.strip() or any(c in ref for c in "\r\n"):
        return False, "invalid_ref"
    heartbeat_file = worker.get("heartbeat_file")
    if not isinstance(heartbeat_file, str) or not heartbeat_file.strip():
        return False, "heartbeat_file_missing"
    candidate = (ROOT / heartbeat_file).resolve()
    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError:
        return False, "heartbeat_path_outside_repository"
    return True, "ok"


def build_recovery_plan(
    registry_path: str | Path = DEFAULT_REGISTRY,
    *,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    now = now or dt.datetime.now(dt.timezone.utc)
    registry = _load_json(Path(registry_path))
    if not isinstance(registry, dict):
        registry = {}
    policy = registry.get("policy", {}) if isinstance(registry.get("policy"), dict) else {}
    if policy.get("unknown_system_installation") != "deny":
        raise PermissionError("recovery registry must deny unknown-system installation")
    if policy.get("require_owner_authorized") is not True:
        raise PermissionError("recovery registry must require owner authorization")
    if policy.get("same_repository_only") is not True:
        raise PermissionError("recovery registry must remain same-repository only")

    allowed_providers = {str(x) for x in policy.get("allowed_providers", [])}
    max_dispatches = max(0, min(int(policy.get("max_recovery_dispatches_per_run", 3)), 10))
    actions: list[dict[str, Any]] = []
    observations: list[dict[str, Any]] = []

    workers = registry.get("workers", []) if isinstance(registry.get("workers"), list) else []
    for worker in workers:
        if not isinstance(worker, dict):
            continue
        valid, reason = _validate_worker(worker, allowed_providers)
        if not valid:
            observations.append({"id": worker.get("id"), "eligible": False, "reason": reason})
            continue

        heartbeat_path = ROOT / str(worker["heartbeat_file"])
        field = str(worker.get("heartbeat_field", "alive_at"))
        stale_after = max(60, min(int(worker.get("stale_after_seconds", 3600)), 7 * 24 * 3600))
        age = _heartbeat_age_seconds(heartbeat_path, field, now=now)
        stale = age > stale_after
        observations.append({
            "id": worker.get("id"),
            "eligible": True,
            "heartbeat_age_seconds": None if age == float("inf") else int(age),
            "stale_after_seconds": stale_after,
            "stale": stale,
        })
        if stale and len(actions) < max_dispatches:
            recovery = worker["recovery"]
            actions.append({
                "worker_id": worker.get("id"),
                "provider": worker.get("provider"),
                "action": "workflow_dispatch",
                "workflow": recovery["workflow"],
                "ref": recovery["ref"],
                "reason": "main_runtime_stale_or_missing",
            })

    return {
        "schema": "the-world-self-recovery-plan/v1",
        "generated_at": now.isoformat(),
        "unknown_system_installation": False,
        "self_installation": False,
        "same_repository_only": True,
        "observations": observations,
        "actions": actions,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build owner-approved META/X recovery plan")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--out")
    args = parser.parse_args()
    plan = build_recovery_plan(args.registry)
    text = json.dumps(plan, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
