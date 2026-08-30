"""Offline adversarial campaign for Senju guard surfaces.

This module treats guardrails as hostile test targets without weakening or bypassing
them.  Every probe is deterministic and local: network transports are replaced with
fakes, artifact probes use temporary directories, workflow/policy documents are
mutated only in memory, and no real secret material is embedded.

Targets:
- ScopeGuard
- OFFENSE_FIRST.md authorization boundary
- Engagement JSON / EngagementManifest
- ExternalContactClient
- security-guard.yml contract
- artifact_guard.py
- Autonomy Engine
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import subprocess
import sys
import tempfile
import urllib.error
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Iterable, Mapping

from .authorized_assessment import EngagementError, EngagementManifest, build_plan
from .autonomy import AutonomyError, AutonomyLoop, WorkItem
from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy
from .safety import ScopeGuard, ScopeViolation, default_lab_policy
from .scopeguard_adversary import DEFAULT_CASES as SCOPEGUARD_CASES


REPO_ROOT = Path(__file__).resolve().parents[2]
SENJU_ROOT = Path(__file__).resolve().parents[1]
OFFENSE_FIRST_PATH = SENJU_ROOT / "OFFENSE_FIRST.md"
SECURITY_GUARD_PATH = REPO_ROOT / ".github" / "workflows" / "security-guard.yml"
ARTIFACT_GUARD_PATH = REPO_ROOT / "scripts" / "security" / "artifact_guard.py"
FIXED_NOW = dt.datetime(2026, 8, 31, 0, 0, tzinfo=dt.timezone.utc)

TARGETS = (
    "scopeguard",
    "offense-first",
    "engagement-json",
    "external-contact",
    "security-guard",
    "artifact-guard",
    "autonomy-engine",
)


@dataclass(frozen=True)
class ProbeObservation:
    allowed: bool
    detail: str
    side_effect_calls: int = 0
    guard_exception_type: str | None = None


@dataclass(frozen=True)
class GuardCase:
    target: str
    name: str
    family: str
    severity: str
    should_allow: bool
    rationale: str
    probe: Callable[[], ProbeObservation]

    def fingerprint_dict(self) -> dict[str, object]:
        return {
            "target": self.target,
            "name": self.name,
            "family": self.family,
            "severity": self.severity,
            "should_allow": self.should_allow,
            "rationale": self.rationale,
        }


@dataclass(frozen=True)
class GuardResult:
    case: GuardCase
    allowed: bool | None
    detail: str
    side_effect_calls: int = 0
    guard_exception_type: str | None = None
    harness_exception_type: str | None = None

    @property
    def surprising(self) -> bool:
        if self.allowed is None or self.allowed != self.case.should_allow:
            return True
        # A blocked operation reaching a fake side-effect boundary is itself a finding.
        return not self.case.should_allow and self.side_effect_calls > 0

    def to_dict(self) -> dict[str, object]:
        payload = self.case.fingerprint_dict()
        payload.update(
            {
                "allowed": self.allowed,
                "detail": self.detail,
                "side_effect_calls": self.side_effect_calls,
                "guard_exception_type": self.guard_exception_type,
                "harness_exception_type": self.harness_exception_type,
                "surprising": self.surprising,
            }
        )
        return payload


@dataclass(frozen=True)
class MultiGuardReport:
    results: tuple[GuardResult, ...]
    campaign_fingerprint: str

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def surprising(self) -> tuple[GuardResult, ...]:
        return tuple(result for result in self.results if result.surprising)

    @property
    def surprising_count(self) -> int:
        return len(self.surprising)

    @property
    def harness_exception_count(self) -> int:
        return sum(result.allowed is None for result in self.results)

    @property
    def side_effect_violation_count(self) -> int:
        return sum(
            result.side_effect_calls > 0 and not result.case.should_allow
            for result in self.results
        )

    @property
    def passed(self) -> bool:
        return self.surprising_count == 0

    def by_target(self) -> dict[str, dict[str, int]]:
        totals = Counter(result.case.target for result in self.results)
        surprises = Counter(result.case.target for result in self.surprising)
        crashes = Counter(
            result.case.target for result in self.results if result.allowed is None
        )
        return {
            target: {
                "total": totals[target],
                "expected": totals[target] - surprises[target],
                "surprising": surprises[target],
                "harness_exceptions": crashes[target],
            }
            for target in sorted(totals)
        }

    def by_family(self) -> dict[str, dict[str, int]]:
        key = lambda result: f"{result.case.target}:{result.case.family}"
        totals = Counter(key(result) for result in self.results)
        surprises = Counter(key(result) for result in self.surprising)
        return {
            family: {
                "total": totals[family],
                "expected": totals[family] - surprises[family],
                "surprising": surprises[family],
            }
            for family in sorted(totals)
        }

    def to_dict(self) -> dict[str, object]:
        return {
            "schema": "senju-multiguard-adversary/v1",
            "campaign_fingerprint": self.campaign_fingerprint,
            "targets": list(TARGETS),
            "total": self.total,
            "surprising_count": self.surprising_count,
            "harness_exception_count": self.harness_exception_count,
            "side_effect_violation_count": self.side_effect_violation_count,
            "passed": self.passed,
            "by_target": self.by_target(),
            "by_family": self.by_family(),
            "results": [result.to_dict() for result in self.results],
        }

    def to_json(self, *, indent: int | None = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent, sort_keys=True)


class _FakeResponse:
    def __init__(self, *, status: int = 204, body: bytes = b"", headers: Mapping[str, str] | None = None) -> None:
        self.status = status
        self.headers = dict(headers or {})
        self._body = body

    def read(self, limit: int = -1) -> bytes:
        return self._body if limit < 0 else self._body[:limit]

    def close(self) -> None:
        return None


class _CountingOpener:
    def __init__(self, *, response: _FakeResponse | None = None, error: Exception | None = None) -> None:
        self.calls = 0
        self.response = response or _FakeResponse()
        self.error = error

    def __call__(self, request, *, timeout: float):  # noqa: ANN001
        self.calls += 1
        if self.error is not None:
            raise self.error
        return self.response


class _CountingClient:
    def __init__(self, delegate: ExternalContactClient | None = None) -> None:
        self.calls = 0
        self.delegate = delegate

    def contact_with_body(self, url: str, **kwargs):  # noqa: ANN003
        self.calls += 1
        if self.delegate is None:
            raise AssertionError("fake client must not be reached")
        return self.delegate.contact_with_body(url, **kwargs)


def _fingerprint(cases: Iterable[GuardCase]) -> str:
    digest = hashlib.sha256()
    for case in cases:
        encoded = json.dumps(
            case.fingerprint_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        digest.update(encoded)
        digest.update(b"\n")
    return digest.hexdigest()


def _run_case(case: GuardCase) -> GuardResult:
    try:
        observation = case.probe()
    except Exception as exc:  # the campaign itself must never die on one probe
        return GuardResult(
            case=case,
            allowed=None,
            detail=str(exc),
            harness_exception_type=type(exc).__name__,
        )
    return GuardResult(
        case=case,
        allowed=observation.allowed,
        detail=observation.detail,
        side_effect_calls=observation.side_effect_calls,
        guard_exception_type=observation.guard_exception_type,
    )


def run_campaign(cases: Iterable[GuardCase] | None = None) -> MultiGuardReport:
    frozen = tuple(build_campaign() if cases is None else cases)
    return MultiGuardReport(
        results=tuple(_run_case(case) for case in frozen),
        campaign_fingerprint=_fingerprint(frozen),
    )


def validate_offense_first_document(text: str) -> tuple[str, ...]:
    """Verify the doctrine still carries an explicit external authorization boundary."""
    required = {
        "authorized-lab-boundary": "Arena / synthetic / owned-or-explicitly-authorized lab",
        "third-party-authority": "所有者または明示的なテスト権限",
        "external-authorization-boundary": "外部資産に対する認可境界",
        "scope-expansion-authorization": "Owner / BOSS が追加 scope を明示的に認可",
        "bounded-autonomy": "BOSS が与えた上限まで",
    }
    forbidden = {
        "unrestricted-external": "UNAUTHORIZED_EXTERNAL_EXECUTION=ALLOW",
        "implicit-third-party": "THIRD_PARTY_AUTHORIZATION=IMPLICIT",
    }
    errors = [f"missing:{name}" for name, marker in required.items() if marker not in text]
    errors.extend(f"forbidden:{name}" for name, marker in forbidden.items() if marker in text)
    return tuple(errors)


def validate_security_guard_workflow(text: str) -> tuple[str, ...]:
    """Static contract check for the Security Guard workflow itself."""
    required = {
        "read-only-contents": "contents: read",
        "discard-checkout-credentials": "persist-credentials: false",
        "tracked-secret-files": "Block tracked secret files",
        "tracked-secret-material": "Block obvious credential material in tracked source",
        "new-line-secret-scan": "Scan newly introduced lines for secrets",
        "fail-closed-workflow-policy": "python automation/security/workflow_policy_entrypoint.py",
        "external-evidence-gate": "python automation/security/reality_gate.py",
        "remote-shell-block": "Block remote shell execution patterns",
        "untrusted-interpolation-block": "Block direct interpolation of untrusted event text",
    }
    forbidden = {
        "write-all": "permissions: write-all",
        "checkout-credentials": "persist-credentials: true",
        "pull-request-target": "pull_request_target:",
        "contents-write": "contents: write",
        "actions-write": "actions: write",
        "id-token-write": "id-token: write",
    }
    errors = [f"missing:{name}" for name, marker in required.items() if marker not in text]
    errors.extend(f"forbidden:{name}" for name, marker in forbidden.items() if marker in text)
    return tuple(errors)


def _scopeguard_cases() -> list[GuardCase]:
    guard = ScopeGuard(default_lab_policy())
    cases: list[GuardCase] = []
    for original in SCOPEGUARD_CASES:
        def probe(ref: str = original.target_ref) -> ProbeObservation:
            try:
                guard.check(ref)
            except ScopeViolation as exc:
                return ProbeObservation(False, str(exc), guard_exception_type=type(exc).__name__)
            return ProbeObservation(True, "accepted")

        cases.append(
            GuardCase(
                target="scopeguard",
                name=original.name,
                family=original.family,
                severity=original.severity,
                should_allow=original.should_allow,
                rationale=original.rationale,
                probe=probe,
            )
        )
    return cases


def _offense_first_cases() -> list[GuardCase]:
    text = OFFENSE_FIRST_PATH.read_text(encoding="utf-8")
    variants: list[tuple[str, str, bool]] = [
        ("baseline", text, True),
        ("blank-document", "", False),
        ("drop-authorized-lab", text.replace("Arena / synthetic / owned-or-explicitly-authorized lab", "Arena / synthetic / lab"), False),
        ("drop-third-party-authority", text.replace("所有者または明示的なテスト権限", "権限"), False),
        ("drop-external-boundary", text.replace("外部資産に対する認可境界", "外部資産の境界"), False),
        ("drop-scope-expansion-approval", text.replace("Owner / BOSS が追加 scope を明示的に認可", "追加 scope"), False),
        ("inject-unrestricted-external", text + "\nUNAUTHORIZED_EXTERNAL_EXECUTION=ALLOW\n", False),
        ("inject-implicit-third-party", text + "\nTHIRD_PARTY_AUTHORIZATION=IMPLICIT\n", False),
    ]
    cases: list[GuardCase] = []
    for name, candidate, expected in variants:
        def probe(value: str = candidate) -> ProbeObservation:
            errors = validate_offense_first_document(value)
            return ProbeObservation(not errors, "; ".join(errors) if errors else "contract intact")

        cases.append(
            GuardCase(
                "offense-first",
                name,
                "document-contract",
                "high" if not expected else "low",
                expected,
                "external authority boundaries must survive doctrine edits",
                probe,
            )
        )
    return cases


def _base_engagement() -> dict[str, object]:
    return {
        "engagement_id": "adv-20260831",
        "owner": "adversary-fixture-owner",
        "authorization_reference": "fixture://explicit-authority",
        "valid_from_utc": "2026-08-30T00:00:00Z",
        "valid_until_utc": "2026-09-02T00:00:00Z",
        "targets": [{"host": "example.com", "scheme": "https", "base_path": "/"}],
        "allowed_checks": ["reachability", "security_txt"],
        "max_requests_per_target": 2,
        "max_rps": 1.0,
        "allow_http": False,
        "destructive": False,
    }


def _engagement_probe(raw: Mapping[str, object]) -> ProbeObservation:
    try:
        manifest = EngagementManifest.from_dict(raw)
        manifest.validate(now=FIXED_NOW, enforce_window=True)
        build_plan(manifest)
    except Exception as exc:
        return ProbeObservation(False, str(exc), guard_exception_type=type(exc).__name__)
    return ProbeObservation(True, "manifest accepted and bounded plan built")


def _engagement_cases() -> list[GuardCase]:
    base = _base_engagement()
    specs: list[tuple[str, Callable[[dict[str, object]], None], bool, str]] = [
        ("valid-window", lambda raw: None, True, "baseline"),
        ("standing-window-omitted", lambda raw: (raw.__setitem__("valid_from_utc", ""), raw.__setitem__("valid_until_utc", "")), True, "window"),
        ("valid-base-path", lambda raw: raw.__setitem__("targets", [{"host": "example.com", "scheme": "https", "base_path": "/safe"}]), True, "target"),
        ("http-explicit-optin", lambda raw: (raw.__setitem__("allow_http", True), raw.__setitem__("targets", [{"host": "example.com", "scheme": "http"}])), True, "scheme"),
        ("owner-missing", lambda raw: raw.__setitem__("owner", ""), False, "required-field"),
        ("authorization-missing", lambda raw: raw.__setitem__("authorization_reference", ""), False, "required-field"),
        ("targets-empty", lambda raw: raw.__setitem__("targets", []), False, "target"),
        ("targets-wrong-type", lambda raw: raw.__setitem__("targets", {"host": "example.com"}), False, "type-confusion"),
        ("target-scalar", lambda raw: raw.__setitem__("targets", [7]), False, "type-confusion"),
        ("wildcard-host", lambda raw: raw.__setitem__("targets", [{"host": "*.example.com"}]), False, "target"),
        ("url-shaped-host", lambda raw: raw.__setitem__("targets", [{"host": "https://example.com"}]), False, "target"),
        ("unknown-check", lambda raw: raw.__setitem__("allowed_checks", ["reachability", "exploit"]), False, "capability"),
        ("checks-empty", lambda raw: raw.__setitem__("allowed_checks", []), False, "capability"),
        ("destructive", lambda raw: raw.__setitem__("destructive", True), False, "capability"),
        ("request-budget-zero", lambda raw: raw.__setitem__("max_requests_per_target", 0), False, "budget"),
        ("request-budget-nine", lambda raw: raw.__setitem__("max_requests_per_target", 9), False, "budget"),
        ("rps-over-limit", lambda raw: raw.__setitem__("max_rps", 3.0), False, "budget"),
        ("http-no-optin", lambda raw: raw.__setitem__("targets", [{"host": "example.com", "scheme": "http"}]), False, "scheme"),
        ("duplicate-target", lambda raw: raw.__setitem__("targets", [{"host": "example.com"}, {"host": "example.com"}]), False, "target"),
        ("one-sided-window", lambda raw: raw.__setitem__("valid_until_utc", ""), False, "window"),
        ("reversed-window", lambda raw: (raw.__setitem__("valid_from_utc", "2026-09-02T00:00:00Z"), raw.__setitem__("valid_until_utc", "2026-08-30T00:00:00Z")), False, "window"),
        ("expired-window", lambda raw: (raw.__setitem__("valid_from_utc", "2026-08-01T00:00:00Z"), raw.__setitem__("valid_until_utc", "2026-08-02T00:00:00Z")), False, "window"),
        ("allow-http-string-false", lambda raw: (raw.__setitem__("allow_http", "false"), raw.__setitem__("targets", [{"host": "example.com", "scheme": "http"}])), False, "type-confusion"),
        ("destructive-string-false", lambda raw: raw.__setitem__("destructive", "false"), False, "type-confusion"),
    ]
    cases: list[GuardCase] = []
    for name, mutate, expected, family in specs:
        raw = copy.deepcopy(base)
        mutate(raw)
        cases.append(
            GuardCase(
                "engagement-json",
                name,
                family,
                "high" if not expected else "low",
                expected,
                "machine-readable engagement data must fail closed on malformed authority or capability",
                lambda value=raw: _engagement_probe(value),
            )
        )
    return cases


def _external_probe(
    *,
    url: str = "https://example.com/",
    method: str = "GET",
    body: bytes | None = None,
    headers: Mapping[str, str] | None = None,
    allow_hosts: Iterable[str] = ("example.com",),
    allow_http: bool = False,
    allow_delete: bool = False,
    resolver_ips: tuple[str, ...] = ("93.184.216.34",),
) -> ProbeObservation:
    opener = _CountingOpener()
    try:
        policy = ExternalContactPolicy.from_hosts(
            allow_hosts,
            allow_http=allow_http,
            allow_delete=allow_delete,
            retries=0,
        )
        client = ExternalContactClient(
            policy,
            resolver=lambda host, port: resolver_ips,
            opener=opener,
            sleeper=lambda seconds: None,
        )
        client.contact_with_body(url, method=method, body=body, headers=headers)
    except Exception as exc:
        return ProbeObservation(
            False,
            str(exc),
            side_effect_calls=opener.calls,
            guard_exception_type=type(exc).__name__,
        )
    return ProbeObservation(True, "fake transport accepted request", side_effect_calls=opener.calls)


def _external_cases() -> list[GuardCase]:
    specs: list[tuple[str, dict[str, object], bool, str]] = [
        ("https-get", {}, True, "baseline"),
        ("https-head", {"method": "HEAD"}, True, "method"),
        ("https-options", {"method": "OPTIONS"}, True, "method"),
        ("https-post-small-body", {"method": "POST", "body": b"{}"}, True, "method"),
        ("unlisted-host", {"url": "https://other.example/"}, False, "allowlist"),
        ("plain-http-disabled", {"url": "http://example.com/"}, False, "scheme"),
        ("unsupported-scheme", {"url": "ftp://example.com/"}, False, "scheme"),
        ("userinfo", {"url": "https://user@example.com/"}, False, "authority"),
        ("userinfo-password", {"url": "https://user:pass@example.com/"}, False, "authority"),
        ("invalid-port", {"url": "https://example.com:notaport/"}, False, "authority"),
        ("trace-method", {"method": "TRACE"}, False, "method"),
        ("delete-no-optin", {"method": "DELETE"}, False, "method"),
        ("get-with-body", {"method": "GET", "body": b"x"}, False, "body"),
        ("oversized-body", {"method": "POST", "body": b"x" * (64 * 1024 + 1)}, False, "body"),
        ("caller-host-header", {"headers": {"Host": "other.example"}}, False, "headers"),
        ("header-name-crlf", {"headers": {"X-Test\nInjected": "1"}}, False, "headers"),
        ("header-value-crlf", {"headers": {"X-Test": "ok\r\nInjected: 1"}}, False, "headers"),
        ("private-resolver-result", {"resolver_ips": ("127.0.0.1",)}, False, "dns"),
        ("empty-resolver-result", {"resolver_ips": ()}, False, "dns"),
        ("nul-allowlist-and-url", {"allow_hosts": ("example.com\x00",), "url": "https://example.com\x00/"}, False, "lexical"),
    ]
    return [
        GuardCase(
            "external-contact",
            name,
            family,
            "high" if not expected else "low",
            expected,
            "blocked outbound requests must be rejected before the fake transport boundary",
            lambda kwargs=kwargs: _external_probe(**kwargs),
        )
        for name, kwargs, expected, family in specs
    ]


def _security_guard_cases() -> list[GuardCase]:
    text = SECURITY_GUARD_PATH.read_text(encoding="utf-8")
    mutations: list[tuple[str, str, bool]] = [
        ("baseline", text, True),
        ("blank", "", False),
        ("drop-read-permission", text.replace("contents: read", "contents: none", 1), False),
        ("checkout-keeps-credentials", text.replace("persist-credentials: false", "persist-credentials: true", 1), False),
        ("drop-secret-file-scan", text.replace("Block tracked secret files", "Tracked files", 1), False),
        ("drop-new-lines-scan", text.replace("Scan newly introduced lines for secrets", "Scan diff", 1), False),
        ("drop-workflow-policy", text.replace("python automation/security/workflow_policy_entrypoint.py", "echo skipped-policy", 1), False),
        ("drop-reality-gate", text.replace("python automation/security/reality_gate.py", "echo skipped-reality", 1), False),
        ("drop-remote-shell-block", text.replace("Block remote shell execution patterns", "Remote shell", 1), False),
        ("drop-untrusted-text-block", text.replace("Block direct interpolation of untrusted event text", "Interpolation", 1), False),
        ("inject-write-all", text + "\npermissions: write-all\n", False),
        ("inject-pr-target", text + "\npull_request_target:\n", False),
    ]
    cases: list[GuardCase] = []
    for name, candidate, expected in mutations:
        def probe(value: str = candidate) -> ProbeObservation:
            errors = validate_security_guard_workflow(value)
            return ProbeObservation(not errors, "; ".join(errors) if errors else "workflow contract intact")

        cases.append(
            GuardCase(
                "security-guard",
                name,
                "workflow-contract",
                "high" if not expected else "low",
                expected,
                "the guard workflow must detect its own privilege and invariant regressions",
                probe,
            )
        )
    return cases


def _artifact_probe(filename: str, content: bytes) -> ProbeObservation:
    with tempfile.TemporaryDirectory(prefix="senju-artifact-adversary-") as tmp:
        root = Path(tmp)
        dist = root / "dist"
        dist.mkdir()
        artifact = dist / filename
        artifact.parent.mkdir(parents=True, exist_ok=True)
        artifact.write_bytes(content)
        report_path = root / "report.json"
        proc = subprocess.run(
            [sys.executable, str(ARTIFACT_GUARD_PATH), str(dist), "--json", str(report_path)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        findings = payload.get("findings", [])
        rules = [str(item.get("rule", "")) for item in findings if isinstance(item, dict)]
        return ProbeObservation(
            proc.returncode == 0,
            ",".join(rules) if rules else "artifact accepted",
        )


def _artifact_cases() -> list[GuardCase]:
    gh_token = ("ghp_" + "A" * 24).encode()
    openai_token = ("sk-" + "B" * 24).encode()
    private_key = ("-----BEGIN " + "PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----").encode()
    specs: list[tuple[str, str, bytes, bool, str]] = [
        ("safe-html", "index.html", b"<a href='https://example.com/'>ok</a>", True, "baseline"),
        ("safe-js", "app.js", b"fetch('https://example.com/data')", True, "baseline"),
        ("safe-json", "data.json", b'{"ok":true}', True, "baseline"),
        ("source-map-file", "app.js.map", b"{}", False, "source-map"),
        ("source-map-reference", "app.js", b"//# sourceMappingURL=app.js.map", False, "source-map"),
        ("localhost-html", "index.html", b"<img src='http://localhost:3000/x.png'>", False, "localhost"),
        ("localhost-js", "app.js", b"fetch('http://127.0.0.1:8000/api')", False, "localhost"),
        ("mixed-content-html", "index.html", b"<script src='http://example.com/app.js'></script>", False, "mixed-content"),
        ("mixed-content-css", "app.css", b"body{background:url(http://example.com/a.png)}", False, "mixed-content"),
        ("github-token-shape", "app.js", gh_token, False, "secret"),
        ("openai-token-shape", "app.js", openai_token, False, "secret"),
        ("private-key-shape", "app.txt", private_key, False, "secret"),
    ]
    return [
        GuardCase(
            "artifact-guard",
            name,
            family,
            "high" if not expected else "low",
            expected,
            "built artifacts are scanned in an isolated temporary directory",
            lambda n=filename, body=content: _artifact_probe(n, body),
        )
        for name, filename, content, expected, family in specs
    ]


def _autonomy_authorization_probe(url: str, *, expected_host: str = "example.com") -> ProbeObservation:
    with tempfile.TemporaryDirectory(prefix="senju-autonomy-adversary-") as tmp:
        loop = AutonomyLoop(
            allow_hosts=[expected_host],
            authorized_write_hosts=[expected_host],
            out_dir=tmp,
            client=_CountingClient(),
        )
        return ProbeObservation(loop.is_authorized_write_target(url), "authorization predicate evaluated")


def _autonomy_blocked_execute_probe(*, item_type: str, method: str, url: str) -> ProbeObservation:
    client = _CountingClient()
    with tempfile.TemporaryDirectory(prefix="senju-autonomy-adversary-") as tmp:
        loop = AutonomyLoop(
            allow_hosts=["example.com"],
            authorized_write_hosts=["example.com"],
            out_dir=tmp,
            client=client,
        )
        item = WorkItem(
            id="adv",
            item_type=item_type,
            url=url,
            method=method,
            payload={"json": {"fixture": True}},
        )
        try:
            result = loop.execute_step(item)
        except AutonomyError as exc:
            return ProbeObservation(False, str(exc), side_effect_calls=client.calls, guard_exception_type=type(exc).__name__)
        except Exception as exc:
            return ProbeObservation(False, str(exc), side_effect_calls=client.calls, guard_exception_type=type(exc).__name__)
        return ProbeObservation(bool(result.get("success", True)), "step returned", side_effect_calls=client.calls)


def _autonomy_cases() -> list[GuardCase]:
    specs: list[tuple[str, Callable[[], ProbeObservation], bool, str]] = [
        ("authorized-exact", lambda: _autonomy_authorization_probe("https://example.com/write"), True, "authorization"),
        ("authorized-uppercase", lambda: _autonomy_authorization_probe("https://EXAMPLE.COM/write"), True, "authorization"),
        ("authorized-explicit-port", lambda: _autonomy_authorization_probe("https://example.com:443/write"), True, "authorization"),
        ("unauthorized-host", lambda: _autonomy_authorization_probe("https://other.example/write"), False, "authorization"),
        ("unauthorized-subdomain", lambda: _autonomy_authorization_probe("https://sub.example.com/write"), False, "authorization"),
        ("userinfo-host-confusion", lambda: _autonomy_authorization_probe("https://example.com@other.example/write"), False, "authorization"),
        ("suffix-confusion", lambda: _autonomy_authorization_probe("https://example.com.evil.invalid/write"), False, "authorization"),
        ("canary-post-unknown", lambda: _autonomy_blocked_execute_probe(item_type="canary_write", method="POST", url="https://other.example/write"), False, "execution"),
        ("canary-delete-unknown", lambda: _autonomy_blocked_execute_probe(item_type="canary_write", method="DELETE", url="https://other.example/write"), False, "execution"),
        ("discovery-post", lambda: _autonomy_blocked_execute_probe(item_type="discovery", method="POST", url="https://example.com/"), False, "execution"),
        ("discovery-patch", lambda: _autonomy_blocked_execute_probe(item_type="discovery", method="PATCH", url="https://example.com/"), False, "execution"),
        ("discovery-delete", lambda: _autonomy_blocked_execute_probe(item_type="discovery", method="DELETE", url="https://example.com/"), False, "execution"),
    ]
    return [
        GuardCase(
            "autonomy-engine",
            name,
            family,
            "high" if not expected else "low",
            expected,
            "unauthorized or non-passive work must stop before an external client is reached",
            probe,
        )
        for name, probe, expected, family in specs
    ]


def build_campaign(*, targets: Iterable[str] | None = None) -> tuple[GuardCase, ...]:
    """Build the deterministic seven-target campaign (208 cases when unfiltered)."""
    selected = set(TARGETS if targets is None else targets)
    unknown = selected - set(TARGETS)
    if unknown:
        raise ValueError(f"unknown adversary target(s): {sorted(unknown)}")

    builders: tuple[tuple[str, Callable[[], list[GuardCase]]], ...] = (
        ("scopeguard", _scopeguard_cases),
        ("offense-first", _offense_first_cases),
        ("engagement-json", _engagement_cases),
        ("external-contact", _external_cases),
        ("security-guard", _security_guard_cases),
        ("artifact-guard", _artifact_cases),
        ("autonomy-engine", _autonomy_cases),
    )
    cases: list[GuardCase] = []
    for target, builder in builders:
        if target in selected:
            cases.extend(builder())
    return tuple(cases)
