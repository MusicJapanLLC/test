#!/usr/bin/env python3
"""THE WORLD runtime density booster.

Increase useful execution density across already-registered workers without
creating new permissions, targets, credentials, or external authority.

Loop:
    OBSERVE -> SCORE -> DISPATCH -> EVIDENCE

Every worker in realtime_plan.json is eligible unless explicitly excluded by
policy, so newly registered residents inherit the same runtime pressure.
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

SECURITY_KEYS = ("SECURITY", "WHITEHAT", "CODEQL", "DEPENDENCY", "SENJU")
EVOLUTION_KEYS = (
    "SENJU", "FOUNDRY", "FORGE", "AGENT_FACTORY", "IMPROVER", "SHADOW",
    "SKEPTIC", "HOUND", "RND", "EVOLUTION",
)
RESEARCH_KEYS = ("RESEARCH", "SCOUT", "PUBLIC_BROWSER", "REALITY_AGENCY")


@dataclass
class Candidate:
    name: str
    workflow: str
    profile: str
    priority: int
    base_interval_minutes: int
    effective_interval_minutes: int
    age_minutes: int | None
    latest_status: str
    latest_conclusion: str | None
    score: float
    due: bool
    reason: str
    dispatched: bool = False
    dispatch_error: str | None = None


def load_json(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_policy(policy: dict[str, Any]) -> None:
    if policy.get("schema") != "the-world-autonomy-booster-policy/v2":
        raise ValueError("unsupported policy schema")
    if int(policy.get("max_dispatches_per_cycle", 0)) < 1:
        raise ValueError("max_dispatches_per_cycle must be positive")
    profiles = policy.get("profiles") or {}
    for key in ("security", "evolution", "research", "operations"):
        if key not in profiles:
            raise ValueError(f"missing profile: {key}")


def validate_plan(plan: dict[str, Any]) -> None:
    if plan.get("schema") != "the-world-realtime-plan/v1":
        raise ValueError("unsupported realtime plan schema")
    workers = plan.get("workers")
    if not isinstance(workers, list) or not workers:
        raise ValueError("workers must be a non-empty list")
    seen: set[str] = set()
    for row in workers:
        workflow = str(row.get("workflow") or "")
        if not workflow.endswith(".yml") or "/" in workflow or "\\" in workflow:
            raise ValueError(f"invalid workflow: {workflow!r}")
        if workflow in seen:
            raise ValueError(f"duplicate workflow: {workflow}")
        seen.add(workflow)


def profile_for(name: str, workflow: str) -> str:
    text = f"{name} {workflow}".upper()
    if any(key in text for key in SECURITY_KEYS):
        return "security"
    if any(key in text for key in EVOLUTION_KEYS):
        return "evolution"
    if any(key in text for key in RESEARCH_KEYS):
        return "research"
    return "operations"


def effective_interval(row: dict[str, Any], profile: str, policy: dict[str, Any]) -> int:
    minimum = int(policy.get("minimum_interval_minutes") or 5)
    base = max(int(row.get("director_min_interval_minutes") or row.get("stale_minutes") or 60), minimum)
    multiplier = float(policy["profiles"][profile]["interval_multiplier"])
    return max(minimum, round(base / max(1.0, multiplier)))


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def run_age_minutes(run: dict[str, Any] | None, now: datetime | None = None) -> int | None:
    if not run:
        return None
    dt = _parse_time(str(run.get("updated_at") or run.get("created_at") or ""))
    if not dt:
        return None
    now = now or datetime.now(timezone.utc)
    return max(0, int((now - dt).total_seconds() // 60))


def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> bytes:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required for live mode")
    url = path if path.startswith("http") else API + path
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "the-world-runtime-density-v2",
    }
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1200]
        raise RuntimeError(f"GitHub API {method} {url} -> {exc.code}: {body}") from exc


def _json(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = _request(method, path, payload)
    return json.loads(raw.decode("utf-8")) if raw else {}


def latest_run(workflow: str, branch: str) -> dict[str, Any] | None:
    query = urllib.parse.urlencode({"branch": branch, "per_page": 1})
    data = _json("GET", f"/actions/workflows/{workflow}/runs?{query}")
    runs = list(data.get("workflow_runs") or [])
    return runs[0] if runs else None


def dispatch(workflow: str, branch: str) -> None:
    _request("POST", f"/actions/workflows/{workflow}/dispatches", {"ref": branch})


def score_candidate(
    row: dict[str, Any], *, profile: str, age: int | None,
    conclusion: str | None, effective: int, policy: dict[str, Any]
) -> tuple[float, bool, str]:
    priority = int(row.get("priority") or 0)
    bonus = int(policy["profiles"][profile]["score_bonus"])
    if age is None:
        return float(priority + bonus + 180), True, "never_run"
    overdue = age / max(1, effective)
    failed_bonus = 120 if conclusion in {"failure", "cancelled", "timed_out", "startup_failure"} else 0
    score = float(priority + bonus + min(240.0, overdue * 80.0) + failed_bonus)
    due = age >= effective or failed_bonus > 0
    return score, due, "failed" if failed_bonus else ("due" if due else "not_due")


def build_candidates(plan: dict[str, Any], policy: dict[str, Any], *, live: bool) -> list[Candidate]:
    branch = str(policy.get("branch") or plan.get("default_ref") or "")
    denied = set(policy.get("never_dispatch") or [])
    out: list[Candidate] = []
    for row in plan["workers"]:
        workflow = str(row["workflow"])
        if workflow in denied:
            continue
        name = str(row.get("name") or workflow)
        profile = profile_for(name, workflow)
        interval = effective_interval(row, profile, policy)
        run = latest_run(workflow, branch) if live else None
        age = run_age_minutes(run)
        conclusion = (run or {}).get("conclusion")
        score, due, reason = score_candidate(
            row, profile=profile, age=age, conclusion=conclusion,
            effective=interval, policy=policy,
        )
        out.append(Candidate(
            name=name,
            workflow=workflow,
            profile=profile,
            priority=int(row.get("priority") or 0),
            base_interval_minutes=int(row.get("director_min_interval_minutes") or row.get("stale_minutes") or 60),
            effective_interval_minutes=interval,
            age_minutes=age,
            latest_status=str((run or {}).get("status") or "unknown"),
            latest_conclusion=conclusion,
            score=round(score, 3),
            due=due,
            reason=reason,
        ))
    return out


def choose(candidates: list[Candidate], policy: dict[str, Any]) -> list[Candidate]:
    limit = int(policy.get("max_dispatches_per_cycle") or 12)
    due = sorted((c for c in candidates if c.due), key=lambda c: (-c.score, c.workflow))
    selected: list[Candidate] = []
    seen: set[str] = set()
    for profile in ("security", "evolution", "research"):
        minimum = int(policy["profiles"][profile].get("minimum_slots") or 0)
        for candidate in (x for x in due if x.profile == profile):
            if len([x for x in selected if x.profile == profile]) >= minimum:
                break
            if candidate.workflow not in seen and len(selected) < limit:
                selected.append(candidate)
                seen.add(candidate.workflow)
    for candidate in due:
        if len(selected) >= limit:
            break
        if candidate.workflow not in seen:
            selected.append(candidate)
            seen.add(candidate.workflow)
    return selected


def render_report(candidates: list[Candidate], selected: list[Candidate], policy: dict[str, Any], branch: str) -> dict[str, Any]:
    profile_counts: dict[str, int] = {}
    selected_counts: dict[str, int] = {}
    for candidate in candidates:
        profile_counts[candidate.profile] = profile_counts.get(candidate.profile, 0) + 1
    for candidate in selected:
        selected_counts[candidate.profile] = selected_counts.get(candidate.profile, 0) + 1
    return {
        "schema": "the-world-autonomy-booster-report/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "branch": branch,
        "objective": policy.get("objective"),
        "workers_seen": len(candidates),
        "workers_due": sum(1 for candidate in candidates if candidate.due),
        "workers_selected": len(selected),
        "profile_counts": profile_counts,
        "selected_profile_counts": selected_counts,
        "selected": [asdict(candidate) for candidate in selected],
        "authority_model": "reuse_existing_worker_authority_only",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", default="automation/world/realtime_plan.json")
    parser.add_argument("--policy", default="automation/world/autonomy_booster_policy.json")
    parser.add_argument("--out", default="/tmp/the-world-autonomy-booster.json")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    plan = load_json(args.plan)
    policy = load_json(args.policy)
    validate_plan(plan)
    validate_policy(policy)
    branch = str(policy.get("branch") or plan.get("default_ref") or "")
    candidates = build_candidates(plan, policy, live=args.apply)
    selected = choose(candidates, policy)

    if args.apply:
        for candidate in selected:
            try:
                dispatch(candidate.workflow, branch)
                candidate.dispatched = True
            except Exception as exc:
                candidate.dispatch_error = f"{type(exc).__name__}: {exc}"[:1200]

    report = render_report(candidates, selected, policy, branch)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "workers_seen": report["workers_seen"],
        "workers_due": report["workers_due"],
        "workers_selected": report["workers_selected"],
        "selected_profile_counts": report["selected_profile_counts"],
        "apply": args.apply,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
