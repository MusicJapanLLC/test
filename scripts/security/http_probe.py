#!/usr/bin/env python3
"""Small non-invasive production DAST probe for Standment-managed sites.

Checks the edge security contract, mixed content, and a few common accidental
file exposures. It does not attempt authentication bypass, exploitation, fuzzing,
or state-changing requests.
"""
from __future__ import annotations

import argparse
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REQUIRED_HEADERS = {
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
}
SENSITIVE_PROBES = {
    ".env": re.compile(r"(?m)^[A-Z][A-Z0-9_]{2,}\s*="),
    ".git/HEAD": re.compile(r"^ref:\s+refs/heads/"),
    "package.json": re.compile(r'"(?:dependencies|devDependencies|scripts)"\s*:'),
    "vite.config.ts": re.compile(r"\bdefineConfig\s*\("),
}


def fetch(url: str, timeout: float = 12.0) -> tuple[int, dict[str, str], bytes, str]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Standment-Defense-Passive-DAST/1.0"},
        method="GET",
    )
    context = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=context) as resp:
            body = resp.read(2_000_000)
            return int(resp.status), {k.lower(): v for k, v in resp.headers.items()}, body, resp.geturl()
    except urllib.error.HTTPError as exc:
        body = exc.read(256_000)
        return int(exc.code), {k.lower(): v for k, v in exc.headers.items()}, body, exc.geturl()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("target")
    parser.add_argument("--json", dest="output", type=Path, required=True)
    args = parser.parse_args()

    target = args.target if args.target.endswith("/") else args.target + "/"
    parsed = urllib.parse.urlparse(target)
    findings: list[dict[str, str]] = []

    if parsed.scheme != "https":
        findings.append({"severity": "HIGH", "rule": "transport.https", "detail": "Target must use HTTPS"})

    try:
        status, headers, body, final_url = fetch(target)
    except Exception as exc:
        findings.append({"severity": "HIGH", "rule": "availability.fetch", "detail": f"Unable to fetch target: {exc}"})
        status, headers, body, final_url = 0, {}, b"", target

    if status < 200 or status >= 400:
        findings.append({"severity": "HIGH", "rule": "availability.http-status", "detail": f"Root returned HTTP {status}"})

    for name in sorted(REQUIRED_HEADERS - set(headers)):
        findings.append({"severity": "HIGH", "rule": "edge.required-header", "detail": f"Missing response header: {name}"})

    if headers.get("x-content-type-options", "").lower() != "nosniff":
        findings.append({"severity": "HIGH", "rule": "edge.nosniff", "detail": "X-Content-Type-Options is not nosniff"})

    csp = headers.get("content-security-policy", "")
    if "'unsafe-eval'" in csp:
        findings.append({"severity": "HIGH", "rule": "edge.csp.unsafe-eval", "detail": "Production CSP allows unsafe-eval"})

    html = body.decode("utf-8", errors="replace")
    for match in re.findall(r"(?:src|href)=[\"'](http://[^\"']+)", html, flags=re.IGNORECASE):
        findings.append({"severity": "HIGH", "rule": "browser.mixed-content", "detail": f"HTTP resource referenced: {match[:180]}"})

    external_scripts = sorted(set(re.findall(r"<script[^>]+src=[\"'](https?://[^\"']+)", html, flags=re.IGNORECASE)))

    exposures: list[dict[str, object]] = []
    for relative, signature in SENSITIVE_PROBES.items():
        url = urllib.parse.urljoin(target, relative)
        try:
            probe_status, probe_headers, probe_body, probe_final = fetch(url)
        except Exception as exc:
            exposures.append({"path": relative, "error": str(exc)})
            continue
        text = probe_body.decode("utf-8", errors="replace")
        exposed = 200 <= probe_status < 300 and bool(signature.search(text))
        exposures.append(
            {
                "path": relative,
                "status": probe_status,
                "final_url": probe_final,
                "content_type": probe_headers.get("content-type", ""),
                "signature_match": exposed,
            }
        )
        if exposed:
            findings.append({"severity": "HIGH", "rule": "exposure.sensitive-file", "detail": f"Sensitive development file appears publicly readable: /{relative}"})

    payload = {
        "schema": "standment.passive-dast.v1",
        "target": target,
        "final_url": final_url,
        "status_code": status,
        "response_headers": headers,
        "external_scripts": external_scripts,
        "sensitive_path_probes": exposures,
        "findings": findings,
        "status": "fail" if any(f["severity"] == "HIGH" for f in findings) else "pass",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for f in findings:
        print(f"::error::{f['rule']}: {f['detail']}")
    if not findings:
        print("Standment passive DAST: PASS")
    return 1 if any(f["severity"] == "HIGH" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
