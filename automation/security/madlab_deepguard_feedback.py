#!/usr/bin/env python3
"""Sanitize aggregate MADLAB DeepGuard external-effect feedback for Security R&D.

The input is deliberately aggregate-only. It must not contain target URLs, approval
codes, credentials, request bodies, or any authority to widen external scope. The
result may change R&D priority only.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path
from typing import Any

SCHEMA = "madlab-research-handoff/v1"
MAX_COUNT = 1_000_000
ALLOWED_ACTION = re.compile(r"^[a-z0-9_\-]{2,80}$", re.I)
FORBIDDEN_KEYS = {
    "target", "url", "host", "hostname", "approval_code", "credential", "credentials",
    "secret", "token", "password", "authorization", "cookie", "request_body", "payload",
}
PROVIDER_ACTIONS = {"dns_mail_profile", "dns_tls_profile", "tls_certificate_renew", "tls_minimum_profile", "cache_refresh"}


def _bounded_int(value: Any) -> int:
    try:
        return max(0, min(MAX_COUNT, int(value or 0)))
    except (TypeError, ValueError):
        return 0


def _walk_keys(value: Any) -> set[str]:
    keys: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            keys.add(str(key).lower())
            keys |= _walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            keys |= _walk_keys(child)
    return keys


def sanitize(raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("schema") != SCHEMA:
        raise ValueError("unexpected_schema")
    if raw.get("authority") != "priority_only":
        raise ValueError("authority_must_be_priority_only")
    for field in ("permission_surface_unchanged", "external_scope_unchanged"):
        if raw.get(field) is not True:
            raise ValueError(f"{field}_must_be_true")
    if raw.get("verification_claimed") is not False:
        raise ValueError("verification_claimed_must_be_false")

    forbidden = sorted(_walk_keys(raw) & FORBIDDEN_KEYS)
    if forbidden:
        raise ValueError(f"forbidden_sensitive_fields:{','.join(forbidden)}")

    gaps: list[dict[str, Any]] = []
    provider_gap = 0
    bridge_gap = 0
    for item in raw.get("top_bridge_gaps") or []:
        if not isinstance(item, dict):
            continue
        action_id = str(item.get("action_id") or "")
        if not ALLOWED_ACTION.fullmatch(action_id):
            continue
        count = _bounded_int(item.get("count"))
        kind = "provider" if action_id in PROVIDER_ACTIONS else "owner_bridge"
        gaps.append({"action_id": action_id, "count": count, "kind": kind})
        if kind == "provider":
            provider_gap += count
        else:
            bridge_gap += count
    gaps = sorted(gaps, key=lambda x: (-x["count"], x["action_id"]))[:12]

    plans = _bounded_int(raw.get("plans"))
    runs = _bounded_int(raw.get("remediation_runs"))
    attempted = _bounded_int(raw.get("actions_attempted"))
    accepted = _bounded_int(raw.get("actions_accepted"))
    resolved = _bounded_int(raw.get("findings_resolved"))
    acceptance_rate = round(accepted / attempted, 4) if attempted else None
    resolution_rate = round(resolved / accepted, 4) if accepted else None

    total_gap = bridge_gap + provider_gap
    # Bounded R&D pressure only. It cannot authorize execution.
    pressure = min(500, 140 + min(total_gap, 180) + (100 if plans > 0 else 0)) if total_gap else 0
    track_pressure = {"SEC-PORT-012": pressure} if pressure else {}
    if provider_gap:
        track_pressure["SEC-PORT-008"] = min(180, 40 + provider_gap)
    if bridge_gap:
        track_pressure["SEC-PORT-005"] = min(160, 30 + bridge_gap)
        track_pressure["SEC-PORT-009"] = min(160, 30 + bridge_gap)

    return {
        "schema": "standment-madlab-external-effect-feedback/v1",
        "authority": "priority_only",
        "permission_surface_unchanged": True,
        "external_scope_unchanged": True,
        "promotion_gate_unchanged": True,
        "verification_authority_unchanged": True,
        "runtime": {
            "plans": plans,
            "remediation_runs": runs,
            "actions_attempted": attempted,
            "actions_accepted": accepted,
            "findings_resolved": resolved,
            "acceptance_rate": acceptance_rate,
            "resolution_rate": resolution_rate,
        },
        "top_bridge_gaps": gaps,
        "gap_totals": {"owner_bridge": bridge_gap, "provider": provider_gap},
        "track_pressure": track_pressure,
        "next_action": (
            f"Expand the highest-frequency bounded actuator: {gaps[0]['action_id']}"
            if gaps else "Collect more aggregate MADLAB plan/remediation evidence before changing R&D priority."
        ),
        "limitations": [
            "Aggregate runtime feedback only; target identity and credentials are not accepted.",
            "Track pressure is bounded and priority-only.",
            "This feedback cannot authorize external actions or alter VERIFIED status."
        ],
    }


def fetch_json(url: str, timeout: float = 5.0) -> dict[str, Any]:
    if url != "https://madlab-deepguard-v2.onrender.com/api/research/handoff":
        raise ValueError("feedback_url_not_allowlisted")
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Standment-Security-RND/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"feedback_http_{response.status}")
        body = response.read(64 * 1024)
    raw = json.loads(body.decode("utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("feedback_must_be_object")
    return raw


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://madlab-deepguard-v2.onrender.com/api/research/handoff")
    ap.add_argument("--input")
    ap.add_argument("--out", default="standment-security/state/madlab-external-effect.json")
    args = ap.parse_args()
    raw = json.loads(Path(args.input).read_text(encoding="utf-8")) if args.input else fetch_json(args.url)
    result = sanitize(raw)
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"gaps": len(result["top_bridge_gaps"]), "track_pressure": result["track_pressure"], "next_action": result["next_action"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
