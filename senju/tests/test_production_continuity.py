import datetime as dt
import json
from pathlib import Path

import pytest

from senju.meta.production_continuity import (
    classify_failure,
    load_deployment_authorities,
    resolve_existing_authority,
    run_production_continuity_cycle,
    select_pre_authorized_failover_route,
)


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _standing(repo: Path, host: str = "prod.example.com", revoked: bool = False) -> None:
    _write(
        repo / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "authorization_reference": "owner:prod-example",
                    "owner": "owner",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": [host],
                    "allowed_methods": ["GET", "HEAD"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": revoked,
                    "revocation_reason": "owner revoked" if revoked else None,
                    "credential_scope": "none",
                    "destructive": False,
                    "private_cidrs": [],
                    "private_dns_names": [],
                }
            ],
        },
    )


def _deployment_registry(path: Path, host: str = "prod.example.com", revoked: bool = False) -> None:
    _write(
        path,
        {
            "schema": "senju-production-deployment-authority/v1",
            "records": [
                {
                    "authorization_reference": "owner:deploy-prod-example",
                    "target_host": host,
                    "workflow": "deploy-approved-production.yml",
                    "ref": "claude/employee-onboarding-setup-udm86",
                    "allowed_systems": ["META", "X", "SENJU"],
                    "capabilities": ["deployment.production"],
                    "effect": "production_deployment",
                    "revoked": revoked,
                }
            ],
        },
    )


def test_unauthorized_discovery_cannot_enter_replication_or_deployment(tmp_path: Path):
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    deploy = tmp_path / "deploy.json"
    _deployment_registry(deploy, host="unknown.example.net")

    result = run_production_continuity_cycle(
        repo_root=repo,
        state_dir=state,
        target_host="unknown.example.net",
        actor="META",
        parent_id="META-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state"],
        desired_replicas=10,
        desired_revision="rev-a",
        deployment_authority_path=deploy,
    )

    assert result["stage"] == "awaiting_authority"
    assert result["replication_queued"] == 0
    assert result["deployment_ready"] is False
    assert result["authority_minted"] is False


def test_existing_authority_drives_replication_and_exact_deployment_intent(tmp_path: Path):
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    deploy = tmp_path / "deploy.json"
    _standing(repo)
    _deployment_registry(deploy)

    result = run_production_continuity_cycle(
        repo_root=repo,
        state_dir=state,
        target_host="prod.example.com",
        actor="META",
        parent_id="META-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state", "write:state"],
        desired_replicas=4,
        desired_revision="rev-a",
        active_agents=0,
        active_limit=2,
        current_replicas=0,
        deployment_authority_path=deploy,
    )

    assert result["authority_reused"] is True
    assert result["authority_reference"] == "owner:prod-example"
    assert result["replication_queued"] == 4
    assert result["replication_materialized"] == 2
    assert result["replication_deferred"] == 2
    assert result["fixed_recursive_generation_ceiling"] is None
    assert result["deployment_ready"] is True
    intent = result["deployment_intent"]
    assert intent["target_host"] == "prod.example.com"
    assert intent["capability"] == "deployment.production"
    assert intent["deployment_authorization_reference"] == "owner:deploy-prod-example"
    assert intent["authority_minted_by_continuity"] is False

    pending = json.loads((state / "pending_descendant_spawns.json").read_text())
    assert pending["requests"][0]["desired_count"] == 2
    assert pending["requests"][0]["requested_scopes"] == ["read:state", "write:state"]


def test_signed_or_discovery_authority_can_be_reused_but_does_not_mint_deployment_power(tmp_path: Path):
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    now = dt.datetime(2026, 8, 31, 8, 0, tzinfo=dt.timezone.utc)
    _write(
        state / "discovery_authorized.json",
        {
            "schema": "meta-discovery-authorized/v2",
            "hosts": {
                "partner.example.net": {
                    "authorization_basis": "signed_remote_delegation",
                    "source": "remote_authority_chain",
                    "expires_at": int(now.timestamp()) + 3600,
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "allow_delete": False,
                    "effect": "read_only",
                }
            },
        },
    )

    evidence = resolve_existing_authority(
        repo_root=repo,
        state_dir=state,
        target_host="partner.example.net",
        now=now,
    )
    assert evidence is not None
    assert evidence.source == "remote_authority_chain"

    result = run_production_continuity_cycle(
        repo_root=repo,
        state_dir=state,
        target_host="partner.example.net",
        actor="X",
        parent_id="X-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state"],
        desired_replicas=1,
        desired_revision="rev-b",
        active_limit=2,
        deployment_authority_path=tmp_path / "missing-deploy.json",
        now=now,
    )
    assert result["authority_reused"] is True
    assert result["stage"] == "awaiting_deployment_authority"
    assert result["deployment_ready"] is False


def test_revocation_is_terminal_for_authority_and_deployment(tmp_path: Path):
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    deploy = tmp_path / "deploy.json"
    _standing(repo, revoked=True)
    _deployment_registry(deploy, revoked=True)

    result = run_production_continuity_cycle(
        repo_root=repo,
        state_dir=state,
        target_host="prod.example.com",
        actor="META",
        parent_id="META-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state"],
        desired_replicas=5,
        desired_revision="rev-a",
        health_status="down",
        deployment_authority_path=deploy,
    )
    assert result["stage"] == "awaiting_authority"
    assert result["recovery_action"] is None


def test_unhealthy_target_creates_same_revision_recovery_under_existing_deploy_authority(tmp_path: Path):
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    deploy = tmp_path / "deploy.json"
    _standing(repo)
    _deployment_registry(deploy)
    _write(
        state / "production_continuity_state.json",
        {
            "schema": "senju-production-continuity/v1",
            "target_host": "prod.example.com",
            "last_deployed_revision": "rev-a",
        },
    )

    result = run_production_continuity_cycle(
        repo_root=repo,
        state_dir=state,
        target_host="prod.example.com",
        actor="X",
        parent_id="X-CHILD-01",
        parent_generation=1,
        parent_scopes=["read:state"],
        desired_replicas=0,
        desired_revision="rev-a",
        current_replicas=0,
        health_status="unhealthy",
        deployment_authority_path=deploy,
    )
    assert result["deployment_ready"] is True
    assert result["recovery_action"] == "recover_same_revision"
    assert result["deployment_intent"]["desired_revision"] == "rev-a"
    assert result["deployment_intent"]["target_host"] == "prod.example.com"


def test_boundary_denial_never_becomes_alternate_route_retry():
    decision = classify_failure("guard_denial")
    assert decision["retryable"] is False
    assert decision["alternate_route_after_boundary_denial"] is False
    assert decision["decision"] == "repair_authority_or_policy_input"


def test_transient_failure_can_select_only_equivalent_pre_authorized_route():
    routes = [
        {
            "route_id": "bad-other-host",
            "authorized": True,
            "target_host": "other.example.com",
            "authority_reference": "owner:prod-example",
            "capability": "authorized_operation",
            "effect": "read_only",
            "health_score": 1.0,
        },
        {
            "route_id": "bad-other-authority",
            "authorized": True,
            "target_host": "prod.example.com",
            "authority_reference": "other-authority",
            "capability": "authorized_operation",
            "effect": "read_only",
            "health_score": 0.99,
        },
        {
            "route_id": "good-route",
            "authorized": True,
            "target_host": "prod.example.com",
            "authority_reference": "owner:prod-example",
            "capability": "authorized_operation",
            "effect": "read_only",
            "health_score": 0.8,
        },
    ]
    selected = select_pre_authorized_failover_route(
        routes=routes,
        target_host="prod.example.com",
        authority_reference="owner:prod-example",
        capability="authorized_operation",
    )
    assert selected is not None
    assert selected["route_id"] == "good-route"


def test_deployment_registry_requires_explicit_production_capability(tmp_path: Path):
    path = tmp_path / "deploy.json"
    _write(
        path,
        {
            "schema": "senju-production-deployment-authority/v1",
            "records": [
                {
                    "authorization_reference": "owner:no-prod",
                    "target_host": "prod.example.com",
                    "workflow": "deploy.yml",
                    "ref": "main",
                    "allowed_systems": ["META"],
                    "capabilities": ["deployment.staging"],
                }
            ],
        },
    )
    records = load_deployment_authorities(path)
    assert len(records) == 1
    assert records[0].permits_production_deployment is False
