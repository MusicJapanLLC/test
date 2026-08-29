#!/usr/bin/env python3
"""TOMOKI/MANAGER: deterministic self-healing supervisor for GitHub workers.

The manager does not escalate a stopped worker before attempting bounded recovery.
No secrets or raw business payloads are written to reports.
"""
from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API = "https://api.github.com"
BAD = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}


def request(path: str, *, method: str = "GET", body: dict[str, Any] | None = None) -> tuple[int, Any]:
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
        data = json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return res.status, json.loads(raw.decode()) if raw else {}
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
    path = f"/repos/{owner}/{name}/actions/workflows/{workflow}/runs?branch={branch}&per_page=5"
    status, payload = request(path)
    if status != 200:
        return []
    return payload.get("workflow_runs", [])


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
        return "SILENT", "no workflow run found"
    latest = runs[0]
    age = age_minutes(latest.get("created_at"))
    if latest.get("status") in {"queued", "in_progress", "waiting", "requested", "pending"}:
        if age is not None and age > max(45, worker["expected_minutes"] * 2):
            return "STUCK", f"active run too old ({age:.0f}m)"
        return "ACTIVE", "run currently active"
    conclusion = latest.get("conclusion")
    if conclusion in BAD:
        return "FAILED", f"latest conclusion={conclusion}"
    if age is not None and age > worker["expected_minutes"]:
        return "STALE", f"last run age={age:.0f}m > {worker['expected_minutes']}m"
    if conclusion == "success":
        return "HEALTHY", "recent verified GitHub run succeeded"
    return "UNKNOWN", f"status={latest.get('status')} conclusion={conclusion}"


def recent_failure_count(runs: list[dict[str, Any]]) -> int:
    return sum(1 for run in runs[:3] if run.get("conclusion") in BAD)


def supervise_worker(repo: str, branch: str, worker: dict[str, Any], budget: int, *, repair: bool) -> dict[str, Any]:
    runs = list_runs(repo, worker["workflow"], branch)
    before, reason = classify(worker, runs)
    row: dict[str, Any] = {
        "id": worker["id"],
        "name": worker["name"],
        "workflow": worker["workflow"],
        "priority": worker["priority"],
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

    if before == "FAILED" and latest and "rerun_failed" in worker.get("repair", []) and failures <= budget:
        ok, note = rerun_failed(repo, int(latest["id"]))
        row["actions"].append(("accepted:" if ok else "rejected:") + note)
        attempted += int(ok)

    if attempted == 0 and "dispatch" in worker.get("repair", []) and failures <= budget:
        ok, note = dispatch(repo, worker["workflow"], branch)
        row["actions"].append(("accepted:" if ok else "rejected:") + note)
        attempted += int(ok)

    if failures > budget or attempted == 0:
        row["actions"].extend(investigate(repo, worker.get("investigate_with", []), branch))

    if worker.get("forge_allowed") and before in {"FAILED", "STALE", "SILENT"} and failures >= 2:
        ok, note = dispatch(repo, "tomoki-forge.yml", branch)
        row["actions"].append(("accepted:" if ok else "rejected:") + "tomoki-forge.yml:" + note)

    # A repair accepted by GitHub means recovering, not yet fixed. The next manager cycle verifies it.
    if any(x.startswith("accepted:") for x in row["actions"]):
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

    rows = [supervise_worker(repo, branch, w, budget, repair=not args.no_repair) for w in config["workers"]]
    states: dict[str, int] = {}
    for row in rows:
        states[row["after"]] = states.get(row["after"], 0) + 1

    incidents = [r for r in rows if r["before"] not in {"HEALTHY", "ACTIVE"}]
    internal_actions = sum(1 for r in rows if any(a.startswith("accepted:") for a in r["actions"]))
    unresolved = [r for r in rows if r["after"] == "UNRESOLVED"]
    recovering = [r for r in rows if r["after"] == "RECOVERING"]

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
            [{"id": r["id"], "score": r["score"], "state": r["after"]} for r in rows],
            key=lambda x: (-x["score"], x["id"]),
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
