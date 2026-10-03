#!/usr/bin/env python3
"""Build durable learning from consecutive owned-site audit reports.

The input reports contain live observations. This module performs no network I/O:
it compares current evidence with the previous successful run and ranks recurring
or newly observed defensive findings for follow-up.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "owned-site-live-learning/v1"


def _load(path: str | Path) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"expected JSON object: {path}")
    return data


def _target_map(report: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    result: dict[str, Mapping[str, Any]] = {}
    for target in report.get("targets") or []:
        if not isinstance(target, Mapping):
            continue
        origin = str(target.get("origin") or "")
        if origin:
            result[origin] = target
    return result


def _page_map(target: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    result: dict[str, Mapping[str, Any]] = {}
    for page in target.get("pages") or []:
        if not isinstance(page, Mapping):
            continue
        url = str(page.get("url") or "")
        if url:
            result[url] = page
    return result


def _finding_keys(target: Mapping[str, Any]) -> set[tuple[str, str, str]]:
    keys: set[tuple[str, str, str]] = set()
    for page in target.get("pages") or []:
        if not isinstance(page, Mapping):
            continue
        url = str(page.get("url") or "")
        for finding in page.get("findings") or []:
            if not isinstance(finding, Mapping):
                continue
            keys.add((url, str(finding.get("type") or "other"), str(finding.get("detail") or "")))
    return keys


def _finding_frequency(target: Mapping[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for page in target.get("pages") or []:
        if not isinstance(page, Mapping):
            continue
        for finding in page.get("findings") or []:
            if not isinstance(finding, Mapping):
                continue
            key = str(finding.get("type") or "other")
            counts[key] = counts.get(key, 0) + 1
    return counts


def _page_changes(current: Mapping[str, Any], previous: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    current_pages = _page_map(current)
    previous_pages = _page_map(previous or {})
    urls = sorted(set(current_pages) | set(previous_pages))
    changes: list[dict[str, Any]] = []
    for url in urls:
        now = current_pages.get(url)
        before = previous_pages.get(url)
        if before is None:
            changes.append({"url": url, "change": "discovered"})
            continue
        if now is None:
            changes.append({"url": url, "change": "missing"})
            continue
        fields: list[str] = []
        for key in ("status", "body_sha256", "content_type", "title"):
            if now.get(key) != before.get(key):
                fields.append(key)
        if now.get("technology_hints") != before.get("technology_hints"):
            fields.append("technology_hints")
        if fields:
            changes.append({"url": url, "change": "modified", "fields": fields})
    return changes


def build_learning(current: Mapping[str, Any], previous: Mapping[str, Any] | None = None) -> dict[str, Any]:
    current_targets = _target_map(current)
    previous_targets = _target_map(previous or {})
    targets: list[dict[str, Any]] = []
    global_priority: dict[str, dict[str, int]] = {}

    for origin, now in current_targets.items():
        before = previous_targets.get(origin)
        now_findings = _finding_keys(now)
        before_findings = _finding_keys(before or {})
        new_findings = sorted(now_findings - before_findings)
        resolved_findings = sorted(before_findings - now_findings)
        recurring_findings = sorted(now_findings & before_findings)
        frequencies = _finding_frequency(now)

        for finding_type, count in frequencies.items():
            row = global_priority.setdefault(finding_type, {"current_count": 0, "recurring_count": 0, "new_count": 0})
            row["current_count"] += count
        for _, finding_type, _ in recurring_findings:
            global_priority.setdefault(finding_type, {"current_count": 0, "recurring_count": 0, "new_count": 0})["recurring_count"] += 1
        for _, finding_type, _ in new_findings:
            global_priority.setdefault(finding_type, {"current_count": 0, "recurring_count": 0, "new_count": 0})["new_count"] += 1

        targets.append({
            "origin": origin,
            "pages_checked": int(now.get("pages_checked") or 0),
            "page_changes": _page_changes(now, before),
            "new_findings": [{"url": url, "type": finding_type, "detail": detail} for url, finding_type, detail in new_findings],
            "resolved_findings": [{"url": url, "type": finding_type, "detail": detail} for url, finding_type, detail in resolved_findings],
            "recurring_findings": [{"url": url, "type": finding_type, "detail": detail} for url, finding_type, detail in recurring_findings],
            "finding_frequency": dict(sorted(frequencies.items())),
        })

    ranking: list[dict[str, Any]] = []
    for finding_type, row in global_priority.items():
        score = row["current_count"] + (2 * row["recurring_count"]) + (3 * row["new_count"])
        ranking.append({"type": finding_type, **row, "follow_up_score": score})
    ranking.sort(key=lambda item: (-item["follow_up_score"], item["type"]))

    packet: dict[str, Any] = {
        "schema": SCHEMA,
        "live_evidence": True,
        "simulation": False,
        "previous_evidence_available": previous is not None,
        "targets": targets,
        "adaptive_follow_up_ranking": ranking,
        "learning_rule": "Prioritize new and recurring defensive findings while preserving the raw live evidence needed to verify whether a later change resolves or reintroduces them.",
    }
    raw = json.dumps(packet, ensure_ascii=False, sort_keys=True).encode("utf-8")
    packet["packet_sha256"] = hashlib.sha256(raw).hexdigest()
    return packet


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--current", required=True)
    ap.add_argument("--previous")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    current = _load(args.current)
    previous = _load(args.previous) if args.previous and Path(args.previous).is_file() else None
    packet = build_learning(current, previous)
    out = Path(args.out)
    out.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(packet, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
