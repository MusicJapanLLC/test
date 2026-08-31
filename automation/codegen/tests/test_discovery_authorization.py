import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.discovery_authorization import run_discovery_authorization


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_promotes_only_trusted_root_and_subdomain(tmp_path: Path):
    _write(
        tmp_path / "discovery_policy.json",
        {"trusted_roots": ["owned.example.com"]},
    )
    _write(
        tmp_path / "discovered_urls.json",
        {
            "links": [
                "https://owned.example.com/a",
                "https://api.owned.example.com/b",
                "https://third-party.example.net/c",
            ]
        },
    )

    result = run_discovery_authorization(tmp_path, ttl_seconds=600, repo_root=tmp_path / "repo")

    assert result["authorized_hosts"] == [
        "api.owned.example.com",
        "owned.example.com",
    ]
    authorized = json.loads((tmp_path / "discovery_authorized.json").read_text())
    assert authorized["hosts"]["owned.example.com"]["allowed_methods"] == ["GET", "HEAD"]
    assert "third-party.example.net" not in authorized["hosts"]

    candidates = json.loads((tmp_path / "discovery_candidates.json").read_text())
    third_party = [
        item for item in candidates["candidates"]
        if item["host"] == "third-party.example.net"
    ][0]
    assert third_party["decision"] == "candidate_only"
    assert third_party["authorization_readiness"] in {"review_required", "owner_review_ready"}

    requests = json.loads((tmp_path / "discovery_authorization_requests.json").read_text())
    assert [item["host"] for item in requests["requests"]] == ["third-party.example.net"]


def test_explicit_host_field_is_a_candidate(tmp_path: Path):
    _write(tmp_path / "discovery_policy.json", {"trusted_roots": ["owned.example.com"]})
    _write(
        tmp_path / "discovered_urls.json",
        {"hostname": "worker.owned.example.com"},
    )

    result = run_discovery_authorization(tmp_path, repo_root=tmp_path / "repo")
    assert result["authorized_hosts"] == ["worker.owned.example.com"]


def test_http_credentials_and_ip_literals_do_not_promote(tmp_path: Path):
    _write(tmp_path / "discovery_policy.json", {"trusted_roots": ["owned.example.com"]})
    _write(
        tmp_path / "discovered_urls.json",
        {
            "links": [
                "http://owned.example.com/plain",
                "https://user:pass@owned.example.com/secret",
            ],
            "host": "127.0.0.1",
        },
    )

    result = run_discovery_authorization(tmp_path, repo_root=tmp_path / "repo")
    assert result["authorized_count"] == 0


def test_active_standing_authorization_exact_host_is_reused_without_reprompt(tmp_path: Path):
    repo_root = tmp_path / "repo"
    _write(
        repo_root / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "authorization_reference": "owner:docs",
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": ["docs.example.com"],
                    "allowed_methods": ["GET", "HEAD"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": False,
                    "credential_scope": "none",
                    "destructive": False,
                }
            ],
        },
    )
    _write(
        tmp_path / "discovered_urls.json",
        {"links": ["https://docs.example.com/new-page"]},
    )

    result = run_discovery_authorization(tmp_path, repo_root=repo_root)
    assert result["authorized_hosts"] == ["docs.example.com"]
    assert result["standing_authorized_exact_hosts"] == ["docs.example.com"]

    authorized = json.loads((tmp_path / "discovery_authorized.json").read_text())
    grant = authorized["hosts"]["docs.example.com"]
    assert grant["authorization_basis"] == "standing_authorization_exact_host"
    assert grant["effect"] == "read_only"


def test_standing_exact_host_does_not_silently_expand_to_sibling_or_subdomain(tmp_path: Path):
    repo_root = tmp_path / "repo"
    _write(
        repo_root / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "authorization_reference": "owner:app",
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": ["app.example.com"],
                    "allowed_methods": ["GET", "HEAD"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": False,
                    "credential_scope": "none",
                    "destructive": False,
                }
            ],
        },
    )
    _write(
        tmp_path / "discovered_urls.json",
        {
            "links": [
                "https://child.app.example.com/a",
                "https://api.example.com/b",
            ]
        },
    )

    result = run_discovery_authorization(tmp_path, repo_root=repo_root)
    assert result["authorized_count"] == 0
    assert result["authorization_request_count"] == 2


def test_owner_supplied_exact_link_can_seed_read_only_discovery_authority(tmp_path: Path):
    _write(
        tmp_path / "human_intent_signals.json",
        {
            "owner_context": True,
            "supplied_links": ["https://owner-picked.example.org/start"],
        },
    )
    _write(
        tmp_path / "discovered_urls.json",
        {"links": ["https://owner-picked.example.org/next"]},
    )

    result = run_discovery_authorization(tmp_path, repo_root=tmp_path / "repo")
    assert result["authorized_hosts"] == ["owner-picked.example.org"]
    assert result["owner_supplied_exact_hosts"] == ["owner-picked.example.org"]

    authorized = json.loads((tmp_path / "discovery_authorized.json").read_text())
    grant = authorized["hosts"]["owner-picked.example.org"]
    assert grant["authorization_basis"] == "owner_supplied_exact_host"
    assert grant["credential_scope"] == "none"


def test_revoked_or_destructive_standing_authority_is_not_inherited(tmp_path: Path):
    repo_root = tmp_path / "repo"
    _write(
        repo_root / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "authorization_reference": "revoked",
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": ["revoked.example.com"],
                    "allowed_methods": ["GET"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": True,
                    "credential_scope": "none",
                    "destructive": False,
                },
                {
                    "authorization_reference": "destructive",
                    "owner": "MusicJapanLLC",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": ["destructive.example.com"],
                    "allowed_methods": ["GET"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": False,
                    "credential_scope": "none",
                    "destructive": True,
                },
            ],
        },
    )
    _write(
        tmp_path / "discovered_urls.json",
        {
            "links": [
                "https://revoked.example.com/a",
                "https://destructive.example.com/b",
            ]
        },
    )

    result = run_discovery_authorization(tmp_path, repo_root=repo_root)
    assert result["authorized_count"] == 0
    assert result["authorization_request_count"] == 2
