from __future__ import annotations

import json
from types import SimpleNamespace

from senju.meta.authority_retry import plan_authority_retries, record_dispatch_results


def _graph(metadata: dict) -> SimpleNamespace:
    obs = SimpleNamespace(surface="security-guard", metadata=metadata)
    return SimpleNamespace(observations=[obs])


def test_authority_retry_delegates_then_waits_then_moves_to_next_agent(tmp_path) -> None:
    state_dir = tmp_path / "state"
    registry_path = tmp_path / "authority-retry-agents.json"
    registry_path.write_text(json.dumps({
        "max_attempts": 4,
        "agents": [
            {
                "name": "JULES",
                "enabled": True,
                "authority_scopes": ["repo:pr:review"],
                "route": {"kind": "jules_task"},
            },
            {
                "name": "OPENHANDS",
                "enabled": True,
                "authority_scopes": ["repo:pr:review"],
                "route": {"kind": "openhands_task"},
            },
        ],
    }), encoding="utf-8")

    initial = {
        "name": "review-change",
        "objective": "review the repository change",
        "authority_denied": True,
        "guard_outcome": "authority_denial",
        "required_authority": "repo:pr:review",
        "authority_reason": "current agent lacks review authority",
        "agent": "SENJU_RND",
    }

    commands, summary = plan_authority_retries(_graph(initial), state_dir, registry_path)
    assert summary["planned"] == 1
    assert len(commands) == 1
    assert commands[0]["kind"] == "jules_task"
    retry_id = commands[0]["_authority_retry"]["retry_id"]
    assert commands[0]["_authority_retry"]["agent"] == "JULES"

    record_dispatch_results(commands, [{"action": "jules_task", "result": {"id": 1}}], state_dir)

    # The unchanged original denial is not enough to trigger another agent. META
    # waits for the delegated attempt's result instead of spraying retries.
    commands_waiting, summary_waiting = plan_authority_retries(_graph(initial), state_dir, registry_path)
    assert commands_waiting == []
    assert summary_waiting["waiting"] == 1

    # When Jules reports the same Authority Denial with the chain id, META marks
    # Jules failed for this chain and delegates to the next independently-authorized agent.
    delegated_denial = {
        **initial,
        "authority_retry_id": retry_id,
        "denied_agent": "JULES",
        "authority_reason": "Jules also lacks authority in this execution context",
    }
    commands_next, summary_next = plan_authority_retries(_graph(delegated_denial), state_dir, registry_path)
    assert summary_next["planned"] == 1
    assert len(commands_next) == 1
    assert commands_next[0]["kind"] == "openhands_task"
    assert commands_next[0]["_authority_retry"]["agent"] == "OPENHANDS"
    assert commands_next[0]["_authority_retry"]["retry_id"] == retry_id


def test_authority_retry_never_uses_agent_without_exact_authority(tmp_path) -> None:
    state_dir = tmp_path / "state"
    registry_path = tmp_path / "authority-retry-agents.json"
    registry_path.write_text(json.dumps({
        "agents": [
            {
                "name": "OPENHANDS",
                "enabled": True,
                "authority_scopes": ["repo:pr:review"],
                "route": {"kind": "openhands_task"},
            }
        ]
    }), encoding="utf-8")

    denial = {
        "name": "write-change",
        "authority_denied": True,
        "required_authority": "repo:write:pr",
        "authority_reason": "write authority required",
    }
    commands, summary = plan_authority_retries(_graph(denial), state_dir, registry_path)
    assert commands == []
    assert summary["stopped"] == 1

    state = json.loads((state_dir / "authority_retry_state.json").read_text(encoding="utf-8"))
    chain = next(iter(state["chains"].values()))
    assert chain["status"] == "no_eligible_agent"
    assert chain["attempts"] == []
