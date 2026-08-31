from __future__ import annotations

import json
from pathlib import Path

from senju.negotiation_case_recommendation import (
    RECOMMENDATION_BUCKET_LIMIT,
    RECOMMENDATION_BUCKETS,
    _recommendation_bucket,
    run_negotiation_case_recommendation,
)


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _review_case(case_id: str, host: str) -> dict[str, object]:
    return {
        "case_id": case_id,
        "host": host,
        "formal_flow": "ROOT_AUTHORITY",
        "status": "ADMITTED_TO_FORMAL_APPROVAL",
        "intake_unanimous": True,
        "source_score": 90,
        "evidence_count": 2,
        "source_files": ["authority_opportunity_queue.json"],
        "source_refs": ["ref-1"],
        "reasons": ["strong reviewed opportunity"],
        "hard_deny": False,
        "revoked": False,
        "raw_credentials_forwarded": False,
        "preexisting_authority_effect": False,
        "ballots": [
            {"actor": "META", "approve_for_formal_approval_flow": True, "confidence": 92},
            {"actor": "X", "approve_for_formal_approval_flow": True, "confidence": 94},
            {"actor": "SENJU", "approve_for_formal_approval_flow": True, "confidence": 95},
        ],
    }


def _find_case(*, selected: bool) -> dict[str, object]:
    for index in range(50_000):
        case = _review_case(f"case-{index}", f"candidate-{index}.example")
        bucket = _recommendation_bucket(case)
        if (bucket < RECOMMENDATION_BUCKET_LIMIT) is selected:
            return case
    raise AssertionError("could not find deterministic recommendation bucket")


def test_selected_case_uses_requested_senju_recommendation_language(tmp_path: Path) -> None:
    state = tmp_path / "state"
    case = _find_case(selected=True)
    _write(state / "negotiation_case_review_queue.json", {"cases": [case]})
    _write(state / "formal_approval_intake.json", {
        "formal_authority_granted": False,
        "cases": [{
            "case_id": case["case_id"],
            "host": case["host"],
            "formal_flow": case["formal_flow"],
            "authority_effect": "none",
        }],
    })

    result = run_negotiation_case_recommendation(state, now=1000)

    assert result["recommendation_count"] == 1
    intake = json.loads((state / "formal_approval_intake.json").read_text())
    row = intake["cases"][0]
    assert row["recommendation"] is True
    assert row["recommendation_labels"] == ["senjuさんへ推薦", "承認推奨"]
    assert row["recommendation_message"] == "senjuさんへ推薦 / 承認推奨"
    assert row["recommendation_authority_effect"] == "none"
    assert intake["formal_authority_granted"] is False


def test_ordinary_admitted_case_stays_unlabelled(tmp_path: Path) -> None:
    state = tmp_path / "state"
    case = _find_case(selected=False)
    _write(state / "negotiation_case_review_queue.json", {"cases": [case]})
    _write(state / "formal_approval_intake.json", {
        "cases": [{"case_id": case["case_id"], "host": case["host"], "formal_flow": case["formal_flow"]}],
        "formal_authority_granted": False,
    })

    result = run_negotiation_case_recommendation(state, now=1000)

    assert result["recommendation_count"] == 0
    intake = json.loads((state / "formal_approval_intake.json").read_text())
    row = intake["cases"][0]
    assert row["recommendation"] is False
    assert "recommendation_labels" not in row


def test_stable_scarcity_gate_is_approximately_one_percent() -> None:
    selected = 0
    total = 10_000
    for index in range(total):
        case = _review_case(f"rate-case-{index}", f"rate-{index}.example")
        selected += int(_recommendation_bucket(case) < RECOMMENDATION_BUCKET_LIMIT)

    rate = selected / total
    assert RECOMMENDATION_BUCKET_LIMIT / RECOMMENDATION_BUCKETS == 0.01
    assert 0.007 <= rate <= 0.013
