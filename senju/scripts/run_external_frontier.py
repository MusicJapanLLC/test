#!/usr/bin/env python3
"""Run Senju's approval-free public-web research frontier.

The frontier follows public HTTP(S) links using GET/HEAD only. Newly discovered
public hosts may be added automatically to the read scope, but discovery never
creates write/effect authority. The output is a compact evidence summary intended
for Senju's advisor, PR #252 self-development, and Jules/OpenHands handoffs.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable

from senju.autonomy.discovery import AutonomyLoop, WorkItem


def run_frontier(
    seed_urls: Iterable[str],
    *,
    out_dir: str | Path,
    max_steps: int = 24,
    max_host_budget: int = 32,
    client=None,  # noqa: ANN001
) -> dict[str, Any]:
    seeds = [str(url).strip() for url in seed_urls if str(url).strip()]
    if not seeds:
        raise ValueError("at least one seed URL is required")
    if not 1 <= int(max_steps) <= 100:
        raise ValueError("max_steps must be between 1 and 100")
    if not 1 <= int(max_host_budget) <= 100:
        raise ValueError("max_host_budget must be between 1 and 100")

    output = Path(out_dir)
    output.mkdir(parents=True, exist_ok=True)
    loop = AutonomyLoop(
        allow_hosts=[],
        out_dir=output,
        client=client,
        max_host_budget=int(max_host_budget),
        auto_authorize_reads=True,
    )

    for index, url in enumerate(seeds, 1):
        loop.queue.enqueue(
            WorkItem(
                id=f"seed-{index}",
                item_type="discovery",
                url=url,
                method="GET",
                source="agency_seed",
                novelty_score=1.0,
                expected_research_value=0.8,
            )
        )

    results: list[dict[str, Any]] = []
    visited_urls: list[str] = []
    evidence_paths: list[str] = []
    discovered_links = 0

    for _ in range(int(max_steps)):
        item = loop.queue.pop_next()
        if item is None:
            break
        result = loop.execute_step(item)
        visited_urls.append(item.url)
        evidence_path = result.get("evidence_path")
        if evidence_path:
            evidence_paths.append(str(evidence_path))
        discovered_links += int(result.get("new_enqueued_candidates") or 0)
        results.append(
            {
                "url": item.url,
                "success": bool(result.get("success")),
                "auto_authorized_read_host": bool(result.get("auto_authorized_read_host")),
                "auto_authorized_discovered_hosts": list(
                    result.get("auto_authorized_discovered_hosts") or []
                ),
                "new_enqueued_candidates": int(result.get("new_enqueued_candidates") or 0),
                "error": result.get("error"),
            }
        )

    successful = sum(1 for item in results if item["success"])
    summary = {
        "schema": "senju-external-frontier/v1",
        "mode": "public-read-only-autonomy",
        "seed_urls": seeds,
        "max_steps": int(max_steps),
        "max_host_budget": int(max_host_budget),
        "steps_executed": len(results),
        "successful_steps": successful,
        "failed_steps": len(results) - successful,
        "discovered_links_enqueued": discovered_links,
        "visited_urls": visited_urls,
        "read_scope_hosts": sorted(loop.allow_hosts),
        "evidence_paths": evidence_paths,
        "results": results,
        "external_write_attempted": False,
        "external_exploit_attempted": False,
    }
    return summary


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed-url", action="append", default=[])
    ap.add_argument("--out-dir", default="reports/external-frontier")
    ap.add_argument("--out", default="reports/external-frontier.json")
    ap.add_argument("--max-steps", type=int, default=24)
    ap.add_argument("--max-host-budget", type=int, default=32)
    args = ap.parse_args()

    summary = run_frontier(
        args.seed_url,
        out_dir=args.out_dir,
        max_steps=args.max_steps,
        max_host_budget=args.max_host_budget,
    )
    encoded = json.dumps(summary, ensure_ascii=False, indent=2) + "\n"
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
