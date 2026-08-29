from __future__ import annotations

import argparse
import ipaddress
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

MAX_REQUESTS = 12
ALLOWED_METHODS = {"GET", "HEAD", "OPTIONS", "POST"}
SAFE_GRAPHQL_QUERY = "query { __typename }"


@dataclass
class ProbeResult:
    probe: str
    url: str
    status: int | None
    ok: bool
    evidence: dict[str, Any]
    note: str


@dataclass
class Hypothesis:
    severity: str
    title: str
    evidence_needed: list[str]
    next_safe_probe: str | None
    remediation: list[str]


def _resolve_host(host: str):
    if host.lower() == "localhost":
        return [ipaddress.ip_address("127.0.0.1")]
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        return sorted({ipaddress.ip_address(info[4][0]) for info in infos}, key=str)


def assert_local_target(url: str):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https targets are allowed")
    if not parsed.hostname:
        raise ValueError("Target must include hostname")
    if parsed.username or parsed.password:
        raise ValueError("Userinfo in target URL is forbidden")
    ips = _resolve_host(parsed.hostname)
    if not ips:
        raise ValueError("Target did not resolve")
    for ip in ips:
        if not (ip.is_loopback or ip.is_private or ip.is_link_local):
            raise ValueError(f"Refusing non-local target {parsed.hostname} -> {ip}")
    return parsed


class RequestBudget:
    def __init__(self, maximum: int = MAX_REQUESTS):
        self.maximum = maximum
        self.used = 0

    def spend(self):
        if self.used >= self.maximum:
            raise RuntimeError(f"Request budget exceeded ({self.maximum})")
        self.used += 1


def request(budget: RequestBudget, method: str, url: str, *, body=None, headers=None, timeout=3.0):
    if method not in ALLOWED_METHODS:
        raise ValueError(f"Method {method} is not permitted")
    assert_local_target(url)
    budget.spend()
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read(64 * 1024)
            return ProbeResult(
                method,
                url,
                resp.status,
                True,
                {
                    "elapsed_ms": round((time.monotonic() - started) * 1000),
                    "headers": {k.lower(): v for k, v in resp.headers.items()},
                    "body_preview": data[:500].decode("utf-8", errors="replace"),
                },
                "Non-destructive probe completed",
            )
    except urllib.error.HTTPError as exc:
        return ProbeResult(
            method,
            url,
            exc.code,
            False,
            {
                "elapsed_ms": round((time.monotonic() - started) * 1000),
                "headers": {k.lower(): v for k, v in exc.headers.items()},
                "body_preview": exc.read(4096).decode("utf-8", errors="replace")[:500],
            },
            "HTTP error observed; no bypass attempt performed",
        )
    except Exception as exc:
        return ProbeResult(method, url, None, False, {"error": type(exc).__name__}, "Probe failed without retry/fuzzing")


def _text(findings):
    return "\n".join(" ".join(str(v) for v in f.values() if v is not None).lower() for f in findings)


def plan_hypotheses(findings: list[dict[str, Any]]) -> list[Hypothesis]:
    text = _text(findings)
    out: list[Hypothesis] = []
    if "graphql" in text:
        out.append(Hypothesis(
            "medium",
            "GraphQL authorization boundary",
            ["401/403 boundary", "harmless query behavior", "resolver authorization design"],
            "graphql_typename",
            ["resolver authorization", "object-level authorization", "depth/complexity/rate limits"],
        ))
    if "httponly" in text or "cookie" in text:
        out.append(Hypothesis(
            "medium",
            "Cookie hardening boundary",
            ["Set-Cookie attributes", "HttpOnly/Secure/SameSite"],
            "baseline_headers",
            ["harden authentication cookies", "CSP", "output encoding"],
        ))
    if "permissions-policy" in text:
        out.append(Hypothesis(
            "low",
            "Browser capability exposure",
            ["Permissions-Policy header"],
            "baseline_headers",
            ["disable unused features", "restrict required origins"],
        ))
    if "security.txt" in text:
        out.append(Hypothesis(
            "low",
            "Vulnerability disclosure route",
            ["/.well-known/security.txt presence"],
            "security_txt",
            ["publish RFC 9116 security.txt"],
        ))
    if "server" in text or "nginx" in text:
        out.append(Hypothesis(
            "info",
            "Technology fingerprint minimization",
            ["Server header detail", "actual dependency versions"],
            "baseline_headers",
            ["minimize version detail", "continuous dependency updates"],
        ))
    if "spf" in text or "dmarc" in text:
        out.append(Hypothesis(
            "medium",
            "Email anti-spoofing controls",
            ["SPF/DMARC/DKIM records", "authorized senders"],
            None,
            ["configure SPF/DKIM/DMARC", "progressively enforce DMARC"],
        ))
    if not out:
        out.append(Hypothesis(
            "info",
            "General trust-boundary review",
            ["declared authority", "failure behavior", "independent retest criteria"],
            "baseline_headers",
            ["make boundary explicit", "add regression test", "document residual risk"],
        ))
    return out


def build_plan_only_report(findings: list[dict[str, Any]]):
    hypotheses = plan_hypotheses(findings)
    return {
        "schema": "standment-whitehat-lab/v1",
        "mode": "plan-only",
        "target": None,
        "network_requests": 0,
        "policy": {
            "network_access": "disabled",
            "active_testing": False,
            "forbidden": [
                "credential guessing",
                "authentication bypass",
                "exploit execution",
                "destructive mutation",
                "path fuzzing",
                "phishing delivery",
            ],
        },
        "hypotheses": [asdict(h) for h in hypotheses],
        "probe_results": [],
        "next": "Map the highest-impact hypothesis to owned source/config or a local fixture, then produce same-condition Before/After evidence",
    }


class LocalLab:
    def __init__(self, target: str, findings: list[dict[str, Any]]):
        self.target = target.rstrip("/")
        assert_local_target(self.target)
        self.findings = findings
        self.hypotheses = plan_hypotheses(findings)
        self.results: list[ProbeResult] = []
        self.budget = RequestBudget()

    def run_probe(self, probe: str):
        if probe == "baseline_headers":
            self.results.append(request(self.budget, "GET", self.target + "/"))
        elif probe == "security_txt":
            self.results.append(request(self.budget, "GET", self.target + "/.well-known/security.txt"))
        elif probe == "graphql_typename":
            payload = json.dumps({"query": SAFE_GRAPHQL_QUERY}).encode("utf-8")
            self.results.append(request(
                self.budget,
                "POST",
                self.target + "/graphql",
                body=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            ))
        else:
            raise ValueError(f"Unknown probe {probe}")

    def run(self):
        probes: list[str] = []
        for h in self.hypotheses:
            if h.next_safe_probe and h.next_safe_probe not in probes:
                probes.append(h.next_safe_probe)
        if "baseline_headers" not in probes:
            probes.insert(0, "baseline_headers")
        for probe in probes:
            self.run_probe(probe)
        return {
            "schema": "standment-whitehat-lab/v1",
            "mode": "local-validation",
            "target": self.target,
            "network_requests": self.budget.used,
            "policy": {
                "target_scope": "loopback/private/link-local only",
                "max_requests": self.budget.maximum,
                "methods": sorted(ALLOWED_METHODS),
                "forbidden": [
                    "credential guessing",
                    "authentication bypass",
                    "exploit execution",
                    "destructive mutation",
                    "path fuzzing",
                    "phishing delivery",
                ],
            },
            "hypotheses": [asdict(h) for h in self.hypotheses],
            "probe_results": [asdict(r) for r in self.results],
            "next": "Implement the smallest defensive remediation, then rerun this same evidence path for Before/After proof",
        }


def render(report: dict[str, Any]) -> str:
    lines = [
        "# Standment White-Hat Lab Evidence",
        "",
        f"- mode: `{report['mode']}`",
        f"- target: `{report['target'] or 'NONE'}`",
        f"- network requests: `{report['network_requests']}`",
        "",
        "## Adversarial hypotheses",
    ]
    for i, h in enumerate(report["hypotheses"], 1):
        lines += [
            f"### {i}. [{h['severity'].upper()}] {h['title']}",
            "Evidence needed:",
            *[f"- {x}" for x in h["evidence_needed"]],
            "Remediation candidates:",
            *[f"- {x}" for x in h["remediation"]],
            "",
        ]
    lines += ["## Safe probe evidence"]
    if report["probe_results"]:
        for r in report["probe_results"]:
            lines += [f"- `{r['probe']}` {r['url']} -> {r['status']} / {r['note']}"]
    else:
        lines += ["- NONE — plan-only mode performed zero network requests"]
    lines += ["", "## Next", report["next"], ""]
    return "\n".join(lines)


def load_findings(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    findings = data.get("findings", data if isinstance(data, list) else [])
    if not isinstance(findings, list):
        raise ValueError("Input must be a list or {'findings': [...]} JSON")
    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--findings", required=True, type=Path)
    ap.add_argument("--target")
    ap.add_argument("--plan-only", action="store_true")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--json-out", required=True, type=Path)
    args = ap.parse_args()
    findings = load_findings(args.findings)
    if args.plan_only:
        if args.target:
            raise ValueError("plan-only mode must not receive a target")
        report = build_plan_only_report(findings)
    else:
        if not args.target:
            raise ValueError("target required unless plan-only")
        report = LocalLab(args.target, findings).run()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(render(report), encoding="utf-8")
    args.json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "mode": report["mode"], "hypotheses": len(report["hypotheses"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
