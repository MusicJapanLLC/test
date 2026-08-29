#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

AUDIENCE = "the-world-public-feed"
ENDPOINT = "https://the-world-public-field-feed-zt5n2q.v2.appdeploy.ai/api/ingest"


def load_json(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def oidc_token() -> str:
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


def select_payloads(doc: dict[str, Any], limit: int = 2) -> list[dict[str, str]]:
    findings = {
        str(item.get("url") or ""): item
        for item in doc.get("findings", [])
        if item.get("url")
    }
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for effect in doc.get("effects", []):
        status = effect.get("status")
        source_url = str(effect.get("source_url") or "")
        if effect.get("kind") != "github_issue" or not isinstance(status, int) or not 200 <= status < 300:
            continue
        if not source_url or source_url in seen or source_url not in findings:
            continue
        seen.add(source_url)
        item = findings[source_url]
        out.append({
            "title": str(item.get("title") or "External field observation"),
            "source_url": source_url,
            "citizen_id": str(item.get("citizen_id") or "unknown"),
            "display_name": str(item.get("display_name") or ""),
            "category": str(item.get("category") or "field"),
            "note": str(item.get("note") or ""),
        })
        if len(out) >= max(1, limit):
            break
    return out


def post_payload(payload: dict[str, str], token: str) -> dict[str, Any]:
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "TheWorld-RealityAgency-PublicFeed/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        body = res.read(8192).decode("utf-8", "replace")
        return {"status": int(res.status), "body": json.loads(body) if body else {}}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--events", default="reality-events.json")
    p.add_argument("--out", default="public-feed-receipt.json")
    p.add_argument("--limit", type=int, default=2)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    payloads = select_payloads(load_json(args.events), args.limit)
    receipts: list[dict[str, Any]] = []
    if args.dry_run:
        receipts = [{"status": "DRY_RUN", "payload": payload} for payload in payloads]
    elif payloads:
        token = oidc_token()
        for payload in payloads:
            receipt = post_payload(payload, token)
            receipts.append({"source_url": payload["source_url"], **receipt})

    result = {
        "schema": "the-world-public-feed-receipt/v1",
        "endpoint": ENDPOINT,
        "audience": AUDIENCE,
        "selected": len(payloads),
        "receipts": receipts,
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0 if all(r.get("status") in {"DRY_RUN", 200, 201, 202} for r in receipts) else 1


if __name__ == "__main__":
    raise SystemExit(main())
