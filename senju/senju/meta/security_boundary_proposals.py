"""Audited self-change proposal channel for META and X.

META/X may autonomously propose changes to security-boundary files, including
safety, external-contact, target-authority, credential, GitHub workflow, and
audit policy surfaces. This module deliberately does not apply those patches.
Every accepted proposal is persisted as immutable review input and requires an
independent exact-head security-boundary audit before any later production merge.
"""
from __future__ import annotations

import datetime as dt
import fnmatch
import hashlib
import json
from pathlib import Path, PurePosixPath
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
POLICY_FILE = ROOT / "senju" / "config" / "security-boundary-proposal-policy.json"
PROPOSAL_DIR = ROOT / "senju" / "state" / "security_boundary_proposals"
AUDIT_FILE = ROOT / "senju" / "state" / "security_boundary_proposal_audit.ndjson"


def _ts() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _append(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(value, ensure_ascii=False) + "\n")


def _normalized_repo_path(raw: str) -> str:
    path = str(PurePosixPath(str(raw).replace("\\", "/")))
    if not path or path == "." or path.startswith("/") or path == ".." or path.startswith("../"):
        return ""
    return path


def _allowed_target(path: str, policy: dict[str, Any]) -> bool:
    return any(fnmatch.fnmatch(path, str(pattern)) for pattern in policy.get("allowed_target_patterns", []))


def stage_proposal(
    system: str,
    target_path: str,
    rationale: str,
    proposed_patch: str,
    *,
    evidence: dict[str, Any] | None = None,
    policy_file: Path = POLICY_FILE,
    proposal_dir: Path = PROPOSAL_DIR,
) -> dict[str, Any]:
    """Persist a security-boundary patch proposal without applying it."""
    policy = _load(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    system_cfg = systems.get(system) if isinstance(systems.get(system), dict) else {}
    path = _normalized_repo_path(target_path)
    patch = str(proposed_patch or "")
    reason = str(rationale or "").strip()

    rejection: list[str] = []
    if not system_cfg.get("enabled", False):
        rejection.append("system_not_enabled")
    if not path or not _allowed_target(path, policy):
        rejection.append("target_not_in_security_boundary_proposal_allowlist")
    if not reason:
        rejection.append("missing_rationale")
    if not patch:
        rejection.append("missing_patch")
    max_bytes = max(1024, min(int(policy.get("max_patch_bytes", 65536)), 262144))
    if len(patch.encode("utf-8")) > max_bytes:
        rejection.append("patch_too_large")

    if rejection:
        result = {
            "status": "rejected",
            "system": system,
            "target_path": path or str(target_path),
            "reasons": rejection,
            "applied": False,
            "self_approved": False,
            "self_merged": False,
        }
        _append(AUDIT_FILE, {"ts": _ts(), "event": "proposal_rejected", **result})
        return result

    digest = hashlib.sha256(
        (system + "\0" + path + "\0" + reason + "\0" + patch).encode("utf-8")
    ).hexdigest()
    proposal_id = f"sbp-{digest[:16]}"
    audit_cfg = policy.get("audit") if isinstance(policy.get("audit"), dict) else {}
    record = {
        "schema": "senju-security-boundary-proposal/v1",
        "proposal_id": proposal_id,
        "created_at": _ts(),
        "system": system,
        "target_path": path,
        "rationale": reason[:4000],
        "proposed_patch": patch,
        "patch_sha256": hashlib.sha256(patch.encode("utf-8")).hexdigest(),
        "evidence": evidence if isinstance(evidence, dict) else {},
        "status": "requires_independent_audit",
        "security_boundary_change": True,
        "apply_mode": "proposal_only",
        "applied": False,
        "direct_default_branch_write": False,
        "self_approval": False,
        "self_merge": False,
        "independent_audit_required": bool(audit_cfg.get("independent_audit_required", True)),
        "exact_head_sha_required": bool(audit_cfg.get("exact_head_sha_required", True)),
        "security_boundary_marker_required": bool(audit_cfg.get("security_boundary_marker_required", True)),
    }
    proposal_dir.mkdir(parents=True, exist_ok=True)
    destination = proposal_dir / f"{proposal_id}.json"
    destination.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _append(AUDIT_FILE, {
        "ts": _ts(),
        "event": "proposal_staged",
        "proposal_id": proposal_id,
        "system": system,
        "target_path": path,
        "patch_sha256": record["patch_sha256"],
        "status": record["status"],
    })
    return record


def stage_from_cycle_report(
    system: str,
    cycle_report: dict[str, Any] | None,
    *,
    policy_file: Path = POLICY_FILE,
    proposal_dir: Path = PROPOSAL_DIR,
) -> list[dict[str, Any]]:
    """Stage any agent-generated boundary proposals carried by a cycle report."""
    if not isinstance(cycle_report, dict):
        return []
    raw = cycle_report.get("security_boundary_proposals", [])
    if not isinstance(raw, list):
        return []
    staged: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        staged.append(stage_proposal(
            system=system,
            target_path=str(item.get("target_path") or item.get("file") or ""),
            rationale=str(item.get("rationale") or item.get("description") or ""),
            proposed_patch=str(item.get("proposed_patch") or item.get("patch") or ""),
            evidence=item.get("evidence") if isinstance(item.get("evidence"), dict) else {},
            policy_file=policy_file,
            proposal_dir=proposal_dir,
        ))
    return staged
