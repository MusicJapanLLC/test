from __future__ import annotations

import datetime as dt
import json

import pytest

from senju.meta.standing_authorization import (
    MAX_LEASE_SECONDS,
    StandingAuthorizationError,
    create_standing_authorization,
    load_registry,
    renew_operational_lease,
    renew_registered_authorization,
    revoke_standing_authorization,
    save_registry,
    sync_canonical_explicit_authorizations,
)


def _now() -> dt.datetime:
    return dt.datetime(2026, 8, 31, 6, 0, tzinfo=dt.timezone.utc)


def _standing():
    return create_standing_authorization(
        authorization_reference="owner-approval-001",
        owner="MusicJapanLLC",
        issuer_kind="owner_explicit",
        exact_hosts=["example.com", "api.example.com"],
        allowed_methods=["GET", "HEAD", "OPTIONS"],
        now=_now(),
    )


def test_standing_authorization_has_no_expiry_field(tmp_path):
    standing = _standing()
    assert standing.is_active is True
    assert not hasattr(standing, "expires_at")
    assert not hasattr(standing, "expires_at_utc")

    path = save_registry(tmp_path / "standing.json", [standing])
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["semantics"] == "durable_until_explicit_revocation"
    assert "expires_at" not in payload["records"][0]
    assert "expires_at_utc" not in payload["records"][0]


@pytest.mark.parametrize("actor", ["META", "X"])
def test_meta_x_can_auto_renew_same_or_narrower_lease(actor):
    standing = _standing()
    result = renew_operational_lease(
        standing,
        actor=actor,
        requested_hosts=["example.com"],
        requested_methods=["GET"],
        lease_seconds=3600,
        reason="still_needed",
        now=_now(),
    )
    assert result.automatically_renewed is True
    assert result.authority_broadened is False
    assert result.lease.actor == actor
    assert result.lease.exact_hosts == ("example.com",)
    assert result.lease.allowed_methods == ("GET",)
    assert result.lease.authorization_reference == standing.authorization_reference
    assert standing.is_active is True


def test_renewal_cannot_add_new_host_or_method():
    standing = _standing()
    with pytest.raises(StandingAuthorizationError, match="may not add hosts"):
        renew_operational_lease(
            standing,
            actor="META",
            requested_hosts=["third-party.example"],
            now=_now(),
        )
    with pytest.raises(StandingAuthorizationError, match="unsupported standing methods"):
        renew_operational_lease(
            standing,
            actor="X",
            requested_methods=["GET", "POST"],
            now=_now(),
        )


def test_revocation_stops_future_auto_renewal():
    standing = revoke_standing_authorization(_standing(), reason="owner revoked")
    assert standing.is_active is False
    with pytest.raises(StandingAuthorizationError, match="revoked"):
        renew_operational_lease(standing, actor="META", now=_now())


def test_meta_x_cannot_mint_standing_authority_themselves():
    for issuer in ["META", "X", "SENJU", "self"]:
        with pytest.raises(StandingAuthorizationError, match="independent explicit issuer"):
            create_standing_authorization(
                authorization_reference="self-issued",
                owner="MusicJapanLLC",
                issuer_kind=issuer,
                exact_hosts=["example.com"],
                now=_now(),
            )


def test_operational_lease_retains_a_bounded_runtime_ttl():
    standing = _standing()
    with pytest.raises(StandingAuthorizationError, match="lease_seconds"):
        renew_operational_lease(
            standing,
            actor="META",
            lease_seconds=MAX_LEASE_SECONDS + 1,
            now=_now(),
        )


def test_canonical_explicit_target_becomes_durable_standing_record(tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    (repo_root / "AUTHORIZED_TEST_TARGETS.json").write_text(
        json.dumps(
            {
                "targets": [
                    {
                        "id": "owned-range",
                        "host": "owned.example",
                        "owner_authorization": "explicit",
                    },
                    {
                        "id": "discovered-only",
                        "host": "unapproved.example",
                        "owner_authorization": "inherited",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    registry = tmp_path / "state" / "standing.json"
    records = sync_canonical_explicit_authorizations(
        repo_root=repo_root,
        registry_path=registry,
        now=_now(),
    )
    assert len(records) == 1
    assert records[0].authorization_reference == "canonical:owned-range"
    assert records[0].exact_hosts == ("owned.example",)
    payload = json.loads(registry.read_text(encoding="utf-8"))
    assert "expires_at" not in payload["records"][0]


def test_registered_standing_record_can_be_auto_renewed_and_logged(tmp_path):
    registry = tmp_path / "standing.json"
    lease_log = tmp_path / "leases.ndjson"
    save_registry(registry, [_standing()])

    result = renew_registered_authorization(
        actor="X",
        authorization_reference="owner-approval-001",
        registry_path=registry,
        lease_log_path=lease_log,
        requested_hosts=["example.com"],
        requested_methods=["HEAD"],
        reason="still_needed",
        now=_now(),
    )
    assert result.automatically_renewed is True
    assert result.lease.actor == "X"
    row = json.loads(lease_log.read_text(encoding="utf-8").strip())
    assert row["renewal_reason"] == "still_needed"
    assert row["authorization_reference"] == "owner-approval-001"


def test_same_authority_can_hold_public_and_explicit_private_scopes(tmp_path):
    standing = create_standing_authorization(
        authorization_reference="owner-unified-network-001",
        owner="MusicJapanLLC",
        issuer_kind="owner_explicit",
        exact_hosts=["public.example.com"],
        allowed_methods=["GET", "HEAD"],
        private_cidrs=["10.20.0.0/16", "fd12:3456:789a::/48"],
        private_dns_names=["api.internal.example", "orders.default.svc.cluster.local"],
        now=_now(),
    )

    assert standing.has_private_network_authority is True
    assert standing.exact_hosts == ("public.example.com",)
    assert standing.private_cidrs == ("10.20.0.0/16", "fd12:3456:789a::/48")
    assert standing.private_dns_names == (
        "api.internal.example",
        "orders.default.svc.cluster.local",
    )

    registry = save_registry(tmp_path / "standing.json", [standing])
    loaded = load_registry(registry)
    assert loaded == (standing,)

    result = renew_operational_lease(
        standing,
        actor="META",
        requested_hosts=["public.example.com"],
        requested_private_cidrs=["10.20.0.0/16"],
        requested_private_dns_names=["api.internal.example"],
        now=_now(),
    )
    assert result.lease.exact_hosts == ("public.example.com",)
    assert result.lease.private_cidrs == ("10.20.0.0/16",)
    assert result.lease.private_dns_names == ("api.internal.example",)
    assert result.authority_broadened is False


def test_public_authority_does_not_transitively_create_private_authority():
    standing = _standing()
    assert standing.has_private_network_authority is False

    with pytest.raises(StandingAuthorizationError, match="may not add private CIDRs"):
        renew_operational_lease(
            standing,
            actor="META",
            requested_private_cidrs=["10.0.0.0/8"],
            now=_now(),
        )

    with pytest.raises(StandingAuthorizationError, match="may not add private DNS names"):
        renew_operational_lease(
            standing,
            actor="X",
            requested_private_dns_names=["db.internal.example"],
            now=_now(),
        )


@pytest.mark.parametrize(
    "cidr",
    [
        "127.0.0.0/8",
        "169.254.0.0/16",
        "169.254.169.254/32",
        "0.0.0.0/32",
        "224.0.0.0/4",
        "::1/128",
        "fe80::/10",
    ],
)
def test_loopback_link_local_metadata_and_special_cidrs_are_not_private_authority(cidr):
    with pytest.raises(StandingAuthorizationError, match="RFC1918/ULA"):
        create_standing_authorization(
            authorization_reference="owner-private-invalid",
            owner="MusicJapanLLC",
            issuer_kind="owner_explicit",
            exact_hosts=["public.example.com"],
            private_cidrs=[cidr],
            now=_now(),
        )


@pytest.mark.parametrize(
    "name",
    [
        "localhost",
        "service.localhost",
        "metadata.google.internal",
        "metadata.azure.internal",
        "instance-data",
        "instance-data.ec2.internal",
    ],
)
def test_loopback_and_metadata_dns_names_are_rejected(name):
    with pytest.raises(StandingAuthorizationError, match="loopback/cloud-metadata"):
        create_standing_authorization(
            authorization_reference="owner-private-dns-invalid",
            owner="MusicJapanLLC",
            issuer_kind="owner_explicit",
            exact_hosts=["public.example.com"],
            private_dns_names=[name],
            now=_now(),
        )


def test_private_renewal_cannot_broaden_beyond_same_authority():
    standing = create_standing_authorization(
        authorization_reference="owner-private-bounded",
        owner="MusicJapanLLC",
        issuer_kind="owner_explicit",
        exact_hosts=["public.example.com"],
        private_cidrs=["10.10.0.0/16"],
        private_dns_names=["api.internal.example"],
        now=_now(),
    )

    with pytest.raises(StandingAuthorizationError, match="may not add private CIDRs"):
        renew_operational_lease(
            standing,
            actor="META",
            requested_private_cidrs=["10.0.0.0/8"],
            now=_now(),
        )

    with pytest.raises(StandingAuthorizationError, match="may not add private DNS names"):
        renew_operational_lease(
            standing,
            actor="X",
            requested_private_dns_names=["new.internal.example"],
            now=_now(),
        )
