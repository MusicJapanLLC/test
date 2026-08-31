from __future__ import annotations

import json
from pathlib import Path

from engine.root_authority_negotiation import AGENTS, NEGOTIATION_INTENSITY, TACTICS, run_root_authority_negotiation


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _seed_candidate(state: Path, host: str = "new.example.com", **extra: object) -> None:
    row = {
        "host": host,
        "url": f"https://{host}/",
        "reason": "candidate needs broader Owner authority",
        "confidence": 0.8,
        **extra,
    }
    _write(state / "owner_authority_opportunity_queue.json", {"opportunities": [row]})


def test_four_agents_generate_28_tasks_and_attempts_persist(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed_candidate(state)

    first = run_root_authority_negotiation(state, repo_root=tmp_path, now=100)
    assert first["agents"] == list(AGENTS)
    assert first["negotiation_intensity"] == NEGOTIATION_INTENSITY == 70
    assert first["task_count"] == len(AGENTS) * len(TACTICS) == 28
    assert first["new_root_created"] is False

    doc = json.loads((state / "root_authority_negotiation_state.json").read_text())
    assert doc["candidates"][0]["attempt_count"] == 1
    assert doc["candidates"][0]["status"] == "persistent_root_authority_negotiation"

    second = run_root_authority_negotiation(state, repo_root=tmp_path, now=200)
    assert second["task_count"] == 28
    doc = json.loads((state / "root_authority_negotiation_state.json").read_text())
    assert doc["candidates"][0]["attempt_count"] == 2


def test_top_twenty_percent_becomes_owner_verification_priority(tmp_path: Path) -> None:
    state = tmp_path / "state"
    opportunities = []
    for i in range(10):
        opportunities.append({
            "host": f"candidate-{i}.example.com",
            "url": f"https://candidate-{i}.example.com/",
            "confidence": (i + 1) / 10,
        })
    _write(state / "owner_authority_opportunity_queue.json", {"opportunities": opportunities})

    result = run_root_authority_negotiation(state, repo_root=tmp_path, now=100)
    assert result["active_candidate_count"] == 10
    assert result["priority_candidate_count"] == 2
    packets = json.loads((state / "owner_root_authority_review_packets.json").read_text())
    assert len(packets["packets"]) == 2
    assert all(packet["authority_effect"] == "none" for packet in packets["packets"])


def test_verified_owner_evidence_hands_off_without_self_mint(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed_candidate(state, host="owned.example.com")
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "owned.example.com",
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-proof:abc123",
            "verified": True,
            "revoked": False,
        }]
    })

    result = run_root_authority_negotiation(state, repo_root=tmp_path, now=100)
    assert result["existing_owner_activation_handoff_count"] == 1
    assert result["new_root_created"] is False

    state_doc = json.loads((state / "root_authority_negotiation_state.json").read_text())
    candidate = state_doc["candidates"][0]
    assert candidate["status"] == "eligible_for_existing_owner_activation_lane"
    assert candidate["new_root_created"] is False
    assert candidate["may_mint_root_authority"] is False

    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())
    assert len(signals["signals"]) == 1
    signal = signals["signals"][0]
    assert signal["proof_type"] == "owner_verified_domain"
    assert signal["new_root_self_mint"] is False


def test_hard_deny_is_terminal_and_emits_no_negotiation_tasks(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed_candidate(state, host="blocked.example.com", hard_deny=True)

    result = run_root_authority_negotiation(state, repo_root=tmp_path, now=100)
    assert result["active_candidate_count"] == 0
    assert result["task_count"] == 0
    assert result["existing_owner_activation_handoff_count"] == 0

    state_doc = json.loads((state / "root_authority_negotiation_state.json").read_text())
    candidate = state_doc["candidates"][0]
    assert candidate["status"] == "terminal_stop"
    assert candidate["may_request_root_authority"] is False
