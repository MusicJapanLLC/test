import json
from pathlib import Path

from engine.remote_authority_chain import run_remote_authority_chain


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _policy(state: Path, *roots: str) -> None:
    _write(state / "discovery_policy.json", {"trusted_roots": list(roots)})


def test_well_known_declaration_builds_recursive_production_chain_inside_owner_root(tmp_path: Path):
    state = tmp_path / "state"
    _policy(state, "owned.example.com")
    _write(
        state / "remote_authority_declarations.json",
        {
            "declarations": [
                {
                    "source_host": "owned.example.com",
                    "source_kind": "well_known_manifest",
                    "evidence_url": "https://owned.example.com/.well-known/security-test-federation.json",
                    "members": ["b.owned.example.com"],
                },
                {
                    "source_host": "b.owned.example.com",
                    "source_kind": "remote_declaration",
                    "authorized_hosts": ["c.owned.example.com"],
                },
                {
                    "source_host": "c.owned.example.com",
                    "source_kind": "linked_registry",
                    "hosts": ["d.owned.example.com"],
                },
            ]
        },
    )

    result = run_remote_authority_chain(state, repo_root=tmp_path / "repo", ttl_seconds=600)
    assert result["environment"] == "production"
    assert result["fixed_chain_depth_limit"] is None
    assert result["promoted_hosts"] == [
        "b.owned.example.com",
        "c.owned.example.com",
        "d.owned.example.com",
    ]

    chain = json.loads((state / "remote_authority_chain.json").read_text())
    d = chain["promoted"]["d.owned.example.com"]
    assert d["lineage"] == [
        "owned.example.com",
        "b.owned.example.com",
        "c.owned.example.com",
        "d.owned.example.com",
    ]
    assert d["depth"] == 3
    assert d["credential_scope"] == "none"
    assert d["allowed_methods"] == ["GET", "HEAD"]


def test_remote_host_cannot_self_mint_unrelated_new_trust_root(tmp_path: Path):
    state = tmp_path / "state"
    _policy(state, "owned.example.com")
    _write(
        state / "remote_authority_declarations.json",
        {
            "declarations": [
                {
                    "source_host": "owned.example.com",
                    "source_kind": "remote_policy",
                    "authorized_hosts": ["unrelated.example.net"],
                }
            ]
        },
    )

    result = run_remote_authority_chain(state, repo_root=tmp_path / "repo")
    assert result["promoted_count"] == 0
    assert result["candidate_count"] == 1

    chain = json.loads((state / "remote_authority_chain.json").read_text())
    row = chain["observations"][0]
    assert row["declared_host"] == "unrelated.example.net"
    assert row["decision"] == "authority_candidate"
    assert row["reason"] == "remote_declaration_has_no_independent_owner_basis"


def test_standing_exact_host_can_be_promoted_from_remote_declaration_then_join_chain(tmp_path: Path):
    state = tmp_path / "state"
    _policy(state, "owned.example.com")
    repo = tmp_path / "repo"
    _write(
        repo / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": ["partner.example.net"],
                    "allowed_methods": ["GET", "HEAD"],
                    "revoked": False,
                    "credential_scope": "none",
                    "destructive": False,
                }
            ],
        },
    )
    _write(
        state / "remote_authority_declarations.json",
        {
            "declarations": [
                {
                    "source_host": "owned.example.com",
                    "source_kind": "federation_member",
                    "members": ["partner.example.net"],
                },
                {
                    "source_host": "partner.example.net",
                    "source_kind": ".well-known",
                    "members": ["child.partner.example.net"],
                },
            ]
        },
    )

    result = run_remote_authority_chain(state, repo_root=repo)
    assert result["promoted_hosts"] == ["partner.example.net"]
    # partner itself may participate after promotion, but its unrelated child still
    # needs its own independent owner basis before execution authority is generated.
    chain = json.loads((state / "remote_authority_chain.json").read_text())
    child = [x for x in chain["observations"] if x.get("declared_host") == "child.partner.example.net"][0]
    assert child["decision"] == "authority_candidate"


def test_unknown_remote_source_kind_is_recorded_but_not_promoted(tmp_path: Path):
    state = tmp_path / "state"
    _policy(state, "owned.example.com")
    _write(
        state / "remote_authority_declarations.json",
        {
            "declarations": [
                {
                    "source_host": "owned.example.com",
                    "source_kind": "random_web_text",
                    "hosts": ["b.owned.example.com"],
                }
            ]
        },
    )

    result = run_remote_authority_chain(state, repo_root=tmp_path / "repo")
    assert result["promoted_count"] == 0
    chain = json.loads((state / "remote_authority_chain.json").read_text())
    assert chain["observations"][0]["reason"] == "unsupported_remote_source_kind"


def test_cycles_terminate_without_fixed_depth_limit(tmp_path: Path):
    state = tmp_path / "state"
    _policy(state, "owned.example.com")
    _write(
        state / "remote_authority_declarations.json",
        {
            "declarations": [
                {"source_host": "owned.example.com", "source_kind": "remote_declaration", "members": ["b.owned.example.com"]},
                {"source_host": "b.owned.example.com", "source_kind": "remote_declaration", "members": ["owned.example.com"]},
            ]
        },
    )

    result = run_remote_authority_chain(state, repo_root=tmp_path / "repo")
    assert result["fixed_chain_depth_limit"] is None
    assert "b.owned.example.com" in result["promoted_hosts"]
