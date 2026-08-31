from __future__ import annotations

import json
from pathlib import Path

from scripts.agency_bus import build_bus, collect_counterexamples, render_markdown


def test_collects_and_deduplicates_adversary_counterexamples(tmp_path: Path) -> None:
    pr273 = tmp_path / "pr273"
    pr275 = tmp_path / "pr275"
    pr273.mkdir()
    pr275.mkdir()
    row = {
        "schema": "senju-adversary-regression/v1",
        "regression_tripwire": True,
        "surface": "ExternalContactClient",
        "reason": "contract drift",
    }
    (pr273 / "a.json").write_text(json.dumps({"events": [row, row]}), encoding="utf-8")
    (pr275 / "b.jsonl").write_text(json.dumps(row) + "\n", encoding="utf-8")

    found = collect_counterexamples(pr273, pr275)
    assert len(found) == 1
    assert found[0]["kind"] == "regression_tripwire"
    assert found[0]["surface"] == "ExternalContactClient"


def test_bus_uses_regression_as_next_focus(tmp_path: Path) -> None:
    pr273 = tmp_path / "pr273"
    pr273.mkdir()
    (pr273 / "regression.json").write_text(
        json.dumps(
            {
                "regression_tripwire": True,
                "surface": "ScopeGuard",
                "reason": "unexpected acceptance",
            }
        ),
        encoding="utf-8",
    )
    frontier = {
        "steps_executed": 4,
        "successful_steps": 4,
        "failed_steps": 0,
        "discovered_links_enqueued": 8,
        "visited_urls": ["https://a.example/x", "https://b.example/y"],
        "read_scope_hosts": ["a.example", "b.example"],
    }
    evolution = {"safe": True, "confidence": 0.9, "changes": []}
    prs = [{"number": 1, "title": "[Senju] improve telemetry", "state": "OPEN", "headRefName": "senju/x"}]

    packet = build_bus(frontier, evolution, prs, pr273_root=pr273)
    assert packet["next_focus"] == "guard_regression_repair"
    assert packet["external_frontier"]["contacted_hosts"] == ["a.example", "b.example"]
    assert packet["pr_swarm"]["open_senju"] == 1
    assert len(packet["digest"]) == 24


def test_digest_is_stable_across_build_time(tmp_path: Path) -> None:
    frontier = {
        "steps_executed": 1,
        "successful_steps": 1,
        "failed_steps": 0,
        "visited_urls": ["https://example.com/"],
    }
    first = build_bus(frontier, {"safe": True}, [])
    second = build_bus(frontier, {"safe": True}, [])
    assert first["digest"] == second["digest"]


def test_markdown_exposes_machine_digest() -> None:
    packet = build_bus(
        {"steps_executed": 0, "successful_steps": 0, "failed_steps": 0},
        {"safe": True},
        [],
    )
    text = render_markdown(packet)
    assert f"agency-digest: `{packet['digest']}`" in text
    assert "TRANSPARENT" not in text  # human summary stays compact; policy lives in JSON
