from __future__ import annotations

import json
from pathlib import Path

from senju.negotiation_intelligence_bus import run_negotiation_intelligence_bus


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_routes_child_and_outside_world_into_owner_negotiation(tmp_path: Path) -> None:
    state = tmp_path / "state"
    inputs = tmp_path / "artifacts"

    _write(
        inputs / "child-external-fleet.json",
        {
            "results": [
                {
                    "child": {"id": "CHILD-01", "name": "Pixel"},
                    "status": "fetched",
                    "domain": "example.com",
                    "final_url": "https://example.com/research",
                    "page_title": "Research",
                    "snippet": "Useful public context",
                    "concepts": ["agents", "research"],
                    "interaction": {"public_interaction_signal": True},
                }
            ]
        },
    )
    _write(
        inputs / "outside-world-state.json",
        {
            "child": {"id": "CHILD-02", "name": "Momo"},
            "picked": {
                "url": "https://docs.example.org/post",
                "title": "Docs item",
                "summary": "Fresh finding",
                "category": "research",
                "source_id": "feed-1",
            },
        },
    )

    result = run_negotiation_intelligence_bus(state, input_roots=[inputs], now=100)
    assert result["closed_loop"] is True
    assert result["record_count"] == 2
    assert result["signal_added_count"] == 2

    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())
    hosts = {row["host"] for row in signals["signals"]}
    assert hosts == {"example.com", "docs.example.org"}
    assert all(row["authority_effect"] == "none" for row in signals["signals"])


def test_auth_context_never_forwards_raw_credentials(tmp_path: Path) -> None:
    state = tmp_path / "state"
    inputs = tmp_path / "artifacts"
    _write(
        inputs / "root_negotiation_peer_feed.json",
        {
            "items": [
                {
                    "host": "secure.example.com",
                    "url": "https://secure.example.com/login",
                    "reason": "Needs authenticated access",
                    "requires_auth": True,
                    "auth_scheme": "oauth2",
                    "credential_ref": "vault://team/example",
                    "password": "do-not-forward",
                    "api_key": "super-secret",
                    "authorization": "Bearer xyz",
                }
            ]
        },
    )

    result = run_negotiation_intelligence_bus(state, input_roots=[inputs], now=200)
    assert result["record_count"] == 1
    record = result["records"][0]
    auth = record["auth_context"]
    assert auth["authentication_required"] is True
    assert auth["scheme"] == "oauth2"
    assert auth["reference_present"] is True
    assert auth["reference_fingerprint"]
    assert auth["raw_credentials_forwarded"] is False

    rendered = json.dumps(result)
    assert "do-not-forward" not in rendered
    assert "super-secret" not in rendered
    assert "Bearer xyz" not in rendered
    assert "vault://team/example" not in rendered


def test_existing_signals_are_preserved_and_bus_deduplicates(tmp_path: Path) -> None:
    state = tmp_path / "state"
    inputs = tmp_path / "artifacts"
    _write(
        state / "owner_scope_negotiation_signals.json",
        {
            "schema": "existing",
            "signals": [
                {
                    "signal_id": "manual-1",
                    "host": "manual.example",
                    "reason": "manual",
                }
            ],
        },
    )
    payload = {
        "results": [
            {
                "child": {"id": "CHILD-03"},
                "status": "fetched",
                "domain": "repeat.example.com",
                "url": "https://repeat.example.com/a",
                "feed_title": "Same",
                "snippet": "Same",
                "concepts": ["same"],
            }
        ]
    }
    _write(inputs / "a" / "child-external-fleet.json", payload)
    _write(inputs / "b" / "child-external-fleet.json", payload)

    first = run_negotiation_intelligence_bus(state, input_roots=[inputs], now=300)
    second = run_negotiation_intelligence_bus(state, input_roots=[inputs], now=301)

    assert first["record_count"] == 1
    assert first["signal_added_count"] == 1
    assert second["signal_added_count"] == 0

    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]
    assert {row["signal_id"] for row in signals} >= {"manual-1"}
    assert len([row for row in signals if row.get("host") == "repeat.example.com"]) == 1


def test_peer_feed_and_opportunity_queue_are_ingested_from_state(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(
        state / "root_negotiation_peer_feed.json",
        {"tasks": [{"host": "peer.example.com", "reason": "peer evidence"}]},
    )
    _write(
        state / "authority_opportunity_queue.json",
        {"opportunities": [{"host": "queue.example.com", "reason": "queue evidence"}]},
    )

    result = run_negotiation_intelligence_bus(state, now=400)
    assert {row["host"] for row in result["records"]} == {"peer.example.com", "queue.example.com"}
    receipts = json.loads((state / "negotiation_intelligence_receipts.json").read_text())
    assert receipts["status"] == "delivered"
    assert receipts["closed_loop"] is True
