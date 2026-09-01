from __future__ import annotations

import json
from pathlib import Path

from senju.red_authorized_url_pool import build_authorized_url_pool


def _queue(path: Path, count: int = 13) -> Path:
    targets = []
    for idx in range(count):
        targets.append({
            "host": f"lab{idx}.example.com",
            "seed_url": f"https://lab{idx}.example.com/",
            "allowed_methods": ["GET", "HEAD"],
            "shared_instance": idx % 2 == 0,
            "rate_limit_rps": 1,
        })
    path.write_text(json.dumps({"targets": targets}), encoding="utf-8")
    return path


def test_pool_reaches_one_hundred_from_authorized_hosts(tmp_path: Path) -> None:
    result = build_authorized_url_pool(_queue(tmp_path / "queue.json"), pool_size=100, window_size=24, rotation=0, now=1)
    assert result["authorized_host_count"] == 13
    assert result["url_count"] == 100
    assert result["pool_full"] is True
    assert len(result["selected_urls"]) == 24
    assert all(row["transport_allowed"] is True for row in result["urls"])
    assert all(row["url"].startswith("https://lab") for row in result["urls"])


def test_observed_same_host_urls_are_prioritized(tmp_path: Path) -> None:
    queue = _queue(tmp_path / "queue.json", count=2)
    report = tmp_path / "report.json"
    report.write_text(json.dumps({
        "contacts": [{
            "url": "https://lab1.example.com/start",
            "final_url": "https://lab1.example.com/start",
            "discovered_links": ["https://lab1.example.com/deep", "https://evil.invalid/nope"],
        }]
    }), encoding="utf-8")
    result = build_authorized_url_pool(queue, red_reports=[report], pool_size=20, window_size=10, now=1)
    urls = [row["url"] for row in result["urls"]]
    assert urls[:2] == ["https://lab1.example.com/start", "https://lab1.example.com/deep"]
    assert all("evil.invalid" not in url for url in urls)


def test_rotation_moves_validation_window(tmp_path: Path) -> None:
    queue = _queue(tmp_path / "queue.json", count=13)
    first = build_authorized_url_pool(queue, pool_size=100, window_size=24, rotation=0, now=1)
    second = build_authorized_url_pool(queue, pool_size=100, window_size=24, rotation=1, now=1)
    assert [x["url"] for x in first["selected_urls"]] != [x["url"] for x in second["selected_urls"]]


def test_unknown_hosts_from_reports_never_enter_pool(tmp_path: Path) -> None:
    queue = _queue(tmp_path / "queue.json", count=1)
    report = tmp_path / "report.json"
    report.write_text(json.dumps({
        "contacts": [{
            "url": "https://evil.invalid/",
            "final_url": "https://evil.invalid/",
            "discovered_links": ["https://evil.invalid/x"],
        }]
    }), encoding="utf-8")
    result = build_authorized_url_pool(queue, red_reports=[report], pool_size=20, now=1)
    assert all(row["host"] == "lab0.example.com" for row in result["urls"])
    assert result["unknown_host_transport"] is False
