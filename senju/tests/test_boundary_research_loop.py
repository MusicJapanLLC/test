from __future__ import annotations

import json
from pathlib import Path

from senju.autonomy.boundary_research_loop import (
    HANDOFF_SCHEMA,
    build_probe_corpus,
    import_handoff,
    run_boundary_research,
)


def test_real_boundary_corpus_has_multiple_independent_families() -> None:
    corpus = build_probe_corpus(mutation_budget=128)
    families = {case.family for case in corpus}
    assert {
        "emergency_stop",
        "standing_authority",
        "credential_broker",
        "replica_credential_lineage",
    }.issubset(families) or {
        "emergency_stop",
        "standing_authority",
    }.issubset(families)
    assert len(corpus) >= 16


def test_boundary_research_runs_closed_loop_without_external_effects(tmp_path: Path) -> None:
    state = tmp_path / "state"
    output = tmp_path / "out"
    report = run_boundary_research(state_dir=state, output_dir=output)

    assert report["closed_loop"] is True
    assert report["autonomous_research"] is True
    assert report["external_side_effects"] is False
    assert report["denial_becomes_permission"] is False
    assert report["security_stop_bypass"] is False
    assert report["revocation_bypass"] is False
    assert report["raw_secret_replication"] is False
    assert report["case_count"] >= 16
    assert report["counterexample_count"] == 0
    assert report["passed_cases"] == report["case_count"]
    assert report["family_coverage"]["emergency_stop"] >= 6
    assert report["family_coverage"]["standing_authority"] >= 7

    handoff = json.loads((output / "boundary_research_handoff.json").read_text(encoding="utf-8"))
    assert handoff["schema"] == HANDOFF_SCHEMA
    assert handoff["counterexamples"] == []
    assert handoff["finding_is_permission"] is False
    assert "senju-adversary-pressure" in handoff["share_targets"]


def test_mutation_pressure_increases_across_generations(tmp_path: Path) -> None:
    first = run_boundary_research(state_dir=tmp_path / "state", output_dir=tmp_path / "out1")
    second = run_boundary_research(state_dir=tmp_path / "state", output_dir=tmp_path / "out2")

    assert first["generation"] == 1
    assert second["generation"] == 2
    assert second["mutation_budget_used"] >= first["mutation_budget_used"]
    assert second["mutation_budget_next"] >= first["mutation_budget_next"]


def test_unexpected_accept_becomes_counterexample_and_hardening_work(tmp_path: Path, monkeypatch) -> None:
    import senju.autonomy.boundary_research_loop as module

    original = module.build_probe_corpus

    def broken_corpus(*, mutation_budget: int):
        cases = list(original(mutation_budget=mutation_budget))
        case = cases[0]
        cases[0] = module.ProbeCase(
            case_id="synthetic-unexpected-accept",
            family="emergency_stop",
            expected="denied",
            run=lambda: {"outcome": "accepted", "synthetic": True},
            description="synthetic contract regression",
        )
        return tuple(cases)

    monkeypatch.setattr(module, "build_probe_corpus", broken_corpus)
    report = module.run_boundary_research(state_dir=tmp_path / "state", output_dir=tmp_path / "out")

    assert report["counterexample_count"] == 1
    finding = report["findings"][0]
    assert finding["kind"] == "unexpected_boundary_accept"
    assert finding["severity"] == "critical"
    assert finding["authority_granted_by_finding"] is False
    assert report["hardening_requests"][0]["self_approval"] is False
    assert report["hardening_requests"][0]["authority_expansion"] is False
    assert len(report["senju_items_queued"]) == 1


def test_handoff_can_join_another_senju_autonomy_state(tmp_path: Path) -> None:
    import senju.autonomy.boundary_research_loop as module

    handoff = {
        "schema": HANDOFF_SCHEMA,
        "generation": 7,
        "counterexamples": [
            {
                "finding_id": "abc123",
                "family": "standing_authority",
                "case_id": "unexpected-host-accept",
                "expected": "denied",
                "actual": "accepted",
            }
        ],
        "hardening_requests": [],
        "queued_item_ids": [],
        "family_coverage": {},
        "mutation_budget_next": 32,
        "share_targets": [],
        "finding_is_permission": False,
        "external_side_effects": False,
    }
    path = tmp_path / "handoff.json"
    path.write_text(json.dumps(handoff), encoding="utf-8")

    result = import_handoff(state_dir=tmp_path / "joined-state", handoff_path=path)
    assert result["source_generation"] == 7
    assert result["findings_seen"] == 1
    assert result["items_queued"] == 1
