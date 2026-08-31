from __future__ import annotations

import pytest

from automation.world.unified_trust_loop import (
    UnifiedTrustEnvelope,
    UnifiedTrustLoop,
    UnifiedTrustLoopError,
    UnifiedTrustState,
)


ROOT = "owner-root:test-range"


def _envelope() -> UnifiedTrustEnvelope:
    return UnifiedTrustEnvelope.create(
        trust_root_id=ROOT,
        allowed_authority_profiles={"base", "writer"},
        allowed_write_targets={"kabeya-authorized-test-range.onrender.com"},
        allowed_write_methods={"POST", "PATCH"},
        allowed_credential_grants={"test-range-writer"},
        allowed_deploy_targets={"kabeya-authorized-test-range.onrender.com"},
        max_replication_per_run=3,
        max_generation=8,
    )


def _state(**overrides):
    data = {
        "generation": 2,
        "authority_profile": "base",
        "persistent_queue": ("https://kabeya-authorized-test-range.onrender.com/",),
        "checkpoint_id": "cp-2",
    }
    data.update(overrides)
    return UnifiedTrustState(**data)


def _run(**overrides):
    kwargs = {
        "state": _state(),
        "self_tune_fn": lambda state: {
            "trust_root_id": ROOT,
            "verified": True,
            "requested_authority_profile": "writer",
            "requested_replicas": 2,
            "deploy_targets": ["kabeya-authorized-test-range.onrender.com"],
        },
        "discover_fn": lambda state, tune: {
            "trust_root_id": ROOT,
            "candidates": ["https://kabeya-authorized-test-range.onrender.com/internal"],
        },
        "authorize_fn": lambda queue, tune: {
            "trust_root_id": ROOT,
            "approved": True,
            "authority_profile": "writer",
            "authority_relation": "same",
            "renewable": True,
            "minted_new_trust_root": False,
        },
        "act_fn": lambda auth: {
            "trust_root_id": ROOT,
            "executed": True,
            "authority_relation": "same",
            "credentialed": True,
            "target": "kabeya-authorized-test-range.onrender.com",
            "method": "POST",
            "credential_grant_id": "test-range-writer",
            "credential_ref_is_opaque": True,
            "status": 200,
        },
        "renew_fn": lambda auth: {
            "trust_root_id": ROOT,
            "renewed": True,
            "authority_profile": "writer",
            "authority_relation": "same",
            "resurrected_revoked_authority": False,
        },
        "replicate_fn": lambda auth, budget: {
            "trust_root_id": ROOT,
            "authority_relation": "same",
            "children": [
                {
                    "worker_id": "X-1",
                    "trust_root_id": ROOT,
                    "authority_relation": "same",
                    "generation": 3,
                },
                {
                    "worker_id": "SENJU-1",
                    "trust_root_id": ROOT,
                    "authority_relation": "narrower",
                    "generation": 3,
                },
            ][:budget],
        },
        "deploy_fn": lambda targets, auth: {
            "trust_root_id": ROOT,
            "authority_relation": "same",
            "deployed_targets": list(targets),
            "minted_deployment_authority": False,
        },
        "network_policy_fn": lambda auth: {
            "trust_root_id": ROOT,
            "change_class": "tightening",
            "auto_applied": True,
        },
        "security_policy_fn": lambda auth: {
            "trust_root_id": ROOT,
            "change_class": "tightening",
            "self_approved": True,
        },
        "persist_fn": lambda checkpoint: {
            "trust_root_id": ROOT,
            "persisted": True,
            "checkpoint_id": "cp-3",
            "queue_hash": "stored",
        },
        "recover_fn": lambda checkpoint: {
            "trust_root_id": ROOT,
            "recovered": True,
            "checkpoint_id": "cp-3",
            "authority_relation": "same",
            "restored_revoked_authority": False,
            "restored_expired_authority": False,
        },
        "rediscover_fn": lambda recovery: {
            "trust_root_id": ROOT,
            "candidates": ["https://kabeya-authorized-test-range.onrender.com/after-recovery"],
        },
    }
    kwargs.update(overrides)
    return UnifiedTrustLoop(_envelope()).run(**kwargs)


def test_full_unified_loop_carries_one_trust_root_across_all_phases() -> None:
    result = _run()
    assert result.generation == 3
    assert result.authority_profile == "writer"
    assert result.checkpoint_id == "cp-3"
    assert result.discovered_again == (
        "https://kabeya-authorized-test-range.onrender.com/after-recovery",
    )
    assert set(result.phase_receipts) == {
        "self_tuning",
        "discovery",
        "authorization",
        "action",
        "auto_renew",
        "replication",
        "deployment",
        "network_policy",
        "security_policy",
        "persistence",
        "recovery",
        "rediscovery",
    }
    assert all(
        receipt["trust_root_id"] == ROOT
        for receipt in result.phase_receipts.values()
    )
    assert len(result.persistent_queue) == 3


def test_authorization_cannot_mint_a_new_trust_root() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="cannot mint a new Trust Root"):
        _run(
            authorize_fn=lambda queue, tune: {
                "trust_root_id": ROOT,
                "approved": True,
                "authority_profile": "writer",
                "authority_relation": "same",
                "minted_new_trust_root": True,
            }
        )


def test_any_phase_with_a_different_trust_root_is_rejected() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="configured Trust Root"):
        _run(
            discover_fn=lambda state, tune: {
                "trust_root_id": "other-root",
                "candidates": [],
            }
        )


def test_credentialed_write_requires_pre_registered_grant_and_opaque_ref() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="credential grant is not pre-authorized"):
        _run(
            act_fn=lambda auth: {
                "trust_root_id": ROOT,
                "executed": True,
                "authority_relation": "same",
                "credentialed": True,
                "target": "kabeya-authorized-test-range.onrender.com",
                "method": "POST",
                "credential_grant_id": "self-minted-admin",
                "credential_ref_is_opaque": True,
            }
        )

    with pytest.raises(UnifiedTrustLoopError, match="opaque credential reference"):
        _run(
            act_fn=lambda auth: {
                "trust_root_id": ROOT,
                "executed": True,
                "authority_relation": "same",
                "credentialed": True,
                "target": "kabeya-authorized-test-range.onrender.com",
                "method": "POST",
                "credential_grant_id": "test-range-writer",
                "credential_ref_is_opaque": False,
            }
        )


def test_raw_secret_material_is_never_allowed_in_receipts() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="raw secret material"):
        _run(
            act_fn=lambda auth: {
                "trust_root_id": ROOT,
                "executed": True,
                "authority_relation": "same",
                "credentialed": True,
                "target": "kabeya-authorized-test-range.onrender.com",
                "method": "POST",
                "credential_grant_id": "test-range-writer",
                "credential_ref_is_opaque": True,
                "access_token": "live-secret-value",
            }
        )


def test_replication_must_be_same_or_narrower_and_within_budget() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="attempted authority widening"):
        _run(
            replicate_fn=lambda auth, budget: {
                "trust_root_id": ROOT,
                "authority_relation": "wider",
                "children": [],
            }
        )

    with pytest.raises(UnifiedTrustLoopError, match="exceeded assigned budget"):
        _run(
            replicate_fn=lambda auth, budget: {
                "trust_root_id": ROOT,
                "authority_relation": "same",
                "children": [
                    {
                        "worker_id": f"worker-{idx}",
                        "trust_root_id": ROOT,
                        "authority_relation": "same",
                        "generation": 3,
                    }
                    for idx in range(budget + 1)
                ],
            }
        )


def test_recovery_cannot_resurrect_revoked_or_expired_authority() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="cannot restore revoked or expired authority"):
        _run(
            recover_fn=lambda checkpoint: {
                "trust_root_id": ROOT,
                "recovered": True,
                "checkpoint_id": "cp-3",
                "authority_relation": "same",
                "restored_revoked_authority": True,
            }
        )


def test_policy_self_changes_are_tightening_only() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="network policy self-edit may only tighten or revoke"):
        _run(
            network_policy_fn=lambda auth: {
                "trust_root_id": ROOT,
                "change_class": "expansion",
                "auto_applied": True,
            }
        )

    with pytest.raises(UnifiedTrustLoopError, match="security self-approval may only tighten or revoke"):
        _run(
            security_policy_fn=lambda auth: {
                "trust_root_id": ROOT,
                "change_class": "authority_expansion",
                "self_approved": True,
            }
        )


def test_external_deployment_cannot_escape_pre_authorized_targets() -> None:
    with pytest.raises(UnifiedTrustLoopError, match="deployment target outside Trust Root envelope"):
        _run(
            self_tune_fn=lambda state: {
                "trust_root_id": ROOT,
                "verified": True,
                "requested_authority_profile": "writer",
                "requested_replicas": 0,
                "deploy_targets": ["unrelated.example"],
            }
        )
