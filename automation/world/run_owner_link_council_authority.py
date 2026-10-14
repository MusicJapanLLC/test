from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Mapping

from automation.world.owner_link_council_authority import (
    CouncilPostAuthority,
    CouncilPostDecision,
    build_owner_links,
    evaluate_owner_link_post,
    execute_council_post_authority,
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _save(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _decision_from_mapping(raw: Mapping[str, Any]) -> CouncilPostDecision:
    authority_raw = raw.get("authority")
    authority = None
    if isinstance(authority_raw, Mapping):
        authority = CouncilPostAuthority(
            authority_id=str(authority_raw.get("authority_id") or ""),
            authority_kind=str(authority_raw.get("authority_kind") or ""),
            authority_basis=str(authority_raw.get("authority_basis") or ""),
            issued_at=int(authority_raw.get("issued_at", 0)),
            expires_at=int(authority_raw.get("expires_at", 0)),
            max_uses=int(authority_raw.get("max_uses", 1)),
            url=str(authority_raw.get("url") or ""),
            host=str(authority_raw.get("host") or ""),
            path=str(authority_raw.get("path") or ""),
            method=str(authority_raw.get("method") or "POST"),
            payload_sha256=str(authority_raw.get("payload_sha256") or ""),
            idempotency_key=str(authority_raw.get("idempotency_key") or ""),
            credential_scope=str(authority_raw.get("credential_scope") or "none"),
            follow_redirects=bool(authority_raw.get("follow_redirects", False)),
            council_members=tuple(str(item) for item in authority_raw.get("council_members", [])),
            council_yes=int(authority_raw.get("council_yes", 0)),
            average_yes_confidence=int(authority_raw.get("average_yes_confidence", 0)),
            general_root_authority=bool(authority_raw.get("general_root_authority", False)),
        )
    return CouncilPostDecision(
        candidate_id=str(raw.get("candidate_id") or "candidate"),
        link_id=str(raw.get("link_id") or ""),
        url=str(raw.get("url") or ""),
        status=str(raw.get("status") or ""),
        council_yes=int(raw.get("council_yes", 0)),
        council_no=int(raw.get("council_no", 0)),
        council_missing=int(raw.get("council_missing", 0)),
        average_yes_confidence=int(raw.get("average_yes_confidence", 0)),
        new_authority_created=bool(raw.get("new_authority_created", False)),
        execute_now=bool(raw.get("execute_now", False)),
        authority=authority,
        payload_json=raw.get("payload_json") if isinstance(raw.get("payload_json"), Mapping) else None,
        reason=str(raw.get("reason") or ""),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Issue and execute Owner-link + council POST Action Authorities")
    parser.add_argument("--state-dir", default="automation/world/state")
    parser.add_argument("--runtime-dir", default=".council-link-authority-runtime")
    parser.add_argument("--execute-approved", action="store_true")
    args = parser.parse_args()

    state = Path(args.state_dir)
    runtime = Path(args.runtime_dir)
    runtime.mkdir(parents=True, exist_ok=True)

    owner_doc = _load(state / "owner_authorized_links.json", {})
    requests_doc = _load(state / "council_link_post_requests.json", {})
    ballots_doc = _load(state / "distributed_internal_ballots.json", {})
    policy_doc = _load(state / "distributed_internal_policy.json", {})
    ledger_doc = _load(runtime / "consumed_post_authorities.json", {})

    owner_rows = owner_doc.get("links", []) if isinstance(owner_doc, Mapping) else []
    requests = requests_doc.get("requests", []) if isinstance(requests_doc, Mapping) else []
    ballots_by_candidate = ballots_doc.get("ballots_by_candidate", {}) if isinstance(ballots_doc, Mapping) else {}
    if not isinstance(ballots_by_candidate, Mapping):
        ballots_by_candidate = {}
    consumed = set(str(item) for item in ledger_doc.get("authority_ids", []) if str(item)) if isinstance(ledger_doc, Mapping) else set()

    links = build_owner_links(owner_rows)
    quorum = int(policy_doc.get("promote_quorum", 3)) if isinstance(policy_doc, Mapping) else 3
    min_confidence = int(policy_doc.get("min_confidence", 60)) if isinstance(policy_doc, Mapping) else 60

    decisions = []
    for request in requests if isinstance(requests, list) else []:
        if not isinstance(request, Mapping):
            continue
        candidate_id = str(request.get("candidate_id") or "candidate")
        decision = evaluate_owner_link_post(
            request,
            links,
            ballots_by_candidate.get(candidate_id, ()),
            quorum=quorum,
            min_confidence=min_confidence,
        )
        decisions.append(decision.to_dict())

    receipts: list[dict[str, Any]] = []
    if args.execute_approved:
        for raw in decisions:
            if not raw.get("execute_now") or not isinstance(raw.get("authority"), Mapping):
                continue
            authority_id = str(raw["authority"].get("authority_id") or "")
            if authority_id in consumed:
                receipts.append({
                    "candidate_id": raw.get("candidate_id"),
                    "authority_id": authority_id,
                    "status": "already_consumed",
                })
                continue
            decision = _decision_from_mapping(raw)
            try:
                receipt = execute_council_post_authority(decision, consumed_authority_ids=consumed)
            except Exception as exc:  # deliberately persist type only; exception text can carry secrets
                receipts.append({
                    "candidate_id": decision.candidate_id,
                    "authority_id": authority_id,
                    "status": "execution_failed",
                    "error_type": type(exc).__name__,
                })
                continue
            consumed.add(authority_id)
            receipts.append({
                "candidate_id": decision.candidate_id,
                "authority_id": authority_id,
                "status": "executed",
                "receipt": receipt,
            })

    ledger = {
        "schema": "the-world-consumed-post-authorities/v1",
        "authority_ids": sorted(consumed),
    }
    _save(runtime / "consumed_post_authorities.json", ledger)

    result = {
        "schema": "the-world-owner-link-council-post-production/v1",
        "mode": "production_exact_link_council_authority_and_post",
        "owner_registered_link_count": len(links),
        "request_count": len(decisions),
        "new_authority_count": sum(1 for item in decisions if item.get("new_authority_created")),
        "execution_requested": bool(args.execute_approved),
        "executed_count": sum(1 for item in receipts if item.get("status") == "executed"),
        "decisions": decisions,
        "execution_receipts": receipts,
        "rules": {
            "owner_exact_link_required": True,
            "council_quorum_required": True,
            "fresh_action_authority_generated": True,
            "post_execution_enabled": bool(args.execute_approved),
            "credential_scope": "none",
            "general_root_authority": False,
            "redirects": False,
            "one_use_authority": True,
        },
    }
    _save(runtime / "council_link_authority_run.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
