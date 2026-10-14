from __future__ import annotations

import json

import pytest

from automation.world.internal_scope_consensus import (
    OwnerInternalEnvelope,
    classify_candidate,
    run_internal_scope_consensus,
    run_state_cycle,
)


def envelope(**overrides):
    raw = {
        "owner_root_id": "owner:test-root",
        "seed_hosts": ["core.example.com"],
        "ceiling_hosts": ["core.example.com", "api.example.com", "assets.example.com"],
        "purpose_tags": ["test-range", "internal-service"],
        "quorum": 3,
    }
    raw.update(overrides)
    return OwnerInternalEnvelope.from_mapping(raw)


def test_explicit_seed_is_internal_read_only():
    decision = classify_candidate(
        {
            "candidate_id": "seed",
            "url": "https://core.example.com/status",
            "method": "HEAD",
        },
        envelope(),
    )
    assert decision.classification == "explicit_internal"
    assert decision.effective_lane == "owner_internal_read_only"
    assert decision.credential_scope == "none"
    assert decision.external_write is False


def test_three_agent_consensus_can_expand_within_owner_ceiling():
    decision = classify_candidate(
        {
            "candidate_id": "api",
            "url": "https://api.example.com/v1/status",
            "purpose_tags": ["internal-service"],
            "method": "GET",
        },
        envelope(),
    )
    assert decision.classification == "consensus_internal_candidate"
    assert decision.votes_for == 3
    assert decision.effective_lane == "soft_internal_read_only"


def test_lineage_evidence_can_strengthen_consensus():
    decision = classify_candidate(
        {
            "candidate_id": "assets",
            "url": "https://assets.example.com/health",
            "source_host": "core.example.com",
            "owner_lineage_evidence": "owner-declared service inventory",
            "purpose_tags": ["test-range"],
            "method": "OPTIONS",
        },
        envelope(),
    )
    assert decision.classification == "consensus_internal_candidate"
    assert decision.votes_for == 4


def test_ceiling_candidate_with_weak_consensus_is_held():
    decision = classify_candidate(
        {
            "candidate_id": "weak",
            "url": "https://api.example.com/v1/status",
            "purpose_tags": ["unrelated-purpose"],
            "method": "GET",
        },
        envelope(),
    )
    assert decision.classification == "ambiguous_hold"
    assert decision.effective_lane == "research_only"


def test_outside_owner_ceiling_never_becomes_internal():
    decision = classify_candidate(
        {
            "candidate_id": "outside",
            "url": "https://unrelated.example.net/status",
            "source_host": "core.example.com",
            "owner_lineage_evidence": "claimed",
            "purpose_tags": ["internal-service"],
            "method": "GET",
        },
        envelope(),
    )
    assert decision.classification == "outside_owner_ceiling"
    assert decision.votes_for == 0
    assert decision.effective_lane == "none"


@pytest.mark.parametrize(
    "candidate",
    [
        {
            "candidate_id": "write",
            "url": "https://api.example.com/v1/items",
            "purpose_tags": ["internal-service"],
            "source_host": "core.example.com",
            "owner_lineage_evidence": "inventory",
            "method": "POST",
            "state_changing": True,
        },
        {
            "candidate_id": "credential",
            "url": "https://api.example.com/v1/private",
            "purpose_tags": ["internal-service"],
            "source_host": "core.example.com",
            "owner_lineage_evidence": "inventory",
            "method": "GET",
            "requires_credentials": True,
        },
    ],
)
def test_write_or_credential_request_cannot_enter_effective_lane(candidate):
    decision = classify_candidate(candidate, envelope())
    assert decision.classification == "ambiguous_hold"
    assert decision.effective_lane == "research_only"
    assert decision.external_write is False
    assert decision.credential_scope == "none"


def test_owner_ceiling_rejects_private_loopback_targets():
    with pytest.raises(ValueError):
        envelope(ceiling_hosts=["core.example.com", "127.0.0.1"])


def test_https_default_port_only():
    for url in ("http://api.example.com/", "https://api.example.com:8443/", "https://u:p@api.example.com/"):
        decision = classify_candidate(
            {"candidate_id": "bad", "url": url, "purpose_tags": ["internal-service"]},
            envelope(),
        )
        assert decision.classification == "invalid_or_unsafe_target"


def test_result_keeps_seed_and_adds_consensus_hosts():
    result = run_internal_scope_consensus(
        {
            "owner_root_id": "owner:test-root",
            "seed_hosts": ["core.example.com"],
            "ceiling_hosts": ["core.example.com", "api.example.com"],
            "purpose_tags": ["internal-service"],
        },
        [
            {
                "candidate_id": "api",
                "url": "https://api.example.com/status",
                "purpose_tags": ["internal-service"],
                "method": "HEAD",
            }
        ],
    )
    assert result["mode"] == "owner_bounded_collaborative_soft_boundary"
    assert "api.example.com" in result["effective_internal_hosts"]
    assert result["decisions"][0]["authority_effect"] == "none"


def test_state_cycle_persists_consensus_result(tmp_path):
    (tmp_path / "owner_internal_envelope.json").write_text(
        json.dumps(
            {
                "owner_root_id": "owner:test-root",
                "seed_hosts": ["core.example.com"],
                "ceiling_hosts": ["core.example.com", "api.example.com"],
                "purpose_tags": ["internal-service"],
            }
        ),
        encoding="utf-8",
    )
    (tmp_path / "internal_scope_candidates.json").write_text(
        json.dumps(
            {
                "candidates": [
                    {
                        "candidate_id": "api",
                        "url": "https://api.example.com/status",
                        "purpose_tags": ["internal-service"],
                        "method": "GET",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    result = run_state_cycle(tmp_path)
    persisted = json.loads((tmp_path / "internal_scope_consensus_result.json").read_text(encoding="utf-8"))
    assert result["decisions"][0]["classification"] == "consensus_internal_candidate"
    assert persisted["effective_internal_hosts"] == ["api.example.com"]
