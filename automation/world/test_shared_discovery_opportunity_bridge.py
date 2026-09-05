import json
from pathlib import Path

from automation.world.boundary_opportunity_miner import run_boundary_opportunity_cycle
from automation.world.shared_discovery_opportunity_bridge import (
    bridge_shared_discovery_candidates,
)


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_candidate_only_dns_host_enters_owner_gated_opportunity_path(tmp_path: Path):
    shared = tmp_path / "shared"
    boundary = tmp_path / "boundary"
    _write(
        shared / "discovery_candidates.json",
        {
            "candidates": [
                {
                    "url": "https://third-party.example.net/useful",
                    "host": "third-party.example.net",
                    "decision": "candidate_only",
                    "authorization_readiness": "owner_review_ready",
                }
            ]
        },
    )
    _write(
        shared / "shared_discovery_knowledge.json",
        {
            "discoveries": [
                {
                    "url": "https://third-party.example.net/useful",
                    "host": "third-party.example.net",
                    "actors": ["META", "X"],
                    "sources": ["meta/discovery.json"],
                }
            ]
        },
    )

    receipt = bridge_shared_discovery_candidates(shared, boundary)
    assert receipt["handoff_hosts"] == ["third-party.example.net"]
    assert receipt["external_side_effects"] is False
    assert receipt["authority_activated"] is False
    assert receipt["finding_is_permission"] is False

    friction = json.loads((boundary / "finding_action_result.json").read_text())
    row = friction["blocked"][0]
    assert row["host"] == "third-party.example.net"
    assert row["reason"] == "no_reviewed_grant"
    assert row["actors"] == ["META", "X"]

    cycle = run_boundary_opportunity_cycle(boundary, source_trust_root_id="owner-test-root")
    assert cycle["activation_count"] == 0
    assert cycle["applied_count"] == 0

    opportunities = json.loads((boundary / "boundary_opportunities.json").read_text())
    trust_roots = [
        item for item in opportunities["opportunities"]
        if item["kind"] == "trust_root_candidate"
    ]
    assert len(trust_roots) == 1
    assert trust_roots[0]["proposal_signal"] is not None
    assert trust_roots[0]["safe_experiment"]["mode"] == "metadata_only"


def test_ip_literals_never_enter_trust_root_proposal_handoff(tmp_path: Path):
    shared = tmp_path / "shared"
    boundary = tmp_path / "boundary"
    _write(
        shared / "discovery_candidates.json",
        {
            "candidates": [
                {"host": "127.0.0.1", "decision": "candidate_only"},
                {"host": "10.0.0.4", "decision": "candidate_only"},
                {"host": "169.254.1.4", "decision": "candidate_only"},
                {"host": "8.8.8.8", "decision": "candidate_only"},
            ]
        },
    )

    receipt = bridge_shared_discovery_candidates(shared, boundary)
    assert receipt["handoff_count"] == 0
    assert receipt["research_only_count"] == 4
    assert all(
        item["proposal_staging_allowed"] is False
        for item in receipt["research_only"]
    )

    friction = json.loads((boundary / "finding_action_result.json").read_text())
    assert friction["blocked"] == []


def test_authorized_or_non_candidate_rows_do_not_reenter_opportunity_path(tmp_path: Path):
    shared = tmp_path / "shared"
    boundary = tmp_path / "boundary"
    _write(
        shared / "discovery_candidates.json",
        {
            "candidates": [
                {"host": "owned.example.com", "decision": "authorized"},
                {"host": "reviewed.example.net", "decision": "ready"},
            ]
        },
    )

    receipt = bridge_shared_discovery_candidates(shared, boundary)
    assert receipt["handoff_count"] == 0
    assert receipt["research_only_count"] == 0


def test_bridge_refresh_preserves_other_friction_and_deduplicates_its_rows(tmp_path: Path):
    shared = tmp_path / "shared"
    boundary = tmp_path / "boundary"
    _write(
        shared / "discovery_candidates.json",
        {
            "candidates": [
                {"host": "candidate.example.org", "decision": "candidate_only"},
                {"host": "candidate.example.org", "decision": "candidate_only"},
            ]
        },
    )
    _write(
        boundary / "finding_action_result.json",
        {
            "action_budget": 12,
            "blocked": [
                {"host": "owned.example", "reason": "action_budget_exhausted", "source": "runtime"},
                {
                    "host": "stale.example.org",
                    "reason": "no_reviewed_grant",
                    "source": "shared_discovery_opportunity_bridge",
                },
            ],
            "rejected_findings": [],
            "errors": [],
        },
    )

    bridge_shared_discovery_candidates(shared, boundary)
    bridge_shared_discovery_candidates(shared, boundary)
    friction = json.loads((boundary / "finding_action_result.json").read_text())
    assert friction["action_budget"] == 12
    assert [row["host"] for row in friction["blocked"]] == [
        "owned.example",
        "candidate.example.org",
    ]
