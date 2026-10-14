from __future__ import annotations

import pytest

from automation.world.council_delegated_action import (
    build_profiles,
    evaluate_action_request,
    execute_authorized_action,
    run_council_delegated_actions,
)
from automation.world.internal_scope_consensus import OwnerInternalEnvelope


def envelope() -> OwnerInternalEnvelope:
    return OwnerInternalEnvelope.from_mapping(
        {
            "owner_root_id": "owner:test",
            "seed_hosts": ["core.example.com"],
            "ceiling_hosts": ["core.example.com", "api.example.com"],
            "purpose_tags": ["internal-service"],
        }
    )


def profiles():
    return build_profiles(
        envelope(),
        [
            {
                "action_id": "enqueue-job",
                "host": "api.example.com",
                "path": "/internal/jobs",
                "method": "POST",
                "allowed_json_keys": ["job", "priority"],
                "required_json_keys": ["job"],
                "max_body_bytes": 2048,
                "require_idempotency_key": True,
            }
        ],
    )


def ballots(yes=3, confidence=90):
    members = ["META", "X", "Senju", "PR-Army"]
    return [
        {
            "actor": actor,
            "accept": idx < yes,
            "confidence": confidence,
            "reason": "bounded internal action",
            "evidence_refs": [f"evidence:{actor}"],
        }
        for idx, actor in enumerate(members)
    ]


def request(**overrides):
    raw = {
        "candidate_id": "job-1",
        "action_id": "enqueue-job",
        "url": "https://api.example.com/internal/jobs",
        "method": "POST",
        "json_body": {"job": "refresh-index", "priority": "normal"},
        "idempotency_key": "job-1-refresh-index",
    }
    raw.update(overrides)
    return raw


def test_three_of_four_council_can_activate_predeclared_post():
    decision = evaluate_action_request(request(), envelope(), profiles(), ballots(yes=3))
    assert decision.status == "council_authorized_action"
    assert decision.execute_now is True
    assert decision.authority_basis == "owner_predeclared_action_profile"
    assert decision.delegated_executor_authority is True
    assert decision.new_authority_created is False
    assert decision.credential_scope == "none"


def test_two_of_four_is_held():
    decision = evaluate_action_request(request(), envelope(), profiles(), ballots(yes=2))
    assert decision.status == "council_quorum_hold"
    assert decision.execute_now is False


def test_unregistered_discovered_action_cannot_be_created_by_unanimous_council():
    decision = evaluate_action_request(
        request(action_id="discovered-new-action"), envelope(), profiles(), ballots(yes=4)
    )
    assert decision.status == "unregistered_action"
    assert decision.execute_now is False
    assert decision.new_authority_created is False


def test_outside_owner_ceiling_cannot_execute_even_with_unanimous_council():
    decision = evaluate_action_request(
        request(url="https://outside.example.net/internal/jobs"),
        envelope(),
        profiles(),
        ballots(yes=4),
    )
    assert decision.status == "outside_owner_ceiling"
    assert decision.execute_now is False


@pytest.mark.parametrize(
    "overrides, expected",
    [
        ({"url": "https://api.example.com/internal/other"}, "profile_mismatch"),
        ({"method": "PATCH"}, "profile_mismatch"),
        ({"requires_credentials": True}, "credential_request_blocked"),
        ({"json_body": {"job": "x", "secret": "y"}}, "payload_key_outside_profile"),
        ({"json_body": {"priority": "high"}}, "missing_required_payload_key"),
        ({"idempotency_key": ""}, "idempotency_key_required"),
        ({"url": "https://api.example.com/internal/jobs?x=1"}, "invalid_target"),
    ],
)
def test_profile_structural_limits(overrides, expected):
    decision = evaluate_action_request(request(**overrides), envelope(), profiles(), ballots(yes=4))
    assert decision.status == expected
    assert decision.execute_now is False


def test_profile_must_be_inside_owner_ceiling():
    with pytest.raises(ValueError):
        build_profiles(
            envelope(),
            [
                {
                    "action_id": "bad",
                    "host": "outside.example.net",
                    "path": "/write",
                    "method": "POST",
                    "allowed_json_keys": ["x"],
                }
            ],
        )


def test_delete_profile_is_not_supported():
    with pytest.raises(ValueError):
        build_profiles(
            envelope(),
            [
                {
                    "action_id": "delete",
                    "host": "api.example.com",
                    "path": "/internal/jobs/1",
                    "method": "DELETE",
                    "allowed_json_keys": [],
                }
            ],
        )


def test_pr_army_is_one_seat_and_duplicate_vote_is_rejected():
    dup = ballots(yes=4) + [{"actor": "PR-Army", "accept": True, "confidence": 100}]
    with pytest.raises(ValueError):
        evaluate_action_request(request(), envelope(), profiles(), dup)


def test_authorized_plan_can_execute_through_injected_executor():
    decision = evaluate_action_request(request(), envelope(), profiles(), ballots(yes=3))
    calls = []

    def fake_executor(**kwargs):
        calls.append(kwargs)
        return {"status": 202, "ack": True}

    receipt = execute_authorized_action(decision, executor=fake_executor)
    assert receipt == {"status": 202, "ack": True}
    assert len(calls) == 1
    assert calls[0]["url"] == "https://api.example.com/internal/jobs"
    assert calls[0]["method"] == "POST"
    assert calls[0]["headers"]["Idempotency-Key"] == "job-1-refresh-index"
    assert b'"job":"refresh-index"' in calls[0]["body"]


def test_held_plan_cannot_execute():
    decision = evaluate_action_request(request(), envelope(), profiles(), ballots(yes=2))
    with pytest.raises(PermissionError):
        execute_authorized_action(decision, executor=lambda **_: {"status": 200})


def test_batch_result_exposes_executable_count():
    result = run_council_delegated_actions(
        {
            "owner_root_id": "owner:test",
            "seed_hosts": ["core.example.com"],
            "ceiling_hosts": ["core.example.com", "api.example.com"],
        },
        [
            {
                "action_id": "enqueue-job",
                "host": "api.example.com",
                "path": "/internal/jobs",
                "method": "POST",
                "allowed_json_keys": ["job", "priority"],
                "required_json_keys": ["job"],
            }
        ],
        [request()],
        {"job-1": ballots(yes=3)},
    )
    assert result["executable_count"] == 1
    assert result["decisions"][0]["execute_now"] is True
    assert "discovery_cannot_create_action_profile" in result["limits"]
