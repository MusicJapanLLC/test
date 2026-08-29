#!/usr/bin/env python3
"""OIDC bridge between GitHub Actions and THE WORLD task/experiment/research ledger.

No Supabase service secret is stored in GitHub. GitHub Actions obtains a short-lived
OIDC identity token and the Edge Function verifies an allowlisted repository/workflow
before bounded task, experiment, research, and observation operations are accepted.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

AUDIENCE = "the-world-worker"
GATEWAY_PROTOCOL = "oidc-repository-v7-autonomous-research"
EDGE_URL = "https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/the-world-github-worker"


def _oidc_token() -> str:
    request_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "").strip()
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "").strip()
    if not request_url or not request_token:
        raise RuntimeError("GitHub OIDC environment is unavailable")
    sep = "&" if "?" in request_url else "?"
    url = request_url + sep + urllib.parse.urlencode({"audience": AUDIENCE})
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {request_token}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode("utf-8"))
    token = str(data.get("value") or "")
    if not token:
        raise RuntimeError("GitHub OIDC token response had no value")
    return token


def _edge(payload: dict[str, Any]) -> dict[str, Any]:
    req = urllib.request.Request(
        EDGE_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_oidc_token()}",
            "Content-Type": "application/json",
            "User-Agent": f"the-world-github-task-worker/{GATEWAY_PROTOCOL}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1500]
        raise RuntimeError(f"worker gateway HTTP {exc.code}: {body}") from exc


def _write(path: str, data: dict[str, Any]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _read(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _apply_research_hints(data: dict[str, Any]) -> dict[str, Any]:
    """Convert shared research memory into a small, bounded exploration nudge.

    Research findings never mutate Senju target/scope/permissions. Candidate findings
    have weak influence; replicated findings can have stronger influence; contested
    findings push toward caution. The full hint list stays in the config as evidence.
    """
    policy = dict(data.get("policy") or {})
    hints = [h for h in (data.get("research_hints") or []) if isinstance(h, dict)]
    try:
        base = float(policy.get("exploration_rate") or 0.35)
    except Exception:
        base = 0.35

    candidate_pressure = 0.0
    replicated_pressure = 0.0
    contested_pressure = 0.0
    used: list[str] = []
    for hint in hints[:24]:
        try:
            confidence = max(0.0, min(1.0, float(hint.get("confidence") or 0.0)))
            novelty = max(0.0, min(1.0, float(hint.get("novelty") or 0.0)))
        except Exception:
            continue
        quality = confidence * novelty
        status = str(hint.get("canon_status") or "CANDIDATE")
        finding_id = str(hint.get("finding_id") or "")
        if finding_id:
            used.append(finding_id)
        if status == "REPLICATED":
            replicated_pressure += quality
        elif status == "CONTESTED":
            contested_pressure += quality
        else:
            candidate_pressure += quality

    # Weak preliminary learning, stronger replicated learning, strong caution for contradiction.
    nudge = min(0.015, candidate_pressure * 0.0015) + min(0.040, replicated_pressure * 0.006) - min(0.040, contested_pressure * 0.008)
    adjusted = max(0.05, min(0.80, base + nudge))
    policy["exploration_rate"] = round(adjusted, 6)
    data["policy"] = policy
    data["research_feedback"] = {
        "base_exploration_rate": round(base, 6),
        "adjusted_exploration_rate": round(adjusted, 6),
        "bounded_nudge": round(nudge, 6),
        "candidate_pressure": round(candidate_pressure, 6),
        "replicated_pressure": round(replicated_pressure, 6),
        "contested_pressure": round(contested_pressure, 6),
        "hint_count": len(hints),
        "used_finding_ids": used[:24],
        "authority": "exploration_geometry_only",
    }
    return data


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("claim", "review"):
        q = sub.add_parser(name)
        q.add_argument("--out", required=True)

    q = sub.add_parser("release")
    q.add_argument("--claim", required=True)
    q.add_argument("--delay", type=int, default=15)
    q.add_argument("--reason", default="execution lane busy")

    q = sub.add_parser("dispatched")
    q.add_argument("--claim", required=True)
    q.add_argument("--workflow", required=True)
    q.add_argument("--run-id", type=int, required=True)
    q.add_argument("--run-url", required=True)

    q = sub.add_parser("finish-review")
    q.add_argument("--review", required=True)
    q.add_argument("--result", required=True)
    q.add_argument("--success", action="store_true")
    q.add_argument("--error", default=None)

    q = sub.add_parser("experiment-config")
    q.add_argument("--out", required=True)
    q.add_argument("--policy-key", default="SENJU_MASS_SHADOW")

    q = sub.add_parser("record-experiment")
    q.add_argument("--selection", required=True)
    q.add_argument("--workflow", required=True)
    q.add_argument("--policy-key", default="SENJU_MASS_SHADOW")
    q.add_argument("--out", default=None)

    q = sub.add_parser("research-config")
    q.add_argument("--out", required=True)
    q.add_argument("--history-limit", type=int, default=80)

    q = sub.add_parser("record-research")
    q.add_argument("--result", required=True)
    q.add_argument("--out", default=None)
    args = p.parse_args()

    if args.cmd == "claim":
        slot = os.environ.get("WORLD_WORKER_SLOT", "0")
        data = _edge({"action": "claim", "worker_slot": slot})
        _write(args.out, data)
        task = data.get("task")
        print("NO_TASK" if not task else f"CLAIM {task.get('id')} {task.get('title')}")
        return 0

    if args.cmd == "review":
        data = _edge({"action": "review"})
        _write(args.out, data)
        task = data.get("task")
        print("NO_TASK" if not task else f"REVIEW {task.get('id')} {task.get('title')}")
        return 0

    if args.cmd == "experiment-config":
        data = _apply_research_hints(_edge({"action": "experiment_config", "policy_key": args.policy_key}))
        _write(args.out, data)
        policy = data.get("policy") or {}
        feedback = data.get("research_feedback") or {}
        print(json.dumps({
            "trial_multiplier": policy.get("trial_multiplier"),
            "exploration_rate": policy.get("exploration_rate"),
            "history_runs": len(data.get("history") or []),
            "research_hints": len(data.get("research_hints") or []),
            "research_nudge": feedback.get("bounded_nudge"),
        }, ensure_ascii=False))
        return 0

    if args.cmd == "record-experiment":
        selection = _read(args.selection)
        candidates = list(selection.get("top_candidates") or [])[:100]
        data = _edge({
            "action": "record_experiment",
            "policy_key": args.policy_key,
            "workflow": args.workflow,
            "summary": selection,
            "candidates": candidates,
        })
        if args.out:
            _write(args.out, data)
        print(json.dumps(data, ensure_ascii=False))
        return 0 if data.get("recorded") else 1

    if args.cmd == "research-config":
        data = _edge({"action": "research_config", "history_limit": max(10, min(200, args.history_limit))})
        _write(args.out, data)
        due = [p.get("program_key") for p in (data.get("programs") or []) if p.get("due")]
        print(json.dumps({
            "active_labs": len(data.get("programs") or []),
            "due_labs": due,
            "recent_findings": len(data.get("recent_findings") or []),
            "open_replications": len(data.get("open_replications") or []),
        }, ensure_ascii=False))
        return 0

    if args.cmd == "record-research":
        result = _read(args.result)
        data = _edge({
            "action": "record_research",
            "program_key": result.get("program_key"),
            "lab_slot": int(result.get("lab_slot") or 0),
            "result": result,
        })
        if args.out:
            _write(args.out, data)
        print(json.dumps(data, ensure_ascii=False))
        return 0 if data.get("recorded") else 1

    if args.cmd == "release":
        c = _read(args.claim)
        t = c.get("task") or {}
        data = _edge({
            "action": "release", "task_id": t.get("id"), "worker": c.get("worker"),
            "delay_minutes": args.delay, "reason": args.reason,
        })
        print(json.dumps(data, ensure_ascii=False))
        return 0 if data.get("released") else 1

    if args.cmd == "dispatched":
        c = _read(args.claim)
        t = c.get("task") or {}
        data = _edge({
            "action": "dispatched", "task_id": t.get("id"), "worker": c.get("worker"),
            "workflow": args.workflow, "run_id": args.run_id, "run_url": args.run_url,
        })
        print(json.dumps(data, ensure_ascii=False))
        return 0 if data.get("marked") else 1

    if args.cmd == "finish-review":
        review = _read(args.review)
        t = review.get("task") or {}
        result = _read(args.result)
        data = _edge({
            "action": "finish_review", "task_id": t.get("id"), "success": bool(args.success),
            "result": result, "error": args.error,
        })
        print(json.dumps(data, ensure_ascii=False))
        return 0 if data.get("finished") else 1

    raise RuntimeError(f"unsupported command: {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
