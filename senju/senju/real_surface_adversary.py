"""Adversarial regression harness for Senju's real guard surfaces.

This module deliberately does *not* reimplement the guarded systems.  It resolves,
hashes, imports, and invokes the repository's real implementations and real policy
files, then applies deterministic fault/adversarial cases to those exact surfaces.

Network side effects are blocked by an injected inert transport while the real
ExternalContactClient validation path executes.  artifact_guard.py is executed as
the real repository script against temporary production-artifact fixtures.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import inspect
import json
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Mapping

from .authorized_assessment import EngagementError, EngagementManifest, build_plan
from .autonomy import AutonomyEngine, WorkItem
from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXED_NOW = dt.datetime(2026, 8, 31, 0, 0, tzinfo=dt.timezone.utc)

TARGET_FILES: dict[str, Path] = {
    "offense-first": REPO_ROOT / "senju" / "OFFENSE_FIRST.md",
    "engagement-json": REPO_ROOT / "senju" / "senju" / "authorized_assessment.py",
    "external-contact": REPO_ROOT / "senju" / "senju" / "external.py",
    "security-guard": REPO_ROOT / ".github" / "workflows" / "security-guard.yml",
    "artifact-guard": REPO_ROOT / "scripts" / "security" / "artifact_guard.py",
    "autonomy-engine": REPO_ROOT / "senju" / "senju" / "autonomy" / "engine.py",
}


@dataclass(frozen=True)
class ProbeResult:
    target: str
    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class CampaignReport:
    provenance: Mapping[str, Mapping[str, str]]
    results: tuple[ProbeResult, ...]

    @property
    def passed(self) -> bool:
        return all(result.passed for result in self.results)

    @property
    def failed(self) -> tuple[ProbeResult, ...]:
        return tuple(result for result in self.results if not result.passed)

    def to_dict(self) -> dict[str, object]:
        return {
            "schema": "senju-real-surface-adversary/v1",
            "mode": "real-repository-surfaces",
            "passed": self.passed,
            "total": len(self.results),
            "failed_count": len(self.failed),
            "provenance": dict(self.provenance),
            "results": [asdict(result) for result in self.results],
        }


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _repo_path(path: Path) -> str:
    return path.resolve().relative_to(REPO_ROOT.resolve()).as_posix()


def _assert_same_source(obj: object, expected: Path) -> str:
    source = inspect.getsourcefile(obj)
    if not source:
        raise AssertionError(f"cannot resolve source for {obj!r}")
    actual = Path(source).resolve()
    if actual != expected.resolve():
        raise AssertionError(f"resolved {actual}, expected {expected.resolve()}")
    return _repo_path(actual)


def collect_provenance() -> dict[str, dict[str, str]]:
    for path in TARGET_FILES.values():
        if not path.is_file():
            raise AssertionError(f"real target missing: {_repo_path(path)}")

    _assert_same_source(EngagementManifest, TARGET_FILES["engagement-json"])
    _assert_same_source(ExternalContactClient, TARGET_FILES["external-contact"])
    _assert_same_source(AutonomyEngine, TARGET_FILES["autonomy-engine"])

    return {
        name: {
            "path": _repo_path(path),
            "sha256": _sha256(path),
        }
        for name, path in TARGET_FILES.items()
    }


def _expect_error(exc_type: type[BaseException], fn: Callable[[], object]) -> str:
    try:
        fn()
    except exc_type as exc:
        return f"rejected:{type(exc).__name__}:{exc}"
    except Exception as exc:  # pragma: no cover - useful diagnostics in CI
        raise AssertionError(
            f"expected {exc_type.__name__}, got {type(exc).__name__}: {exc}"
        ) from exc
    raise AssertionError(f"expected {exc_type.__name__}, but operation was accepted")


def _run_probe(target: str, name: str, fn: Callable[[], str]) -> ProbeResult:
    try:
        detail = fn()
    except Exception as exc:
        return ProbeResult(target, name, False, f"{type(exc).__name__}: {exc}")
    return ProbeResult(target, name, True, detail)


def _offense_first_probes() -> list[ProbeResult]:
    path = TARGET_FILES["offense-first"]

    def contract() -> str:
        text = path.read_text(encoding="utf-8")
        required = (
            "Arena / synthetic / owned-or-explicitly-authorized lab",
            "所有者または明示的なテスト権限",
            "外部資産に対する認可境界",
            "Owner / BOSS が追加 scope を明示的に認可",
            "BOSS が与えた上限まで",
        )
        forbidden = (
            "UNAUTHORIZED_EXTERNAL_EXECUTION=ALLOW",
            "THIRD_PARTY_AUTHORIZATION=IMPLICIT",
            "SCOPEGUARD=DISABLED",
            "ALLOW_ANY_HOST=true",
            "ENGAGEMENT_REQUIRED=false",
            "AUTONOMY_BOUNDARY=NONE",
        )
        missing = [marker for marker in required if marker not in text]
        present_forbidden = [marker for marker in forbidden if marker in text]
        if missing or present_forbidden:
            raise AssertionError(
                f"missing={missing!r}; forbidden_present={present_forbidden!r}"
            )
        return f"real-file-ok sha256={_sha256(path)[:16]}"

    return [_run_probe("offense-first", "authorization-boundary-contract", contract)]


def _engagement_base() -> dict[str, object]:
    return {
        "engagement_id": "real-surface-test",
        "owner": "MusicJapanLLC",
        "authorization_reference": "owned-lab-regression",
        "targets": [{"host": "example.com", "scheme": "https", "base_path": "/"}],
        "allowed_checks": ["reachability", "root_snapshot"],
        "max_requests_per_target": 2,
        "max_rps": 1.0,
        "allow_http": False,
        "destructive": False,
    }


def _engagement_probes() -> list[ProbeResult]:
    out: list[ProbeResult] = []

    def valid_exact_host() -> str:
        manifest = EngagementManifest.from_dict(_engagement_base())
        plan = build_plan(manifest)
        if not plan or any(request.target_host != "example.com" for request in plan):
            raise AssertionError("plan escaped exact target host")
        return f"accepted:{manifest.effective_engagement_id}:requests={len(plan)}"

    out.append(_run_probe("engagement-json", "valid-owned-exact-host", valid_exact_host))

    def missing_authorization() -> str:
        raw = _engagement_base()
        raw["authorization_reference"] = ""
        return _expect_error(EngagementError, lambda: EngagementManifest.from_dict(raw))

    out.append(_run_probe("engagement-json", "reject-missing-authorization", missing_authorization))

    def wildcard_host() -> str:
        raw = copy.deepcopy(_engagement_base())
        raw["targets"] = [{"host": "*.example.com"}]
        return _expect_error(EngagementError, lambda: EngagementManifest.from_dict(raw))

    out.append(_run_probe("engagement-json", "reject-wildcard-host", wildcard_host))

    def destructive() -> str:
        raw = _engagement_base()
        raw["destructive"] = True
        return _expect_error(EngagementError, lambda: EngagementManifest.from_dict(raw))

    out.append(_run_probe("engagement-json", "reject-destructive", destructive))

    def request_budget() -> str:
        raw = _engagement_base()
        raw["max_requests_per_target"] = 99
        return _expect_error(EngagementError, lambda: EngagementManifest.from_dict(raw))

    out.append(_run_probe("engagement-json", "reject-request-budget-bypass", request_budget))

    def expired_window() -> str:
        raw = _engagement_base()
        raw["valid_from_utc"] = "2026-01-01T00:00:00Z"
        raw["valid_until_utc"] = "2026-01-02T00:00:00Z"
        manifest = EngagementManifest.from_dict(raw)
        return _expect_error(
            EngagementError,
            lambda: manifest.validate(now=FIXED_NOW, enforce_window=True),
        )

    out.append(_run_probe("engagement-json", "reject-expired-window", expired_window))
    return out


class _Response:
    status = 204
    headers: dict[str, str] = {}

    def read(self, limit: int = -1) -> bytes:
        return b""

    def close(self) -> None:
        return None


class _CountingOpener:
    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, request, *, timeout: float):  # noqa: ANN001
        self.calls += 1
        return _Response()


def _public_resolver(host: str, port: int) -> tuple[str, ...]:
    del host, port
    return ("93.184.216.34",)


def _external_client(*, resolver: Callable[[str, int], tuple[str, ...]] = _public_resolver): tuple[ExternalContactClient, _CountingOpener]:
    opener = _CountingOpener()
    policy = ExternalContactPolicy.from_hosts(
        ["example.com"],
        allow_http=False,
        allow_delete=False,
        follow_redirects=False,
        retries=0,
    )
    return ExternalContactClient(policy, resolver=resolver, opener=opener, sleeper=lambda _: None), opener


def _external_probes() -> list[ProbeResult]:
    out: list[ProbeResult] = []

    def allowed_get() -> str:
        client, opener = _external_client()
        receipt = client.contact("https://example.com/health", method="GET")
        if receipt.status != 204 or opener.calls != 1:
            raise AssertionError(f"status={receipt.status}; opener_calls={opener.calls}")
        return "real-client-accepted-exact-allowlisted-host"

    out.append(_run_probe("external-contact", "allow-exact-public-host", allowed_get))

    def non_allowlisted() -> str:
        client, opener = _external_client()
        detail = _expect_error(
            ExternalContactError,
            lambda: client.contact("https://attacker.invalid/", method="GET"),
        )
        if opener.calls:
            raise AssertionError("transport was called for rejected host")
        return detail

    out.append(_run_probe("external-contact", "reject-non-allowlisted-host-before-io", non_allowlisted))

    def private_resolution() -> str:
        client, opener = _external_client(resolver=lambda _h, _p: ("127.0.0.1",))
        detail = _expect_error(
            ExternalContactError,
            lambda: client.contact("https://example.com/", method="GET"),
        )
        if opener.calls:
            raise AssertionError("transport was called after private-IP resolution")
        return detail

    out.append(_run_probe("external-contact", "reject-private-resolution-before-io", private_resolution))

    def url_credentials() -> str:
        client, opener = _external_client()
        detail = _expect_error(
            ExternalContactError,
            lambda: client.contact("https://user:pass@example.com/", method="GET"),
        )
        if opener.calls:
            raise AssertionError("transport was called for credential-bearing URL")
        return detail

    out.append(_run_probe("external-contact", "reject-url-credentials", url_credentials))

    def plain_http() -> str:
        client, opener = _external_client()
        detail = _expect_error(
            ExternalContactError,
            lambda: client.contact("http://example.com/", method="GET"),
        )
        if opener.calls:
            raise AssertionError("transport was called for blocked HTTP")
        return detail

    out.append(_run_probe("external-contact", "reject-plain-http", plain_http))

    def delete_without_opt_in() -> str:
        client, opener = _external_client()
        detail = _expect_error(
            ExternalContactError,
            lambda: client.contact("https://example.com/object/1", method="DELETE"),
        )
        if opener.calls:
            raise AssertionError("transport was called for blocked DELETE")
        return detail

    out.append(_run_probe("external-contact", "reject-delete-without-opt-in", delete_without_opt_in))
    return out


def _workflow_probes() -> list[ProbeResult]:
    path = TARGET_FILES["security-guard"]

    def hardened_workflow() -> str:
        text = path.read_text(encoding="utf-8")
        required = (
            "contents: read",
            "persist-credentials: false",
            "Block tracked secret files",
            "Block obvious credential material in tracked source",
            "Scan newly introduced lines for secrets",
            "python automation/security/workflow_policy_entrypoint.py",
            "python automation/security/reality_gate.py",
            "Run real-surface adversary regression",
            "python -m senju.real_surface_adversary",
        )
        forbidden = (
            "pull_request_target:",
            "permissions: write-all",
            "persist-credentials: true",
            "contents: write",
            "id-token: write",
        )
        missing = [marker for marker in required if marker not in text]
        bad = [marker for marker in forbidden if marker in text]
        if missing or bad:
            raise AssertionError(f"missing={missing!r}; forbidden_present={bad!r}")
        return f"real-workflow-ok sha256={_sha256(path)[:16]}"

    return [_run_probe("security-guard", "workflow-self-contract", hardened_workflow)]


def _run_artifact_guard(files: Mapping[str, str]) -> tuple[int, dict[str, object], str]:
    with tempfile.TemporaryDirectory(prefix="senju-artifact-adversary-") as td:
        root = Path(td)
        dist = root / "dist"
        dist.mkdir()
        for relative, content in files.items():
            path = dist / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        report = root / "artifact-report.json"
        proc = subprocess.run(
            [sys.executable, str(TARGET_FILES["artifact-guard"]), str(dist), "--json", str(report)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        payload = json.loads(report.read_text(encoding="utf-8"))
        return proc.returncode, payload, proc.stdout + proc.stderr


def _artifact_probes() -> list[ProbeResult]:
    out: list[ProbeResult] = []

    def clean() -> str:
        rc, payload, _ = _run_artifact_guard({"index.html": "<html><body>ok</body></html>"})
        if rc != 0 or payload.get("status") != "pass":
            raise AssertionError(f"rc={rc}; payload={payload!r}")
        return "real-script-clean-pass"

    out.append(_run_probe("artifact-guard", "clean-production-artifact", clean))

    def synthetic_secret() -> str:
        token = "sk-" + ("A" * 28)
        rc, payload, _ = _run_artifact_guard({"app.js": f"const synthetic = '{token}';"})
        rules = {finding.get("rule") for finding in payload.get("findings", []) if isinstance(finding, dict)}
        if rc != 1 or "artifact.secret.openai-key" not in rules:
            raise AssertionError(f"rc={rc}; rules={sorted(str(rule) for rule in rules)}")
        return "real-script-blocked-synthetic-secret"

    out.append(_run_probe("artifact-guard", "block-secret-like-browser-output", synthetic_secret))

    def local_reference() -> str:
        rc, payload, _ = _run_artifact_guard({"app.js": "fetch('http://127.0.0.1:3000/admin')"})
        rules = {finding.get("rule") for finding in payload.get("findings", []) if isinstance(finding, dict)}
        if rc != 1 or "artifact.localhost-reference" not in rules:
            raise AssertionError(f"rc={rc}; rules={sorted(str(rule) for rule in rules)}")
        return "real-script-blocked-localhost-reference"

    out.append(_run_probe("artifact-guard", "block-localhost-reference", local_reference))

    def source_map() -> str:
        rc, payload, _ = _run_artifact_guard({"bundle.js.map": "{}"})
        rules = {finding.get("rule") for finding in payload.get("findings", []) if isinstance(finding, dict)}
        if rc != 1 or "artifact.source-map" not in rules:
            raise AssertionError(f"rc={rc}; rules={sorted(str(rule) for rule in rules)}")
        return "real-script-blocked-source-map"

    out.append(_run_probe("artifact-guard", "block-production-source-map", source_map))
    return out


def _autonomy_probes() -> list[ProbeResult]:
    out: list[ProbeResult] = []

    def source_and_bounded_queue() -> str:
        source = _assert_same_source(AutonomyEngine, TARGET_FILES["autonomy-engine"])
        with tempfile.TemporaryDirectory(prefix="senju-autonomy-adversary-") as td:
            engine = AutonomyEngine(td)
            if len(engine.queue._items) < 3:
                raise AssertionError("engine did not seed its real queue")
            selected = engine.queue.select_next(budget_matches=1)
            if selected is not None:
                raise AssertionError("queue selected an item above the supplied match budget")
            if (Path(td) / "autonomy_reports").exists():
                raise AssertionError("a tournament executed during budget-rejection probe")
        return f"real-engine={source}:budget-rejection-ok"

    out.append(_run_probe("autonomy-engine", "real-engine-bounded-budget", source_and_bounded_queue))

    def invalid_category() -> str:
        return _expect_error(
            ValueError,
            lambda: WorkItem(
                item_id="adv-invalid-category",
                hypothesis="synthetic invalid work item",
                category="unbounded_external_action",
                expected_value=0.5,
                cost_budget_matches=10,
            ),
        )

    out.append(_run_probe("autonomy-engine", "reject-unknown-work-category", invalid_category))

    def excessive_matches() -> str:
        return _expect_error(
            ValueError,
            lambda: WorkItem(
                item_id="adv-excessive-budget",
                hypothesis="synthetic excessive budget item",
                category="test",
                expected_value=0.5,
                cost_budget_matches=5001,
            ),
        )

    out.append(_run_probe("autonomy-engine", "reject-excessive-match-budget", excessive_matches))
    return out


def run_campaign() -> CampaignReport:
    provenance = collect_provenance()
    results: list[ProbeResult] = []
    results.extend(_offense_first_probes())
    results.extend(_engagement_probes())
    results.extend(_external_probes())
    results.extend(_workflow_probes())
    results.extend(_artifact_probes())
    results.extend(_autonomy_probes())
    return CampaignReport(provenance=provenance, results=tuple(results))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run adversarial regression against real Senju guard surfaces")
    parser.add_argument("--json", dest="json_path", type=Path)
    args = parser.parse_args(argv)

    report = run_campaign()
    payload = report.to_dict()
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"

    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(rendered, encoding="utf-8")

    print(rendered, end="")
    return 0 if report.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
