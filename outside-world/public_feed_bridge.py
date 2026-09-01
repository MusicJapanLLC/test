#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ENDPOINT = "https://the-world-public-field-feed-zt5n2q.v2.appdeploy.ai/api/ingest"
OIDC_AUDIENCE = "the-world-public-field-feed"


def load_json(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def oidc_token() -> str:
    base = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "").strip()
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "").strip()
    if not base or not request_token:
        raise RuntimeError("GitHub Actions OIDC environment is unavailable")
    sep = "&" if "?" in base else "?"
    url = base + sep + urllib.parse.urlencode({"audience": OIDC_AUDIENCE})
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {request_token}",
            "Accept": "application/json",
            "User-Agent": "TheWorld-RealityAgency-OIDC/1.0",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        doc = json.loads(res.read(65536).decode("utf-8"))
    token = str(doc.get("value") or "").strip()
    if token.count(".") != 2:
        raise RuntimeError("GitHub Actions OIDC token response is invalid")
    return token


def run_id() -> int:
    value = os.environ.get("GITHUB_RUN_ID", "").strip()
    if not value.isdigit() or int(value) < 1:
        raise RuntimeError("GITHUB_RUN_ID is unavailable")
    return int(value)


def finding_payload(item: dict[str, Any]) -> dict[str, str]:
    return {
        "title": str(item.get("title") or "External field observation"),
        "source_url": str(item.get("url") or ""),
        "citizen_id": str(item.get("citizen_id") or "unknown"),
        "display_name": str(item.get("display_name") or ""),
        "category": str(item.get("category") or "field"),
        "note": str(item.get("note") or ""),
    }


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
        out.append(finding_payload(findings[source_url]))
        if len(out) >= max(1, limit):
            break
    return out


def select_probe_payloads(doc: dict[str, Any]) -> list[dict[str, str]]:
    """Select exactly one real browser finding for an explicitly marked bootstrap probe."""
    for item in doc.get("findings", []):
        if item.get("url") and item.get("title") and item.get("citizen_id"):
            return [finding_payload(item)]
    return []


def decode_error_body(raw: bytes) -> Any:
    text = raw[:8192].decode("utf-8", "replace")
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"message": text[:1000]}


def post_payload(payload: dict[str, Any], token: str) -> dict[str, Any]:
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "TheWorld-RealityAgency-PublicFeed/3.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            body = res.read(8192).decode("utf-8", "replace")
            return {"status": int(res.status), "body": json.loads(body) if body else {}}
    except urllib.error.HTTPError as exc:
        return {
            "status": int(exc.code),
            "body": decode_error_body(exc.read(8192)),
            "error": "http_error",
        }
    except urllib.error.URLError as exc:
        return {
            "status": "NETWORK_ERROR",
            "body": {},
            "error": str(getattr(exc, "reason", exc))[:500],
        }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--events", default="reality-events.json")
    p.add_argument("--out", default="public-feed-receipt.json")
    p.add_argument("--limit", type=int, default=2)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--probe", action="store_true", help="one-time bootstrap: publish one real finding even if the regular 6h owned-publication interval is not due")
    args = p.parse_args()

    doc = load_json(args.events)
    payloads: list[dict[str, Any]] = list(select_probe_payloads(doc) if args.probe else select_payloads(doc, args.limit))
    receipts: list[dict[str, Any]] = []
    if args.dry_run:
        receipts = [{"status": "DRY_RUN", "payload": payload} for payload in payloads]
    elif payloads:
        token = oidc_token()
        current_run = run_id()
        for payload in payloads:
            body = {**payload, "run_id": current_run}
            receipt = post_payload(body, token)
            receipts.append({"source_url": payload["source_url"], **receipt})

    success_statuses = {"DRY_RUN", 200, 201, 202}
    failures = [r for r in receipts if r.get("status") not in success_statuses]
    result = {
        "schema": "the-world-public-feed-receipt/v5",
        "endpoint": ENDPOINT,
        "auth": "github_actions_oidc_audience_bound",
        "audience": OIDC_AUDIENCE,
        "mode": "BOOTSTRAP_PROBE" if args.probe else "REGULAR",
        "selected": len(payloads),
        "delivery_ok": not failures,
        "failure_count": len(failures),
        "receipts": receipts,
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    if failures:
        print(f"public feed degraded: {len(failures)} failed publication(s); receipt preserved for downstream learning", flush=True)
    # Transport failure is an observed outcome, not a reason to discard the mission's
    # already-verified browser observations and owned-channel effects. Authentication
    # acquisition/validation errors still raise and fail closed above.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
