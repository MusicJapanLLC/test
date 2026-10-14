from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


NOW = 1_788_174_600


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _load_runner():
    path = Path(__file__).resolve().parents[1] / "scripts" / "run_discovery_production_continuity.py"
    spec = importlib.util.spec_from_file_location("run_discovery_production_continuity_test", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_runner_adds_active_discovery_lease_target_and_stages_authority(tmp_path: Path, monkeypatch) -> None:
    module = _load_runner()
    repo = tmp_path / "repo"
    state = tmp_path / "state"
    config = tmp_path / "continuity.json"
    leases = tmp_path / "leases.json"
    output = tmp_path / "output.json"
    repo.mkdir(parents=True)

    _write(
        config,
        {
            "schema": "senju-production-continuity-config/v1",
            "environment": "production",
            "discovery_capability_continuity": {
                "enabled": True,
                "actor": "META",
                "parent_id_prefix": "META-DISCOVERY-CONTINUITY",
                "parent_generation": 1,
                "parent_scopes": ["read:state", "write:state"],
                "desired_replicas": 4,
                "desired_revision": "default-branch",
                "active_limit": 50,
            },
            "targets": [],
        },
    )
    _write(
        leases,
        {
            "schema": "meta-discovery-capability-leases/v1",
            "leases": [
                {
                    "lease_id": "discovery:api.owner.example:abc:1",
                    "target": "api.owner.example",
                    "url": "https://api.owner.example/v1",
                    "authorization_reference": "owner:root:owner.example",
                    "authorization_basis": "trusted_root",
                    "capability_authorization_profile": "owner.example",
                    "capability_inherited_from_owner_root": True,
                    "capabilities": ["scan", "probe", "write", "mutation"],
                    "credential_scope": "none",
                    "shared_with": ["META", "X", "SENJU", "CHILD", "AI"],
                    "issued_at": NOW,
                    "expires_at": 4_102_444_800,
                    "source_action_fingerprint": "abc",
                    "status": "active",
                }
            ],
        },
    )

    captured = {}

    def fake_federated(args):
        effective = json.loads(Path(args.config).read_text())
        captured["effective"] = effective
        return {
            "schema": "senju-production-continuity-run/v1",
            "environment": "production",
            "targets_processed": len(effective.get("targets", [])),
            "targets": [],
        }

    monkeypatch.setattr(module, "run_federated_continuity", fake_federated)
    args = argparse.Namespace(
        repo_root=str(repo),
        state_dir=str(state),
        config=str(config),
        discovery_leases=str(leases),
        remote_chain_state=str(state / "federation.json"),
        deployment_authorities=str(repo / "deployment.json"),
        output=str(output),
        probe_health=False,
        dispatch_approved_deployments=False,
    )

    result = module.run(args)
    targets = captured["effective"]["targets"]
    assert len(targets) == 1
    assert targets[0]["target_host"] == "api.owner.example"
    assert targets[0]["desired_replicas"] == 4
    assert targets[0]["raw_credential_inheritance"] is False
    assert targets[0]["automatic_deployment_authority_from_discovery"] is False
    staged = json.loads((state / "api.owner.example" / "discovery_authorized.json").read_text())
    row = staged["hosts"]["api.owner.example"]
    assert row["authorization_reference"] == "owner:root:owner.example"
    assert row["credential_scope"] == "none"
    assert row["allowed_methods"] == ["GET", "HEAD"]
    assert result["discovery_capability_continuity"]["accepted_count"] == 1
    assert result["discovery_capability_continuity"]["added_target_count"] == 1
    assert result["discovery_capability_continuity"]["automatic_production_deployment_from_discovery"] is False
