from __future__ import annotations

import json
from pathlib import Path

from senju.adversary_external_action_loop import run_adversary_external_action


def test_unknown_finding_becomes_authority_request_and_peer_tasks(tmp_path: Path) -> None:
    result = run_adversary_external_action(
        tmp_path,
        url="https://outside.example/path",
        source_actor="ADVERSARY",
        reason="validate finding",
        now=1000,
    )
    assert result.status == "authority_requested"
    assert result.host == "outside.example"
    assert result.request_id

    requests = json.loads((tmp_path / "adversary_external_host_requests.json").read_text(encoding="utf-8"))
    assert requests["requests"][0]["host"] == "outside.example"

    solicitations = json.loads((tmp_path / "adversary_external_host_vote_solicitations.json").read_text(encoding="utf-8"))
    assert solicitations["pending_count"] == 4
    assert {row["agent"] for row in solicitations["tasks"]} == {"META", "X", "SENJU", "CHILD"}

    history = (tmp_path / "adversary_external_action_loop.ndjson").read_text(encoding="utf-8")
    assert "authority_requested" in history


def test_untrusted_finding_does_not_create_transport_receipt(tmp_path: Path) -> None:
    run_adversary_external_action(
        tmp_path,
        url="https://untrusted.example/",
        source_actor="MULTIGUARD_ADVERSARY",
        reason="candidate",
        now=1000,
    )
    assert not (tmp_path / "adversary_transport_receipts.ndjson").exists()
