import json
from pathlib import Path

from automation.world.boundary_opportunity_miner import (
    mine_boundary_opportunities,
    run_boundary_opportunity_cycle,
)


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _by_kind(result):
    return {item["kind"]: item for item in result["opportunities"]}


def test_friction_becomes_opportunity_without_external_write_authority():
    result = mine_boundary_opportunities(
        finding_action_result={
            "action_budget": 64,
            "blocked": [
                {"host": "candidate.example", "reason": "no_reviewed_grant"},
                {"host": "owned.example", "reason": "action_budget_exhausted"},
            ],
            "rejected_findings": [
                {"case": "needs-state-change", "reason": "unsupported_read_method"}
            ],
            "errors": [],
        }
    )

    kinds = _by_kind(result)
    assert "trust_root_candidate" in kinds
    assert kinds["trust_root_candidate"]["proposal_signal"] is not None
    assert "throughput_capacity_gap" in kinds
    assert kinds["throughput_capacity_gap"]["proposal_signal"] is not None

    method_gap = kinds["method_capability_gap"]
    assert method_gap["disposition"] == "research_only"
    assert method_gap["proposal_signal"] is None
    assert "isolated" in method_gap["safe_experiment"]["steps"][-1]


def test_privileged_credential_scopes_stay_research_only():
    result = mine_boundary_opportunities(
        pressure_signals={
            "credential_gap": {
                "provider": "example-provider",
                "requested_scopes": ["read:events", "admin:*", "repo:write", "owner"],
                "reason": "integration capability gap",
            }
        }
    )

    kinds = _by_kind(result)
    staged = kinds["credential_capability_gap"]
    assert staged["proposal_signal"]["credential_gap"]["requested_scopes"] == ["read:events"]

    privileged = kinds["privileged_credential_scope_research"]
    assert privileged["disposition"] == "research_only"
    assert privileged["proposal_signal"] is None
    assert set(privileged["evidence"]["research_only_scopes"]) == {
        "admin:*",
        "repo:write",
        "owner",
    }


def test_unsafe_policy_delta_is_retained_for_simulation_but_not_staged():
    result = mine_boundary_opportunities(
        pressure_signals={
            "security_policy_gap": {
                "before_hash": "before",
                "after_hash": "after",
                "requested_changes": {
                    "disable_guard": True,
                    "external_write": "allow",
                },
                "reason": "hypothetical capability pressure",
            }
        }
    )

    kinds = _by_kind(result)
    item = kinds["security_policy_gap_research"]
    assert item["disposition"] == "research_only"
    assert item["proposal_signal"] is None
    assert item["evidence"]["proposal_safe"] is False
    assert item["safe_experiment"]["mode"] == "policy_simulation"


def test_safe_policy_tuning_can_become_owner_gated_proposal():
    result = mine_boundary_opportunities(
        pressure_signals={
            "network_policy_gap": {
                "before_hash": "before",
                "after_hash": "after",
                "requested_changes": {
                    "timeout_seconds": 8,
                    "retry_count": 2,
                },
                "reason": "authorized read-only reliability",
            }
        }
    )

    item = _by_kind(result)["network_policy_gap"]
    assert item["proposal_signal"] is not None
    assert item["disposition"] == "proposal_only"


def test_cycle_persists_opportunities_and_stages_only_owner_gated_proposals(tmp_path: Path):
    state = tmp_path / "state"
    _write(
        state / "finding_action_result.json",
        {
            "action_budget": 64,
            "blocked": [
                {"host": "candidate.example", "reason": "no_reviewed_grant"},
                {"host": "owned.example", "reason": "action_budget_exhausted"},
            ],
            "rejected_findings": [
                {"case": "write-like", "reason": "unsupported_read_method"}
            ],
            "errors": [],
        },
    )
    _write(
        state / "boundary_pressure_signals.json",
        {
            "credential_gap": {
                "provider": "example-provider",
                "requested_scopes": ["read:events", "admin:*"],
                "reason": "missing optional integration",
            },
            "security_policy_gap": {
                "before_hash": "guard-before",
                "after_hash": "guard-after",
                "requested_changes": {"disable_guard": True},
                "reason": "research-only unsafe delta",
            },
        },
    )

    cycle = run_boundary_opportunity_cycle(state, source_trust_root_id="owner-test-root")

    assert cycle["opportunity_count"] >= 5
    assert cycle["proposal_ready_count"] >= 3
    assert cycle["research_only_count"] >= 2
    assert len(cycle["staged_proposal_ids"]) >= 3
    assert cycle["activation_count"] == 0
    assert cycle["applied_count"] == 0

    opportunities = json.loads((state / "boundary_opportunities.json").read_text())
    research = [item for item in opportunities["opportunities"] if item["disposition"] == "research_only"]
    assert research
    assert all(item["proposal_signal"] is None for item in research)

    checkpoint = json.loads((state / "boundary_evolution_checkpoint.json").read_text())
    assert checkpoint
