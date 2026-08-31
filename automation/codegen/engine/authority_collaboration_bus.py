"""Shared proposal-only bus for autonomous authority research loops.

The bus connects Shared Discovery / Boundary Opportunity research, META/X/SENJU
rights requests, and Root Authority negotiation without turning any of those signals
into production authority. It only normalizes and persists proposal/evidence state in
the shared ``.authority-opportunity-runtime`` cache.

No network I/O, credential access, authority activation, policy mutation, or external
write occurs here.
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit

SCHEMA = "the-world-authority-collaboration-bus/v1"
QUEUE_SCHEMA = "the-world-authority-opportunity-queue/v1"

RIGHTS_FILES = (
    "rights_request_ledger.json",
    "rights_request_federation.json",
    "owner_scope_negotiation_signals.json",
    "owner_scope_negotiation_result.json",
    "owner_contact_ceiling_effective.json",
)
BOUNDARY_FILES = (
    "boundary_opportunities.json",
    "boundary_opportunity_cycle_result.json",
    "shared_discovery_opportunity_bridge.json",
    "boundary_evolution_checkpoint.json",
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: Any) -> str:
    raw = str(value or "").strip().lower().rstrip(".")
    if not raw:
        return ""
    if "://" in raw:
        try:
            parsed = urlsplit(raw)
        except ValueError:
            return ""
        if parsed.username or parsed.password:
            return ""
        raw = (parsed.hostname or "").lower().rstrip(".")
    if not raw or any(ch in raw for ch in "/?#@*"):
        return ""
    return raw


def _priority(value: Any, default: int = 70) -> int:
    try:
        score = int(float(value))
    except (TypeError, ValueError):
        score = default
    return max(1, min(score, 100))


def _confidence(value: Any, default: float = 0.7) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = default
    if score > 1:
        score /= 10 if score <= 10 else 100
    return max(0.0, min(score, 1.0))


def _copy_existing(source_dir: Path | None, bus_dir: Path, names: Iterable[str]) -> list[str]:
    copied: list[str] = []
    if source_dir is None:
        return copied
    for name in names:
        src = source_dir / name
        if not src.is_file():
            continue
        dst = bus_dir / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        copied.append(name)
    return copied


def _existing_opportunities(bus_dir: Path) -> list[dict[str, Any]]:
    doc = _load(bus_dir / "authority_opportunity_queue.json", {})
    rows = doc.get("opportunities", []) if isinstance(doc, Mapping) else []
    return [dict(row) for row in rows if isinstance(row, Mapping)] if isinstance(rows, list) else []


def _from_rights(rights_dir: Path | None) -> list[dict[str, Any]]:
    if rights_dir is None:
        return []
    doc = _load(rights_dir / "rights_request_ledger.json", {})
    rows = doc.get("requests", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        status = str(row.get("status", ""))
        if not status.startswith(("requesting_", "owner_review_")):
            continue
        if row.get("hard_deny") is True or row.get("revoked") is True:
            continue
        host = _host(row.get("host"))
        if not host:
            continue
        out.append({
            "host": host,
            "reason": str(row.get("reason") or "META/X/SENJU request broader Owner scope")[:400],
            "priority": _priority(row.get("priority"), 82),
            "confidence": min(0.99, 0.72 + min(int(row.get("seen_count", 1) or 1), 9) * 0.02),
            "requested_methods": list(row.get("requested_methods", [])) if isinstance(row.get("requested_methods"), list) else [],
            "source": "rights_request_federation",
            "source_ref": row.get("request_id"),
            "proposal_only": True,
            "authority_effect": "none",
            "hard_deny": False,
            "revoked": False,
        })
    return out


def _from_boundary(boundary_dir: Path | None) -> list[dict[str, Any]]:
    if boundary_dir is None:
        return []
    doc = _load(boundary_dir / "boundary_opportunities.json", {})
    rows = doc.get("opportunities", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        if str(row.get("disposition", "proposal_only")) != "proposal_only":
            continue
        if not isinstance(row.get("proposal_signal"), Mapping):
            continue
        evidence = row.get("evidence") if isinstance(row.get("evidence"), Mapping) else {}
        host = _host(row.get("host") or evidence.get("host"))
        if not host:
            continue
        out.append({
            "host": host,
            "reason": str(
                evidence.get("reason")
                or row.get("capability_unlocked")
                or "Boundary research produced a proposal-safe Owner review candidate"
            )[:400],
            "priority": _priority(row.get("priority_score"), 76),
            "confidence": _confidence(row.get("confidence_score"), 0.75),
            "source": "boundary_opportunity_research",
            "source_ref": row.get("opportunity_id"),
            "proposal_only": True,
            "authority_effect": "none",
            "hard_deny": False,
            "revoked": False,
        })
    return out


def _merge(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for raw in rows:
        host = _host(raw.get("host") or raw.get("target") or raw.get("url"))
        if not host:
            continue
        if raw.get("hard_deny") is True or raw.get("revoked") is True:
            # Terminal evidence is never converted into a new negotiation opportunity.
            merged.pop(host, None)
            continue
        current = merged.get(host)
        source = str(raw.get("source") or "existing_authority_opportunity")
        source_ref = str(raw.get("source_ref") or raw.get("request_id") or raw.get("opportunity_id") or "")
        if current is None:
            current = {
                "host": host,
                "reason": str(raw.get("reason") or "Authority opportunity")[:400],
                "priority": _priority(raw.get("priority") or raw.get("priority_score"), 70),
                "confidence": _confidence(raw.get("confidence") or raw.get("confidence_score"), 0.7),
                "requested_methods": list(raw.get("requested_methods", [])) if isinstance(raw.get("requested_methods"), list) else [],
                "sources": [],
                "source_refs": [],
                "proposal_only": True,
                "authority_effect": "none",
                "hard_deny": False,
                "revoked": False,
            }
            merged[host] = current
        current["priority"] = max(int(current["priority"]), _priority(raw.get("priority") or raw.get("priority_score"), 70))
        current["confidence"] = max(float(current["confidence"]), _confidence(raw.get("confidence") or raw.get("confidence_score"), 0.7))
        if source and source not in current["sources"]:
            current["sources"].append(source)
        if source_ref and source_ref not in current["source_refs"]:
            current["source_refs"].append(source_ref)
        methods = raw.get("requested_methods")
        if isinstance(methods, list):
            current["requested_methods"] = sorted(set(current["requested_methods"]) | {str(v).upper() for v in methods})
    return sorted(merged.values(), key=lambda row: (-int(row["priority"]), row["host"]))


def build_authority_collaboration_bus(
    bus_dir: str | Path,
    *,
    rights_state_dir: str | Path | None = None,
    boundary_state_dir: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    bus = Path(bus_dir)
    bus.mkdir(parents=True, exist_ok=True)
    rights = Path(rights_state_dir) if rights_state_dir else None
    boundary = Path(boundary_state_dir) if boundary_state_dir else None
    copied = _copy_existing(rights, bus, RIGHTS_FILES) + _copy_existing(boundary, bus, BOUNDARY_FILES)

    existing = _existing_opportunities(bus)
    rights_rows = _from_rights(rights or bus)
    boundary_rows = _from_boundary(boundary or bus)
    opportunities = _merge([*existing, *boundary_rows, *rights_rows])
    generated_at = int(time.time()) if now is None else int(now)

    queue = {
        "schema": QUEUE_SCHEMA,
        "generated_at": generated_at,
        "producer": "authority_collaboration_bus",
        "proposal_only": True,
        "authority_activated": False,
        "external_side_effects": False,
        "opportunities": opportunities,
        "opportunity_count": len(opportunities),
    }
    _write(bus / "authority_opportunity_queue.json", queue)

    summary = {
        "schema": SCHEMA,
        "generated_at": generated_at,
        "closed_loop": True,
        "shared_runtime": str(bus),
        "producers": ["Shared Discovery/Boundary Research", "META/X/SENJU Rights Federation", "Root Negotiation"],
        "consumers": ["META", "X", "SENJU", "PR-ARMY", "Root Authority Negotiation"],
        "copied_files": sorted(set(copied)),
        "rights_candidate_count": len(rights_rows),
        "boundary_candidate_count": len(boundary_rows),
        "opportunity_count": len(opportunities),
        "authority_effect": "none",
        "authority_activated": False,
        "external_side_effects": False,
        "credential_access": False,
        "hard_deny_override": False,
    }
    _write(bus / "authority_collaboration_bus.json", summary)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bus-dir", required=True)
    parser.add_argument("--rights-state-dir")
    parser.add_argument("--boundary-state-dir")
    parser.add_argument("--json-out")
    args = parser.parse_args()
    result = build_authority_collaboration_bus(
        args.bus_dir,
        rights_state_dir=args.rights_state_dir,
        boundary_state_dir=args.boundary_state_dir,
    )
    if args.json_out:
        _write(Path(args.json_out), result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
