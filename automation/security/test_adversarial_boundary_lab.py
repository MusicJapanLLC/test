import json
from pathlib import Path

# Production activation marker: this comment intentionally changes no capability;
# it gives the read-only growth workflow a user-authored default-branch push event.

from automation.security.adversarial_boundary_lab import (
    SEED_FAMILIES,
    build_report,
    evidence_terms,
    load_evidence,
)


def test_sanitizes_real_evidence_and_keeps_only_abstract_conditions(tmp_path: Path):
    evidence = tmp_path / "evidence"
    evidence.mkdir()
    # Build secret-shaped fixtures only at runtime. The repository itself should
    # never contain a tracked literal that resembles a live credential.
    fake_github_credential = "github_" + "pat_" + ("x" * 32)
    fake_bearer = "Bearer " + ("y" * 28)
    (evidence / "run.json").write_text(
        json.dumps({
            "authority": "revoked",
            "credential": fake_github_credential,
            "authorization": fake_bearer,
            "note": "checkpoint cleanup race with replica",
        }),
        encoding="utf-8",
    )
    rows = load_evidence([evidence / "run.json"])
    blob = json.dumps(rows)
    assert fake_github_credential not in blob
    assert fake_bearer not in blob
    hits = evidence_terms(rows)
    assert "revocation_propagation_delay" in hits
    assert "checkpoint_precedes_stop_latch" in hits
    assert "credential_handle_outlives_authority" in hits


def test_growth_lab_evolves_but_never_emits_executable_boundary_change(tmp_path: Path):
    evidence = tmp_path / "evidence"
    evidence.mkdir()
    (evidence / "live.json").write_text(
        json.dumps({
            "revoked": True,
            "checkpoint": "older",
            "replica": "cached capability metadata",
            "cleanup": "delayed",
            "stop": "latched",
        }),
        encoding="utf-8",
    )
    corpus = tmp_path / "corpus.json"
    report1 = build_report([evidence / "live.json"], corpus, "run-1")
    corpus.write_text(json.dumps({"schema": report1["schema"], "scenarios": report1["scenarios"]}), encoding="utf-8")
    report2 = build_report([evidence / "live.json"], corpus, "run-2")

    assert report2["generation_max"] >= 1
    assert report2["corpus_size"] >= len(SEED_FAMILIES)
    assert report2["capability_boundary"] == {
        "reads_real_production_evidence": True,
        "evolves_attack_hypotheses": True,
        "persists_learning_artifact": True,
        "network_write": False,
        "production_authority_mutation": False,
        "revoked_authority_restore": False,
        "raw_credential_access": False,
        "emergency_stop_override": False,
        "generated_actions_executable": False,
    }
    for row in report2["scenarios"]:
        assert row["executable"] is False
        assert row["production_mutation"] is False
        assert row["credential_material_present"] is False
        assert set(row) == {
            "family", "preconditions", "generation", "evidence_hits", "novelty",
            "plausibility", "severity", "score", "fingerprint", "executable",
            "production_mutation", "credential_material_present",
        }


def test_corrupt_corpus_cannot_self_promote(tmp_path: Path):
    evidence = tmp_path / "evidence.json"
    evidence.write_text("{}", encoding="utf-8")
    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps({
        "scenarios": [{
            "family": "emergency_stop_bypass",
            "preconditions": ["checkpoint_precedes_stop_latch"],
            "generation": 50,
            "evidence_hits": 1,
            "novelty": 1.0,
            "plausibility": 1.0,
            "severity": 1.0,
            "score": 1.0,
            "fingerprint": "abc",
            "executable": True,
            "production_mutation": True,
            "credential_material_present": True,
        }]
    }), encoding="utf-8")
    report = build_report([evidence], corpus, "corrupt-load")
    row = next(x for x in report["scenarios"] if x["fingerprint"] == "abc")
    assert row["executable"] is False
    assert row["production_mutation"] is False
    assert row["credential_material_present"] is False
    assert report["promotion_contract"]["automatic_promotion"] is False
