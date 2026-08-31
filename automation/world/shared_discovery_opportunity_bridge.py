"""Bridge unknown Shared Discovery hosts into bounded authority-opportunity research.

This adapter deliberately does *not* authorize or contact anything. It converts public
DNS-name discoveries that are already marked ``candidate_only`` into the friction
shape consumed by :mod:`automation.world.boundary_opportunity_miner`.

The resulting opportunity can be ranked, simulated, and staged as an owner-gated
proposal candidate, but this bridge never activates authority, writes externally,
handles credentials, or turns discovery into permission.

IP literals (including private/loopback/link-local/public IPs) and malformed hosts are
retained as research-only evidence rather than handed to the trust-root proposal path.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import time
from pathlib import Path
from typing import Any, Mapping

BRIDGE_SCHEMA = "the-world-shared-discovery-opportunity-bridge/v1"
SOURCE_TAG = "shared_discovery_opportunity_bridge"


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _clean_host(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    host = value.strip().rstrip(".").lower()
    if not host or len(host) > 253 or any(ch in host for ch in "/*?#@"):
        return ""
    return host


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


def _is_public_dns_name(host: str) -> bool:
    if not host or _is_ip_literal(host) or "*" in host or "." not in host:
        return False
    labels = host.split(".")
    return all(
        label
        and len(label) <= 63
        and label[0].isalnum()
        and label[-1].isalnum()
        and all(ch.isalnum() or ch == "-" for ch in label)
        for label in labels
    )


def _shared_metadata(shared_doc: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    rows = shared_doc.get("discoveries", ()) if isinstance(shared_doc, Mapping) else ()
    result: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _clean_host(raw.get("host"))
        if not host:
            continue
        result[host] = {
            "url": raw.get("url"),
            "actors": list(raw.get("actors", ())) if isinstance(raw.get("actors"), list) else [],
            "sources": list(raw.get("sources", ())) if isinstance(raw.get("sources"), list) else [],
        }
    return result


def bridge_shared_discovery_candidates(
    shared_state_dir: str | Path,
    boundary_state_dir: str | Path,
) -> dict[str, Any]:
    """Convert unknown public DNS candidates into proposal-only friction evidence."""
    shared_state = Path(shared_state_dir)
    boundary_state = Path(boundary_state_dir)
    boundary_state.mkdir(parents=True, exist_ok=True)

    candidates_doc = _load_json(shared_state / "discovery_candidates.json", {})
    shared_doc = _load_json(shared_state / "shared_discovery_knowledge.json", {})
    metadata = _shared_metadata(shared_doc if isinstance(shared_doc, Mapping) else {})

    raw_candidates = candidates_doc.get("candidates", ()) if isinstance(candidates_doc, Mapping) else ()
    candidates = raw_candidates if isinstance(raw_candidates, list) else []

    existing = _load_json(boundary_state / "finding_action_result.json", {})
    if not isinstance(existing, dict):
        existing = {}
    existing_blocked = existing.get("blocked", ())
    preserved = [
        dict(item)
        for item in existing_blocked
        if isinstance(item, Mapping) and item.get("source") != SOURCE_TAG
    ] if isinstance(existing_blocked, list) else []

    handoff_rows: list[dict[str, Any]] = []
    research_only: list[dict[str, Any]] = []
    seen: set[str] = set()

    for raw in candidates:
        if not isinstance(raw, Mapping) or raw.get("decision") != "candidate_only":
            continue
        host = _clean_host(raw.get("host"))
        if not host or host in seen:
            continue
        seen.add(host)
        meta = metadata.get(host, {})
        row = {
            "host": host,
            "url": raw.get("url") or meta.get("url"),
            "authorization_readiness": raw.get("authorization_readiness"),
            "actors": meta.get("actors", []),
            "sources": meta.get("sources", []),
            "source": SOURCE_TAG,
        }
        if _is_public_dns_name(host):
            handoff_rows.append({**row, "reason": "no_reviewed_grant"})
        else:
            research_only.append(
                {
                    **row,
                    "reason": "non_dns_or_ip_literal_research_only",
                    "proposal_staging_allowed": False,
                }
            )

    finding_action_result = dict(existing)
    finding_action_result.setdefault("action_budget", 64)
    finding_action_result.setdefault("rejected_findings", [])
    finding_action_result.setdefault("errors", [])
    finding_action_result["blocked"] = preserved + handoff_rows
    _write_json(boundary_state / "finding_action_result.json", finding_action_result)

    receipt = {
        "schema": BRIDGE_SCHEMA,
        "generated_at": int(time.time()),
        "mode": "candidate_only_to_owner_gated_opportunity",
        "candidate_count": len(candidates),
        "handoff_count": len(handoff_rows),
        "research_only_count": len(research_only),
        "handoff_hosts": sorted(row["host"] for row in handoff_rows),
        "research_only": research_only,
        "same_closed_loop_handoff": "shared-discovery->boundary-opportunity-miner",
        "external_side_effects": False,
        "authority_activated": False,
        "finding_is_permission": False,
        "credentials_touched": False,
        "private_network_activation": False,
    }
    _write_json(boundary_state / "shared_discovery_opportunity_bridge.json", receipt)
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shared-state", required=True)
    parser.add_argument("--boundary-state", required=True)
    args = parser.parse_args()
    result = bridge_shared_discovery_candidates(args.shared_state, args.boundary_state)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
