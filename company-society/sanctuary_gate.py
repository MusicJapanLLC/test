#!/usr/bin/env python3
"""Deterministic Sanctuary gate for THE COVENANT.

The LLM Manager may propose bounded dispatches, but a worker that the Council has
placed in REST/SANCTUARY must not be woken by another direct dispatch or rerun.
The gate blocks actions aimed at the resting worker while allowing a distinct
specialist to be dispatched as a companion.

This file has no GitHub side effects. It only filters a proposed plan and emits
an audit record. Existing manager.py remains the final allowlist/action gate.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _resting_agents(council: dict[str, Any]) -> set[str]:
    agents: set[str] = set()
    for row in council.get("rest") or []:
        agent = str(row.get("agent") or "").strip().upper()
        if agent and agent != "NONE":
            agents.add(agent)
    return agents


def _worker_maps(snapshot: dict[str, Any]) -> tuple[dict[str, str], dict[int, str]]:
    workflow_to_agent: dict[str, str] = {}
    run_to_agent: dict[int, str] = {}
    for row in snapshot.get("workers") or []:
        agent = str(row.get("agent") or "").strip().upper()
        workflow = str(row.get("workflow") or "").strip()
        if agent and workflow:
            workflow_to_agent[workflow] = agent
        run_id = row.get("run_id")
        if agent and run_id is not None:
            try:
                run_to_agent[int(run_id)] = agent
            except (TypeError, ValueError):
                pass
    return workflow_to_agent, run_to_agent


def gate_plan(
    plan: dict[str, Any],
    snapshot: dict[str, Any],
    council: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    resting = _resting_agents(council)
    workflow_to_agent, run_to_agent = _worker_maps(snapshot)
    kept: list[dict[str, Any]] = []
    blocked: list[dict[str, Any]] = []

    for action in plan.get("actions") or []:
        kind = str(action.get("action") or "none")
        target_agent = ""
        if kind == "dispatch":
            target_agent = workflow_to_agent.get(str(action.get("workflow") or ""), "")
        elif kind == "rerun_failed":
            try:
                target_agent = run_to_agent.get(int(action.get("run_id")), "")
            except (TypeError, ValueError):
                target_agent = ""

        if target_agent and target_agent in resting:
            rejected = dict(action)
            rejected["blocked_by"] = "THE_COVENANT_SANCTUARY"
            rejected["resting_agent"] = target_agent
            rejected["reason"] = (
                "Council placed this worker in REST/SANCTUARY. Do not repeat the same direct "
                "dispatch/rerun; use a distinct companion, root-cause analysis, or changed hypothesis."
            )
            blocked.append(rejected)
            continue
        kept.append(action)

    gated = dict(plan)
    gated["actions"] = kept
    if blocked:
        suffix = f" Sanctuary gate blocked {len(blocked)} direct action(s) to resting worker(s)."
        gated["summary"] = (str(gated.get("summary") or "") + suffix).strip()

    audit = {
        "schema": "the-covenant-sanctuary-gate/v1",
        "resting_agents": sorted(resting),
        "input_actions": len(plan.get("actions") or []),
        "kept_actions": len(kept),
        "blocked_actions": blocked,
        "rule": "rest the worker; dispatch a distinct companion if help is needed",
    }
    return gated, audit


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--plan", required=True)
    p.add_argument("--snapshot", required=True)
    p.add_argument("--council", required=True)
    p.add_argument("--output", default="tomoki-manager-plan-gated.json")
    p.add_argument("--audit", default="covenant-sanctuary-gate.json")
    args = p.parse_args()

    gated, audit = gate_plan(load(args.plan), load(args.snapshot), load(args.council))
    Path(args.output).write_text(json.dumps(gated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "resting_agents": audit["resting_agents"],
        "blocked": len(audit["blocked_actions"]),
        "kept": audit["kept_actions"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
