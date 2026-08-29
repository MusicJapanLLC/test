#!/usr/bin/env python3
"""GitHub-native execution bridge for THE WORLD.

The worker authenticates to the Supabase Edge Function with GitHub Actions OIDC,
claims exactly one canonical ai_tasks row, and reconciles an evidence-bearing
result. It never stores a Supabase service key in GitHub.
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
EDGE_URL = "https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/the-world-github-worker"


def _oidc_token() -> str:
    request_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "").strip()
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "").strip()
    if not request_url or not request_token:
        raise RuntimeError("GitHub OIDC environment is unavailable")
    sep = "&" if "?" in request_url else "?"
    url = request_url + sep + urllib.parse.urlencode({"audience": AUDIENCE})
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {request_token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode("utf-8"))
    token = str(data.get("value") or "")
    if not token:
        raise RuntimeError("GitHub OIDC token response had no value")
    return token


def _edge(payload: dict[str, Any]) -> dict[str, Any]:
    token = _oidc_token()
    req = urllib.request.Request(
        EDGE_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "the-world-github-task-worker",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1500]
        raise RuntimeError(f"worker gateway HTTP {exc.code}: {body}") from exc


def claim(out: Path) -> int:
    data = _edge({"action": "claim"})
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    task = data.get("task")
    if not task:
        print("NO_TASK")
        return 0
    print(f"CLAIMED {task.get('id')} {task.get('title')}")
    return 0


def finish(claim_path: Path, result_path: Path, success: bool, error: str | None) -> int:
    claim_data = json.loads(claim_path.read_text(encoding="utf-8"))
    task = claim_data.get("task") or {}
    worker = str(claim_data.get("worker") or "")
    task_id = str(task.get("id") or "")
    if not task_id or not worker:
        raise RuntimeError("claim file does not contain task/worker identity")
    if result_path.exists():
        result = json.loads(result_path.read_text(encoding="utf-8"))
    else:
        result = {
            "schema": "the-world-task-result/v1",
            "status": "FAILED",
            "summary": "Worker produced no result document.",
            "verified": False,
            "produced_change": False,
            "evidence": [],
        }
        success = False
    data = _edge(
        {
            "action": "finish",
            "task_id": task_id,
            "worker": worker,
            "success": bool(success),
            "result": result,
            "error": error,
        }
    )
    print(json.dumps(data, ensure_ascii=False))
    return 0 if data.get("finished") else 1


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    pc = sub.add_parser("claim")
    pc.add_argument("--out", required=True)
    pf = sub.add_parser("finish")
    pf.add_argument("--claim", required=True)
    pf.add_argument("--result", required=True)
    pf.add_argument("--success", action="store_true")
    pf.add_argument("--error", default=None)
    args = p.parse_args()
    if args.cmd == "claim":
        return claim(Path(args.out))
    return finish(Path(args.claim), Path(args.result), args.success, args.error)


if __name__ == "__main__":
    raise SystemExit(main())
