#!/usr/bin/env python3
"""Summarize generation-over-generation RED live-range evidence.

This module performs no network activity. It reads the bounded live-run report and
memory, compares them with the previous summary when present, and writes durable
RED-only metrics for later cycles.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA = "red-live-range-metrics/v1"


def load(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    data = json.loads(p.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--memory", required=True)
    parser.add_argument("--expected-host", required=True)
    parser.add_argument("--previous")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    report = load(args.report)
    memory = load(args.memory)
    previous = load(args.previous)

    host = str(report.get("authorized_host") or "").lower()
    expected = args.expected_host.lower()
    if host != expected:
        raise SystemExit("unexpected host in evidence")
    if report.get("same_origin_only") is not True:
        raise SystemExit("same-origin invariant missing")
    if report.get("authority_self_expansion") is not False:
        raise SystemExit("authority invariant violated")
    if report.get("destructive_requests") is not False:
        raise SystemExit("destructive request invariant violated")
    if report.get("credential_guessing") is not False:
        raise SystemExit("credential invariant violated")
    if report.get("denial_of_service") is not False:
        raise SystemExit("resource-safety invariant violated")

    families = report.get("probe_family_state") or {}
    ranking = report.get("evolution", {}).get("next_family_ranking") or []
    rows = []
    for position, family in enumerate(ranking, start=1):
        state = families.get(family) or {}
        rows.append({
            "rank": position,
            "family": family,
            "score": state.get("score"),
            "attempts": int(state.get("attempts") or 0),
            "interesting_hits": int(state.get("interesting_hits") or 0),
            "hit_rate": float(state.get("hit_rate") or 0.0),
            "failures": int(state.get("failures") or 0),
            "last_reason": state.get("last_reason"),
        })

    requests = int(report.get("request_count") or 0)
    attempts = sum(row["attempts"] for row in rows)
    hits = sum(row["interesting_hits"] for row in rows)
    failures = sum(row["failures"] for row in rows)
    cycle = int(memory.get("cycles") or report.get("evolution", {}).get("memory_cycles") or 0)
    current_counterexamples = int(report.get("counterexample_count") or 0)

    prev_metrics = previous.get("metrics") or {}
    metrics = {
        "requests": requests,
        "probe_attempts": attempts,
        "interesting_hits": hits,
        "failures": failures,
        "hit_rate": round(hits / attempts, 6) if attempts else 0.0,
        "evidence_per_request": round(hits / requests, 6) if requests else 0.0,
        "counterexamples": current_counterexamples,
        "pages_discovered": int(report.get("pages_discovered") or 0),
        "forms_discovered": int(report.get("forms_discovered") or 0),
    }
    trend = {
        key: round(float(metrics[key]) - float(prev_metrics.get(key, metrics[key])), 6)
        for key in ("hit_rate", "evidence_per_request", "counterexamples", "pages_discovered")
    }

    result = {
        "schema": SCHEMA,
        "authorized_host": host,
        "red_only": True,
        "simulation": False,
        "generation": cycle,
        "source_evidence_digest": report.get("digest"),
        "metrics": metrics,
        "trend_vs_previous": trend,
        "next_family_ranking": rows,
        "persistent_memory": memory,
        "previous_summary_sha256": previous.get("summary_sha256") if previous else None,
    }
    raw = json.dumps(result, ensure_ascii=False, sort_keys=True).encode("utf-8")
    result["summary_sha256"] = hashlib.sha256(raw).hexdigest()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"RED_LIVE_METRICS host={host} generation={cycle} summary={result['summary_sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
