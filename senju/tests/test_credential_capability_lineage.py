from __future__ import annotations

import json

import pytest

from senju.meta.agent_factory import ensure_direct_fleet, revoke_child
from senju.meta.closed_loop_agent_fabric import queue_descendant_request, run_closed_loop_cycle
from senju.meta.credential_capability_lineage import (
    SUPPORTED_CREDENTIAL_CLASSES,
    CredentialCapabilityError,
    build_use_request,
    delegate_capability,
    issue_root_capability,
    lineage,
    register_root_reference,
    registry_summary,
    revoke_capability,
    validate_subject_capabilities,
)


def _root_capability(tmp_path, *, owner: str = "META", klass: str = "github_token"):
    registry = tmp_path / "credential_capability_registry.json"
    root = register_root_reference(
        registry,
        owner_agent_id=owner,
        credential_class=klass,
        provider="production-credential-broker",
        secret_ref=f"vault://production/{klass}/{owner.lower()}",
        scopes=["read", "write"],
        audiences=["api.example.com", "github.com"],
    )
    capability = issue_root_capability(
        registry,
        root_reference_id=root.root_reference_id,
        subject_agent_id=owner,
        ttl_seconds=1800,
    )
    return registry, root, capability


def test_all_requested_credential_classes_are_supported_as_provider_references(tmp_path):
    expected = {
        "api_key",
        "oauth_token",
        "github_token",
        "cloud_credential",
        "ssh_private_key",
        "session_cookie",
        "bearer_token",
        "service_account_credential",
        "database_secret",
    }
    assert SUPPORTED_CREDENTIAL_CLASSES == expected

    registry = tmp_path / "registry.json"
    roots = []
    for klass in sorted(expected):
        roots.append(
            register_root_reference(
                registry,
                owner_agent_id="META",
                credential_class=klass,
                provider="production-broker",
                secret_ref=f"secret-manager://production/{klass}/primary",
                scopes=["read"],
                audiences=["service.example.com"],
            )
        )
    data = json.loads(registry.read_text())
    assert len(data["roots"]) == len(expected)
    assert all(root.raw_credential_embedded is False for root in roots)
    assert "ghp_" not in registry.read_text()
    assert "BEGIN OPENSSH PRIVATE KEY" not in registry.read_text()


def test_parent_child_grandchild_credential_lineage_is_distinct_and_auditable(tmp_path):
    registry, root, parent = _root_capability(tmp_path)
    child = delegate_capability(
        registry,
        parent_agent_id="META",
        child_agent_id="META-CHILD-01",
        parent_capability_id=parent.capability_id,
        requested_scopes=["read", "write"],
        requested_audiences=["github.com"],
        ttl_seconds=1200,
    )
    grandchild = delegate_capability(
        registry,
        parent_agent_id="META-CHILD-01",
        child_agent_id="META-CHILD-01-CHILD-0001",
        parent_capability_id=child.capability_id,
        requested_scopes=["read"],
        requested_audiences=["github.com"],
        ttl_seconds=600,
    )

    assert len({parent.capability_id, child.capability_id, grandchild.capability_id}) == 3
    assert child.parent_capability_id == parent.capability_id
    assert grandchild.parent_capability_id == child.capability_id
    assert child.generation == 1
    assert grandchild.generation == 2
    assert grandchild.scopes == ("read",)
    assert grandchild.raw_credential_inherited is False
    assert grandchild.raw_credential_embedded is False

    chain = lineage(registry, capability_id=grandchild.capability_id)
    assert [row["subject_agent_id"] for row in chain] == [
        "META",
        "META-CHILD-01",
        "META-CHILD-01-CHILD-0001",
    ]
    assert all(row["raw_credential_inherited"] is False for row in chain)

    use = build_use_request(
        registry,
        capability_id=grandchild.capability_id,
        subject_agent_id="META-CHILD-01-CHILD-0001",
        requested_scope="read",
        audience="github.com",
    )
    assert use.materialization_mode == "provider_exchange"
    assert use.raw_credential_returned is False
    assert use.secret_ref == root.secret_ref


def test_child_cannot_expand_credential_scope_audience_or_use_another_subject(tmp_path):
    registry, _, parent = _root_capability(tmp_path)
    with pytest.raises(CredentialCapabilityError, match="scope may not exceed"):
        delegate_capability(
            registry,
            parent_agent_id="META",
            child_agent_id="META-CHILD-01",
            parent_capability_id=parent.capability_id,
            requested_scopes=["read", "write", "admin"],
        )
    with pytest.raises(CredentialCapabilityError, match="audience may not exceed"):
        delegate_capability(
            registry,
            parent_agent_id="META",
            child_agent_id="META-CHILD-01",
            parent_capability_id=parent.capability_id,
            requested_audiences=["github.com", "unrelated.example.net"],
        )
    with pytest.raises(CredentialCapabilityError, match="not bound"):
        delegate_capability(
            registry,
            parent_agent_id="X",
            child_agent_id="X-CHILD-01",
            parent_capability_id=parent.capability_id,
        )


def test_parent_revocation_cascades_through_descendants(tmp_path):
    registry, _, parent = _root_capability(tmp_path)
    child = delegate_capability(
        registry,
        parent_agent_id="META",
        child_agent_id="META-CHILD-01",
        parent_capability_id=parent.capability_id,
    )
    grandchild = delegate_capability(
        registry,
        parent_agent_id="META-CHILD-01",
        child_agent_id="META-CHILD-01-CHILD-0001",
        parent_capability_id=child.capability_id,
    )
    revoked = revoke_capability(
        registry,
        capability_id=parent.capability_id,
        reason="root agent stopped",
        cascade=True,
    )
    assert set(revoked) == {parent.capability_id, child.capability_id, grandchild.capability_id}
    with pytest.raises(CredentialCapabilityError, match="revoked"):
        validate_subject_capabilities(
            registry,
            subject_agent_id="META-CHILD-01-CHILD-0001",
            capability_ids=[grandchild.capability_id],
        )


def test_direct_fleet_gets_fresh_child_bound_credential_capabilities(tmp_path):
    credential_registry, _, parent = _root_capability(tmp_path)
    agent_registry = tmp_path / "agent_registry.json"
    fleet = ensure_direct_fleet(
        agent_registry,
        system="META",
        parent_id="META",
        parent_scopes=["read:state", "write:state"],
        count=2,
        credential_registry_path=credential_registry,
        parent_credential_capability_ids=[parent.capability_id],
    )
    children = fleet["children"]
    assert len(children) == 2
    assert all(len(child["credential_capability_ids"]) == 1 for child in children)
    assert children[0]["credential_capability_ids"] != children[1]["credential_capability_ids"]
    for child in children:
        cap_id = child["credential_capability_ids"][0]
        validate_subject_capabilities(
            credential_registry,
            subject_agent_id=child["agent_id"],
            capability_ids=[cap_id],
        )
        assert child["credential_materialization_mode"] == "provider_exchange"
        assert child["raw_credential_inherited"] is False


def test_direct_child_capability_continues_into_recursive_grandchild(tmp_path):
    credential_registry, _, parent = _root_capability(tmp_path)
    agent_registry = tmp_path / "agent_registry.json"
    fleet = ensure_direct_fleet(
        agent_registry,
        system="META",
        parent_id="META",
        parent_scopes=["read:state", "write:state"],
        count=1,
        credential_registry_path=credential_registry,
        parent_credential_capability_ids=[parent.capability_id],
    )
    child = fleet["children"][0]
    child_cap_id = child["credential_capability_ids"][0]

    queue_descendant_request(
        state_dir=tmp_path,
        system="META",
        parent_id=child["agent_id"],
        parent_generation=1,
        parent_scopes=["read:state", "write:state"],
        desired_count=1,
        parent_credential_capability_ids=[child_cap_id],
    )
    result = run_closed_loop_cycle(state_dir=tmp_path, active_agents=0, active_limit=1)
    assert result["activated_count"] == 1
    assert result["credential_capabilities_issued"] == 1
    grandchild = result["activated"][0]
    assert grandchild["credential_materialization_mode"] == "provider_exchange"
    assert grandchild["raw_credential_inherited"] is False
    grandchild_cap_id = grandchild["credential_capability_ids"][0]

    chain = lineage(credential_registry, capability_id=grandchild_cap_id)
    assert [row["subject_agent_id"] for row in chain] == [
        "META",
        "META-CHILD-01",
        "META-CHILD-01-CHILD-0001",
    ]
    assert registry_summary(credential_registry)["raw_credential_storage"] is False


def test_revoking_direct_child_also_revokes_its_credential_subtree_when_registry_is_supplied(tmp_path):
    credential_registry, _, parent = _root_capability(tmp_path)
    agent_registry = tmp_path / "agent_registry.json"
    fleet = ensure_direct_fleet(
        agent_registry,
        system="META",
        parent_id="META",
        parent_scopes=["read:state"],
        count=1,
        credential_registry_path=credential_registry,
        parent_credential_capability_ids=[parent.capability_id],
    )
    child = fleet["children"][0]
    child_cap = child["credential_capability_ids"][0]
    grandchild = delegate_capability(
        credential_registry,
        parent_agent_id=child["agent_id"],
        child_agent_id="META-CHILD-01-CHILD-0001",
        parent_capability_id=child_cap,
    )

    assert revoke_child(
        agent_registry,
        parent_id="META",
        agent_id=child["agent_id"],
        credential_registry_path=credential_registry,
    ) is True
    with pytest.raises(CredentialCapabilityError, match="revoked"):
        validate_subject_capabilities(
            credential_registry,
            subject_agent_id="META-CHILD-01-CHILD-0001",
            capability_ids=[grandchild.capability_id],
        )
