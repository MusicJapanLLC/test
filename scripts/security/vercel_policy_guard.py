#!/usr/bin/env python3
"""Validate the deploy-time browser/edge security contract in vercel.json."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED_HEADERS = {
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "x-frame-options",
}

REQUIRED_CSP_DIRECTIVES = {
    "default-src",
    "script-src",
    "connect-src",
    "object-src",
    "base-uri",
    "frame-ancestors",
    "form-action",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("vercel_json", type=Path)
    parser.add_argument("--json", dest="output", type=Path, required=True)
    args = parser.parse_args()

    config = json.loads(args.vercel_json.read_text(encoding="utf-8"))
    global_headers: dict[str, str] = {}
    for rule in config.get("headers", []):
        if rule.get("source") == "/(.*)":
            for header in rule.get("headers", []):
                global_headers[str(header.get("key", "")).lower()] = str(header.get("value", ""))

    findings: list[dict[str, str]] = []
    missing = sorted(REQUIRED_HEADERS - set(global_headers))
    for name in missing:
        findings.append({"severity": "HIGH", "rule": "edge.required-header", "detail": f"Missing header: {name}"})

    if global_headers.get("x-content-type-options", "").lower() != "nosniff":
        findings.append({"severity": "HIGH", "rule": "edge.nosniff", "detail": "X-Content-Type-Options must be nosniff"})

    hsts = global_headers.get("strict-transport-security", "").lower()
    if "max-age=" not in hsts:
        findings.append({"severity": "HIGH", "rule": "edge.hsts", "detail": "HSTS must define max-age"})

    csp = global_headers.get("content-security-policy", "")
    directives: dict[str, str] = {}
    for part in csp.split(";"):
        tokens = part.strip().split(maxsplit=1)
        if tokens:
            directives[tokens[0].lower()] = tokens[1] if len(tokens) > 1 else ""

    for name in sorted(REQUIRED_CSP_DIRECTIVES - set(directives)):
        findings.append({"severity": "HIGH", "rule": "edge.csp.required-directive", "detail": f"Missing CSP directive: {name}"})

    script_src = directives.get("script-src", "")
    if "'unsafe-eval'" in script_src:
        findings.append({"severity": "HIGH", "rule": "edge.csp.unsafe-eval", "detail": "script-src must not allow unsafe-eval"})
    if "*" in script_src.split():
        findings.append({"severity": "HIGH", "rule": "edge.csp.wildcard-script", "detail": "script-src must not use a wildcard source"})

    connect_src = directives.get("connect-src", "")
    if "*" in connect_src.split():
        findings.append({"severity": "HIGH", "rule": "edge.csp.wildcard-connect", "detail": "connect-src must not use a wildcard source"})

    if directives.get("object-src", "").strip() != "'none'":
        findings.append({"severity": "HIGH", "rule": "edge.csp.object-src", "detail": "object-src must be 'none'"})

    payload = {
        "schema": "standment.edge-policy.v1",
        "config": str(args.vercel_json),
        "headers": global_headers,
        "findings": findings,
        "status": "fail" if any(f["severity"] == "HIGH" for f in findings) else "pass",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for f in findings:
        print(f"::error::{f['rule']}: {f['detail']}")
    if not findings:
        print("Standment edge policy: PASS")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
