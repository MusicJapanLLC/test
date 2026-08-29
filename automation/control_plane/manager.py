#!/usr/bin/env python3
"""TOMOKI/MANAGER: deterministic self-healing supervisor for GitHub workers.

The manager does not escalate a stopped worker before attempting bounded recovery.
No secrets or raw business payloads are written to reports.
Operational health is based only on the events configured for each worker; a push/test
run must never masquerade as proof that a scheduled production worker is alive.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API = "https://api.github.com"
BAD = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}
ACTIVE = {"queued", "in_progress", "waiting", "requested", "pending"}


def request(path: str, *, method: str = "GET", body: Any = None) -> tuple[int, Any]:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GitHub token missing")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tomoki-manager",
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"message": raw[:300]}
        return exc.code, payload


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def age_minutes(value: str | None) -> float | None:
    dt = parse_dt(value)
    if not dt:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds() / 60


def list_runs(repo: str, workflow: str, branch: str) -> list[dict[str, Any]]:
    owner, name = repo.split("/", 1)
    path = f"/repos/{owner}/{name}/actions/workflows/{workflow}/runs?branch={branch}&per_page=10"
    status, payload = request(path)
    if status != 200:
        return []
    return payload.get("workflow_runs", [])


def operational_runs(worker: dict[str, Any], runs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    allowed = set(worker.get("operational_events") or [])
    if not allowed:
        return runs
    return [run for run in runs if run.get("event") in allowed]


def rerun_failed(repo: str, run_id: int) -> tuple[bool, str]:
    owner, name = repo.split("/", 1)
    status, payload = request(f"/repos/{owner}/{name}/actions/runs/{run_id}/rerun-failed-jobs", method="POST")
    return status in {201, 202}, f"rerun_failed:{status}:{payload.get('message','')}"


def dispatch(repo: str, workflow: str, branch: str) -> tuple[bool, str]:
    owner, name = repo.split("/", 1)
    status, payload = request(
        f"/repos/{owner}/{name}/actions/workflows/{workflow}/dispatches",
        method="POST",
        body={"ref": branch},
    )
    return status in {201, 204}, f"dispatch:{status}:{payload.get('message','')}"


def investigate(repo: str, workflows: list[str], branch: str) -> list[str]:
    actions: list[str] = []
    for workflow in workflows[:2]:
        ok, note = dispatch(repo, workflow, branch)
        actions.append(("accepted:" if ok else "rejected:") + workflow + ":" + note)
    return actions


def classify(worker: dict[str, Any], runs: list[dict[str, Any]]) -> tuple[str, str]:
    if not runs:
        allowed = ",".join(worker.get("operational_events") or []) or "any"
        return "SILENT", f"no operational workflow run found (events={allowed})"
    latest = runs[0]
    age = age_minutes(latest.get("created_at"))
    if latest.get("status") in ACTIVE:
        if age is not None and age > max(45, worker["expected_minutes"] * 2):
            return "STUCK", f"active run too old ({age:.0f}m)"
        return "ACTIVE", f"operational run active event={latest.get('event')}"
    conclusion = latest.get("conclusion")
    if conclusion in BAD:
        return "FAILED", f"latest operational conclusion={conclusion} event={latest.get('event')}"
    if age is not None and age > worker["expected_minutes"]:
        return "STALE", f"last operational run age={age:.0f}m > {worker['expected_minutes']}m"
    if conclusion == "success":
        return "HEALTHY", f"recent operational run succeeded event={latest.get('event')}"
    return "UNKNOWN", f"status={latest.get('status')} conclusion={conclusion} event={latest.get('event')}"


def recent_failure_count(runs: list[dict[str, Any]]) -> int:
    return sum(1 for run in runs[:3] if run.get("conclusion") in BAD)


def supervise_worker(repo: str, branch: str, worker: dict[str, Any], budget: int, *, repair: bool) -> dict[str, Any]:
    all_runs = list_runs(repo, worker["workflow"], branch)
    runs = operational_runs(worker, all_runs)
    before, reason = classify(worker, runs)
    row: dict[str, Any] = {
        "id": worker["id"],
        "name": worker["name"],
        "workflow": worker["workflow"],
        "priority": worker["priority"],
        "operational_events": worker.get("operational_events") or ["any"],
        "before": before,
        "reason": reason,
        "actions": [],
        "after": before,
        "score": 100 if before == "HEALTHY" else 70 if before == "ACTIVE" else 35,
    }
    if before in {"HEALTHY", "ACTIVE"} or not repair:
        return row

    failures = recent_failure_count(runs)
    attempted = 0
    latest = runs[0] if runs else None
    latest_attempt = int(latest.get("run_attempt") or 1) if latest else 0

    if (
        before == "FAILED"
        and latest
        and "rerun_failed" in worker.get("repair", [])
        and failures <= budget
        and latest_attempt <= budget
    ):
        ok, note = rerun_failed(repo, int(latest["id"]))
        row["actions"].append(("accepted:" if ok else "rejected:") + note)
        attempted += int(ok)

    if attempted == 0 and "dispatch" in worker.get("repair", []) and failures <= budget and before != "FAILED":
        ok, note = dispatch(repo, worker["workflow"], branch)
        row["actions"].append(("accepted:" if ok else "rejected:") + note)
        attempted += int(ok)

    exhausted = before == "FAILED" and latest_attempt > budget
    if (failures > budget or attempted == 0) and not exhausted:
        row["actions"].extend(investigate(repo, worker.get("investigate_with", []), branch))

    if (
        worker.get("forge_allowed")
        and before in {"FAILED", "STALE", "SILENT"}
        and failures >= 2
        and not exhausted
    ):
        ok, note = dispatch(repo, "tomoki-forge.yml", branch)
        row["actions"].append(("accepted:" if ok else "rejected:") + "tomoki-forge.yml:" + note)

    if exhausted:
        row["actions"].append(f"retry-budget-exhausted:run_attempt={latest_attempt}")

    if any(action.startswith("accepted:") for action in row["actions"]):
        row["after"] = "RECOVERING"
        row["score"] = 65
    else:
        row["after"] = "UNRESOLVED"
        row["score"] = 10
    return row


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="automation/control_plane/workers.json")
    parser.add_argument("--out", default="reports/control-plane/manager-latest.json")
    parser.add_argument("--no-repair", action="store_true")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    repo = os.environ.get("GITHUB_REPOSITORY", "MusicJapanLLC/test")
    branch = config.get("default_branch") or os.environ.get("GITHUB_REF_NAME")
    budget = int(config.get("retry_budget_per_incident", 2))

    rows = [supervise_worker(repo, branch, worker, budget, repair=not args.no_repair) for worker in config["workers"]]
    states: dict[str, int] = {}
    for row in rows:
        states[row["after"]] = states.get(row["after"], 0) + 1

    incidents = [row for row in rows if row["before"] not in {"HEALTHY", "ACTIVE"}]
    internal_actions = sum(1 for row in rows if any(action.startswith("accepted:") for action in row["actions"]))
    unresolved = [row for row in rows if row["after"] == "UNRESOLVED"]
    recovering = [row for row in rows if row["after"] == "RECOVERING"]

    report = {
        "schema": "ai-factory-manager-report/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo": repo,
        "branch": branch,
        "policy": "DETECT>DIAGNOSE>REPAIR/REASSIGN>VERIFY>LEARN>REPORT",
        "summary": {
            "workers": len(rows),
            "incidents": len(incidents),
            "internal_recovery_actions": internal_actions,
            "recovering": len(recovering),
            "unresolved": len(unresolved),
            "states": states,
        },
        "scoreboard": sorted(
            [{"id": row["id"], "score": row["score"], "state": row["after"]} for row in rows],
            key=lambda item: (-item["score"], item["id"]),
        ),
        "workers": rows,
        "privacy": "aggregate GitHub workflow health only; no secrets/customer/email content",
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
