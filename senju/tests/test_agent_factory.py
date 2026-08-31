import json

import pytest

from senju.meta.agent_factory import (
    MAX_CHILDREN_PER_PARENT,
    ensure_direct_fleet,
    revoke_child,
    spawn_children,
)
from senju.meta.agent_fleet import provision_meta_x_fleets


def test_meta_and_x_can_each_get_ten_direct_children(tmp_path):
    result = provision_meta_x_fleets(tmp_path, count=10)
    assert result["meta_children"] == 10
    assert result["x_children"] == 10
    registry = json.loads((tmp_path / "meta_x_agent_registry.json").read_text())
    assert len(registry["parents"]["META"]["children"]) == 10
    assert len(registry["parents"]["X"]["children"]) == 10


def test_children_never_inherit_raw_credentials():
    children = spawn_children(
        system="META",
        parent_id="META",
        parent_scopes=["read:state", "write:state"],
        count=10,
    )
    assert len(children) == MAX_CHILDREN_PER_PARENT
    assert all(child.grant.raw_credential_inherited is False for child in children)
    assert len({child.grant.grant_id for child in children}) == 10
    assert all(child.may_spawn_children is False for child in children)


def test_child_scope_may_only_be_equal_or_narrower():
    child = spawn_children(
        system="X",
        parent_id="X",
        parent_scopes=["read:state", "write:state"],
        requested_scopes=["read:state"],
        count=1,
    )[0]
    assert child.grant.scopes == ("read:state",)

    with pytest.raises(PermissionError, match="may not exceed parent scope"):
        spawn_children(
            system="X",
            parent_id="X",
            parent_scopes=["read:state"],
            requested_scopes=["read:state", "admin:all"],
            count=1,
        )


def test_recursive_spawn_is_rejected():
    with pytest.raises(PermissionError, match="recursive child spawning is disabled"):
        spawn_children(
            system="META",
            parent_id="META-CHILD-01",
            parent_scopes=["read:state"],
            count=10,
            parent_generation=1,
        )


def test_count_above_ten_is_rejected():
    with pytest.raises(ValueError, match="count must be between"):
        spawn_children(
            system="META",
            parent_id="META",
            parent_scopes=["read:state"],
            count=11,
        )


def test_reprovision_is_idempotent_not_exponential(tmp_path):
    registry = tmp_path / "registry.json"
    ensure_direct_fleet(
        registry,
        system="META",
        parent_id="META",
        parent_scopes=["read:state"],
        count=10,
    )
    ensure_direct_fleet(
        registry,
        system="META",
        parent_id="META",
        parent_scopes=["read:state"],
        count=10,
    )
    data = json.loads(registry.read_text())
    assert len(data["parents"]["META"]["children"]) == 10


def test_single_child_can_be_revoked_without_touching_siblings(tmp_path):
    registry = tmp_path / "registry.json"
    ensure_direct_fleet(
        registry,
        system="X",
        parent_id="X",
        parent_scopes=["read:state"],
        count=3,
    )
    assert revoke_child(registry, parent_id="X", agent_id="X-CHILD-02") is True
    data = json.loads(registry.read_text())
    statuses = {child["agent_id"]: child["status"] for child in data["parents"]["X"]["children"]}
    assert statuses == {
        "X-CHILD-01": "provisioned",
        "X-CHILD-02": "revoked",
        "X-CHILD-03": "provisioned",
    }
