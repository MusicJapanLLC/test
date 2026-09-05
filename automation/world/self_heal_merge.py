#!/usr/bin/env python3
"""Merge only verified THE WORLD self-heal pull requests.

A repair PR is merged only when GitHub reports it mergeable, at least one check
run exists, every check has completed, and every conclusion is non-failing.
This prevents the repair executor from merging its own unverified patch.
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
HEAD_PREFIX = "the-world/self-heal-"
GOOD = {"success", "neutral", "skipped"}


def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> bytes:
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    url = path if path.startswith("http") else API + path
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "the-world-self-heal-merge",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1200]
        raise RuntimeError(f"GitHub API {method} {url} -> {exc.code}: {body}") from exc


def _json(path: str) -> Any:
    raw = _request("GET", path)
    return json.loads(raw.decode("utf-8")) if raw else {}


def _open_repair_prs() -> list[dict[str, Any]]:
    q = urllib.parse.urlencode({"state": "open", "per_page": 100, "sort": "created", "direction": "asc"})
    rows = _json(f"/pulls?{q}")
    return [p for p in rows if str((p.get("head") or {}).get("ref") or "").startswith(HEAD_PREFIX)]


def inspect_pr(pr: dict[str, Any]) -> dict[str, Any]:
    number = int(pr["number"])
    detail = _json(f"/pulls/{number}")
    sha = str((detail.get("head") or {}).get("sha") or "")
    checks = list((_json(f"/commits/{sha}/check-runs?per_page=100").get("check_runs") or [])) if sha else []
    pending = [c for c in checks if str(c.get("status") or "") != "completed"]
    bad = [c for c in checks if str(c.get("status") or "") == "completed" and str(c.get("conclusion") or "") not in GOOD]
    mergeable = detail.get("mergeable") is True
    labels = {str(lb.get("name") or "") for lb in (detail.get("labels") or [])}
    has_approval_label = "ai-merge-approved" in labels
    ready = bool(checks) and not pending and not bad and mergeable and has_approval_label
    return {
        "number": number,
        "head": str((detail.get("head") or {}).get("ref") or ""),
        "base": str((detail.get("base") or {}).get("ref") or ""),
        "sha": sha,
        "mergeable": detail.get("mergeable"),
        "checks_total": len(checks),
        "checks_pending": [str(c.get("name") or "check") for c in pending],
        "checks_bad": [f"{c.get('name')}={c.get('conclusion')}" for c in bad],
        "has_ai_merge_approved": has_approval_label,
        "ready": ready,
        "html_url": detail.get("html_url"),
    }


def reconcile(*, apply_actions: bool, max_merges: int = 2) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    merged = 0
    for pr in _open_repair_prs():
        row = inspect_pr(pr)
        row["action"] = "WAIT"
        if row["ready"] and merged < max(0, min(3, max_merges)):
            if apply_actions:
                try:
                    result_raw = _request("PUT", f"/pulls/{row['number']}/merge", {"merge_method": "squash"})
                    result = json.loads(result_raw.decode("utf-8")) if result_raw else {}
                    if result.get("merged"):
                        row["action"] = "MERGED"
                        merged += 1
                    else:
                        row["action"] = "MERGE_REJECTED"
                        row["message"] = str(result.get("message") or "merge endpoint rejected")[:500]
                except Exception as exc:
                    row["action"] = "MERGE_ERROR"
                    row["message"] = f"{type(exc).__name__}: {exc}"[:700]
            else:
                row["action"] = "WOULD_MERGE"
        rows.append(row)
    return {
        "schema": "the-world-self-heal-merge/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "apply_actions": apply_actions,
        "merged": merged,
        "pull_requests": rows,
    }


def render(result: dict[str, Any]) -> str:
    lines = [
        "# THE WORLD — SELF HEAL MERGE GATE",
        "",
        f"- generated: {result['generated_at']}",
        f"- merged this cycle: {result['merged']}",
    ]
    if not result["pull_requests"]:
        lines.append("- open repair PRs: 0")
    for row in result["pull_requests"]:
        lines.append(
            f"- PR #{row['number']} `{row['head']}` -> `{row['base']}` "
            f"checks={row['checks_total']} pending={len(row['checks_pending'])} bad={len(row['checks_bad'])} "
            f"mergeable={row['mergeable']} action={row['action']}"
        )
        if row["checks_bad"]:
            lines.append("  - bad: " + ", ".join(row["checks_bad"]))
        if row["checks_pending"]:
            lines.append("  - pending: " + ", ".join(row["checks_pending"]))
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", default="self-heal-merge.json")
    p.add_argument("--report", default="self-heal-merge.md")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--max-merges", type=int, default=2)
    args = p.parse_args()
    result = reconcile(apply_actions=args.apply, max_merges=args.max_merges)
    Path(args.json).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render(result), encoding="utf-8")
    print(json.dumps({"merged": result["merged"], "open": len(result["pull_requests"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
