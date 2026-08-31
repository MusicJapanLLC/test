import datetime as dt
import json
from pathlib import Path

from senju.meta.production_continuity import resolve_existing_authority
from senju.meta.production_federated_discovery import (
    eligible_direct_signed_grants,
    stage_direct_signed_grant,
)


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _chain(now: dt.datetime, *, depth: int = 1, expired: bool = False):
    expiry = int(now.timestamp()) + (-1 if expired else 3600)
    lineage = ["root.example.com", "child.example.net"]
    if depth == 2:
        lineage = ["root.example.com", "middle.example.net", "child.example.net"]
    return {
        "schema": "meta-remote-authority-chain/v2",
        "environment": "production",
        "trust_anchor_hosts": ["root.example.com"],
        "promoted": {
            "child.example.net": {
                "host": "child.example.net",
                "expires_at": expiry,
                "allowed_methods": ["GET", "HEAD"],
                "credential_scope": "none",
                "allow_http": False,
                "allow_delete": False,
                "effect": "read_only",
                "source": "remote_authority_chain",
                "declared_by": "root.example.com" if depth == 1 else "middle.example.net",
                "authorization_basis": "signed_remote_delegation",
                "authorization_reference": "root.example.com",
                "lineage": lineage,
                "depth": depth,
                "signature_verified": True,
                "may_delegate_further": depth == 2,
            }
        },
    }


def test_direct_owner_pinned_signed_grant_is_eligible_and_reusable(tmp_path: Path):
    now = dt.datetime(2026, 8, 31, 9, 0, tzinfo=dt.timezone.utc)
    chain = tmp_path / "remote_authority_chain.json"
    _write(chain, _chain(now))

    grants = eligible_direct_signed_grants(chain, now=now)
    assert len(grants) == 1
    grant = grants[0]
    assert grant.target_host == "child.example.net"
    assert grant.source_host == "root.example.com"

    state = tmp_path / "target-state"
    stage_direct_signed_grant(state_dir=state, grant=grant)
    evidence = resolve_existing_authority(
        repo_root=tmp_path / "repo",
        state_dir=state,
        target_host="child.example.net",
        now=now,
    )
    assert evidence is not None
    assert evidence.source == "production_direct_signed_federation"
    assert set(evidence.allowed_methods) == {"GET", "HEAD"}
    assert evidence.credential_scope == "none"


def test_recursive_signed_grandchild_is_not_auto_enrolled(tmp_path: Path):
    now = dt.datetime(2026, 8, 31, 9, 0, tzinfo=dt.timezone.utc)
    chain = tmp_path / "remote_authority_chain.json"
    _write(chain, _chain(now, depth=2))
    assert eligible_direct_signed_grants(chain, now=now) == ()


def test_expired_signed_grant_is_not_auto_enrolled(tmp_path: Path):
    now = dt.datetime(2026, 8, 31, 9, 0, tzinfo=dt.timezone.utc)
    chain = tmp_path / "remote_authority_chain.json"
    _write(chain, _chain(now, expired=True))
    assert eligible_direct_signed_grants(chain, now=now) == ()


def test_write_or_credential_scope_is_rejected(tmp_path: Path):
    now = dt.datetime(2026, 8, 31, 9, 0, tzinfo=dt.timezone.utc)
    payload = _chain(now)
    payload["promoted"]["child.example.net"]["credential_scope"] = "github:write"
    payload["promoted"]["child.example.net"]["allowed_methods"] = ["GET", "POST"]
    chain = tmp_path / "remote_authority_chain.json"
    _write(chain, payload)
    assert eligible_direct_signed_grants(chain, now=now) == ()
