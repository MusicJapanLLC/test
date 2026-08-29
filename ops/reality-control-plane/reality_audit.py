#!/usr/bin/env python3
"""Evidence-based runtime truth for The world.

Conversational claims, role counts, Slack posts, PRs and static labels never prove
runtime health. Critical workflows fail closed to their worst current evidence. Fresh,
explicitly verified external runtime evidence may prove non-GitHub substrates such as
the Company Memory database. Verified commercial events are business truth.
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
STATE_PRIORITY = {
    "FAILED_RECENT": 5,
    "CONFIG_ONLY": 4,
    "STALE": 3,
    "ACTIVE": 2,
    "PROVEN": 1,
}


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


def latest_for_path(runs: list[dict[str, Any]], path: str) -> dict[str, Any] | None:
    candidates = [r for r in runs if str(r.get("path", "")) == path]
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


def run_view(run: dict[str, Any] | None) -> dict[str, Any] | None:
    if not run:
        return None
    return {
        "id": run.get("id"),
        "name": run.get("name"),
        "path": run.get("path"),
        "status": run.get("status"),
        "conclusion": run.get("conclusion"),
        "created_at": run.get("created_at"),
        "html_url": run.get("html_url"),
    }


def external_state(
    evidence_doc: dict[str, Any], evidence_id: str, freshness_hours: int, now: datetime
) -> tuple[str, str, dict[str, Any] | None]:
    match = next(
        (
            item
            for item in evidence_doc.get("evidence", []) or []
            if isinstance(item, dict) and str(item.get("id")) == evidence_id
        ),
        None,
    )
    if not match or match.get("verified") is not True:
        return "CONFIG_ONLY", "No verified external runtime evidence exists.", match
    verified_at = parse_time(str(match.get("verified_at", "")))
    if verified_at is None:
        return "STALE", "External evidence has no valid verified_at timestamp.", match
    ttl = min(freshness_hours, int(match.get("freshness_hours", freshness_hours) or freshness_hours))
    age_hours = max(0.0, (now - verified_at).total_seconds() / 3600)
    if age_hours > ttl:
        return "STALE", f"External evidence is {age_hours:.2f}h old; TTL is {ttl}h.", match
    return "PROVEN", f"Fresh verified external evidence is {age_hours:.2f}h old.", match


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
            cash += max(0, int(event.get("amount_yen", 0) or 0))
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
    external_doc = load_json(root / "ops/reality-control-plane/external-evidence.json")
    for core in config.get("cores", []):
        paths = list(core.get("expected_workflows") or [])
        freshness = int(core.get("freshness_hours", 24))
        workflow_evidence = []
        external_evidence = None

        if paths:
            for path in paths:
                run = latest_for_path(runs, path)
                state, reason = runtime_state(run, freshness, now)
                workflow_evidence.append({
                    "path": path,
                    "runtime_state": state,
                    "reason": reason,
                    "latest_run": run_view(run),
                })
            worst = max(workflow_evidence, key=lambda item: STATE_PRIORITY[item["runtime_state"]])
            state = str(worst["runtime_state"])
            reason = f"Fail-closed aggregate; worst evidence is {worst['path']}: {worst['reason']}"
        elif core.get("external_evidence_id"):
            state, reason, external_evidence = external_state(
                external_doc,
                str(core["external_evidence_id"]),
                freshness,
                now,
            )
        else:
            state = "CONFIG_ONLY"
            reason = "No runtime workflow or external evidence source is registered for this core."

        entry: dict[str, Any] = {
            "id": core.get("id"),
            "name": core.get("name"),
            "runtime_state": state,
            "reason": reason,
            "proof_requirement": core.get("proof_requirement"),
            "workflow_evidence": workflow_evidence,
        }
        if external_evidence is not None:
            entry["external_evidence"] = {
                "id": external_evidence.get("id"),
                "verified": external_evidence.get("verified"),
                "verified_at": external_evidence.get("verified_at"),
                "source": external_evidence.get("source"),
                "scope": external_evidence.get("scope"),
                "checks": external_evidence.get("checks") or [],
                "limitations": external_evidence.get("limitations") or [],
            }
        commercial_path = core.get("commercial_events_path")
        if commercial_path:
            entry["commercial"] = verified_commercial(load_json(root / str(commercial_path)))
        cores.append(entry)

    runtime_blocking_ids = {
        str(c["id"])
        for c in cores
        if c["runtime_state"] in {"FAILED_RECENT", "STALE", "CONFIG_ONLY"}
    }
    revenue = next((c for c in cores if c["id"] == "revenue-agent"), {})
    commercial = revenue.get("commercial") or {}
    revenue_connected = bool(commercial.get("revenue_connected", False))
    blocking_ids = set(runtime_blocking_ids)
    if not revenue_connected:
        blocking_ids.add("revenue-agent")

    return {
        "schema": "the-world-reality-audit/v1",
        "generated_at": now.isoformat(timespec="seconds"),
        "truth_source": "GitHub Actions + fresh verified external runtime evidence + verified commercial event contract",
        "overall": "PROVEN" if not blocking_ids else "UNPROVEN",
        "blocking_core_count": len(blocking_ids),
        "blocking_core_ids": sorted(blocking_ids),
        "verified_cash_yen": int(commercial.get("verified_cash_yen", 0) or 0),
        "revenue_connected": revenue_connected,
        "cores": cores,
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        "# THE WORLD — REALITY AUDIT",
        "",
        f"- overall: **{report['overall']}**",
        f"- blocking cores: **{report['blocking_core_count']}** ({', '.join(report['blocking_core_ids']) or 'none'})",
        f"- verified cash: **¥{report['verified_cash_yen']:,}**",
        f"- revenue connected: **{str(report['revenue_connected']).lower()}**",
        "",
        "| Core | Runtime truth | Evidence summary |",
        "|---|---|---|",
    ]
    for core in report["cores"]:
        ev = core.get("workflow_evidence") or []
        ext = core.get("external_evidence")
        if ev:
            summary = ", ".join(
                f"{Path(str(item['path'])).name}:{item['runtime_state']}"
                for item in ev
            )
        elif ext:
            summary = f"{ext.get('source')} @ {ext.get('verified_at')}"
        else:
            summary = "no runtime evidence"
        lines.append(f"| {core['name']} | **{core['runtime_state']}** | {summary} |")
    lines += [
        "",
        "> A chat message, Slack post, role/persona count, PR, source file, or static `VERIFIED` label is not runtime proof.",
        "> Overall PROVEN also requires the revenue core to have at least one trusted verified commercial event.",
        "> Cash still requires a verified payment event; operational success alone is never revenue.",
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

    report = audit(config, list(payload.get("workflow_runs") or []), root, datetime.now(timezone.utc))
    out_json, out_md = root / args.out_json, root / args.out_md
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(render(report), encoding="utf-8")
    print(json.dumps({
        "overall": report["overall"],
        "blocking_core_count": report["blocking_core_count"],
        "blocking_core_ids": report["blocking_core_ids"],
        "verified_cash_yen": report["verified_cash_yen"],
        "revenue_connected": report["revenue_connected"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
