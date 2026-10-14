#!/usr/bin/env python3
"""Build a bounded repair dossier for persistent failures in THE WORLD.

The engine is read-only. It inspects allowlisted GitHub Actions workflows,
selects one recent persistent failure, captures failed job logs, and attaches
bounded source context for the repair executor (TOMOKI/FORGE).

Two invariants matter here:
1. Never repair an obsolete failure. If the branch HEAD moved beyond the
   failing run SHA, the Realtime Kernel must revalidate the latest HEAD first.
2. Give the repair executor concrete code context. The dossier includes the
   failing workflow source plus traceback/file:line excerpts from owned source.

GitHub serves job logs through a temporary redirect to object storage. The
GitHub bearer token must never be forwarded to that different host; the signed
redirect URL is fetched without the GitHub Authorization header.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
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
MAX_CONTEXT_FILES = 6
MAX_CONTEXT_CHARS = 50000
CONTEXT_RADIUS = 14
ALLOWED_CONTEXT_PREFIXES = (
    ".github/workflows/",
    "automation/world/",
    "company-society/",
    "senju/",
    "tomoki-agents/",
)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Expose GitHub's temporary redirect so auth can be stripped cross-host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


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


def _github_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "the-world-self-heal-engine",
    }


def _request(method: str, path: str) -> bytes:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, headers=_github_headers(), method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"GitHub API {method} {url} -> {exc.code}: {body}") from exc


def _download_redirected_github_asset(path: str) -> bytes:
    """Download a GitHub asset without leaking GitHub auth to object storage."""
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, headers=_github_headers(), method="GET")
    opener = urllib.request.build_opener(_NoRedirect())
    location = ""
    try:
        with opener.open(req, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        if exc.code not in {301, 302, 303, 307, 308}:
            body = exc.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(f"GitHub asset GET {url} -> {exc.code}: {body}") from exc
        location = str(exc.headers.get("Location") or "").strip()
        if not location:
            raise RuntimeError(f"GitHub asset GET {url} redirected without Location") from exc

    source_host = urllib.parse.urlparse(url).netloc.lower()
    target_host = urllib.parse.urlparse(location).netloc.lower()
    if not target_host:
        raise RuntimeError("GitHub asset redirect target has no host")
    follow_headers = _github_headers() if target_host == source_host else {
        "User-Agent": "the-world-self-heal-engine"
    }
    follow = urllib.request.Request(location, headers=follow_headers, method="GET")
    try:
        with urllib.request.urlopen(follow, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(
            f"GitHub asset redirected download -> {exc.code} host={target_host}: {body}"
        ) from exc


def _json(path: str) -> dict[str, Any]:
    raw = _request("GET", path)
    return json.loads(raw.decode("utf-8")) if raw else {}


def _recent_runs(workflow: str, per_page: int = 30) -> list[dict[str, Any]]:
    q = urllib.parse.urlencode({"per_page": max(1, min(100, per_page))})
    return list((_json(f"/actions/workflows/{workflow}/runs?{q}").get("workflow_runs") or []))


def _branch_head_sha(branch: str) -> str:
    encoded = urllib.parse.quote(branch, safe="")
    data = _json(f"/branches/{encoded}")
    return str(((data.get("commit") or {}).get("sha")) or "")


def _fetch_text_file(path: str, ref: str) -> str:
    encoded_path = urllib.parse.quote(path, safe="/")
    query = urllib.parse.urlencode({"ref": ref})
    data = _json(f"/contents/{encoded_path}?{query}")
    if str(data.get("encoding") or "") != "base64":
        return ""
    content = str(data.get("content") or "").replace("\n", "")
    if not content:
        return ""
    return base64.b64decode(content).decode("utf-8", errors="replace")


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
                text = _download_redirected_github_asset(
                    f"/actions/jobs/{job_id}/logs"
                ).decode("utf-8", errors="replace")
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


def _normalize_source_path(raw: str) -> str:
    path = raw.strip().replace("\\", "/")
    path = path.split("?", 1)[0].split("#", 1)[0]
    for marker in ALLOWED_CONTEXT_PREFIXES:
        idx = path.find(marker)
        if idx >= 0:
            return path[idx:]
    while path.startswith("./"):
        path = path[2:]
    return path


def _owned_context_path(path: str) -> bool:
    normalized = _normalize_source_path(path)
    if ".." in Path(normalized).parts:
        return False
    return normalized.startswith(ALLOWED_CONTEXT_PREFIXES)


def _extract_source_locations(text: str) -> list[tuple[str, int]]:
    """Extract stable owned file:line references from Python/test/shell logs."""
    found: list[tuple[str, int]] = []
    seen: set[tuple[str, int]] = set()
    patterns = [
        re.compile(r"File [\"']([^\"']+)[\"'], line (\d+)"),
        re.compile(r"(?m)(?:^|\s)([A-Za-z0-9_./\\-]+\.(?:py|sh|ya?ml|json)):(\d+)(?::\d+)?"),
    ]
    for pattern in patterns:
        for match in pattern.finditer(text):
            path = _normalize_source_path(match.group(1))
            try:
                line = max(1, int(match.group(2)))
            except ValueError:
                continue
            key = (path, line)
            if key in seen or not _owned_context_path(path):
                continue
            seen.add(key)
            found.append(key)
            if len(found) >= MAX_CONTEXT_FILES:
                return found
    return found


def _excerpt(text: str, line: int, radius: int = CONTEXT_RADIUS) -> dict[str, Any]:
    lines = text.splitlines()
    if not lines:
        return {"start_line": 1, "end_line": 0, "text": ""}
    line = min(max(1, line), len(lines))
    start = max(1, line - radius)
    end = min(len(lines), line + radius)
    numbered = "\n".join(f"{idx:5d} | {lines[idx - 1]}" for idx in range(start, end + 1))
    return {"start_line": start, "end_line": end, "text": numbered}


def _source_context(incident: dict[str, Any], jobs: list[dict[str, Any]]) -> dict[str, Any]:
    ref = str(incident.get("head_sha") or incident.get("head_branch") or DEFAULT_REF)
    workflow_path = f".github/workflows/{incident['workflow']}"
    result: dict[str, Any] = {
        "ref": ref,
        "workflow": {"path": workflow_path, "text": "", "error": ""},
        "locations": [],
    }
    remaining = MAX_CONTEXT_CHARS
    try:
        workflow_text = _fetch_text_file(workflow_path, ref)
        workflow_text = workflow_text[: min(remaining, 24000)]
        result["workflow"]["text"] = workflow_text
        remaining -= len(workflow_text)
    except Exception as exc:
        result["workflow"]["error"] = f"{type(exc).__name__}: {exc}"[:700]

    combined = "\n".join(str(job.get("log_tail") or "") for job in jobs)
    for path, line in _extract_source_locations(combined):
        if remaining <= 0:
            break
        try:
            text = _fetch_text_file(path, ref)
            excerpt = _excerpt(text, line)
            excerpt_text = str(excerpt["text"])[:remaining]
            remaining -= len(excerpt_text)
            result["locations"].append(
                {
                    "path": path,
                    "line": line,
                    "start_line": excerpt["start_line"],
                    "end_line": excerpt["end_line"],
                    "text": excerpt_text,
                }
            )
        except Exception as exc:
            result["locations"].append(
                {
                    "path": path,
                    "line": line,
                    "error": f"{type(exc).__name__}: {exc}"[:700],
                }
            )
    return result


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
    branch_heads: dict[str, str] = {}

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

            failing_sha = str(run.get("head_sha") or "")
            if branch not in branch_heads:
                try:
                    branch_heads[branch] = _branch_head_sha(branch)
                except Exception:
                    branch_heads[branch] = ""
            current_sha = branch_heads[branch]
            if failing_sha and current_sha and failing_sha != current_sha:
                # The failure belongs to obsolete code. Realtime Kernel owns the
                # revalidation dispatch; FORGE must never patch this stale SHA.
                continue

            updated = _parse_time(run.get("updated_at") or run.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)
            incident = {
                "workflow": workflow,
                "worker": str(cfg.get("name") or workflow),
                "priority": int(cfg.get("priority", 0)),
                "head_branch": branch,
                "head_sha": failing_sha,
                "current_branch_sha": current_sha,
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
            "schema": "the-world-self-heal-dossier/v2",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "selected": False,
            "repository": REPO,
            "reason": "No current-HEAD persistent allowlisted workflow failure requires code repair.",
        }
    jobs = _failed_job_logs(int(incident["run_id"]))
    source_context = _source_context(incident, jobs)
    return {
        "schema": "the-world-self-heal-dossier/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "selected": True,
        "repository": REPO,
        "target_base": incident["head_branch"],
        "incident": incident,
        "failed_jobs": jobs,
        "source_context": source_context,
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
        f"- failing SHA: `{incident.get('head_sha') or 'unknown'}`",
        f"- current branch SHA: `{incident.get('current_branch_sha') or 'unknown'}`",
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

    context = dossier.get("source_context") or {}
    workflow = context.get("workflow") or {}
    lines += ["", "## Source context"]
    if workflow.get("text"):
        lines += [
            f"### Failing workflow — `{workflow.get('path')}`",
            "```yaml",
            str(workflow.get("text"))[:24000],
            "```",
        ]
    elif workflow.get("error"):
        lines.append(f"- workflow source unavailable: {workflow.get('error')}")

    for item in context.get("locations") or []:
        path = item.get("path")
        line = item.get("line")
        if item.get("text"):
            lines += [
                f"### `{path}:{line}`",
                "```text",
                str(item.get("text")),
                "```",
            ]
        else:
            lines.append(f"- `{path}:{line}` source unavailable: {item.get('error') or 'unknown error'}")

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
