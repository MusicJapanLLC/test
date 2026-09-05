import json
from pathlib import Path

from senju.negotiation_authorization_accelerator import run_negotiation_authorization_accelerator
from senju.negotiation_case_review_gate import run_negotiation_case_review_gate


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _seed(state: Path, count: int = 6) -> list[str]:
    hosts = [f"candidate-{i}.example" for i in range(count)]
    _write(
        state / "negotiation_intelligence_bus.json",
        {
            "records": [
                {
                    "host": host,
                    "intelligence_id": f"intel-{i}",
                    "reason": "negotiation AI produced a traceable candidate",
                    "requested_methods": ["GET", "HEAD"],
                    "score": 100 - i,
                }
                for i, host in enumerate(hosts)
            ]
        },
    )
    run_negotiation_case_review_gate(state, now=1000)
    return hosts


def test_advances_five_real_admitted_hosts_without_fabricating_authorization(tmp_path: Path):
    state = tmp_path / "state"
    _seed(state, 6)
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    attestations = tmp_path / "attestations.json"
    _write(canonical, {"targets": []})
    _write(attestations, {"records": []})

    result = run_negotiation_authorization_accelerator(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        minimum_batch=5,
    )

    assert result["selected_count"] == 5
    assert result["minimum_batch_met"] is True
    assert result["authorization_issued_count"] == 0
    assert result["pending_verification_count"] == 5
    assert all(row["review_key"]["acquisition_policy"] == "open" for row in result["rows"])
    assert all(row["authority_effect"] == "none" for row in result["rows"])


def test_canonical_negotiation_candidate_is_issued_immediately(tmp_path: Path):
    state = tmp_path / "state"
    hosts = _seed(state, 5)
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    attestations = tmp_path / "attestations.json"
    _write(
        canonical,
        {
            "targets": [
                {
                    "host": hosts[0],
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "HEAD", "OPTIONS"],
                }
            ]
        },
    )
    _write(attestations, {"records": []})

    result = run_negotiation_authorization_accelerator(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        minimum_batch=5,
    )

    issued = [row for row in result["rows"] if row["authorization_status"] == "authorization_issued"]
    assert len(issued) == 1
    assert issued[0]["host"] == hosts[0]
    assert issued[0]["authorization"]["authorization_basis"] == "canonical_authorized_host"


def test_verified_connected_control_candidate_is_issued_without_canonical_registration(tmp_path: Path):
    state = tmp_path / "state"
    hosts = _seed(state, 5)
    host = hosts[0]
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    attestations = tmp_path / "attestations.json"
    _write(canonical, {"targets": []})
    _write(
        attestations,
        {
            "records": [
                {
                    "provider": "render",
                    "host": host,
                    "service_url": f"https://{host}",
                    "provider_control_verified": True,
                    "owner_authorized": True,
                    "proof_ref": "render:test-service",
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "private_network": False,
                }
            ]
        },
    )

    result = run_negotiation_authorization_accelerator(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        minimum_batch=5,
    )

    issued = [row for row in result["rows"] if row["authorization_status"] == "authorization_issued"]
    assert len(issued) == 1
    assert issued[0]["authorization"]["authorization_basis"] == "verified_cloud_control:render"


def test_does_not_invent_hosts_to_satisfy_minimum_batch(tmp_path: Path):
    state = tmp_path / "state"
    _seed(state, 3)
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    attestations = tmp_path / "attestations.json"
    _write(canonical, {"targets": []})
    _write(attestations, {"records": []})

    result = run_negotiation_authorization_accelerator(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        minimum_batch=5,
    )

    assert result["available_admitted_unique_hosts"] == 3
    assert result["selected_count"] == 3
    assert result["minimum_batch_met"] is False
