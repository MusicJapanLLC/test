#!/usr/bin/env python3
"""OIDC bridge between GitHub Actions and THE WORLD task ledger.

No Supabase service secret is stored in GitHub. GitHub Actions obtains a short-lived
OIDC identity token and the Edge Function verifies repository ownership before
allowing bounded task claim/release/dispatch/reconciliation operations.
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
GATEWAY_PROTOCOL = "oidc-repository-v3"
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
    args = p.parse_args()

    if args.cmd in {"claim", "review"}:
        data = _edge({"action": args.cmd})
        _write(args.out, data)
        task = data.get("task")
        print("NO_TASK" if not task else f"{args.cmd.upper()} {task.get('id')} {task.get('title')}")
        return 0

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

    review = _read(args.review)
    t = review.get("task") or {}
    result = _read(args.result)
    data = _edge({
        "action": "finish_review", "task_id": t.get("id"), "success": bool(args.success),
        "result": result, "error": args.error,
    })
    print(json.dumps(data, ensure_ascii=False))
    return 0 if data.get("finished") else 1


if __name__ == "__main__":
    raise SystemExit(main())
