#!/usr/bin/env python3
"""Run the autonomous AI Authority Council against an explicit Owner test target.

This is a live production canary for the distributed authority path:

    canonical Owner target -> Owner envelope -> META/X/SENJU trust council
    -> automatic ALLOW -> guarded multi-engine egress -> audit receipt

The script never discovers or self-authorizes a new trust root. By default it keeps the
legacy behavior and selects an explicit target marked ``authorization_authority_root``.
When ``--target-host`` is supplied, the host must already be an exact explicit Owner
target *and* have an active, non-destructive, credential-free standing authorization.
HARD_DENY, revocation, envelope expiry and envelope escape remain enforced by the
underlying routing primitives.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Mapping

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.distributed_egress import route_autonomous_council_egress  # noqa: E402
from senju.meta.autonomous_authority_council import CouncilPolicy  # noqa: E402
from senju.meta.distributed_authority import create_root_authority_envelope  # noqa: E402
from senju.meta.transitive_trust import create_trust_edge  # noqa: E402

SCHEMA = "senju-autonomous-authority-council-live/v1"
COUNCIL_APPROVERS = ("META", "X", "SENJU")
READ_ONLY_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"{path} must contain a JSON object")
    return value


def _normalize_host(value: str) -> str:
    host = str(value or "").strip().lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@"):
        raise RuntimeError("invalid target host")
    return host


def _standing_authorization(repo_root: Path, host: str) -> Mapping[str, Any]:
    doc = _load_json(repo_root / "senju" / "state" / "standing_authorizations.json")
    rows = doc.get("records", [])
    for raw in rows if isinstance(rows, list) else []:
        if not isinstance(raw, Mapping):
            continue
        exact_hosts = {
            str(item).strip().lower().rstrip(".")
            for item in raw.get("exact_hosts", ())
        }
        if host not in exact_hosts:
            continue
        if raw.get("revoked") is True:
            raise RuntimeError("target standing authorization is revoked")
        if raw.get("destructive") is True:
            raise RuntimeError("destructive standing authorization is not eligible")
        if str(raw.get("credential_scope", "none")) != "none":
            raise RuntimeError("credential-bearing standing authorization is not eligible")
        methods = {
            str(item).strip().upper()
            for item in raw.get("allowed_methods", ())
        } & READ_ONLY_METHODS
        if "GET" not in methods:
            raise RuntimeError("standing authorization must include GET for the live council probe")
        return raw
    raise RuntimeError("target has no active exact Owner standing authorization")


def _select_target(repo_root: Path, target_host: str | None = None) -> dict[str, Any]:
    doc = _load_json(repo_root / "AUTHORIZED_TEST_TARGETS.json")
    requested = _normalize_host(target_host) if target_host else None
    for raw in doc.get("targets", []):
        if not isinstance(raw, dict):
            continue
        if raw.get("owner_authorization") != "explicit":
            continue
        host = str(raw.get("host", "")).strip().lower().rstrip(".")
        if not host:
            continue
        if requested is None:
            if raw.get("authorization_authority_root", False):
                return raw
            continue
        if host != requested:
            continue
        if str(raw.get("scheme", "https")).lower() != "https":
            raise RuntimeError("explicit target must be HTTPS")
        _standing_authorization(repo_root, host)
        return raw
    if requested is None:
        raise RuntimeError("no explicit Owner authority root target is configured")
    raise RuntimeError("requested host is not an exact explicit Owner-authorized target")


def _probe_url(target: dict[str, Any]) -> str:
    for key in ("scope_url", "federation_url", "base_url"):
        value = str(target.get(key, "")).strip()
        if value.startswith("https://"):
            return value
    raise RuntimeError("explicit Owner target has no HTTPS probe URL")


def _trust_edges():
    return (
        create_trust_edge(truster="Owner", trustee="META", scopes=["egress:approve"]),
        create_trust_edge(truster="META", trustee="X", scopes=["egress:approve"]),
        create_trust_edge(truster="X", trustee="SENJU", scopes=["egress:approve"]),
    )


def run_cycle(repo_root: Path, target_host: str | None = None) -> dict[str, Any]:
    target = _select_target(repo_root, target_host=target_host)
    host = str(target["host"]).strip().lower().rstrip(".")
    if target_host is not None:
        _standing_authorization(repo_root, host)
    url = _probe_url(target)
    now = int(time.time())
    envelope = create_root_authority_envelope(
        reference=f"canonical-owner-target:{host}",
        owner="Owner",
        exact_hosts=[host],
        allowed_methods=["GET", "HEAD"],
        expires_at_epoch=now + 3600,
    )
    result = route_autonomous_council_egress(
        actor="SENJU",
        url=url,
        method="GET",
        envelope=envelope,
        owner="Owner",
        approvers=COUNCIL_APPROVERS,
        trust_edges=_trust_edges(),
        council_policy=CouncilPolicy(min_trusted_agents=1, allowed_methods=("GET", "HEAD")),
        now=now,
    )
    council_vote = next(
        vote for vote in result.authority_decision.votes if vote.evaluator == "ai_authority_council"
    )
    return {
        "schema": SCHEMA,
        "generated_at": int(time.time()),
        "production": True,
        "target": host,
        "url": url,
        "owner_authorization": "explicit",
        "standing_authorization_required": target_host is not None,
        "authority_decision": {
            "allowed": result.authority_decision.allowed,
            "reason": result.authority_decision.reason,
            "winning_evaluators": list(result.authority_decision.winning_evaluators),
            "hard_stopped": result.authority_decision.hard_stopped,
        },
        "ai_council": {
            "effect": council_vote.effect,
            "reason": council_vote.reason,
            "approval_mode": council_vote.evidence.get("approval_mode"),
            "trusted_approvals": council_vote.evidence.get("trusted_approvals", ()),
            "per_host_manual_reapproval_required": False,
        },
        "transport": {
            "engine": result.routed.receipt.engine,
            "status": result.routed.receipt.status,
            "final_url": result.routed.receipt.final_url,
            "response_bytes": result.routed.receipt.response_bytes,
            "response_sha256": result.routed.receipt.response_sha256,
            "attempts": [
                {
                    "engine": attempt.engine,
                    "outcome": attempt.outcome,
                    "error": attempt.error,
                }
                for attempt in result.routed.attempts
            ],
        },
        "invariants": {
            "new_root_created": False,
            "hard_deny_override": False,
            "revocation_override": False,
            "owner_envelope_required": True,
            "exact_explicit_target_required": True,
            "standing_authorization_required_for_target_override": target_host is not None,
            "ordinary_deny_can_be_overridden_by_council": True,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(_REPO_ROOT))
    parser.add_argument("--target-host")
    parser.add_argument("--out")
    args = parser.parse_args()
    result = run_cycle(Path(args.repo_root), target_host=args.target_host)
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered + "\n", encoding="utf-8")
    return 0 if result["authority_decision"]["allowed"] and result["transport"]["status"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
