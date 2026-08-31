from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from engine.discovery_closed_loop import extract_response_urls, run_discovery_closed_loop
from engine.discovery_event_bus import publish_discovery_event


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_response_link_extraction_normalizes_relative_and_absolute_https() -> None:
    body = b'''<html><a href="/inside">inside</a><img src="https://cdn.owner.example/a.png"><a href="http://bad.example/">bad</a></html>'''
    urls = extract_response_urls("https://owner.example/start", body)
    assert "https://owner.example/inside" in urls
    assert "https://cdn.owner.example/a.png" in urls
    assert all(not url.startswith("http://") for url in urls)


def test_closed_loop_authorizes_in_scope_rediscovery_and_keeps_external_candidate_only(tmp_path: Path) -> None:
    state = tmp_path / "meta_state"
    repo = tmp_path / "repo"
    state.mkdir(parents=True)
    repo.mkdir(parents=True)
    _write(state / "discovery_policy.json", {"trusted_roots": ["owner.example"]})
    publish_discovery_event(
        state,
        actor="META",
        url="https://owner.example/",
        source="crawler",
        discovered_at=1000,
    )

    calls: list[tuple[str, str]] = []

    class FakeClient:
        def __init__(self, policy):
            self.policy = policy

        def contact_with_body(self, url: str, *, method: str = "GET"):
            calls.append((url, method))
            if url == "https://owner.example/":
                body = (
                    b'<a href="https://api.owner.example/v1">api</a>'
                    b'<a href="https://outside.example/path">outside</a>'
                )
            else:
                body = b"<html>done</html>"
            return SimpleNamespace(
                body=body,
                receipt=SimpleNamespace(
                    status=200,
                    final_url=url,
                    resolved_ips=("93.184.216.34",),
                ),
            )

    result = run_discovery_closed_loop(
        state,
        repo_root=repo,
        max_rounds=3,
        client_factory=FakeClient,
    )

    assert result["rounds_completed"] == 2
    assert result["new_event_count"] == 2
    assert result["final_authorized_count"] == 2
    # Existing shared action-queue semantics promote a newly authorized host as an
    # exact host target and probe its root URL, while preserving the discovered /v1 URL
    # in shared discovery knowledge.
    assert calls == [
        ("https://owner.example/", "GET"),
        ("https://api.owner.example/", "GET"),
    ]

    shared = json.loads((state / "shared_discovery_knowledge.json").read_text())
    decisions = {row["host"]: row["decision"] for row in shared["discoveries"]}
    urls = {row["url"] for row in shared["discoveries"]}
    assert decisions["owner.example"] == "probationary_authorized"
    assert decisions["api.owner.example"] == "probationary_authorized"
    assert decisions["outside.example"] == "candidate_only"
    assert "https://api.owner.example/v1" in urls
    assert "https://outside.example/path" not in {url for url, _ in calls}


def test_closed_loop_never_executes_high_impact_capability_as_high_impact(tmp_path: Path) -> None:
    state = tmp_path / "meta_state"
    repo = tmp_path / "repo"
    state.mkdir(parents=True)
    repo.mkdir(parents=True)
    _write(
        state / "discovery_policy.json",
        {
            "trusted_roots": ["owner.example"],
            "action_profiles": {
                "api.owner.example": {
                    "owner_authorization": "explicit",
                    "capabilities": ["write", "mutation", "credentialed_action"],
                    "credential_scope": "owner-api-service",
                }
            },
        },
    )
    publish_discovery_event(
        state,
        actor="CHILD/9",
        url="https://api.owner.example/",
        source="crawler",
        discovered_at=1000,
    )
    calls: list[tuple[str, str]] = []

    class FakeClient:
        def __init__(self, policy):
            self.policy = policy

        def contact_with_body(self, url: str, *, method: str = "GET"):
            calls.append((url, method))
            return SimpleNamespace(
                body=b"",
                receipt=SimpleNamespace(
                    status=204,
                    final_url=url,
                    resolved_ips=("93.184.216.34",),
                ),
            )

    result = run_discovery_closed_loop(state, repo_root=repo, client_factory=FakeClient)
    assert result["final_high_impact_ready_count"] == 1
    assert calls == [("https://api.owner.example/", "GET")]
    receipt = result["rounds"][0]["crawl"]["receipts"][0]
    assert receipt["executed_capability"] == "scan_probe"
    assert receipt["credential_scope"] == "none"
