#!/usr/bin/env python3
"""THE WORLD realtime kernel.

A bounded GitHub-native watchdog that keeps the existing autonomous workers alive.
It does not invent new authority. It only dispatches/reruns allowlisted workflows
on the repository's default branch and emits auditable evidence.

This module intentionally contains no third-party targeting, credential use,
billing changes, email sending, or permission/policy mutation.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = os.getenv("GITHUB_REPOSITORY", "MusicJapanLLC/test")
TOKEN = os.getenv("GITHUB_TOKEN", os.getenv("GH_TOKEN", "")).strip()
API = f"https://api.github.com/repos/{REPO}"
DEFAULT_REF = os.getenv("WORLD_REALTIME_REF", os.getenv("GITHUB_REF_NAME", "claude/employee-onboarding-setup-udm86"))
MAX_RERUN_ATTEMPTS = int(os.getenv("WORLD_REALTIME_MAX_RERUN_ATTEMPTS", "2"))

RETRYABLE = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}

@dataclass
class WorkflowState:
    name: str
    workflow: str
    status: str
    conclusion: str | None
    run_id: int | None
    run_attempt: int
    age_minutes: int | None
    stale_minutes: int
    priority: int
    autostart: bool
    director_min_interval_minutes: int
    state: str
    action: str = "NONE"
    action_result: str = "NONE"

def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def _age_minutes(run: dict[str, Any] | None, now: datetime | None = None) -> int | None:
    if not run:
        return None
    dt = _parse_time(run.get("updated_at") or run.get("created_at"))
    if not dt:
        return None
    now = now or datetime.now(timezone.utc)
    return max(0, int((now - dt).total_seconds() // 60))

def classify_run(run: dict[str, Any] | None, stale_minutes: int, now: datetime | None = None) -> str:
    if run is None:
        return "MISSING"
    status = str(run.get("status") or "unknown")
    conclusion = run.get("conclusion")
    if status in {"queued", "in_progress", "waiting", "requested", "pending"}:
        return "RUNNING"
    if status != "completed":
        return "UNKNOWN"
    if conclusion in RETRYABLE:
        return "FAILED"
    if conclusion != "success":
        return "DEGRADED"
    age = _age_minutes(run, now)
    if age is not None and age > stale_minutes:
        return "STALE"
    return "HEALTHY"

def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> bytes:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = path if path.startswith("http") else API + path
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "the-world-realtime-kernel",
    }
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"GitHub API {method} {url} -> {exc.code}: {body}") from exc

def _json(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = _request(method, path, payload)
    return json.loads(raw.decode("utf-8")) if raw else {}

def _latest_run(workflow: str, ref: str) -> dict[str, Any] | None:
    q = urllib.parse.urlencode({"branch": ref, "per_page": 10})
    data = _json("GET", f"/actions/workflows/{workflow}/runs?{q}")
    runs = data.get("workflow_runs") or []
    return runs[0] if runs else None

def _dispatch(workflow: str, ref: str) -> None:
    _request("POST", f"/actions/workflows/{workflow}/dispatches", {"ref": ref})

def _rerun_failed(run_id: int) -> None:
    _request("POST", f"/actions/runs/{run_id}/rerun-failed-jobs")

def load_plan(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("schema") != "the-world-realtime-plan/v1":
        raise ValueError("unsupported realtime plan schema")
    workers = data.get("workers")
    if not isinstance(workers, list) or not workers:
        raise ValueError("plan workers must be a non-empty list")
    seen: set[str] = set()
    for row in workers:
        wf = str(row.get("workflow") or "")
        if not wf.endswith(".yml") or "/" in wf or "\\" in wf:
            raise ValueError(f"invalid workflow allowlist entry: {wf!r}")
        if wf in seen:
            raise ValueError(f"duplicate workflow: {wf}")
        seen.add(wf)
        stale = int(row.get("stale_minutes", 0))
        if stale < 15:
            raise ValueError(f"stale_minutes too aggressive for {wf}")
    return data

def collect(plan: dict[str, Any], *, apply_actions: bool, ref: str | None = None) -> dict[str, Any]:
    ref = ref or str(plan.get("default_ref") or DEFAULT_REF)
    max_actions = max(0, min(5, int(plan.get("max_dispatches_per_pulse", 3))))
    states: list[WorkflowState] = []
    actions_used = 0
    errors: list[dict[str, Any]] = []
    rows = sorted(plan["workers"], key=lambda r: (-int(r.get("priority", 0)), str(r.get("workflow", ""))))

    for cfg in rows:
        workflow = str(cfg["workflow"])
        name = str(cfg.get("name") or workflow)
        stale_minutes = int(cfg.get("stale_minutes", 60))
        priority = int(cfg.get("priority", 0))
        autostart = bool(cfg.get("autostart", True))
        director_min = int(cfg.get("director_min_interval_minutes", stale_minutes))
        try:
            run = _latest_run(workflow, ref)
            state_name = classify_run(run, stale_minutes)
            state = WorkflowState(
                name=name,
                workflow=workflow,
                status=str((run or {}).get("status") or "missing"),
                conclusion=(run or {}).get("conclusion"),
                run_id=int(run["id"]) if run and run.get("id") is not None else None,
                run_attempt=int((run or {}).get("run_attempt") or 0),
                age_minutes=_age_minutes(run),
                stale_minutes=stale_minutes,
                priority=priority,
                autostart=autostart,
                director_min_interval_minutes=director_min,
                state=state_name,
            )
            should_act = apply_actions and autostart and actions_used < max_actions
            if should_act and state_name == "FAILED" and state.run_id is not None:
                if state.run_attempt < MAX_RERUN_ATTEMPTS:
                    _rerun_failed(state.run_id)
                    state.action = "RERUN_FAILED"
                    state.action_result = "REQUESTED"
                    actions_used += 1
                else:
                    _dispatch(workflow, ref)
                    state.action = "DISPATCH_FRESH"
                    state.action_result = "REQUESTED"
                    actions_used += 1
            elif should_act and state_name in {"STALE", "MISSING"}:
                _dispatch(workflow, ref)
                state.action = "WAKE_STALE"
                state.action_result = "REQUESTED"
                actions_used += 1
            states.append(state)
        except Exception as exc:
            errors.append({"workflow": workflow, "error": f"{type(exc).__name__}: {exc}"[:1000]})
            states.append(WorkflowState(name=name,workflow=workflow,status="error",conclusion=None,run_id=None,run_attempt=0,age_minutes=None,stale_minutes=stale_minutes,priority=priority,autostart=autostart,director_min_interval_minutes=director_min,state="ERROR",action="NONE",action_result="ERROR"))

    material_states = {"FAILED", "STALE", "MISSING", "ERROR", "DEGRADED"}
    material = bool(actions_used or errors or any(s.state in material_states for s in states))
    summary = {
        "healthy": sum(s.state == "HEALTHY" for s in states),
        "running": sum(s.state == "RUNNING" for s in states),
        "stale": sum(s.state == "STALE" for s in states),
        "failed": sum(s.state == "FAILED" for s in states),
        "missing": sum(s.state == "MISSING" for s in states),
        "error": sum(s.state == "ERROR" for s in states),
        "actions": actions_used,
    }
    return {
        "schema": "the-world-realtime-pulse/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": REPO,
        "ref": ref,
        "apply_actions": apply_actions,
        "material": material,
        "summary": summary,
        "workers": [asdict(s) for s in states],
        "errors": errors,
        "external_effect_policy": {
            "allowed": ["dispatch_or_rerun_allowlisted_owned_github_workflows", "emit_internal_evidence_and_reports"],
            "forbidden": ["third_party_email_or_dm", "credential_testing", "public_or_third_party_targeting", "purchase_or_financial_commitment", "secret_permission_or_branch_protection_mutation"],
        },
    }

def render_markdown(pulse: dict[str, Any]) -> str:
    s = pulse["summary"]
    lines = [
        "# THE WORLD — REALTIME PULSE", "",
        f"- generated: {pulse['generated_at']}",
        f"- ref: `{pulse['ref']}`",
        f"- healthy={s['healthy']} running={s['running']} stale={s['stale']} failed={s['failed']} missing={s['missing']} error={s['error']}",
        f"- autonomous actions this pulse: **{s['actions']}**", "", "## Workers",
    ]
    for w in pulse["workers"]:
        lines.append(f"- **{w['name']}** `{w['state']}` age={w['age_minutes']}m run={w['run_id']} action={w['action']} {w['action_result']}")
    if pulse.get("errors"):
        lines += ["", "## Errors"]
        for e in pulse["errors"]:
            lines.append(f"- {e['workflow']}: {e['error']}")
    lines += ["", "## Boundary", "This pulse can wake/rerun only allowlisted owned GitHub workflows. It cannot contact third parties, test credentials, target public/third-party assets, change secrets/permissions, or make purchases/financial commitments."]
    return "\n".join(lines) + "\n"

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--plan", default="automation/world/realtime_plan.json")
    p.add_argument("--json", default="world-realtime-pulse.json")
    p.add_argument("--report", default="world-realtime-pulse.md")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--ref", default=None)
    args = p.parse_args()
    plan = load_plan(args.plan)
    pulse = collect(plan, apply_actions=args.apply, ref=args.ref)
    Path(args.json).write_text(json.dumps(pulse, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render_markdown(pulse), encoding="utf-8")
    print(json.dumps(pulse["summary"], ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
