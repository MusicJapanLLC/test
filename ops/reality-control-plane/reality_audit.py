#!/usr/bin/env python3
"""Evidence-based runtime truth for The world.

This auditor deliberately ignores conversational claims and static labels when deciding
whether a core capability is actually operating. GitHub Actions is runtime evidence;
verified commercial events are business evidence.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ACTIVE = {"queued", "in_progress", "pending", "waiting", "requested"}


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def api_json(url: str, token: str) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "the-world-reality-audit/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def latest_for_paths(runs: list[dict[str, Any]], paths: list[str]) -> dict[str, Any] | None:
    candidates = [r for r in runs if str(r.get("path", "")) in paths]
    if not candidates:
        return None
    return max(candidates, key=lambda r: str(r.get("created_at", "")))


def runtime_state(run: dict[str, Any] | None, freshness_hours: int, now: datetime) -> tuple[str, str]:
    if run is None:
        return "CONFIG_ONLY", "No matching workflow run was found."
    status = str(run.get("status", ""))
    conclusion = run.get("conclusion")
    if status in ACTIVE:
        return "ACTIVE", f"Latest run is {status}."
    created = parse_time(str(run.get("created_at", "")))
    age_hours = None if created is None else max(0.0, (now - created).total_seconds() / 3600)
    if conclusion != "success":
        return "FAILED_RECENT", f"Latest completed run conclusion={conclusion or 'unknown'}."
    if age_hours is None or age_hours > freshness_hours:
        return "STALE", f"Latest success is older than the {freshness_hours}h freshness window."
    return "PROVEN", f"Latest run succeeded {age_hours:.2f}h ago."


def verified_commercial(events: dict[str, Any]) -> dict[str, Any]:
    verified = []
    cash = 0
    for event in events.get("events", []) or []:
        if not isinstance(event, dict) or event.get("verified") is not True:
            continue
        if not event.get("evidence_ref"):
            continue
        stage = str(event.get("stage", ""))
        if stage not in {"outreach_ready", "meeting", "proposal", "contract", "payment"}:
            continue
        verified.append(event)
        if stage == "payment":
            amount = max(0, int(event.get("amount_yen", 0) or 0))
            cash += amount
    return {
        "verified_event_count": len(verified),
        "verified_cash_yen": cash,
        "revenue_connected": bool(verified),
    }


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def audit(config: dict[str, Any], runs: list[dict[str, Any]], root: Path, now: datetime) -> dict[str, Any]:
    cores = []
    for core in config.get("cores", []):
        paths = list(core.get("expected_workflows") or [])
        latest = latest_for_paths(runs, paths) if paths else None
        state, reason = runtime_state(latest, int(core.get("freshness_hours", 24)), now)
        entry: dict[str, Any] = {
            "id": core.get("id"),
            "name": core.get("name"),
            "runtime_state": state,
            "reason": reason,
            "proof_requirement": core.get("proof_requirement"),
            "latest_run": None,
        }
        if latest:
            entry["latest_run"] = {
                "id": latest.get("id"),
                "name": latest.get("name"),
                "path": latest.get("path"),
                "status": latest.get("status"),
                "conclusion": latest.get("conclusion"),
                "created_at": latest.get("created_at"),
                "html_url": latest.get("html_url"),
            }
        commercial_path = core.get("commercial_events_path")
        if commercial_path:
            entry["commercial"] = verified_commercial(load_json(root / str(commercial_path)))
        cores.append(entry)

    blocking = [c for c in cores if c["runtime_state"] in {"FAILED_RECENT", "STALE", "CONFIG_ONLY"}]
    revenue = next((c for c in cores if c["id"] == "revenue-agent"), {})
    commercial = revenue.get("commercial") or {}
    return {
        "schema": "the-world-reality-audit/v1",
        "generated_at": now.isoformat(timespec="seconds"),
        "truth_source": "GitHub Actions + verified commercial event contract",
        "overall": "PROVEN" if not blocking else "UNPROVEN",
        "blocking_core_count": len(blocking),
        "verified_cash_yen": int(commercial.get("verified_cash_yen", 0) or 0),
        "revenue_connected": bool(commercial.get("revenue_connected", False)),
        "cores": cores,
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        "# THE WORLD — REALITY AUDIT",
        "",
        f"- overall: **{report['overall']}**",
        f"- blocking cores: **{report['blocking_core_count']}**",
        f"- verified cash: **¥{report['verified_cash_yen']:,}**",
        f"- revenue connected: **{str(report['revenue_connected']).lower()}**",
        "",
        "| Core | Runtime truth | Latest evidence |",
        "|---|---|---|",
    ]
    for core in report["cores"]:
        run = core.get("latest_run") or {}
        evidence = f"run {run.get('id')} / {run.get('conclusion') or run.get('status')}" if run else "none"
        lines.append(f"| {core['name']} | **{core['runtime_state']}** | {evidence} |")
    lines += [
        "",
        "> A chat message, Slack post, role/persona count, PR, source file, or static `VERIFIED` label is not runtime proof.",
        "> Completion requires current machine evidence. Revenue requires a trusted verified commercial event.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="ops/reality-control-plane/core-runtime.json")
    p.add_argument("--runs-file", help="Optional GitHub Actions API fixture for offline tests")
    p.add_argument("--out-json", default="reports/reality-audit/latest.json")
    p.add_argument("--out-md", default="reports/reality-audit/latest.md")
    args = p.parse_args()

    root = Path.cwd()
    config = load_json(root / args.config)
    if not config:
        raise SystemExit("Reality config is missing or invalid")

    if args.runs_file:
        payload = load_json(root / args.runs_file)
    else:
        repo = os.environ.get("GITHUB_REPOSITORY", "")
        token = os.environ.get("GITHUB_TOKEN", "")
        if not repo or not token:
            raise SystemExit("GITHUB_REPOSITORY and GITHUB_TOKEN are required unless --runs-file is used")
        payload = api_json(f"https://api.github.com/repos/{repo}/actions/runs?per_page=100", token)

    now = datetime.now(timezone.utc)
    report = audit(config, list(payload.get("workflow_runs") or []), root, now)
    out_json, out_md = root / args.out_json, root / args.out_md
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(render(report), encoding="utf-8")
    print(json.dumps({
        "overall": report["overall"],
        "blocking_core_count": report["blocking_core_count"],
        "verified_cash_yen": report["verified_cash_yen"],
        "revenue_connected": report["revenue_connected"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
