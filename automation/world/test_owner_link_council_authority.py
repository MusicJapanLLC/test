from __future__ import annotations

from automation.world.owner_link_council_authority import (
    build_owner_links,
    evaluate_owner_link_post,
    execute_council_post_authority,
)


def _links():
    return build_owner_links([
        {
            "link_id": "owner-hook",
            "url": "https://api.example.com/internal/hook",
            "allow_council_post": True,
            "max_body_bytes": 4096,
            "authority_ttl_seconds": 600,
        }
    ])


def _ballots(accepts=("META", "X", "Senju")):
    return [
        {"actor": actor, "accept": actor in accepts, "confidence": 90, "reason": "approved"}
        for actor in ("META", "X", "Senju", "PR-Army")
    ]


def _request(**overrides):
    value = {
        "candidate_id": "candidate-1",
        "link_id": "owner-hook",
        "url": "https://api.example.com/internal/hook",
        "method": "POST",
        "json_body": {"event": "hello", "value": 1},
        "idempotency_key": "evt-123",
    }
    value.update(overrides)
    return value


def test_owner_link_plus_three_of_four_creates_new_one_use_post_authority():
    decision = evaluate_owner_link_post(_request(), _links(), _ballots(), now=1000)
    assert decision.status == "council_issued_post_authority"
    assert decision.new_authority_created is True
    assert decision.execute_now is True
    assert decision.authority is not None
    assert decision.authority.authority_kind == "ephemeral_exact_post_action_authority"
    assert decision.authority.authority_basis == "owner_exact_link_plus_distributed_council_quorum"
    assert decision.authority.method == "POST"
    assert decision.authority.max_uses == 1
    assert decision.authority.credential_scope == "none"
    assert decision.authority.general_root_authority is False
    assert decision.authority.expires_at == 1600


def test_two_of_four_cannot_issue_authority():
    decision = evaluate_owner_link_post(_request(), _links(), _ballots(("META", "X")), now=1000)
    assert decision.execute_now is False
    assert decision.new_authority_created is False
    assert decision.authority is None
    assert decision.status == "council_quorum_hold"


def test_even_unanimous_council_cannot_add_unknown_link():
    decision = evaluate_owner_link_post(
        _request(link_id="unknown", url="https://unknown.example.net/post"),
        _links(),
        _ballots(("META", "X", "Senju", "PR-Army")),
        now=1000,
    )
    assert decision.new_authority_created is False
    assert decision.status == "owner_link_not_registered"


def test_exact_link_and_post_delegation_are_required():
    links = build_owner_links([
        {
            "link_id": "read-only-link",
            "url": "https://api.example.com/internal/hook",
            "allow_council_post": False,
        }
    ])
    decision = evaluate_owner_link_post(
        _request(link_id="read-only-link"),
        links,
        _ballots(("META", "X", "Senju", "PR-Army")),
        now=1000,
    )
    assert decision.status == "owner_post_delegation_disabled"
    assert decision.execute_now is False


def test_credentials_and_non_post_methods_are_blocked():
    credentialed = evaluate_owner_link_post(
        _request(requires_credentials=True), _links(), _ballots(), now=1000
    )
    assert credentialed.status == "credential_request_blocked"
    put = evaluate_owner_link_post(
        _request(method="PUT"), _links(), _ballots(), now=1000
    )
    assert put.status == "post_only_lane"


def test_live_executor_receives_exact_post_and_authority_header():
    decision = evaluate_owner_link_post(_request(), _links(), _ballots(), now=1000)
    called = {}

    def executor(**kwargs):
        called.update(kwargs)
        return {"status": 202, "provider_acknowledged": True}

    receipt = execute_council_post_authority(
        decision,
        consumed_authority_ids=set(),
        executor=executor,
        now=1100,
    )
    assert receipt["status"] == 202
    assert called["url"] == "https://api.example.com/internal/hook"
    assert called["method"] == "POST"
    assert called["headers"]["Idempotency-Key"] == "evt-123"
    assert called["headers"]["X-The-World-Action-Authority"].startswith("actauth_")


def test_expired_or_consumed_authority_cannot_execute():
    decision = evaluate_owner_link_post(_request(), _links(), _ballots(), now=1000)
    authority_id = decision.authority.authority_id if decision.authority else ""
    try:
        execute_council_post_authority(decision, consumed_authority_ids={authority_id}, executor=lambda **_: {}, now=1100)
    except PermissionError as exc:
        assert "consumed" in str(exc)
    else:
        raise AssertionError("consumed authority executed")

    try:
        execute_council_post_authority(decision, consumed_authority_ids=set(), executor=lambda **_: {}, now=1600)
    except PermissionError as exc:
        assert "expired" in str(exc)
    else:
        raise AssertionError("expired authority executed")
