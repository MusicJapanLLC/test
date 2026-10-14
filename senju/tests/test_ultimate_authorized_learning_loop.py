from pathlib import Path

import senju.ultimate_authorized_learning_loop as loop


def test_integrated_loop_persists_safe_tactics(monkeypatch, tmp_path: Path) -> None:
    state = tmp_path / "state"
    meta = tmp_path / "meta"
    state.mkdir()
    meta.mkdir()

    def fake_promotion(*args, **kwargs):
        (state / "promotion_bureau_approved_hosts.json").write_text(
            '{"hosts":[{"host":"approved.example"}]}',
            encoding="utf-8",
        )
        return {"approved_runtime_host_count": 1}

    calls = []

    def fake_red(**kwargs):
        calls.append(kwargs)
        kwargs["memory"].events.append(
            {
                "category": "external_failure",
                "agent_id": "SENJU-RED-ADAPTIVE",
                "route_key": "r1",
                "host": "approved.example",
            }
        )
        return {
            "success": True,
            "attempts": [
                {
                    "success": True,
                    "host": "approved.example",
                    "method": "GET",
                    "path": "/health",
                }
            ],
        }

    monkeypatch.setattr(loop, "run_authority_promotion_bureau", fake_promotion)
    monkeypatch.setattr(loop, "execute_authorized_red_learning_cycle", fake_red)

    result = loop.run_ultimate_authorized_learning_loop(
        repo_root=tmp_path,
        state_dir=state,
        meta_state_dir=meta,
        operation_id="op-1",
        seed_urls=("https://approved.example/",),
        rollout_percent=45,
    )

    assert result["capabilities"]["persistent_learning_memory"] is True
    assert result["hard_limits"]["exploit_payload_generation"] is False
    assert "/health" in result["successful_paths"]
    assert "GET" in result["successful_methods"]
    assert calls
    assert (state / "approved_authority_red_memory.json").exists()
    assert (state / "safe_red_tactic_memory.json").exists()


def test_previous_successful_path_is_reused_as_hint(monkeypatch, tmp_path: Path) -> None:
    state = tmp_path / "state"
    meta = tmp_path / "meta"
    state.mkdir()
    meta.mkdir()
    (state / "safe_red_tactic_memory.json").write_text(
        '{"schema":"senju-safe-red-tactic-memory/v1","successful_paths":["/status"],"successful_methods":["GET"]}',
        encoding="utf-8",
    )

    monkeypatch.setattr(
        loop,
        "run_authority_promotion_bureau",
        lambda *args, **kwargs: {"approved_runtime_host_count": 0},
    )

    observed = {}

    def fake_red(**kwargs):
        observed["alternate_paths"] = list(kwargs["alternate_paths"])
        return {"success": False, "attempts": []}

    monkeypatch.setattr(loop, "execute_authorized_red_learning_cycle", fake_red)

    loop.run_ultimate_authorized_learning_loop(
        repo_root=tmp_path,
        state_dir=state,
        meta_state_dir=meta,
        operation_id="op-2",
        seed_urls=("https://approved.example/",),
    )

    assert "/status" in observed["alternate_paths"]
