import pytest

from senju.meta.recursive_agent_broker import (
    MAX_ACTIVE_AGENTS,
    MAX_QUEUED_DESCENDANTS,
    materialize_spawn_request,
    request_descendants,
)


def test_one_million_descendant_request_is_accepted():
    request = request_descendants(
        system="META",
        parent_id="META-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state", "write:state"],
        desired_count=1_000_000,
    )
    assert request.desired_count == MAX_QUEUED_DESCENDANTS
    assert request.queue_limit == 1_000_000


def test_request_above_one_million_is_rejected():
    with pytest.raises(ValueError, match="queued descendant capacity"):
        request_descendants(
            system="X",
            parent_id="X-CHILD-01",
            parent_generation=1,
            parent_scopes=["read:state"],
            desired_count=1_000_001,
        )


def test_large_plan_is_deferred_instead_of_materialized_all_at_once():
    request = request_descendants(
        system="X",
        parent_id="X-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state"],
        desired_count=1_000_000,
    )
    result = materialize_spawn_request(request, active_agents=0)
    assert len(result.materialized) == MAX_ACTIVE_AGENTS
    assert result.deferred_count == 1_000_000 - MAX_ACTIVE_AGENTS
    assert result.queue_limit == 1_000_000
    assert all(agent.grant.raw_credential_inherited is False for agent in result.materialized)


def test_descendant_scope_cannot_expand_during_large_request():
    with pytest.raises(PermissionError, match="may not exceed parent scope"):
        request_descendants(
            system="META",
            parent_id="META-CHILD-01",
            parent_generation=1,
            parent_scopes=["read:state"],
            requested_scopes=["read:state", "admin:all"],
            desired_count=1_000_000,
        )
