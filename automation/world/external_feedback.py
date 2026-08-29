#!/usr/bin/env python3
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
    url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "").strip()
    token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "").strip()
    if not url or not token:
        raise RuntimeError("GitHub OIDC environment is unavailable")
    sep = "&" if "?" in url else "?"
    req = urllib.request.Request(
        url + sep + urllib.parse.urlencode({"audience": AUDIENCE}),
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        value = json.loads(res.read().decode("utf-8")).get("value")
    if not value:
        raise RuntimeError("OIDC token response had no value")
    return str(value)


def _edge(payload: dict[str, Any]) -> dict[str, Any]:
    req = urllib.request.Request(
        EDGE_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {_oidc_token()}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def _load(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    q = sub.add_parser("record")
    q.add_argument("--lane", required=True)
    q.add_argument("--action-type", default="observe")
    q.add_argument("--resident-key", default="")
    q.add_argument("--source-task-id", default="")
    q.add_argument("--outcome", required=True)
    q.add_argument("--learning-signal", type=float, default=1.0)
    q.add_argument("--metrics")
    q.add_argument("--evidence")
    q.add_argument("--verified", action="store_true")
    q.add_argument("--external-effect", action="store_true")
    q.add_argument("--irreversible", action="store_true")

    q = sub.add_parser("query")
    q.add_argument("--task-id", required=True)
    q.add_argument("--out", required=True)
    args = p.parse_args()

    if args.cmd == "record":
        data = _edge({
            "action": "record_external",
            "lane": args.lane,
            "resident_key": args.resident_key,
            "source_task_id": args.source_task_id,
            "action_type": args.action_type,
            "verified": bool(args.verified),
            "external_effect": bool(args.external_effect),
            "reversible": not bool(args.irreversible),
            "outcome": args.outcome,
            "learning_signal": args.learning_signal,
            "metrics": _load(args.metrics),
            "evidence": _load(args.evidence),
        })
        print(json.dumps(data, ensure_ascii=False))
        return 0 if data.get("recorded") else 1

    data = _edge({"action": "external_result", "task_id": args.task_id})
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(data, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
