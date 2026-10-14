from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Mapping

from automation.world.council_delegated_action import (
    CouncilActionDecision,
    execute_authorized_action,
    run_council_delegated_actions,
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _decision_from_mapping(raw: Mapping[str, Any]) -> CouncilActionDecision:
    from automation.world.distributed_internal_council import AgentBallot

    ballots = tuple(AgentBallot.from_mapping(item) for item in raw.get("ballots", []) if isinstance(item, Mapping))
    return CouncilActionDecision(
        candidate_id=str(raw.get("candidate_id") or "candidate"),
        action_id=str(raw.get("action_id") or ""),
        url=str(raw.get("url") or ""),
        host=str(raw.get("host") or ""),
        path=str(raw.get("path") or ""),
        method=str(raw.get("method") or ""),
        status=str(raw.get("status") or ""),
        execute_now=bool(raw.get("execute_now")),
        council_yes=int(raw.get("council_yes", 0)),
        council_no=int(raw.get("council_no", 0)),
        council_missing=int(raw.get("council_missing", 0)),
        average_yes_confidence=int(raw.get("average_yes_confidence", 0)),
        ballots=ballots,
        authority_basis=str(raw.get("authority_basis") or "none"),
        delegated_executor_authority=bool(raw.get("delegated_executor_authority")),
        new_authority_created=bool(raw.get("new_authority_created")),
        credential_scope=str(raw.get("credential_scope") or "none"),
        payload_json=raw.get("payload_json") if isinstance(raw.get("payload_json"), Mapping) else None,
        idempotency_key=str(raw.get("idempotency_key") or ""),
        reason=str(raw.get("reason") or ""),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run council-delegated internal action decisions")
    parser.add_argument("--state-dir", default="automation/world/state")
    parser.add_argument("--execute-approved", action="store_true")
    args = parser.parse_args()

    state = Path(args.state_dir)
    envelope = _load(state / "owner_internal_envelope.json", {})
    profiles_doc = _load(state / "owner_action_profiles.json", {})
    requests_doc = _load(state / "council_action_requests.json", {})
    ballots_doc = _load(state / "distributed_internal_ballots.json", {})
    policy_doc = _load(state / "distributed_internal_policy.json", {})

    profiles = profiles_doc.get("profiles", []) if isinstance(profiles_doc, Mapping) else []
    requests = requests_doc.get("requests", []) if isinstance(requests_doc, Mapping) else []
    ballots = ballots_doc.get("ballots_by_candidate", {}) if isinstance(ballots_doc, Mapping) else {}
    if not isinstance(ballots, Mapping):
        ballots = {}

    result = run_council_delegated_actions(
        envelope,
        profiles,
        requests,
        ballots,
        quorum=int(policy_doc.get("promote_quorum", 3)) if isinstance(policy_doc, Mapping) else 3,
        min_confidence=int(policy_doc.get("min_confidence", 60)) if isinstance(policy_doc, Mapping) else 60,
    )

    receipts = []
    if args.execute_approved:
        for raw in result["decisions"]:
            if not raw.get("execute_now"):
                continue
            decision = _decision_from_mapping(raw)
            receipts.append(
                {
                    "candidate_id": decision.candidate_id,
                    "action_id": decision.action_id,
                    "receipt": execute_authorized_action(decision),
                }
            )
    result["execution_requested"] = bool(args.execute_approved)
    result["execution_receipts"] = receipts

    state.mkdir(parents=True, exist_ok=True)
    output = state / "council_delegated_actions_result.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
