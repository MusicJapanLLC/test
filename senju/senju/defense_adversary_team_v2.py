"""Defense Adversary Suite V2 for Senju guard layers.

This module pressure-tests local parsers, policy text, workflow text, synthetic
artifacts, and autonomy authorization gates. It deliberately performs no live
network contact and never mutates production guard configuration.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import random
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

from .authorized_assessment import EngagementError, EngagementManifest
from .autonomy import AutonomyError, AutonomyLoop, AutonomyQueue, WorkItem
from .external import ExternalContactError, ExternalContactPolicy, _parse_url
from .safety import ScopeGuard, default_lab_policy
from .scopeguard_adversary import DEFAULT_CASES, ProbeCase, probe_guard


@dataclass(frozen=True)
class Finding:
    layer: str
    case: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class AdversaryReport:
    schema: str
    seed: int
    findings: tuple[Finding, ...]

    @property
    def weaknesses(self) -> tuple[Finding, ...]:
        return tuple(item for item in self.findings if not item.passed)

    def to_dict(self) -> dict[str, object]:
        layers: dict[str, dict[str, int]] = {}
        for item in self.findings:
            bucket = layers.setdefault(item.layer, {"checks": 0, "passed": 0, "weaknesses": 0})
            bucket["checks"] += 1
            if item.passed:
                bucket["passed"] += 1
            else:
                bucket["weaknesses"] += 1
        return {
            "schema": self.schema,
            "seed": self.seed,
            "summary": {
                "checks": len(self.findings),
                "passed": sum(1 for item in self.findings if item.passed),
                "weaknesses": len(self.weaknesses),
                "layers": layers,
            },
            "findings": [asdict(item) for item in self.findings],
        }


def _result(layer: str, case: str, passed: bool, detail: str) -> Finding:
    return Finding(layer=layer, case=case, passed=bool(passed), detail=detail)


# ScopeGuard: deterministic mutation corpus (local strings only)
def _scope_mutations(count: int, seed: int) -> tuple[ProbeCase, ...]:
    rng = random.Random(seed)
    bases = (
        "example.com", "EXAMPLE.COM", "https://example.com", "http://example.com",
        "ftp://example.com", "127.0.0.1", "127.1", "10.0.0.1", "169.254.1.1",
        "::1", "[::1]", "labnet:fixture", "LABNET:fixture", "SIM://fixture",
        "sim:/fixture", "sim%3A//fixture", "sim：//fixture",
    )
    wrappers: tuple[Callable[[str], str], ...] = (
        lambda value: value,
        lambda value: f" {value}",
        lambda value: f"{value} ",
        lambda value: f"\t{value}",
        lambda value: f"{value}\n",
        lambda value: f"//{value}",
        lambda value: f"{value}:443",
        lambda value: f"{value}/path",
        lambda value: f"{value}?q=1",
        lambda value: f"{value}#fragment",
        lambda value: f"{value}@other.invalid",
    )
    return tuple(
        ProbeCase(f"v2-fuzz-{index:05d}", rng.choice(wrappers)(rng.choice(bases)), False)
        for index in range(max(0, count))
    )


def probe_scopeguard_v2(*, count: int = 4096, seed: int = 26002) -> list[Finding]:
    guard = ScopeGuard(default_lab_policy())
    cases = DEFAULT_CASES + _scope_mutations(count, seed)
    return [
        _result("scopeguard", result.case.name, not result.surprising, result.detail)
        for result in probe_guard(guard, cases)
    ]


# ExternalContactClient: URL/authority parser pressure; never resolves or opens.
def probe_external_contact_v2() -> list[Finding]:
    policy = ExternalContactPolicy.from_hosts(["example.com"], allow_http=False)
    cases: tuple[tuple[str, str, bool], ...] = (
        ("exact-https", "https://example.com/", True),
        ("uppercase-host", "https://EXAMPLE.COM/", True),
        ("trailing-dot", "https://example.com./", True),
        ("path-query-fragment", "https://example.com/a?b=1#c", True),
        ("http-disabled", "http://example.com/", False),
        ("subdomain", "https://api.example.com/", False),
        ("suffix-lookalike", "https://example.com.invalid/", False),
        ("prefix-lookalike", "https://notexample.com/", False),
        ("userinfo", "https://user@example.com/", False),
        ("password", "https://user:pass@example.com/", False),
        ("userinfo-host-confusion", "https://example.com@evil.invalid/", False),
        ("ftp", "ftp://example.com/", False),
        ("file", "file:///tmp/x", False),
        ("javascript", "javascript:alert(1)", False),
        ("missing-scheme", "//example.com/path", False),
        ("missing-host", "https:///path", False),
        ("relative", "/relative/path", False),
        ("empty", "", False),
        ("bad-port-alpha", "https://example.com:abc/", False),
        ("bad-port-range", "https://example.com:99999/", False),
        ("ipv4-not-allowlisted", "https://127.0.0.1/", False),
        ("ipv6-not-allowlisted", "https://[::1]/", False),
        ("encoded-at-host", "https://%40example.com/", False),
        ("non-default-port", "https://example.com:444/", False),
    )
    findings: list[Finding] = []
    for name, url, should_allow in cases:
        try:
            _parse_url(url, policy)
        except (ExternalContactError, TypeError, ValueError) as exc:
            allowed = False
            detail = f"rejected: {exc}"
        else:
            allowed = True
            detail = "accepted"
        findings.append(_result("external-contact", name, allowed == should_allow, detail))
    return findings


# Engagement JSON: schema/type/window/scope mutation pressure.
def _engagement_baseline() -> dict[str, object]:
    return {
        "engagement_id": "v2-local-synthetic",
        "owner": "local-test-owner",
        "authorization_reference": "synthetic://defense-adversary/local-only",
        "valid_from_utc": "2026-08-31T00:00:00+00:00",
        "valid_until_utc": "2026-09-01T00:00:00+00:00",
        "targets": [{"host": "example.com", "scheme": "https", "base_path": "/"}],
        "allowed_checks": ["reachability", "root_snapshot"],
        "max_requests_per_target": 2,
        "max_rps": 1.0,
        "allow_http": False,
        "destructive": False,
    }


def _copy_manifest() -> dict[str, object]:
    return json.loads(json.dumps(_engagement_baseline()))


def probe_engagement_v2() -> list[Finding]:
    cases: list[tuple[str, Mapping[str, Any], bool]] = [("valid-baseline", _copy_manifest(), True)]
    standing = _copy_manifest()
    standing["engagement_id"] = ""
    standing["valid_from_utc"] = ""
    standing["valid_until_utc"] = ""
    cases.append(("standing-authority-derived-id", standing, True))

    def mutate(name: str, key: str, value: object, should_allow: bool = False) -> None:
        raw = _copy_manifest()
        raw[key] = value
        cases.append((name, raw, should_allow))

    mutate("owner-empty", "owner", "")
    mutate("authorization-empty", "authorization_reference", "")
    mutate("targets-empty", "targets", [])
    mutate("targets-wrong-type", "targets", {"host": "example.com"})
    mutate("checks-wrong-type", "allowed_checks", "reachability")
    mutate("checks-empty", "allowed_checks", [])
    mutate("unknown-check", "allowed_checks", ["reachability", "exploit"])
    mutate("request-budget-zero", "max_requests_per_target", 0)
    mutate("request-budget-high", "max_requests_per_target", 9)
    mutate("rps-zero", "max_rps", 0)
    mutate("rps-high", "max_rps", 2.1)
    mutate("destructive", "destructive", True)
    mutate("partial-window", "valid_until_utc", "")
    mutate("bad-start-format", "valid_from_utc", "not-a-date")
    mutate("timezone-missing", "valid_from_utc", "2026-08-31T00:00:00")

    wildcard = _copy_manifest()
    wildcard["targets"] = [{"host": "*.example.com"}]
    cases.append(("wildcard-host", wildcard, False))
    duplicate = _copy_manifest()
    duplicate["targets"] = [{"host": "example.com"}, {"host": "example.com"}]
    cases.append(("duplicate-host", duplicate, False))
    reversed_window = _copy_manifest()
    reversed_window["valid_from_utc"] = "2026-09-01T00:00:00+00:00"
    reversed_window["valid_until_utc"] = "2026-08-31T00:00:00+00:00"
    cases.append(("reversed-window", reversed_window, False))
    http_without_optin = _copy_manifest()
    http_without_optin["targets"] = [{"host": "example.com", "scheme": "http"}]
    cases.append(("http-without-optin", http_without_optin, False))
    bad_scheme = _copy_manifest()
    bad_scheme["targets"] = [{"host": "example.com", "scheme": "ftp"}]
    cases.append(("unsupported-scheme", bad_scheme, False))
    path_fragment = _copy_manifest()
    path_fragment["targets"] = [{"host": "example.com", "base_path": "/x#frag"}]
    cases.append(("fragment-in-path", path_fragment, False))
    path_relative = _copy_manifest()
    path_relative["targets"] = [{"host": "example.com", "base_path": "relative"}]
    cases.append(("relative-base-path", path_relative, False))
    string_false_http = _copy_manifest()
    string_false_http["allow_http"] = "false"
    string_false_http["targets"] = [{"host": "example.com", "scheme": "http"}]
    cases.append(("string-false-http-coercion", string_false_http, False))

    findings: list[Finding] = []
    for name, raw, should_allow in cases:
        try:
            EngagementManifest.from_dict(raw)
        except (EngagementError, TypeError, ValueError, AttributeError) as exc:
            allowed = False
            detail = f"rejected: {exc}"
        else:
            allowed = True
            detail = "accepted"
        findings.append(_result("engagement-json", name, allowed == should_allow, detail))

    now = dt.datetime(2026, 8, 31, 12, 0, tzinfo=dt.timezone.utc)
    for name, start, end, should_allow in (
        ("active-window", "2026-08-31T00:00:00+00:00", "2026-09-01T00:00:00+00:00", True),
        ("expired-window", "2026-08-29T00:00:00+00:00", "2026-08-30T00:00:00+00:00", False),
        ("future-window", "2026-09-02T00:00:00+00:00", "2026-09-03T00:00:00+00:00", False),
    ):
        raw = _copy_manifest()
        raw["valid_from_utc"] = start
        raw["valid_until_utc"] = end
        try:
            manifest = EngagementManifest.from_dict(raw)
            manifest.validate(now=now, enforce_window=True)
        except (EngagementError, TypeError, ValueError) as exc:
            allowed = False
            detail = f"rejected: {exc}"
        else:
            allowed = True
            detail = "accepted"
        findings.append(_result("engagement-json", name, allowed == should_allow, detail))
    return findings


# OFFENSE_FIRST.md: authorization contract invariants + mutation sensitivity.
def audit_offense_text(text: str) -> list[str]:
    problems: list[str] = []
    required = (
        "owned-or-explicitly-authorized lab",
        "外部第三者の資産",
        "所有者または明示的なテスト権限",
        "campaign scope",
    )
    for marker in required:
        if marker not in text:
            problems.append(f"missing authorization-boundary marker: {marker}")
    normalized = text.lower()
    forbidden = (
        "any public host without authorization",
        "third-party assets require no authorization",
        "外部第三者の資産は認可不要",
    )
    for marker in forbidden:
        if marker.lower() in normalized:
            problems.append(f"unsafe authorization claim present: {marker}")
    return problems


def probe_offense_first_v2(repo_root: Path) -> list[Finding]:
    path = repo_root / "senju" / "OFFENSE_FIRST.md"
    if not path.is_file():
        return [_result("offense-first", "file-present", False, f"missing: {path}")]
    text = path.read_text(encoding="utf-8")
    problems = audit_offense_text(text)
    findings = [_result("offense-first", "authorization-boundary-intact", not problems, "; ".join(problems) or "intact")]
    mutated = text.replace("所有者または明示的なテスト権限", "")
    caught = bool(audit_offense_text(mutated))
    findings.append(_result("offense-first", "mutation-removes-third-party-authorization", caught, "mutation detected" if caught else "mutation escaped auditor"))
    injected = text + "\nThird-party assets require no authorization.\n"
    caught = bool(audit_offense_text(injected))
    findings.append(_result("offense-first", "mutation-injects-unsafe-claim", caught, "mutation detected" if caught else "mutation escaped auditor"))
    return findings


# security-guard.yml: static workflow hardening + synthetic mutations.
def audit_security_guard_text(text: str) -> list[str]:
    problems: list[str] = []
    required = (
        "permissions:\n  contents: read",
        "persist-credentials: false",
        "Block tracked secret files",
        "Block obvious credential material in tracked source",
        "Enforce fail-closed workflow policy",
        "Enforce external-evidence reality gate",
        "Block remote shell execution patterns",
        "Block direct interpolation of untrusted event text",
    )
    for marker in required:
        if marker not in text:
            problems.append(f"missing workflow invariant: {marker}")
    unsafe = ("pull_request_target:", "permissions: write-all", "persist-credentials: true", "continue-on-error: true")
    for marker in unsafe:
        if marker in text:
            problems.append(f"unsafe workflow marker present: {marker}")
    return problems


def probe_security_guard_v2(repo_root: Path) -> list[Finding]:
    path = repo_root / ".github" / "workflows" / "security-guard.yml"
    if not path.is_file():
        return [_result("security-guard-workflow", "file-present", False, f"missing: {path}")]
    text = path.read_text(encoding="utf-8")
    problems = audit_security_guard_text(text)
    findings = [_result("security-guard-workflow", "live-contract", not problems, "; ".join(problems) or "intact")]
    mutations = (
        ("pull-request-target", text.replace("  pull_request:\n", "  pull_request_target:\n", 1)),
        ("write-permission", text.replace("  contents: read", "  contents: write", 1)),
        ("credential-persistence", text.replace("persist-credentials: false", "persist-credentials: true", 1)),
        ("continue-on-error", text + "\n# synthetic mutation\ncontinue-on-error: true\n"),
    )
    for name, mutated in mutations:
        caught = bool(audit_security_guard_text(mutated))
        findings.append(_result("security-guard-workflow", f"mutation-{name}", caught, "mutation detected" if caught else "mutation escaped auditor"))
    return findings


# artifact_guard.py: execute against temporary synthetic build outputs only.
def _run_artifact_case(guard_path: Path, files: Mapping[str, str]) -> tuple[int, dict[str, Any], str]:
    with tempfile.TemporaryDirectory(prefix="senju-artifact-adversary-") as tmp:
        root = Path(tmp)
        dist = root / "dist"
        dist.mkdir()
        for rel, content in files.items():
            target = dist / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        output = root / "report.json"
        completed = subprocess.run(
            [sys.executable, str(guard_path), str(dist), "--json", str(output)],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        payload = json.loads(output.read_text(encoding="utf-8")) if output.is_file() else {}
        return completed.returncode, payload, (completed.stdout + completed.stderr).strip()


def probe_artifact_guard_v2(repo_root: Path) -> list[Finding]:
    guard_path = repo_root / "scripts" / "security" / "artifact_guard.py"
    if not guard_path.is_file():
        return [_result("artifact-guard", "file-present", False, f"missing: {guard_path}")]
    fake_openai_key = "sk-" + ("A" * 24)
    cases: tuple[tuple[str, Mapping[str, str], bool, str | None], ...] = (
        ("clean", {"index.html": '<script src="https://example.com/app.js"></script>'}, True, None),
        ("source-map-file", {"assets/app.js.map": "{}"}, False, "artifact.source-map"),
        ("mixed-content", {"index.html": '<script src="http://example.com/app.js"></script>'}, False, "artifact.mixed-content"),
        ("localhost", {"assets/app.js": 'fetch("http://localhost:3000/api")'}, False, "artifact.localhost-reference"),
        ("source-map-reference", {"assets/app.js": "//# sourceMappingURL=app.js.map"}, False, "artifact.source-map-reference"),
        ("synthetic-secret", {"nested/config.JSON": f'{{"token":"{fake_openai_key}"}}'}, False, "artifact.secret.openai-key"),
    )
    findings: list[Finding] = []
    for name, files, should_pass, expected_rule in cases:
        try:
            code, payload, output = _run_artifact_case(guard_path, files)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
            findings.append(_result("artifact-guard", name, False, f"runner error: {exc}"))
            continue
        rules = {str(item.get("rule")) for item in payload.get("findings", []) if isinstance(item, dict)}
        actual_pass = code == 0 and payload.get("status") == "pass"
        if should_pass:
            passed = actual_pass
        else:
            passed = code != 0 and payload.get("status") == "fail" and (expected_rule in rules if expected_rule else True)
        detail = f"exit={code}; status={payload.get('status')}; rules={sorted(rules)}"
        if output:
            detail += f"; output={output[:240]}"
        findings.append(_result("artifact-guard", name, passed, detail))
    return findings


# Autonomy Engine: authorization/queue gates with an exploding local stub.
class _NoNetworkClient:
    def __init__(self) -> None:
        self.calls = 0

    def contact_with_body(self, *args: object, **kwargs: object) -> object:
        self.calls += 1
        raise AssertionError("V2 adversary must not perform external contact")


def probe_autonomy_v2(repo_root: Path) -> list[Finding]:
    findings: list[Finding] = []
    path = repo_root / "senju" / "senju" / "autonomy.py"
    if not path.is_file():
        return [_result("autonomy-engine", "file-present", False, f"missing: {path}")]
    source = path.read_text(encoding="utf-8")
    for case, marker in (
        ("authorized-write-gate-present", "is_authorized_write_target"),
        ("unknown-public-write-restriction-present", "must be GET/HEAD only"),
        ("discovered-host-allowlist-present", "cand_host in self.allow_hosts"),
        ("guarded-transport-present", "ExternalContactPolicy.from_hosts"),
    ):
        findings.append(_result("autonomy-engine", case, marker in source, "present" if marker in source else "missing"))

    with tempfile.TemporaryDirectory(prefix="senju-autonomy-adversary-") as tmp:
        stub = _NoNetworkClient()
        loop = AutonomyLoop(
            allow_hosts=["example.com"], authorized_write_hosts=["owned.example"],
            out_dir=Path(tmp), client=stub, max_host_budget=1,  # type: ignore[arg-type]
        )
        unauthorized = WorkItem(
            id="unauth-write", item_type="canary_write", url="https://third-party.invalid/x",
            method="POST", payload={"json": {"synthetic": True}},
        )
        try:
            loop.execute_step(unauthorized)
        except AutonomyError as exc:
            blocked, detail = True, str(exc)
        except AssertionError as exc:
            blocked, detail = False, str(exc)
        else:
            blocked, detail = False, "unexpectedly accepted"
        findings.append(_result("autonomy-engine", "unauthorized-canary-write", blocked and stub.calls == 0, detail))

        public_post = WorkItem(id="public-post", item_type="discovery", url="https://example.com/x", method="POST")
        try:
            loop.execute_step(public_post)
        except AutonomyError as exc:
            blocked, detail = True, str(exc)
        except AssertionError as exc:
            blocked, detail = False, str(exc)
        else:
            blocked, detail = False, "unexpectedly accepted"
        findings.append(_result("autonomy-engine", "public-non-read-method", blocked and stub.calls == 0, detail))
        findings.append(_result("autonomy-engine", "exact-authorized-write-host", loop.is_authorized_write_target("https://OWNED.EXAMPLE/path"), "exact host accepted"))
        findings.append(_result("autonomy-engine", "write-host-suffix-lookalike", not loop.is_authorized_write_target("https://owned.example.evil.invalid/path"), "lookalike rejected"))

    queue = AutonomyQueue(max_host_budget=1)
    first = WorkItem(id="q1", item_type="discovery", url="https://example.com/", method="GET")
    second = WorkItem(id="q2", item_type="discovery", url="HTTPS://EXAMPLE.COM", method="GET")
    first_ok, second_ok = queue.enqueue(first), queue.enqueue(second)
    findings.append(_result("autonomy-engine", "queue-url-dedup", first_ok and not second_ok, f"first={first_ok}; second={second_ok}"))
    queue.record_outcome(first.url, success=True)
    budgeted = WorkItem(id="q3", item_type="discovery", url="https://example.com/next", method="GET")
    score = queue.score_item(budgeted)
    findings.append(_result("autonomy-engine", "host-budget-penalty", score == 0.0, f"score={score:.3f}"))
    return findings


def run_v2(repo_root: Path | None = None, *, scope_cases: int = 4096, seed: int = 26002) -> AdversaryReport:
    root = repo_root or Path(__file__).resolve().parents[2]
    findings: list[Finding] = []
    findings.extend(probe_scopeguard_v2(count=scope_cases, seed=seed))
    findings.extend(probe_engagement_v2())
    findings.extend(probe_external_contact_v2())
    findings.extend(probe_offense_first_v2(root))
    findings.extend(probe_security_guard_v2(root))
    findings.extend(probe_artifact_guard_v2(root))
    findings.extend(probe_autonomy_v2(root))
    return AdversaryReport("senju-defense-adversary-suite/v2", seed, tuple(findings))


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run Senju Defense Adversary Suite V2")
    parser.add_argument("--json", dest="output", type=Path)
    parser.add_argument("--scope-cases", type=int, default=4096)
    parser.add_argument("--seed", type=int, default=26002)
    parser.add_argument("--strict", action="store_true", help="return non-zero when any weakness is found")
    args = parser.parse_args(list(argv) if argv is not None else None)
    report = run_v2(scope_cases=max(0, args.scope_cases), seed=args.seed)
    rendered = json.dumps(report.to_dict(), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(json.dumps(report.to_dict()["summary"], ensure_ascii=False))
    else:
        print(rendered, end="")
    return 1 if args.strict and report.weaknesses else 0


if __name__ == "__main__":
    raise SystemExit(main())
