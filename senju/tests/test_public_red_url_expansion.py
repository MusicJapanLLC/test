from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def _load_script(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


expander = _load_script("public_red_seed_expander", "senju/scripts/public_red_seed_expander.py")
burst = _load_script("public_red_burst_fanout", "senju/scripts/public_red_burst_fanout.py")


def test_route_seed_catalog_has_broad_operator_backed_url_supply():
    doc = json.loads((ROOT / "senju/config/public_red_route_seeds.json").read_text(encoding="utf-8"))
    sources = doc["sources"]
    assert sources
    paths = [path for source in sources for path in source["paths"]]
    assert len(paths) >= 40
    assert len(set(paths)) == len(paths)
    assert all(str(path).startswith("/") for path in paths)
    assert all(source.get("evidence_url") for source in sources)
    assert all(source.get("route_source") for source in sources)


def test_seed_path_rejects_cross_host_query_fragment_and_absolute_schemes():
    assert expander._safe_seed_path("/dom/toxicdom") == "/dom/toxicdom"
    assert expander._safe_seed_path("dom/eventtriggering") == "/dom/eventtriggering"
    for raw in (
        "//evil.example/path",
        "https://evil.example/path",
        "http://evil.example/path",
        "ftp://evil.example/path",
        "mailto:red@example.com",
        "/path?q=payload",
        "/path#fragment",
    ):
        with pytest.raises(ValueError):
            expander._safe_seed_path(raw)


def test_seed_expansion_requires_existing_standing_and_effective_authority():
    config = {
        "providers": [{
            "id": "lab-provider",
            "operator": "Lab Operator",
            "evidence_urls": ["https://operator.example/evidence"],
            "exact_hosts": ["lab.example.com"],
        }],
        "target_profiles": [],
    }
    seeds = {
        "sources": [{
            "provider_id": "lab-provider",
            "host": "lab.example.com",
            "evidence_url": "https://operator.example/evidence",
            "route_source": "https://operator.example/routes",
            "paths": ["/one", "/two"],
        }]
    }
    standing = {
        "records": [{
            "exact_hosts": ["lab.example.com"],
            "allowed_methods": ["GET", "HEAD", "OPTIONS"],
            "credential_scope": "none",
            "destructive": False,
            "revoked": False,
            "authorization_evidence_url": "https://operator.example/evidence",
        }]
    }

    profiles, added = expander.expand_seed_routes(
        config=config,
        seeds=seeds,
        discovery={},
        standing_doc=standing,
        effective_doc={"ceiling": {"exact_hosts": ["lab.example.com"]}},
    )
    assert len(profiles) == 2
    assert len(added) == 2
    assert all(row["url"].startswith("https://lab.example.com/") for row in profiles)

    blocked, blocked_added = expander.expand_seed_routes(
        config=config,
        seeds=seeds,
        discovery={},
        standing_doc=standing,
        effective_doc={"ceiling": {"exact_hosts": []}},
    )
    assert blocked == []
    assert blocked_added == []


def test_diverse_batch_prefers_distinct_authorized_hosts():
    profiles = [
        {"id": "a1", "host": "a.example", "url": "https://a.example/1"},
        {"id": "a2", "host": "a.example", "url": "https://a.example/2"},
        {"id": "b1", "host": "b.example", "url": "https://b.example/1"},
        {"id": "b2", "host": "b.example", "url": "https://b.example/2"},
        {"id": "c1", "host": "c.example", "url": "https://c.example/1"},
        {"id": "c2", "host": "c.example", "url": "https://c.example/2"},
    ]
    batch = burst._diverse_batch(profiles, "op-123", 3)
    assert len(batch) == 3
    assert len({row["host"] for row in batch}) == 3


def test_burst_cycle_has_hard_request_profile_cap():
    profiles = [
        {"id": f"p{i}", "host": f"h{i}.example", "url": f"https://h{i}.example/"}
        for i in range(30)
    ]
    batch = burst._diverse_batch(profiles, "op-cap", 99)
    assert len(batch) == burst.MAX_PROFILES_PER_CYCLE == 6
