#!/usr/bin/env python3
"""THE WORLD realtime kernel.

A bounded GitHub-native watchdog that keeps the existing autonomous workers
alive across the default branch *and* recently active feature branches.

Recovery ladder:
1. detect latest failure per active branch,
2. if the branch HEAD moved beyond the failing SHA, revalidate current HEAD,
3. rerun transient/first-attempt failures on the same SHA,
4. route persistent current-HEAD failures to bounded TOMOKI/FORGE repair,
5. keep stale default-branch workers awake,
6. emit auditable evidence for every action.

The kernel never edits source code itself and never mutates secrets, repository
permissions, billing, external targets, or third-party systems.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = os.getenv("GITHUB_REPOSITORY", "MusicJapanLLC/test")
TOKEN = os.getenv("GITHUB_TOKEN", os.getenv("GH_TOKEN", "")).strip()
API = f"https://api.github.com/repos/{REPO}"
DEFAULT_REF = os.getenv("WORLD_REALTIME_REF", os.getenv("GITHUB_REF_NAME", "claude/employee-onboarding-setup-udm86"))
RETRYABLE = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}
REPAIR_BRANCH_PREFIX = "the-world/self-heal-"


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


def _recent_runs(workflow: str, *, ref: str | None = None, per_page: int = 30) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"per_page": max(1, min(100, per_page))}
    if ref:
        params["branch"] = ref
    q = urllib.parse.urlencode(params)
    data = _json("GET", f"/actions/workflows/{workflow}/runs?{q}")
    return list(data.get("workflow_runs") or [])


def _latest_run(workflow: str, ref: str) -> dict[str, Any] | None:
    runs = _recent_runs(workflow, ref=ref, per_page=10)
    return runs[0] if runs else None


def _branch_head_sha(ref: str) -> str:
    encoded = urllib.parse.quote(ref, safe="")
    data = _json("GET", f"/branches/{encoded}")
    return str(((data.get("commit") or {}).get("sha")) or "")


def _dispatch(workflow: str, ref: str, inputs: dict[str, str] | None = None) -> None:
    payload: dict[str, Any] = {"ref": ref}
    if inputs:
        payload["inputs"] = inputs
    _request("POST", f"/actions/workflows/{workflow}/dispatches", payload)


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
    repair = str(data.get("repair_workflow") or "")
    if repair and repair not in seen:
        raise ValueError("repair_workflow must also be present in workers allowlist")
    return data


def _latest_by_branch(runs: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for run in runs:
        branch = str(run.get("head_branch") or "")
        if not branch or branch.startswith(REPAIR_BRANCH_PREFIX) or branch in out:
            continue
        out[branch] = run
    return out


def _needs_head_revalidation(run: dict[str, Any] | None, current_sha: str) -> bool:
    if not run or not current_sha:
        return False
    failing_sha = str(run.get("head_sha") or "")
    return bool(failing_sha and failing_sha != current_sha)


def collect(plan: dict[str, Any], *, apply_actions: bool, ref: str | None = None) -> dict[str, Any]:
    ref = ref or str(plan.get("default_ref") or DEFAULT_REF)
    max_actions = max(0, min(8, int(plan.get("max_dispatches_per_pulse", 5))))
    active_window = max(30, int(plan.get("active_branch_window_minutes", 720)))
    repair_after = max(1, int(plan.get("repair_after_attempts", 2)))
    repair_workflow = str(plan.get("repair_workflow") or "")
    states: list[WorkflowState] = []
    incidents: list[dict[str, Any]] = []
    actions_used = 0
    errors: list[dict[str, Any]] = []
    repair_triggered = False
    now = datetime.now(timezone.utc)
    rows = sorted(plan["workers"], key=lambda r: (-int(r.get("priority", 0)), str(r.get("workflow", ""))))
    branch_heads: dict[str, str] = {}

    def branch_head(branch: str) -> str:
        if branch not in branch_heads:
            try:
                branch_heads[branch] = _branch_head_sha(branch)
            except Exception as exc:
                branch_heads[branch] = ""
                errors.append({"branch": branch, "error": f"branch HEAD lookup failed: {type(exc).__name__}: {exc}"[:1000]})
        return branch_heads[branch]

    def trigger_repair(source_workflow: str, branch: str, run_id: int | None) -> tuple[str, str]:
        nonlocal actions_used, repair_triggered
        if not apply_actions or repair_triggered or not repair_workflow or actions_used >= max_actions:
            return "REPAIR_PENDING", "WAITING"
        try:
            _dispatch(repair_workflow, ref, {"mode": "repair"})
            actions_used += 1
            repair_triggered = True
            return "DISPATCH_REPAIR", "REQUESTED"
        except Exception as exc:
            errors.append(
                {
                    "workflow": source_workflow,
                    "branch": branch,
                    "run_id": run_id,
                    "error": f"repair dispatch failed: {type(exc).__name__}: {exc}"[:1000],
                }
            )
            return "DISPATCH_REPAIR", "ERROR"

    def revalidate(workflow: str, branch: str, run_id: int | None, action_name: str) -> tuple[str, str]:
        nonlocal actions_used
        if not apply_actions or actions_used >= max_actions:
            return action_name, "WAITING"
        try:
            _dispatch(workflow, branch)
            actions_used += 1
            return action_name, "REQUESTED"
        except Exception as exc:
            errors.append(
                {
                    "workflow": workflow,
                    "branch": branch,
                    "run_id": run_id,
                    "error": f"current-HEAD revalidation dispatch failed: {type(exc).__name__}: {exc}"[:1000],
                }
            )
            return action_name, "ERROR"

    for cfg in rows:
        workflow = str(cfg["workflow"])
        name = str(cfg.get("name") or workflow)
        stale_minutes = int(cfg.get("stale_minutes", 60))
        priority = int(cfg.get("priority", 0))
        autostart = bool(cfg.get("autostart", True))
        recover_failures = bool(cfg.get("recover_failures", True))
        director_min = int(cfg.get("director_min_interval_minutes", stale_minutes))
        try:
            recent = _recent_runs(workflow, per_page=30)
            by_branch = _latest_by_branch(recent)
            run = by_branch.get(ref) or _latest_run(workflow, ref)
            state_name = classify_run(run, stale_minutes, now)
            state = WorkflowState(
                name=name,
                workflow=workflow,
                status=str((run or {}).get("status") or "missing"),
                conclusion=(run or {}).get("conclusion"),
                run_id=int(run["id"]) if run and run.get("id") is not None else None,
                run_attempt=int((run or {}).get("run_attempt") or 0),
                age_minutes=_age_minutes(run, now),
                stale_minutes=stale_minutes,
                priority=priority,
                autostart=autostart,
                director_min_interval_minutes=director_min,
                state=state_name,
            )

            should_act = apply_actions and actions_used < max_actions
            if should_act and recover_failures and state_name == "FAILED" and state.run_id is not None:
                current_sha = branch_head(ref)
                if _needs_head_revalidation(run, current_sha):
                    state.action, state.action_result = revalidate(workflow, ref, state.run_id, "REVALIDATE_HEAD")
                elif state.run_attempt < repair_after:
                    _rerun_failed(state.run_id)
                    state.action = "RERUN_FAILED"
                    state.action_result = "REQUESTED"
                    actions_used += 1
                elif workflow == repair_workflow:
                    _dispatch(workflow, ref, {"mode": "auto"})
                    state.action = "RESTART_REPAIR_EXECUTOR"
                    state.action_result = "REQUESTED"
                    actions_used += 1
                else:
                    state.action, state.action_result = trigger_repair(workflow, ref, state.run_id)
            elif should_act and autostart and state_name in {"STALE", "MISSING"}:
                _dispatch(workflow, ref)
                state.action = "WAKE_STALE"
                state.action_result = "REQUESTED"
                actions_used += 1
            states.append(state)

            # The default-branch summary above preserves compatibility with the
            # existing Director. This second pass closes the historic blind spot:
            # failures on recently active feature/PR branches.
            for branch, branch_run in by_branch.items():
                if branch == ref:
                    continue
                age = _age_minutes(branch_run, now)
                if age is None or age > active_window:
                    continue
                branch_state = classify_run(branch_run, stale_minutes, now)
                if branch_state != "FAILED" or not recover_failures:
                    continue
                attempt = int(branch_run.get("run_attempt") or 1)
                run_id = int(branch_run["id"])
                current_sha = branch_head(branch)
                stale_sha = _needs_head_revalidation(branch_run, current_sha)
                incident = {
                    "worker": name,
                    "workflow": workflow,
                    "branch": branch,
                    "run_id": run_id,
                    "run_attempt": attempt,
                    "failing_sha": str(branch_run.get("head_sha") or ""),
                    "current_branch_sha": current_sha,
                    "stale_failure_sha": stale_sha,
                    "age_minutes": age,
                    "state": branch_state,
                    "action": "NONE",
                    "action_result": "NONE",
                }
                if apply_actions and actions_used < max_actions:
                    if stale_sha:
                        incident["action"], incident["action_result"] = revalidate(
                            workflow, branch, run_id, "REVALIDATE_BRANCH_HEAD"
                        )
                    elif attempt < repair_after:
                        try:
                            _rerun_failed(run_id)
                            incident["action"] = "RERUN_FAILED_BRANCH"
                            incident["action_result"] = "REQUESTED"
                            actions_used += 1
                        except Exception as exc:
                            incident["action"] = "RERUN_FAILED_BRANCH"
                            incident["action_result"] = "ERROR"
                            errors.append(
                                {
                                    "workflow": workflow,
                                    "branch": branch,
                                    "run_id": run_id,
                                    "error": f"{type(exc).__name__}: {exc}"[:1000],
                                }
                            )
                    elif workflow != repair_workflow:
                        incident["action"], incident["action_result"] = trigger_repair(workflow, branch, run_id)
                incidents.append(incident)
        except Exception as exc:
            errors.append({"workflow": workflow, "error": f"{type(exc).__name__}: {exc}"[:1000]})
            states.append(
                WorkflowState(
                    name=name,
                    workflow=workflow,
                    status="error",
                    conclusion=None,
                    run_id=None,
                    run_attempt=0,
                    age_minutes=None,
                    stale_minutes=stale_minutes,
                    priority=priority,
                    autostart=autostart,
                    director_min_interval_minutes=director_min,
                    state="ERROR",
                    action="NONE",
                    action_result="ERROR",
                )
            )

    material_states = {"FAILED", "STALE", "MISSING", "ERROR", "DEGRADED"}
    persistent = sum(
        int(i.get("run_attempt", 0)) >= repair_after and not bool(i.get("stale_failure_sha"))
        for i in incidents
    )
    revalidations = sum(str(i.get("action") or "").startswith("REVALIDATE") for i in incidents)
    revalidations += sum(str(s.action or "").startswith("REVALIDATE") for s in states)
    material = bool(actions_used or errors or incidents or any(s.state in material_states for s in states))
    summary = {
        "healthy": sum(s.state == "HEALTHY" for s in states),
        "running": sum(s.state == "RUNNING" for s in states),
        "stale": sum(s.state == "STALE" for s in states),
        "failed": sum(s.state == "FAILED" for s in states),
        "missing": sum(s.state == "MISSING" for s in states),
        "error": sum(s.state == "ERROR" for s in states),
        "branch_incidents": len(incidents),
        "persistent_branch_incidents": persistent,
        "head_revalidations": revalidations,
        "actions": actions_used,
        "repair_triggered": repair_triggered,
    }
    return {
        "schema": "the-world-realtime-pulse/v3",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": REPO,
        "ref": ref,
        "apply_actions": apply_actions,
        "material": material,
        "summary": summary,
        "workers": [asdict(s) for s in states],
        "incidents": incidents,
        "errors": errors,
        "external_effect_policy": {
            "allowed": [
                "dispatch_or_rerun_allowlisted_owned_github_workflows",
                "revalidate_latest_owned_branch_head_before_repair",
                "route_persistent_internal_ci_failures_to_bounded_repair_executor",
                "emit_internal_evidence_and_reports",
            ],
            "forbidden": [
                "third_party_email_or_dm",
                "credential_testing",
                "public_or_third_party_targeting",
                "purchase_or_financial_commitment",
                "secret_permission_or_branch_protection_mutation",
            ],
        },
    }


def render_markdown(pulse: dict[str, Any]) -> str:
    s = pulse["summary"]
    lines = [
        "# THE WORLD — REALTIME PULSE",
        "",
        f"- generated: {pulse['generated_at']}",
        f"- ref: `{pulse['ref']}`",
        (
            f"- healthy={s['healthy']} running={s['running']} stale={s['stale']} "
            f"failed={s['failed']} missing={s['missing']} error={s['error']}"
        ),
        f"- active-branch incidents={s['branch_incidents']} persistent={s['persistent_branch_incidents']}",
        f"- latest-HEAD revalidations: **{s['head_revalidations']}**",
        f"- autonomous actions this pulse: **{s['actions']}** / repair_triggered={s['repair_triggered']}",
        "",
        "## Default-branch workers",
    ]
    for w in pulse["workers"]:
        lines.append(
            f"- **{w['name']}** `{w['state']}` age={w['age_minutes']}m "
            f"run={w['run_id']} action={w['action']} {w['action_result']}"
        )
    if pulse.get("incidents"):
        lines += ["", "## Active-branch incidents"]
        for i in pulse["incidents"]:
            lines.append(
                f"- **{i['worker']}** `{i['branch']}` run={i['run_id']} attempt={i['run_attempt']} "
                f"stale_sha={i.get('stale_failure_sha')} action={i['action']} {i['action_result']}"
            )
    if pulse.get("errors"):
        lines += ["", "## Errors"]
        for e in pulse["errors"]:
            suffix = f" branch={e.get('branch')} run={e.get('run_id')}" if e.get("branch") else ""
            lines.append(f"- {e.get('workflow') or 'kernel'}{suffix}: {e.get('error')}")
    lines += [
        "",
        "## Boundary",
        "This pulse can wake/rerun only allowlisted owned GitHub workflows, revalidate the latest owned branch HEAD, and route persistent current-HEAD CI failures to the bounded repair executor. It cannot contact third parties, test credentials, target public/third-party assets, change secrets/permissions, or make purchases/financial commitments.",
    ]
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
