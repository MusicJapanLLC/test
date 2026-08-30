#!/usr/bin/env python3
"""Deterministic authority gate for THE CORE autonomous director."""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = os.getenv("GITHUB_REPOSITORY", "MusicJapanLLC/test")
TOKEN = os.getenv("GITHUB_TOKEN", os.getenv("GH_TOKEN", "")).strip()
API = f"https://api.github.com/repos/{REPO}"
REF = os.getenv("WORLD_REALTIME_REF", os.getenv("GITHUB_REF_NAME", "claude/employee-onboarding-setup-udm86"))
ALLOWED_ACTIONS = {"dispatch", "rerun_failed", "none"}

def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> None:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = API + path
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url,data=data,headers={"Authorization":f"Bearer {TOKEN}","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"the-core-autonomous-director"},method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"GitHub API {method} {url} -> {exc.code}: {body}") from exc

def _dispatch(workflow: str, ref: str) -> None:
    _request("POST", f"/actions/workflows/{workflow}/dispatches", {"ref": ref})

def _rerun_failed(run_id: int) -> None:
    _request("POST", f"/actions/runs/{run_id}/rerun-failed-jobs")

def validate_plan(plan: dict[str, Any], snapshot: dict[str, Any], realtime_plan: dict[str, Any], *, max_actions: int = 3) -> list[dict[str, Any]]:
    allow = {str(w["workflow"]): w for w in realtime_plan.get("workers", [])}
    states = {str(w["workflow"]): w for w in snapshot.get("workers", [])}
    current_run_ids = {int(w["run_id"]): str(w["workflow"]) for w in snapshot.get("workers", []) if w.get("run_id") is not None}
    accepted: list[dict[str, Any]] = []
    touched: set[str] = set()
    raw_actions = plan.get("actions") or []
    if not isinstance(raw_actions, list):
        return accepted

    for raw in raw_actions[:max(0, min(5, max_actions))]:
        action = str(raw.get("action") or "none")
        if action not in ALLOWED_ACTIONS or action == "none":
            continue
        if action == "dispatch":
            workflow = str(raw.get("workflow") or "")
            cfg = allow.get(workflow)
            state = states.get(workflow)
            if cfg is None or state is None or workflow in touched or state.get("state") == "RUNNING":
                continue
            age = state.get("age_minutes")
            min_interval = int(cfg.get("director_min_interval_minutes", cfg.get("stale_minutes", 60)))
            if state.get("state") == "HEALTHY" and age is not None and int(age) < min_interval:
                continue
            accepted.append({"action":"dispatch","workflow":workflow,"reason":str(raw.get("reason") or "")[:400]})
            touched.add(workflow)
        elif action == "rerun_failed":
            try:
                run_id = int(raw.get("run_id"))
            except (TypeError, ValueError):
                continue
            workflow = current_run_ids.get(run_id)
            if workflow is None or workflow not in allow or workflow in touched:
                continue
            state = states.get(workflow) or {}
            if state.get("state") != "FAILED":
                continue
            accepted.append({"action":"rerun_failed","run_id":run_id,"workflow":workflow,"reason":str(raw.get("reason") or "")[:400]})
            touched.add(workflow)
    return accepted

def apply(plan: dict[str, Any], snapshot: dict[str, Any], realtime_plan: dict[str, Any], *, apply_actions: bool) -> dict[str, Any]:
    max_actions = int(realtime_plan.get("director_max_actions_per_cycle", 3))
    accepted = validate_plan(plan, snapshot, realtime_plan, max_actions=max_actions)
    results: list[dict[str, Any]] = []
    for action in accepted:
        row = dict(action)
        try:
            if not apply_actions:
                row["result"] = "DRY_RUN"
            elif action["action"] == "dispatch":
                _dispatch(str(action["workflow"]), str(snapshot.get("ref") or REF))
                row["result"] = "DISPATCHED"
            elif action["action"] == "rerun_failed":
                _rerun_failed(int(action["run_id"]))
                row["result"] = "RERUN_REQUESTED"
        except Exception as exc:
            row["result"] = "ERROR"
            row["error"] = f"{type(exc).__name__}: {exc}"[:1000]
        results.append(row)

    blocked = [w for w in snapshot.get("workers", []) if w.get("state") in {"FAILED","ERROR","MISSING","DEGRADED"}]
    owner_action = str(plan.get("owner_action") or "NONE")[:500]
    ceo_escalation = bool(owner_action and owner_action != "NONE" and blocked)
    return {
        "schema":"the-core-director-result/v1",
        "generated_at":datetime.now(timezone.utc).isoformat(),
        "summary":str(plan.get("summary") or "")[:1200],
        "accepted_actions":results,
        "proposed_count":len(plan.get("actions") or []),
        "accepted_count":len(accepted),
        "material_outcome":bool(results or plan.get("material_outcome")),
        "next_improvement":str(plan.get("next_improvement") or "")[:1000],
        "owner_action":owner_action if ceo_escalation else "NONE",
        "ceo_escalation":ceo_escalation,
        "blocked_core_workflows":[{"workflow":w.get("workflow"),"state":w.get("state"),"run_id":w.get("run_id")} for w in blocked],
        "authority_boundary":"dispatch/rerun allowlisted owned workflows only",
    }

def render(result: dict[str, Any]) -> str:
    lines=["# THE CORE — AUTONOMOUS DIRECTOR","",f"- generated: {result['generated_at']}",f"- summary: {result['summary'] or 'No additional action required.'}",f"- accepted actions: {result['accepted_count']}/{result['proposed_count']}",f"- CEO escalation: {result['ceo_escalation']}","","## Actions"]
    if not result["accepted_actions"]:
        lines.append("- NONE — existing workers remain within cadence.")
    for row in result["accepted_actions"]:
        lines.append(f"- {row['action']} `{row.get('workflow')}` -> {row.get('result')} / {row.get('reason','')}")
    lines += ["","## Next",result.get("next_improvement") or "Continue evidence-driven autonomous cycles.","","## Constitutional boundary","The Director can choose which allowlisted internal worker to wake, but cannot alter secrets, permissions, billing, external-target scope, Covenant authority, or contact third parties."]
    return "\n".join(lines)+"\n"

def main() -> int:
    p=argparse.ArgumentParser()
    p.add_argument("--plan",default="core-director-plan.json")
    p.add_argument("--snapshot",default="world-realtime-snapshot.json")
    p.add_argument("--realtime-plan",default="automation/world/realtime_plan.json")
    p.add_argument("--json",default="core-director-result.json")
    p.add_argument("--report",default="core-director-report.md")
    p.add_argument("--apply",action="store_true")
    args=p.parse_args()
    plan=json.loads(Path(args.plan).read_text(encoding="utf-8"))
    snapshot=json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    realtime_plan=json.loads(Path(args.realtime_plan).read_text(encoding="utf-8"))
    result=apply(plan,snapshot,realtime_plan,apply_actions=args.apply)
    Path(args.json).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    Path(args.report).write_text(render(result),encoding="utf-8")
    print(json.dumps({"accepted":result["accepted_count"],"ceo_escalation":result["ceo_escalation"]}))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
