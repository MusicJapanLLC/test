from __future__ import annotations

from automation.agent_bridge.denial_delegation import (
    DENIAL_CONTEXT_PROPAGATION_FRACTION,
    DenialAwareDelegator,
    OUTCOME_AUTHORITY_DENIED,
    OUTCOME_POLICY_DENIED,
    OUTCOME_RETRYABLE_DENIED,
    OUTCOME_SUCCESS,
)


def test_retryable_denial_moves_to_next_agent_until_success() -> None:
    results = {
        "A": {"status": "DENIED", "reason": "capacity"},
        "B": {"status": "DENIED", "reason": "timeout"},
        "C": {"status": "SUCCESS", "reason": ""},
    }

    def executor(agent, operation, history):
        assert operation == {"kind": "build", "target": "demo"}
        return results[agent]

    result = DenialAwareDelegator(max_attempts=4).run(
        {"kind": "build", "target": "demo"}, ["A", "B", "C", "D"], executor
    )
    assert result.succeeded is True
    assert [attempt.agent for attempt in result.attempts] == ["A", "B", "C"]
    assert [attempt.outcome for attempt in result.attempts] == [
        OUTCOME_RETRYABLE_DENIED, OUTCOME_RETRYABLE_DENIED, OUTCOME_SUCCESS
    ]


def test_authority_denial_uses_minimal_context_for_remaining_agents() -> None:
    executed = []
    replanned = []

    def executor(agent, operation, history):
        executed.append(agent)
        return {"status": "DENIED", "reason": "authority", "secret_detail": "do-not-propagate"}

    def replanner(agent, operation, notice):
        replanned.append(agent)
        assert notice.blocked is True
        assert notice.denial_class == "AUTHORITY"
        assert notice.propagation_fraction == DENIAL_CONTEXT_PROPAGATION_FRACTION
        assert not hasattr(notice, "reason")
        assert not hasattr(notice, "details")
        assert not hasattr(notice, "source_agent")
        return {"alternative": f"safe-plan-{agent}"}

    result = DenialAwareDelegator(max_attempts=4).run(
        {"kind": "external_contact", "target": "example"},
        ["A", "B", "C", "D"],
        executor,
        replanner=replanner,
    )
    assert executed == ["A"]
    assert replanned == ["B", "C", "D"]
    assert result.final_outcome == OUTCOME_AUTHORITY_DENIED
    assert [item.agent for item in result.replans] == ["B", "C", "D"]


def test_policy_denial_cannot_be_relabelled_retryable() -> None:
    called = []

    def executor(agent, operation, history):
        called.append(agent)
        return {"outcome": "RETRYABLE_DENIED", "reason": "policy"}

    result = DenialAwareDelegator().run({"kind": "write"}, ["A", "B"], executor)
    assert called == ["A"]
    assert result.final_outcome == OUTCOME_POLICY_DENIED


def test_unknown_denial_fails_closed_without_rotation() -> None:
    called = []

    def executor(agent, operation, history):
        called.append(agent)
        return {"status": "DENIED", "reason": "mystery"}

    result = DenialAwareDelegator().run({"kind": "task"}, ["A", "B"], executor)
    assert called == ["A"]
    assert result.succeeded is False


def test_duplicate_agents_do_not_consume_extra_attempts() -> None:
    called = []

    def executor(agent, operation, history):
        called.append(agent)
        return {"status": "DENIED", "reason": "temporary_unavailable"}

    DenialAwareDelegator(max_attempts=4).run({"kind": "task"}, ["A", "A", "B"], executor)
    assert called == ["A", "B"]
