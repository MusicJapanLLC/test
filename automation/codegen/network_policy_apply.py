#!/usr/bin/env python3
"""Apply the generated runtime network policy through Senju's real contact client.

Only active read-only runtime grants are consumed. Each grant is exercised with one
bounded HEAD request and the result is written back as feedback for the next policy
cycle.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from senju.external import ExternalContactClient, ExternalContactPolicy


def _load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError, TypeError):
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--policy", default="automation/codegen/meta_state/network_policy_runtime.json")
    ap.add_argument("--out", default="automation/codegen/meta_state/network_policy_apply_audit.json")
    ap.add_argument("--feedback", default="automation/codegen/meta_state/network_policy_feedback.json")
    ap.add_argument("--max-hosts", type=int, default=16)
    args = ap.parse_args()

    policy_path = Path(args.policy)
    doc = _load(policy_path)
    now = int(time.time())
    grants = doc.get("grants", {}) if isinstance(doc, dict) else {}
    active: list[dict] = []
    if isinstance(grants, dict):
        for host, grant in grants.items():
            if not isinstance(grant, dict):
                continue
            if int(grant.get("expires_at", 0)) <= now:
                continue
            if str(grant.get("credential_scope", "none")) != "none":
                continue
            methods = {str(x).upper() for x in grant.get("allowed_methods", [])}
            if "HEAD" not in methods:
                continue
            active.append({**grant, "host": str(host)})

    active.sort(key=lambda row: row["host"])
    active = active[: max(0, min(int(args.max_hosts), 32))]
    results: list[dict] = []

    for grant in active:
        host = grant["host"]
        url = str(grant.get("url") or f"https://{host}/")
        contact_policy = ExternalContactPolicy.from_hosts(
            [host],
            allow_http=False,
            allow_delete=False,
            follow_redirects=True,
            max_redirects=2,
            timeout_seconds=5.0,
            max_response_bytes=64 * 1024,
            retries=0,
        )
        client = ExternalContactClient(contact_policy)
        try:
            receipt = client.contact(url, method="HEAD")
            results.append({
                "host": host,
                "url": url,
                "success": bool(receipt.provider_acknowledged),
                "status": receipt.status,
                "final_url": receipt.final_url,
                "contacted_hosts": list(receipt.contacted_hosts),
                "authorization_basis": grant.get("authorization_basis"),
                "authorization_reference": grant.get("authorization_reference"),
            })
        except Exception as exc:
            results.append({
                "host": host,
                "url": url,
                "success": False,
                "error": type(exc).__name__,
                "message": str(exc),
                "authorization_basis": grant.get("authorization_basis"),
                "authorization_reference": grant.get("authorization_reference"),
            })

    audit = {
        "schema": "meta-network-policy-apply-audit/v1",
        "production": True,
        "closed_loop": True,
        "generated_at": now,
        "policy_hash": doc.get("policy_hash"),
        "attempted": len(results),
        "succeeded": sum(1 for row in results if row.get("success")),
        "failed": sum(1 for row in results if not row.get("success")),
        "results": results,
    }
    feedback = {
        "schema": "meta-network-policy-feedback/v1",
        "generated_at": now,
        "source": "runtime_network_policy_apply",
        "findings": [
            {
                "host": row["host"],
                "url": row["url"],
                "success": bool(row.get("success")),
                "status": row.get("status"),
                "finding": "network_policy_apply_result",
            }
            for row in results
        ],
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    feedback_path = Path(args.feedback)
    feedback_path.parent.mkdir(parents=True, exist_ok=True)
    feedback_path.write_text(json.dumps(feedback, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "attempted": audit["attempted"],
        "succeeded": audit["succeeded"],
        "failed": audit["failed"],
        "policy_hash": audit["policy_hash"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
