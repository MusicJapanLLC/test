from __future__ import annotations

import datetime as dt
import json

import pytest

from senju.meta.private_zone_authority import (
    auto_enroll_and_renew_registered_authorization,
    auto_enroll_private_targets,
    create_private_zone_envelope,
    load_private_zone_registry,
    save_private_zone_registry,
)
from senju.meta.standing_authorization import (
    StandingAuthorizationError,
    create_standing_authorization,
    load_registry,
    revoke_standing_authorization,
    save_registry,
)


def _now() -> dt.datetime:
    return dt.datetime(2026, 8, 31, 8, 0, tzinfo=dt.timezone.utc)


def _standing():
    return create_standing_authorization(
        authorization_reference="owner-private-zone-001",
        owner="MusicJapanLLC",
        issuer_kind="owner_explicit",
        exact_hosts=["public.example.com"],
        allowed_methods=["GET", "HEAD", "OPTIONS"],
        now=_now(),
    )


def _envelope():
    return create_private_zone_envelope(
        authorization_reference="owner-private-zone-001",
        private_zone_cidrs=["10.20.0.0/16", "fd12:3456::/48"],
        private_dns_suffixes=["svc.corp.internal", "svc.cluster.local"],
    )


def test_meta_auto_enrolls_exact_targets_inside_owner_zone_without_per_host_approval():
    standing = _standing()
    result = auto_enroll_private_targets(
        standing,
        _envelope(),
        actor="META",
        discovered_ips=["10.20.4.7", "fd12:3456::7"],
        discovered_dns_names=["payments.svc.corp.internal", "api.svc.cluster.local"],
    )

    assert result.trigger_actor == "META"
    assert result.standing_authorization.exact_hosts == ("public.example.com",)
    assert result.enrolled_private_cidrs == ("10.20.4.7/32", "fd12:3456::7/128")
    assert result.enrolled_private_dns_names == (
        "api.svc.cluster.local",
        "payments.svc.corp.internal",
    )
    assert result.standing_authorization.has_private_network_authority is True


def test_discovery_outside_owner_zone_cannot_expand_authority():
    with pytest.raises(StandingAuthorizationError, match="outside the approved private-zone envelope"):
        auto_enroll_private_targets(
            _standing(),
            _envelope(),
            actor="X",
            discovered_ips=["10.21.1.5"],
        )

    with pytest.raises(StandingAuthorizationError, match="outside the approved DNS envelope"):
        auto_enroll_private_targets(
            _standing(),
            _envelope(),
            actor="X",
            discovered_dns_names=["db.other.internal"],
        )


def test_loopback_link_local_and_metadata_cannot_become_zone_envelopes():
    for cidr in ["127.0.0.0/8", "169.254.0.0/16", "fe80::/10"]:
        with pytest.raises(StandingAuthorizationError, match="RFC1918/ULA"):
            create_private_zone_envelope(
                authorization_reference="owner-private-zone-001",
                private_zone_cidrs=[cidr],
            )

    for suffix in ["localhost", "metadata.google.internal", "instance-data.ec2.internal"]:
        with pytest.raises(StandingAuthorizationError):
            create_private_zone_envelope(
                authorization_reference="owner-private-zone-001",
                private_dns_suffixes=[suffix],
            )


def test_revoked_authority_cannot_be_auto_enrolled():
    revoked = revoke_standing_authorization(_standing(), reason="owner revoked")
    with pytest.raises(StandingAuthorizationError, match="revoked"):
        auto_enroll_private_targets(
            revoked,
            _envelope(),
            actor="META",
            discovered_ips=["10.20.1.9"],
        )


def test_senju_can_trigger_enrollment_and_meta_executes_immediate_renewal(tmp_path):
    registry_path = tmp_path / "standing.json"
    zone_path = tmp_path / "private-zones.json"
    lease_path = tmp_path / "leases.ndjson"
    save_registry(registry_path, [_standing()])
    save_private_zone_registry(zone_path, [_envelope()])

    result = auto_enroll_and_renew_registered_authorization(
        actor="SENJU",
        authorization_reference="owner-private-zone-001",
        registry_path=registry_path,
        private_zone_registry_path=zone_path,
        lease_log_path=lease_path,
        discovered_ips=["10.20.8.12"],
        discovered_dns_names=["worker.svc.corp.internal"],
        lease_seconds=3600,
        now=_now(),
    )

    assert result.trigger_actor == "SENJU"
    assert result.lease is not None
    assert result.lease.actor == "META"
    assert result.lease.renewal_reason == "private_zone_auto_enroll:senju"
    assert "10.20.8.12/32" in result.lease.private_cidrs
    assert "worker.svc.corp.internal" in result.lease.private_dns_names
    assert result.lease.exact_hosts == ("public.example.com",)

    persisted = load_registry(registry_path)[0]
    assert "10.20.8.12/32" in persisted.private_cidrs
    assert "worker.svc.corp.internal" in persisted.private_dns_names
    assert lease_path.exists()


def test_private_zone_registry_is_explicit_and_round_trips(tmp_path):
    path = save_private_zone_registry(tmp_path / "zones.json", [_envelope()])
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["schema"] == "senju-private-zone-authority/v1"
    assert payload["semantics"] == "explicit-owner-zone-envelope-with-autonomous-target-enrollment"
    assert payload["records"][0]["owner_authorization"] == "explicit"

    loaded = load_private_zone_registry(path)
    assert loaded == (_envelope(),)


def test_non_authority_actor_cannot_trigger_auto_enrollment():
    with pytest.raises(StandingAuthorizationError, match="META/X/SENJU"):
        auto_enroll_private_targets(
            _standing(),
            _envelope(),
            actor="RANDOM_WORKER",
            discovered_ips=["10.20.1.2"],
        )
