#!/usr/bin/env python3
"""Build a bounded repair dossier for persistent failures in THE WORLD.

The engine is read-only. It inspects allowlisted GitHub Actions workflows,
selects one recent persistent failure, and captures failed job logs for the
bounded repair executor (TOMOKI/FORGE). It never edits repository state.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = os.getenv("GITHUB_REPOSITORY", "MusicJapanLLC/test")
TOKEN = os.getenv("GITHUB_TOKEN", os.getenv("GH_TOKEN", "")).strip()
API = f"https://api.github.com/repos/{REPO}"
DEFAULT_REF = os.getenv("WORLD_REALTIME_REF", os.getenv("GITHUB_REF_NAME", "claude/employee-onboarding-setup-udm86"))
RETRYABLE = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}
REPAIR_BRANCH_PREFIX = "the-world/self-heal-"
MAX_LOG_CHARS = 60000


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _age_minutes(run: dict[str, Any], now: datetime | None = None) -> int:
    dt = _parse_time(run.get("updated_at") or run.get("created_at"))
    if not dt:
        return 10**9
    now = now or datetime.now(timezone.utc)
    return max(0, int((now - dt).total_seconds() // 60))


def _request(method: str, path: str) -> bytes:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "the-world-self-heal-engine",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"GitHub API {method} {url} -> {exc.code}: {body}") from exc


def _json(path: str) -> dict[str, Any]:
    raw = _request("GET", path)
    return json.loads(raw.decode("utf-8")) if raw else {}


def _recent_runs(workflow: str, per_page: int = 30) -> list[dict[str, Any]]:
    q = urllib.parse.urlencode({"per_page": max(1, min(100, per_page))})
    return list((_json(f"/actions/workflows/{workflow}/runs?{q}").get("workflow_runs") or []))


def _failed_job_logs(run_id: int) -> list[dict[str, Any]]:
    jobs = _json(f"/actions/runs/{run_id}/jobs?per_page=100").get("jobs") or []
    out: list[dict[str, Any]] = []
    remaining = MAX_LOG_CHARS
    for job in jobs:
        if str(job.get("conclusion") or "") not in RETRYABLE:
            continue
        job_id = int(job["id"])
        text = ""
        if remaining > 0:
            try:
                text = _request("GET", f"/actions/jobs/{job_id}/logs").decode("utf-8", errors="replace")
            except Exception as exc:
                text = f"[log unavailable: {type(exc).__name__}: {exc}]"
            text = text[-min(remaining, 20000):]
            remaining -= len(text)
        out.append(
            {
                "id": job_id,
                "name": str(job.get("name") or "job"),
                "conclusion": job.get("conclusion"),
                "html_url": job.get("html_url"),
                "log_tail": text,
            }
        )
    return out


def load_plan(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("schema") != "the-world-realtime-plan/v1":
        raise ValueError("unsupported realtime plan schema")
    workers = data.get("workers")
    if not isinstance(workers, list) or not workers:
        raise ValueError("plan workers must be a non-empty list")
    return data


def select_incident(plan: dict[str, Any], now: datetime | None = None) -> dict[str, Any] | None:
    now = now or datetime.now(timezone.utc)
    active_window = max(30, int(plan.get("active_branch_window_minutes", 720)))
    repair_after = max(1, int(plan.get("repair_after_attempts", 2)))
    excluded = {str(x) for x in (plan.get("repair_exclude_workflows") or [])}
    candidates: list[tuple[int, datetime, dict[str, Any]]] = []

    for cfg in plan.get("workers", []):
        workflow = str(cfg.get("workflow") or "")
        if not workflow or workflow in excluded or not bool(cfg.get("recover_failures", True)):
            continue
        latest_by_branch: dict[str, dict[str, Any]] = {}
        try:
            for run in _recent_runs(workflow):
                branch = str(run.get("head_branch") or "")
                if not branch or branch.startswith(REPAIR_BRANCH_PREFIX):
                    continue
                if branch in latest_by_branch:
                    continue
                latest_by_branch[branch] = run
        except Exception:
            continue

        for branch, run in latest_by_branch.items():
            if str(run.get("status") or "") != "completed":
                continue
            conclusion = str(run.get("conclusion") or "")
            if conclusion not in RETRYABLE:
                continue
            age = _age_minutes(run, now)
            if branch != str(plan.get("default_ref") or DEFAULT_REF) and age > active_window:
                continue
            attempt = int(run.get("run_attempt") or 1)
            if conclusion != "startup_failure" and attempt < repair_after:
                continue
            updated = _parse_time(run.get("updated_at") or run.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)
            incident = {
                "workflow": workflow,
                "worker": str(cfg.get("name") or workflow),
                "priority": int(cfg.get("priority", 0)),
                "head_branch": branch,
                "head_sha": str(run.get("head_sha") or ""),
                "run_id": int(run.get("id")),
                "run_attempt": attempt,
                "conclusion": conclusion,
                "age_minutes": age,
                "html_url": run.get("html_url"),
                "event": run.get("event"),
            }
            candidates.append((incident["priority"], updated, incident))

    if not candidates:
        return None
    candidates.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return candidates[0][2]


def build_dossier(plan: dict[str, Any]) -> dict[str, Any]:
    incident = select_incident(plan)
    if incident is None:
        return {
            "schema": "the-world-self-heal-dossier/v1",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "selected": False,
            "repository": REPO,
            "reason": "No recent persistent allowlisted workflow failure requires code repair.",
        }
    jobs = _failed_job_logs(int(incident["run_id"]))
    return {
        "schema": "the-world-self-heal-dossier/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "selected": True,
        "repository": REPO,
        "target_base": incident["head_branch"],
        "incident": incident,
        "failed_jobs": jobs,
        "repair_contract": {
            "goal": "restore the failing workflow with the smallest verified repository change",
            "must_preserve": [
                "existing security boundaries",
                "secret handling",
                "external-target restrictions",
                "business data and unrelated product behavior",
            ],
            "must_not": [
                "disable tests or security gates",
                "weaken permissions or policy checks",
                "hardcode secrets",
                "change billing or third-party targeting",
                "edit self-heal guardrail files",
            ],
        },
    }


def render(dossier: dict[str, Any]) -> str:
    lines = ["# THE WORLD — SELF HEAL DOSSIER", "", f"- generated: {dossier['generated_at']}"]
    if not dossier.get("selected"):
        lines.append(f"- selected: false — {dossier.get('reason')}")
        return "\n".join(lines) + "\n"
    incident = dossier["incident"]
    lines += [
        "- selected: true",
        f"- workflow: `{incident['workflow']}` / {incident['worker']}",
        f"- target base: `{dossier['target_base']}`",
        f"- run: {incident['run_id']} attempt={incident['run_attempt']} conclusion={incident['conclusion']}",
        f"- URL: {incident.get('html_url') or 'n/a'}",
        "",
        "## Failed jobs / log tails",
    ]
    for job in dossier.get("failed_jobs", []):
        lines += [
            f"### {job['name']} ({job['conclusion']})",
            "```text",
            str(job.get("log_tail") or "[no log text captured]")[-20000:],
            "```",
        ]
    lines += [
        "",
        "## Repair contract",
        "Repair the root cause with the smallest change. Do not silence the failing check. Do not weaken security or policy. Verification must pass before a PR can be created.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--plan", default="automation/world/realtime_plan.json")
    p.add_argument("--json", default="self-heal-dossier.json")
    p.add_argument("--report", default="self-heal-dossier.md")
    args = p.parse_args()
    dossier = build_dossier(load_plan(args.plan))
    Path(args.json).write_text(json.dumps(dossier, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render(dossier), encoding="utf-8")
    print(json.dumps({"selected": bool(dossier.get("selected")), "target_base": dossier.get("target_base")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
