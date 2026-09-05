from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest

from senju.credential_runtime import CredentialRecoveryRuntime
from senju.world_trust_root_loop import (
    CHECKPOINT_SCHEMA,
    QUEUE_SCHEMA,
    WORLD_LOOP_SCHEMA,
    TrustRootBinding,
    WorldTrustRootLoop,
    load_credentialed_write_authorities,
    load_trust_root_bindings,
    resolve_trust_root_binding,
)


def _dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def _standing_registry(path: Path, *, host: str, reference: str, revoked: bool = False) -> None:
    _dump(
        path,
        {
            "schema": "senju-standing-authorization/v1",
            "semantics": "durable_until_explicit_revocation",
            "network_scope_semantics": "test",
            "records": [
                {
                    "authorization_reference": reference,
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": [host],
                    "allowed_methods": ["GET", "HEAD", "OPTIONS"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": revoked,
                    "revocation_reason": "test" if revoked else None,
                    "credential_scope": "none",
                    "destructive": False,
                    "private_cidrs": [],
                    "private_dns_names": [],
                }
            ],
        },
    )


def _deployment_registry(path: Path, *, host: str, reference: str | None = None) -> None:
    records = []
    if reference:
        records.append(
            {
                "authorization_reference": reference,
                "target_host": host,
                "workflow": "test-deploy.yml",
                "ref": "main",
                "allowed_systems": ["META", "X", "SENJU"],
                "capabilities": ["deployment.production"],
                "effect": "production_deployment",
                "revoked": False,
            }
        )
    _dump(
        path,
        {
            "schema": "senju-production-deployment-authority/v1",
            "records": records,
        },
    )


def _write_registry(
    path: Path,
    *,
    root_id: str,
    host: str,
    reference: str,
    resource_prefix: str,
) -> None:
    _dump(
        path,
        {
            "schema": "senju-credentialed-external-write-authority/v1",
            "records": [
                {
                    "authorization_reference": reference,
                    "root_id": root_id,
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "approval_ref": "test-owner-approval",
                    "target_host": host,
                    "provider": "github",
                    "resource_prefixes": [resource_prefix],
                    "allowed_methods": ["PATCH"],
                    "required_scopes": ["contents:write"],
                    "allowed_systems": ["META"],
                    "effect": "credentialed_external_write",
                    "revoked": False,
                }
            ],
        },
    )


def _binding(
    *,
    host: str = "owned.example.com",
    standing_ref: str = "owner:read:owned",
    deployment_ref: str | None = "owner:deploy:owned",
    write_ref: str | None = None,
    root_id: str = "world:owned",
) -> TrustRootBinding:
    return TrustRootBinding(
        root_id=root_id,
        owner="MusicJapanLLC",
        target_host=host,
        standing_authorization_reference=standing_ref,
        deployment_authorization_reference=deployment_ref,
        credentialed_write_authorization_reference=write_ref,
        max_replica_target=8,
        max_credential_replica_depth=4,
    )


def _loop(
    tmp_path: Path,
    *,
    binding: TrustRootBinding | None = None,
    emergency_stop: bool = False,
) -> WorldTrustRootLoop:
    binding = binding or _binding()
    registry = tmp_path / "senju/state/standing_authorizations.json"
    deployments = tmp_path / "senju/config/production-deployment-authorizations.json"
    writes = tmp_path / "senju/config/credentialed-external-write-authorizations.json"
    _standing_registry(
        registry,
        host=binding.target_host,
        reference=binding.standing_authorization_reference,
    )
    _deployment_registry(
        deployments,
        host=binding.target_host,
        reference=binding.deployment_authorization_reference,
    )
    _dump(
        writes,
        {
            "schema": "senju-credentialed-external-write-authority/v1",
            "records": [],
        },
    )
    return WorldTrustRootLoop(
        repo_root=tmp_path,
        state_dir=tmp_path / "runtime-state",
        binding=binding,
        actor="META",
        emergency_state={"emergency_stop": emergency_stop},
        standing_registry_path=registry,
        deployment_authority_path=deployments,
        write_authority_path=writes,
    )


def _patch_continuity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "senju.world_trust_root_loop.run_production_continuity_cycle",
        lambda **kwargs: {
            "stage": "deployment_intent_ready",
            "authority_reused": True,
            "authority_minted": False,
            "authority_reference": kwargs["target_host"],
            "replication_queued": kwargs["desired_replicas"],
            "replication_materialized": 0,
            "replication_deferred": kwargs["desired_replicas"],
            "deployment_ready": True,
            "recovery_action": (
                "recover_same_revision"
                if str(kwargs["health_status"]).lower() in {"failed", "down", "degraded"}
                else None
            ),
        },
    )


def test_binding_registry_only_links_existing_authority(tmp_path: Path) -> None:
    path = tmp_path / "bindings.json"
    _dump(
        path,
        {
            "schema": "senju-world-trust-root-bindings/v1",
            "semantics": "binding_only_existing_authority_never_mints_authority",
            "records": [
                {
                    "root_id": "world:test",
                    "owner": "MusicJapanLLC",
                    "target_host": "owned.example.com",
                    "standing_authorization_reference": "owner:read",
                    "deployment_authorization_reference": "owner:deploy",
                    "credentialed_write_authorization_reference": None,
                    "max_replica_target": 999,
                    "max_credential_replica_depth": 999,
                    "revoked": False,
                }
            ],
        },
    )

    records = load_trust_root_bindings(path)
    assert len(records) == 1
    assert records[0].root_id == "world:test"
    assert records[0].max_replica_target == 32
    assert records[0].max_credential_replica_depth == 8
    assert resolve_trust_root_binding(path=path, root_id="world:test") == records[0]


def test_discovery_reuses_exact_root_and_queues_unknown_host(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    loop = _loop(tmp_path)

    report = loop.run_cycle(
        discoveries=(
            {"url": "https://owned.example.com/a", "source": "test"},
            {"url": "https://other.example.net/", "source": "test"},
        ),
        desired_replicas=2,
        desired_revision="rev-a",
    )

    assert report["schema"] == WORLD_LOOP_SCHEMA
    assert report["authorization_central"] is True
    assert report["authorization_reused_not_minted"] is True
    assert report["discovery"]["records"][0]["authorization_state"] == "authorized_existing_root"
    assert report["discovery"]["records"][1]["authorization_state"] == "authorization_required"
    assert report["discovery"]["records"][1]["authority_minted_from_discovery"] is False
    assert report["self_tune"]["failure_count"] >= 1
    queue = json.loads(loop.queue_path.read_text())
    assert queue["schema"] == QUEUE_SCHEMA
    assert any(item["kind"] == "authorization_request" for item in queue["items"])
    assert set(report["same_trust_root"].values()) == {"world:owned"}


def test_security_stop_pauses_every_stage_and_prevents_checkpoint_recovery(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    loop = _loop(tmp_path)
    first = loop.run_cycle(discoveries=({"host": "owned.example.com"},))
    assert first["discover_again"] is True
    assert loop.checkpoint_path.exists()

    stopped = _loop(tmp_path, emergency_stop=True)
    result = stopped.run_cycle()
    assert result["stage"] == "paused"
    assert result["emergency_stop"] is True
    assert result["discover_again"] is False
    assert result["checkpoint_recovery"]["recovered"] is False
    assert result["checkpoint_recovery"]["reason"] == "live_authority_or_security_stop_blocked"
    assert result["security_self_approval"] is False
    assert result["network_policy_self_edit"] is False


def test_checkpoint_restores_queue_only_after_live_authority_revalidation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    loop = _loop(tmp_path)
    loop.run_cycle(discoveries=({"host": "unknown.example.net"},))
    checkpoint = json.loads(loop.checkpoint_path.read_text())
    assert checkpoint["schema"] == CHECKPOINT_SCHEMA
    assert checkpoint["authority_snapshot_is_not_restorable"] is True

    loop.queue_path.unlink()
    restored = _loop(tmp_path)
    recovery = restored.recover_checkpoint()
    assert recovery["recovered"] is True
    assert recovery["authority_restored_from_checkpoint"] is False
    assert recovery["work_state_restored"] is True
    queue = json.loads(restored.queue_path.read_text())
    assert queue["items"][0]["status"] == "pending_external_authority"


def test_revoked_live_root_blocks_checkpoint_and_does_not_reactivate(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    loop = _loop(tmp_path)
    loop.run_cycle(discoveries=({"host": "unknown.example.net"},))

    assert loop.standing_registry_path is not None
    _standing_registry(
        loop.standing_registry_path,
        host=loop.binding.target_host,
        reference=loop.binding.standing_authorization_reference,
        revoked=True,
    )
    result = loop.run_cycle()
    assert result["stage"] == "paused"
    assert result["live_authority"] is False
    assert result["authority_minted_by_loop"] is False
    assert result["checkpoint_recovery"]["recovered"] is False


def test_write_without_explicit_write_authority_never_calls_executor(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    called = False

    def writer(secret: str, context: Mapping[str, object]) -> dict[str, object]:
        nonlocal called
        called = True
        return {"ok": True}

    loop = _loop(tmp_path)
    loop.write_executor = writer
    report = loop.run_cycle(
        operations=(
            {
                "operation_id": "write-1",
                "target_host": "owned.example.com",
                "method": "PATCH",
                "resource": "anything",
                "required_scopes": ["contents:write"],
            },
        )
    )
    write = report["execution"]["credentialed_external_writes"][0]
    assert write["success"] is False
    assert write["stage"] == "awaiting_credentialed_write_authority"
    assert called is False
    assert report["execution"]["external_write_enabled"] is False


def test_explicit_write_authority_uses_preprovisioned_credential_and_replica_leases(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    monkeypatch.setenv("GITHUB_TOKEN", "test-secret-token")
    binding = _binding(
        host="api.github.com",
        standing_ref="owner:read:github",
        deployment_ref=None,
        write_ref="owner:write:github-repo",
        root_id="world:github-repo",
    )
    loop = _loop(tmp_path, binding=binding)
    assert loop.write_authority_path is not None
    _write_registry(
        loop.write_authority_path,
        root_id=binding.root_id,
        host=binding.target_host,
        reference=binding.credentialed_write_authorization_reference or "",
        resource_prefix="repos/MusicJapanLLC/test/",
    )
    runtime = CredentialRecoveryRuntime.from_environment(
        actor="META",
        environ={"GITHUB_TOKEN": "test-secret-token"},
        state_dir=tmp_path / "credential-state",
    )
    seen: list[dict[str, object]] = []

    def writer(secret: str, context: Mapping[str, object]) -> dict[str, object]:
        assert secret == "test-secret-token"
        seen.append(dict(context))
        return {"ok": True, "resource": context["resource"]}

    loop.credential_runtime = runtime
    loop.write_executor = writer
    report = loop.run_cycle(
        operations=(
            {
                "kind": "credentialed_external_write",
                "operation_id": "repo-write",
                "target_host": "api.github.com",
                "method": "PATCH",
                "resource": "repos/MusicJapanLLC/test/contents/demo.txt",
                "required_scopes": ["contents:write"],
                "payload": {"message": "authorized"},
                "replicate_depth": 2,
                "ttl_seconds": 300,
            },
        ),
        desired_replicas=1,
    )

    write = report["execution"]["credentialed_external_writes"][0]
    assert write["success"] is True
    assert write["authority_changed"] is False
    assert write["authorization_reference"] == "owner:write:github-repo"
    assert seen and seen[0]["root_id"] == binding.root_id
    lineage = write["credential_replication"]
    assert lineage["raw_secret_replication"] is False
    assert len(lineage["replicas"]) == 3
    serialized = json.dumps(report)
    assert "test-secret-token" not in serialized
    assert "env://GITHUB_TOKEN" not in serialized


def test_write_resource_and_scope_are_exactly_bounded(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    binding = _binding(
        host="api.github.com",
        standing_ref="owner:read:github",
        deployment_ref=None,
        write_ref="owner:write:github-repo",
        root_id="world:github-repo",
    )
    loop = _loop(tmp_path, binding=binding)
    assert loop.write_authority_path is not None
    _write_registry(
        loop.write_authority_path,
        root_id=binding.root_id,
        host=binding.target_host,
        reference=binding.credentialed_write_authorization_reference or "",
        resource_prefix="repos/MusicJapanLLC/test/",
    )
    result = loop._execute_credentialed_write(
        {
            "operation_id": "outside-resource",
            "target_host": "api.github.com",
            "method": "PATCH",
            "resource": "repos/OtherOrg/other/contents/x",
            "required_scopes": ["contents:write"],
        }
    )
    assert result["success"] is False
    assert result["stage"] == "write_outside_authority"
    assert loop.denial_memory.events[-1]["category"] == "policy_denial"


def test_write_executor_cannot_return_raw_secret(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_continuity(monkeypatch)
    monkeypatch.setenv("GITHUB_TOKEN", "never-persist-me")
    binding = _binding(
        host="api.github.com",
        standing_ref="owner:read:github",
        deployment_ref=None,
        write_ref="owner:write:github-repo",
        root_id="world:github-repo",
    )
    loop = _loop(tmp_path, binding=binding)
    assert loop.write_authority_path is not None
    _write_registry(
        loop.write_authority_path,
        root_id=binding.root_id,
        host=binding.target_host,
        reference=binding.credentialed_write_authorization_reference or "",
        resource_prefix="repos/MusicJapanLLC/test/",
    )
    loop.credential_runtime = CredentialRecoveryRuntime.from_environment(
        actor="META",
        environ={"GITHUB_TOKEN": "never-persist-me"},
        state_dir=tmp_path / "credential-state",
    )
    loop.write_executor = lambda secret, context: {"leak": secret}
    result = loop._execute_credentialed_write(
        {
            "operation_id": "leak-test",
            "target_host": "api.github.com",
            "method": "PATCH",
            "resource": "repos/MusicJapanLLC/test/contents/demo.txt",
            "required_scopes": ["contents:write"],
        }
    )
    assert result["success"] is False
    serialized = json.dumps(result)
    assert "never-persist-me" not in serialized


def test_read_lease_auto_renew_never_broadens_authority(tmp_path: Path) -> None:
    loop = _loop(tmp_path)
    result = loop._renew_read_lease(now=dt.datetime(2026, 8, 31, tzinfo=dt.timezone.utc))
    assert result["renewed"] is True
    assert result["authority_broadened"] is False
    assert result["authorization_reference"] == loop.binding.standing_authorization_reference


def test_explicit_write_registry_rejects_untrusted_or_broad_entries(tmp_path: Path) -> None:
    path = tmp_path / "writes.json"
    _dump(
        path,
        {
            "schema": "senju-credentialed-external-write-authority/v1",
            "records": [
                {
                    "authorization_reference": "bad",
                    "root_id": "world:x",
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "self_approved",
                    "approval_ref": "ai-council",
                    "target_host": "api.github.com",
                    "provider": "github",
                    "resource_prefixes": ["repos/MusicJapanLLC/test/"],
                    "allowed_methods": ["PATCH"],
                    "required_scopes": ["contents:write"],
                    "allowed_systems": ["META"],
                },
                {
                    "authorization_reference": "bad-delete",
                    "root_id": "world:x",
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "approval_ref": "owner",
                    "target_host": "api.github.com",
                    "provider": "github",
                    "resource_prefixes": ["repos/MusicJapanLLC/test/"],
                    "allowed_methods": ["DELETE"],
                    "required_scopes": ["contents:write"],
                    "allowed_systems": ["META"],
                },
            ],
        },
    )
    assert load_credentialed_write_authorities(path) == ()
