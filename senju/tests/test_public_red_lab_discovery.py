from __future__ import annotations

import json
from pathlib import Path

from senju.public_red_lab_discovery import refresh_public_red_lab_authority


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _repo(tmp_path: Path) -> tuple[Path, Path, Path]:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    meta = repo / "automation" / "codegen" / "meta_state"
    _write(repo / "senju" / "config" / "public-red-lab-registry.json", {
        "targets": [{
            "id": "curated",
            "host": "lab.example.com",
            "base_url": "https://lab.example.com",
            "authorization_evidence_url": "https://evidence.example.com/lab",
            "authorization_note": "operator-published test lab",
        }]
    })
    return repo, state, meta


def test_curated_exact_host_becomes_read_only_authority_and_candidate(tmp_path: Path) -> None:
    repo, state, meta = _repo(tmp_path)
    result = refresh_public_red_lab_authority(repo, state, meta, now=1000)
    assert result["curated_count"] == 1
    authority = json.loads((state / "public_red_lab_authority.json").read_text())
    row = authority["targets"][0]
    assert row["host"] == "lab.example.com"
    assert row["allowed_methods"] == ["GET", "HEAD", "OPTIONS"]
    assert row["credential_scope"] == "none"
    assert row["allow_delete"] is False
    candidates = json.loads((meta / "discovery_candidates.json").read_text())
    assert any(item["host"] == "lab.example.com" for item in candidates["candidates"])


def test_vwad_direct_online_lab_auto_promotes_but_platform_does_not(tmp_path: Path) -> None:
    repo, state, meta = _repo(tmp_path)
    upstream = repo / "vwad.json"
    _write(upstream, [
        {
            "name": "Example Vulnerable Security Lab",
            "collection": ["online"],
            "notes": "intentionally vulnerable test application",
            "references": [{"name": "live", "url": "https://fresh-lab.example.net/path"}],
        },
        {
            "name": "TryHackMe",
            "collection": ["online", "platform"],
            "notes": "security training platform",
            "references": [{"name": "live", "url": "https://platform.example.net/"}],
        },
    ])
    result = refresh_public_red_lab_authority(repo, state, meta, upstream_vwad=upstream, max_auto_new=2, now=2000)
    assert "fresh-lab.example.net" in result["hosts"]
    assert "platform.example.net" not in result["hosts"]
    authority = json.loads((state / "public_red_lab_authority.json").read_text())
    auto = next(row for row in authority["targets"] if row["host"] == "fresh-lab.example.net")
    assert auto["status"] == "PUBLIC_RED_LAB_PROBATIONARY"
    assert auto["allowed_methods"] == ["GET", "HEAD", "OPTIONS"]


def test_auto_growth_is_capped_and_rejects_http_or_private_literals(tmp_path: Path) -> None:
    repo, state, meta = _repo(tmp_path)
    upstream = repo / "vwad.json"
    rows = []
    for index in range(5):
        rows.append({
            "name": f"Vulnerable Test Lab {index}",
            "collection": ["online"],
            "notes": "deliberately vulnerable test app",
            "references": [{"name": "live", "url": f"https://lab{index}.example.net/"}],
        })
    rows.extend([
        {
            "name": "Vulnerable HTTP Lab",
            "collection": ["online"],
            "notes": "vulnerable test app",
            "references": [{"name": "live", "url": "http://cleartext.example.net/"}],
        },
        {
            "name": "Vulnerable Private Lab",
            "collection": ["online"],
            "notes": "vulnerable test app",
            "references": [{"name": "live", "url": "https://127.0.0.1/"}],
        },
    ])
    _write(upstream, rows)
    result = refresh_public_red_lab_authority(repo, state, meta, upstream_vwad=upstream, max_auto_new=2, now=3000)
    assert result["new_probationary_count"] == 2
    assert result["target_count"] == 3
    assert "cleartext.example.net" not in result["hosts"]
    assert "127.0.0.1" not in result["hosts"]


def test_probationary_authority_survives_temporary_upstream_failure_without_widening(tmp_path: Path) -> None:
    repo, state, meta = _repo(tmp_path)
    upstream = repo / "vwad.json"
    _write(upstream, [{
        "name": "Vulnerable Training App",
        "collection": ["online"],
        "notes": "intentionally vulnerable training app",
        "references": [{"name": "live", "url": "https://persist.example.net/"}],
    }])
    refresh_public_red_lab_authority(repo, state, meta, upstream_vwad=upstream, max_auto_new=1, now=4000)
    missing = repo / "missing.json"
    result = refresh_public_red_lab_authority(repo, state, meta, upstream_vwad=missing, max_auto_new=1, now=5000)
    assert "persist.example.net" in result["hosts"]
    authority = json.loads((state / "public_red_lab_authority.json").read_text())
    row = next(item for item in authority["targets"] if item["host"] == "persist.example.net")
    assert row["allowed_methods"] == ["GET", "HEAD", "OPTIONS"]
    assert row["credential_scope"] == "none"
    assert row["cross_host_inheritance"] is False
