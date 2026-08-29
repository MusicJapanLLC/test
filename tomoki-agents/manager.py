#!/usr/bin/env python3
"""TOMOKI Manager: repair-first orchestration for autonomous GitHub workers.

The manager does not replace specialist autonomy. It observes each worker's
GitHub Actions evidence, retries recoverable failures, wakes stale workers,
collects their report artifacts, and produces a bounded repair plan.

Safe boundaries:
- only allowlisted workflows can be dispatched/rerun
- no secret, permission, branch-protection, billing, or deployment-policy edits
- never rerun/dispatch itself
- max repair actions per cycle
- unresolved material blockers escalate only after internal repair attempts
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = os.getenv("GITHUB_REPOSITORY", "MusicJapanLLC/test")
REF = os.getenv("TOMOKI_MANAGER_REF", os.getenv("GITHUB_REF_NAME", "claude/employee-onboarding-setup-udm86"))
TOKEN = os.getenv("GITHUB_TOKEN", os.getenv("GH_TOKEN", "")).strip()
API = f"https://api.github.com/repos/{REPO}"

MAX_REPAIR_ACTIONS = int(os.getenv("TOMOKI_MANAGER_MAX_ACTIONS", "3"))
STALE_MINUTES_DEFAULT = int(os.getenv("TOMOKI_MANAGER_STALE_MINUTES", "95"))
MAX_RERUN_ATTEMPTS = int(os.getenv("TOMOKI_MANAGER_MAX_RERUN_ATTEMPTS", "2"))

WORKERS: dict[str, dict[str, Any]] = {
    "SKEPTIC": {
        "workflow": "tomoki-skeptic.yml",
        "artifact": "tomoki-skeptic-report",
        "motive": "証拠のない成功を止める",
        "strength": "検証・反証・回帰発見",
        "sla_minutes": 95,
    },
    "HOUND": {
        "workflow": "tomoki-hound.yml",
        "artifact": "tomoki-hound-report",
        "motive": "放置と再発を根絶する",
        "strength": "長期停滞・再発・未完了追跡",
        "sla_minutes": 95,
    },
    "FORGE": {
        "workflow": "tomoki-forge.yml",
        "artifact": "tomoki-forge-report",
        "motive": "検証可能な改善を積み上げる",
        "strength": "低リスク実装・テスト・PR/merge",
        "sla_minutes": 95,
    },
}

CONCLUSIONS_RETRYABLE = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}
BAD_REPORT_PATTERNS = [
    re.compile(r"failed or produced no report", re.I),
    re.compile(r"レポートファイルが生成されません", re.I),
    re.compile(r"\bBLOCKED\b", re.I),
]
MATERIAL_PATTERNS = [
    re.compile(r"\bcritical\b", re.I),
    re.compile(r"\bhigh\b", re.I),
    re.compile(r"再発|放置|未完了|回帰|脆弱|失敗|blocked|stale", re.I),
]
VERIFIED_PATTERNS = [
    re.compile(r"MERGE:\s*KEEP", re.I),
    re.compile(r"POLICY:\s*PASS", re.I),
    re.compile(r"VERIFY:\s*PASS", re.I),
    re.compile(r"\bVERIFIED\b", re.I),
]


@dataclass
class WorkerState:
    agent: str
    workflow: str
    status: str
    conclusion: str | None
    run_id: int | None
    run_attempt: int
    age_minutes: int | None
    report_excerpt: str
    report_quality: str
    material_signal: bool
    verified_signal: bool
    manager_action: str = "NONE"
    action_result: str = "NONE"


def _request(method: str, path: str, payload: dict[str, Any] | None = None, accept: str | None = None) -> bytes:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = path if path.startswith("http") else API + path
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": accept or "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tomoki-manager",
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
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _age_minutes(run: dict[str, Any]) -> int | None:
    dt = _parse_time(run.get("updated_at") or run.get("created_at"))
    if not dt:
        return None
    return max(0, int((datetime.now(timezone.utc) - dt).total_seconds() // 60))


def _latest_run(workflow: str) -> dict[str, Any] | None:
    data = _json("GET", f"/actions/workflows/{workflow}/runs?branch={REF}&per_page=10")
    runs = data.get("workflow_runs") or []
    return runs[0] if runs else None


def _artifact_report(run_id: int, artifact_name: str) -> str:
    data = _json("GET", f"/actions/runs/{run_id}/artifacts?per_page=100")
    artifacts = data.get("artifacts") or []
    matches = [a for a in artifacts if a.get("name") == artifact_name and not a.get("expired")]
    if not matches:
        return ""
    artifact_id = matches[0]["id"]
    raw = _request("GET", f"/actions/artifacts/{artifact_id}/zip")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith((".md", ".txt", ".json"))]
            if not names:
                return ""
            return zf.read(names[0]).decode("utf-8", errors="replace")
    except zipfile.BadZipFile:
        return ""


def _classify_report(text: str) -> tuple[str, bool, bool]:
    clean = text.strip()
    if not clean:
        return "MISSING", False, False
    bad = any(p.search(clean) for p in BAD_REPORT_PATTERNS)
    material = any(p.search(clean) for p in MATERIAL_PATTERNS)
    verified = any(p.search(clean) for p in VERIFIED_PATTERNS)
    return ("BAD" if bad else "OK"), material, verified


def _dispatch(workflow: str) -> None:
    _request("POST", f"/actions/workflows/{workflow}/dispatches", {"ref": REF})


def _rerun_failed(run_id: int) -> None:
    _request("POST", f"/actions/runs/{run_id}/rerun-failed-jobs")


def collect(apply_repairs: bool) -> dict[str, Any]:
    states: list[WorkerState] = []
    repairs_used = 0
    unresolved: list[dict[str, Any]] = []

    for agent, cfg in WORKERS.items():
        run = _latest_run(cfg["workflow"])
        if run is None:
            state = WorkerState(
                agent=agent,
                workflow=cfg["workflow"],
                status="MISSING",
                conclusion=None,
                run_id=None,
                run_attempt=0,
                age_minutes=None,
                report_excerpt="",
                report_quality="MISSING",
                material_signal=True,
                verified_signal=False,
            )
            if apply_repairs and repairs_used < MAX_REPAIR_ACTIONS:
                _dispatch(cfg["workflow"])
                repairs_used += 1
                state.manager_action = "WAKE_STALE"
                state.action_result = "DISPATCHED"
            else:
                unresolved.append({"agent": agent, "reason": "no workflow run found"})
            states.append(state)
            continue

        run_id = int(run["id"])
        report = _artifact_report(run_id, cfg["artifact"])
        quality, material, verified = _classify_report(report)
        state = WorkerState(
            agent=agent,
            workflow=cfg["workflow"],
            status=str(run.get("status") or "unknown"),
            conclusion=run.get("conclusion"),
            run_id=run_id,
            run_attempt=int(run.get("run_attempt") or 1),
            age_minutes=_age_minutes(run),
            report_excerpt=report.strip()[:1800],
            report_quality=quality,
            material_signal=material,
            verified_signal=verified,
        )

        retryable = state.conclusion in CONCLUSIONS_RETRYABLE
        stale = (
            state.status == "completed"
            and state.age_minutes is not None
            and state.age_minutes > int(cfg.get("sla_minutes", STALE_MINUTES_DEFAULT))
        )
        bad_report = state.status == "completed" and state.conclusion == "success" and quality == "BAD"

        if apply_repairs and repairs_used < MAX_REPAIR_ACTIONS:
            if retryable and state.run_attempt < MAX_RERUN_ATTEMPTS:
                _rerun_failed(run_id)
                repairs_used += 1
                state.manager_action = "RERUN_FAILED"
                state.action_result = "RERUN_REQUESTED"
            elif stale:
                _dispatch(cfg["workflow"])
                repairs_used += 1
                state.manager_action = "WAKE_STALE"
                state.action_result = "DISPATCHED"
            elif bad_report:
                _dispatch(cfg["workflow"])
                repairs_used += 1
                state.manager_action = "REGENERATE_REPORT"
                state.action_result = "DISPATCHED"

        if retryable and state.manager_action == "NONE":
            unresolved.append({
                "agent": agent,
                "reason": f"workflow {state.conclusion}; attempts={state.run_attempt}",
                "run_id": run_id,
            })
        if quality == "MISSING" and state.status == "completed" and state.conclusion == "success":
            unresolved.append({
                "agent": agent,
                "reason": "successful run has no standardized report artifact yet",
                "run_id": run_id,
            })

        states.append(state)

    return {
        "schema": "tomoki-manager-cycle/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": REPO,
        "ref": REF,
        "apply_repairs": apply_repairs,
        "repairs_used": repairs_used,
        "max_repairs": MAX_REPAIR_ACTIONS,
        "workers": [asdict(s) for s in states],
        "unresolved": unresolved,
    }


def _validate_plan(plan: dict[str, Any], snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    allowed_workflows = {cfg["workflow"] for cfg in WORKERS.values()}
    allowed_actions = {"dispatch", "rerun_failed", "none"}
    current_run_ids = {
        int(w["run_id"]) for w in snapshot["workers"] if w.get("run_id") is not None
    }
    already_touched_workflows = {
        str(w["workflow"]) for w in snapshot["workers"] if w.get("manager_action") not in (None, "", "NONE")
    }
    already_touched_run_ids = {
        int(w["run_id"]) for w in snapshot["workers"]
        if w.get("run_id") is not None and w.get("manager_action") not in (None, "", "NONE")
    }
    accepted: list[dict[str, Any]] = []
    for raw in (plan.get("actions") or [])[:MAX_REPAIR_ACTIONS]:
        action = str(raw.get("action", "none"))
        if action not in allowed_actions:
            continue
        if action == "dispatch":
            workflow = str(raw.get("workflow", ""))
            if workflow not in allowed_workflows or workflow == "tomoki-manager.yml":
                continue
            if workflow in already_touched_workflows:
                continue
            accepted.append({"action": action, "workflow": workflow, "reason": str(raw.get("reason", ""))[:400]})
        elif action == "rerun_failed":
            try:
                run_id = int(raw.get("run_id"))
            except (TypeError, ValueError):
                continue
            if run_id not in current_run_ids or run_id in already_touched_run_ids:
                continue
            accepted.append({"action": action, "run_id": run_id, "reason": str(raw.get("reason", ""))[:400]})
    return accepted


def apply_plan(snapshot_path: str, plan_path: str, apply_actions: bool) -> dict[str, Any]:
    snapshot = json.loads(Path(snapshot_path).read_text(encoding="utf-8"))
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    accepted = _validate_plan(plan, snapshot)
    results: list[dict[str, Any]] = []
    for action in accepted:
        result = dict(action)
        if not apply_actions:
            result["result"] = "DRY_RUN"
        elif action["action"] == "dispatch":
            _dispatch(action["workflow"])
            result["result"] = "DISPATCHED"
        elif action["action"] == "rerun_failed":
            _rerun_failed(int(action["run_id"]))
            result["result"] = "RERUN_REQUESTED"
        results.append(result)
    return {
        "schema": "tomoki-manager-apply/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "accepted_actions": results,
        "rejected_or_trimmed": max(0, len(plan.get("actions") or []) - len(accepted)),
        "ceo_escalation": bool(plan.get("ceo_escalation", False)),
        "material_outcome": bool(plan.get("material_outcome", False)),
        "summary": str(plan.get("summary", ""))[:1000],
        "business_effect": str(plan.get("business_effect", ""))[:1000],
        "next_improvement": str(plan.get("next_improvement", ""))[:1000],
        "owner_action": str(plan.get("owner_action", "NONE"))[:400],
    }


def render_markdown(snapshot: dict[str, Any], apply_result: dict[str, Any] | None = None) -> str:
    lines = [
        "# TOMOKI MANAGER CYCLE",
        "",
        f"- generated: {snapshot['generated_at']}",
        f"- repairs: {snapshot['repairs_used']}/{snapshot['max_repairs']}",
        f"- unresolved: {len(snapshot['unresolved'])}",
        "",
        "## Workforce",
    ]
    for w in snapshot["workers"]:
        lines.append(
            f"- **{w['agent']}**: {w['status']}/{w.get('conclusion')} "
            f"age={w.get('age_minutes')}m report={w['report_quality']} "
            f"manager={w['manager_action']} -> {w['action_result']}"
        )
    if snapshot["unresolved"]:
        lines += ["", "## Unresolved after internal repair"]
        for item in snapshot["unresolved"]:
            lines.append(f"- {item.get('agent')}: {item.get('reason')}")
    if apply_result:
        lines += ["", "## Manager plan", f"- {apply_result.get('summary', '')}"]
        for a in apply_result.get("accepted_actions", []):
            lines.append(f"- {a}")
        lines.append(f"- CEO escalation: {apply_result.get('ceo_escalation')}")
    lines += [
        "",
        "## Rule",
        "CEOへ上げる前に、再実行・再割当・専門家への引継ぎ・再検証を先に行う。",
        "安全境界、Secrets、権限、課金、外部送信方針はManagerが勝手に緩めない。",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("collect")
    c.add_argument("--output", default="tomoki-manager-snapshot.json")
    c.add_argument("--report", default="tomoki-manager-report.md")
    c.add_argument("--apply-repairs", action="store_true")

    a = sub.add_parser("apply-plan")
    a.add_argument("--snapshot", required=True)
    a.add_argument("--plan", required=True)
    a.add_argument("--output", default="tomoki-manager-apply.json")
    a.add_argument("--report", default="tomoki-manager-report.md")
    a.add_argument("--apply-actions", action="store_true")

    args = p.parse_args()
    if args.command == "collect":
        snapshot = collect(args.apply_repairs)
        Path(args.output).write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        Path(args.report).write_text(render_markdown(snapshot), encoding="utf-8")
        print(json.dumps({"repairs": snapshot["repairs_used"], "unresolved": len(snapshot["unresolved"])}, ensure_ascii=False))
        return 0

    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    result = apply_plan(args.snapshot, args.plan, args.apply_actions)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render_markdown(snapshot, result), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
