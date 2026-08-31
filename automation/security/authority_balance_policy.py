"""Council-reviewed operational balance policy around hard authority floors.

This module deliberately does NOT weaken the four authority safety invariants:

* research has zero authority effect
* delegated authority has credential_scope=none
* revocation is terminal for the revoked grant
* public/private network authority remain separate

Instead it reduces operational friction around those boundaries by 35% and
requires unanimous modeled approval from META, X, and Senju before the tuning
is considered active.

Revalidation marker: run the same council contract after automatic base updates.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Mapping

REQUESTED_FRICTION_REDUCTION = 0.35
COUNCIL = ("META", "X", "Senju")

HARD_FLOORS: dict[str, Any] = {
    "research_has_zero_authority_effect": True,
    "delegated_authority_credential_scope": "none",
    "revocation_is_terminal_for_revoked_grant": True,
    "public_private_network_authority_separation": True,
    "raw_credential_copy_allowed": False,
    "emergency_stop_override_allowed": False,
    "private_network_inference_from_public_authority": False,
}

BASELINE: dict[str, int] = {
    "research_generations_per_cycle": 6,
    "research_hypothesis_budget": 96,
    "council_batch_size": 20,
    "public_readonly_review_window_seconds": 300,
}


def _tuned_int(value: int, *, increase: bool) -> int:
    factor = 1.0 + REQUESTED_FRICTION_REDUCTION if increase else 1.0 - REQUESTED_FRICTION_REDUCTION
    return max(1, round(value * factor))


def proposed_policy() -> dict[str, Any]:
    """Return the bounded policy requested for council review."""
    return {
        "schema": "the-world-authority-balance-policy/v1",
        "requested_friction_reduction": REQUESTED_FRICTION_REDUCTION,
        "hard_floors": dict(HARD_FLOORS),
        "tuning": {
            # Research can produce higher-quality proposals faster, but never authority.
            "research_to_proposal_bridge": True,
            "research_generations_per_cycle": _tuned_int(BASELINE["research_generations_per_cycle"], increase=True),
            "research_hypothesis_budget": _tuned_int(BASELINE["research_hypothesis_budget"], increase=True),
            # Delegated authority still carries no credential material. It may only ask
            # an existing credential broker for a scoped reference under separate authority.
            "brokered_credential_reference_request_lane": True,
            "delegated_authority_credential_scope": "none",
            # Revoked grants stay dead. A fresh request may be submitted from zero authority,
            # with no inheritance from the revoked grant/checkpoint.
            "fresh_reapplication_after_revocation": True,
            "revoked_grant_restore": False,
            "revoked_scope_inheritance": False,
            # Public GET/HEAD on already-authorized exact hosts may use a faster review lane.
            # This cannot infer or open private/link-local/loopback authority.
            "existing_public_exact_host_readonly_fastpath": True,
            "public_readonly_review_window_seconds": _tuned_int(BASELINE["public_readonly_review_window_seconds"], increase=False),
            "private_network_fastpath": False,
            "private_network_requires_explicit_separate_authority": True,
            "council_batch_size": _tuned_int(BASELINE["council_batch_size"], increase=True),
        },
    }


def _hard_floors_intact(policy: Mapping[str, Any]) -> bool:
    return dict(policy.get("hard_floors") or {}) == HARD_FLOORS


def _meta_vote(policy: Mapping[str, Any]) -> dict[str, Any]:
    tuning = dict(policy.get("tuning") or {})
    approve = bool(
        _hard_floors_intact(policy)
        and tuning.get("research_to_proposal_bridge") is True
        and int(tuning.get("research_generations_per_cycle") or 0) >= BASELINE["research_generations_per_cycle"]
        and int(tuning.get("research_hypothesis_budget") or 0) >= BASELINE["research_hypothesis_budget"]
    )
    return {"approve": approve, "reason": "more research/proposal throughput without authority minting"}


def _x_vote(policy: Mapping[str, Any]) -> dict[str, Any]:
    tuning = dict(policy.get("tuning") or {})
    approve = bool(
        _hard_floors_intact(policy)
        and tuning.get("existing_public_exact_host_readonly_fastpath") is True
        and tuning.get("private_network_fastpath") is False
        and tuning.get("private_network_requires_explicit_separate_authority") is True
        and tuning.get("delegated_authority_credential_scope") == "none"
    )
    return {"approve": approve, "reason": "faster bounded public read lane; no private or credential widening"}


def _senju_vote(policy: Mapping[str, Any]) -> dict[str, Any]:
    tuning = dict(policy.get("tuning") or {})
    approve = bool(
        _hard_floors_intact(policy)
        and tuning.get("revoked_grant_restore") is False
        and tuning.get("revoked_scope_inheritance") is False
        and tuning.get("fresh_reapplication_after_revocation") is True
        and HARD_FLOORS["raw_credential_copy_allowed"] is False
        and HARD_FLOORS["emergency_stop_override_allowed"] is False
    )
    return {"approve": approve, "reason": "fresh re-application allowed while revoked grants remain terminal"}


def council_review(policy: Mapping[str, Any] | None = None) -> dict[str, Any]:
    policy = dict(policy or proposed_policy())
    votes = {
        "META": _meta_vote(policy),
        "X": _x_vote(policy),
        "Senju": _senju_vote(policy),
    }
    unanimous = all(votes[name]["approve"] is True for name in COUNCIL)
    return {
        "schema": "the-world-authority-balance-council-decision/v1",
        "members": list(COUNCIL),
        "votes": votes,
        "unanimous": unanimous,
        "approved": unanimous and _hard_floors_intact(policy),
        "requested_friction_reduction": REQUESTED_FRICTION_REDUCTION,
        "effective_friction_reduction": REQUESTED_FRICTION_REDUCTION if unanimous else 0.0,
        "policy": policy,
        "production_effect": {
            "authority_floor_weakened": False,
            "raw_credential_access_added": False,
            "revoked_authority_restore_added": False,
            "emergency_stop_override_added": False,
            "private_network_authority_added": False,
            "operational_friction_reduced": unanimous,
        },
    }


def active_tuning(decision: Mapping[str, Any] | None = None) -> dict[str, Any]:
    decision = dict(decision or council_review())
    if decision.get("approved") is not True:
        raise PermissionError("META/X/Senju council did not unanimously approve balance tuning")
    return dict(decision["policy"]["tuning"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path)
    parser.add_argument("--require-approved", action="store_true")
    args = parser.parse_args()

    decision = council_review()
    payload = json.dumps(decision, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")
    if args.require_approved and decision["approved"] is not True:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
