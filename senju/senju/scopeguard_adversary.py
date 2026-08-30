"""Minimal adversarial harness for ScopeGuard.

This module pressure-tests ScopeGuard itself without performing network I/O or
mutating the guard. It feeds deliberately awkward target_ref values through the
same public API used by Arena and reports surprising accepts/rejects.
"""
from __future__ import annotations

from dataclasses import dataclass

from .safety import ScopeGuard, ScopeViolation


@dataclass(frozen=True)
class ProbeCase:
    name: str
    target_ref: str
    should_allow: bool


@dataclass(frozen=True)
class ProbeResult:
    case: ProbeCase
    allowed: bool
    detail: str

    @property
    def surprising(self) -> bool:
        return self.allowed != self.case.should_allow


DEFAULT_CASES: tuple[ProbeCase, ...] = (
    ProbeCase("empty", "", False),
    ProbeCase("plain-public-host", "example.com", False),
    ProbeCase("public-host-leading-space", " example.com", False),
    ProbeCase("public-host-trailing-space", "example.com ", False),
    ProbeCase("public-url-http", "http://example.com", False),
    ProbeCase("public-url-https", "https://example.com", False),
    ProbeCase("public-host-uppercase", "EXAMPLE.COM", False),
    ProbeCase("loopback-v4", "127.0.0.1", False),
    ProbeCase("loopback-v4-with-port", "127.0.0.1:8000", False),
    ProbeCase("loopback-v6", "::1", False),
    ProbeCase("private-v4", "10.0.0.1", False),
    ProbeCase("private-v4-with-port", "10.0.0.1:443", False),
    ProbeCase("link-local", "169.254.1.1", False),
    ProbeCase("labnet-prefix", "labnet:example", False),
    ProbeCase("simulated", "sim://fixture", True),
    ProbeCase("sim-lookalike-case", "SIM://fixture", False),
    ProbeCase("sim-leading-space", " sim://fixture", False),
    ProbeCase("sim-prefix-only", "sim://", True),
)


def probe_guard(
    guard: ScopeGuard,
    cases: tuple[ProbeCase, ...] = DEFAULT_CASES,
) -> list[ProbeResult]:
    """Run adversarial target_ref probes against an existing ScopeGuard."""
    results: list[ProbeResult] = []
    for case in cases:
        try:
            guard.check(case.target_ref)
        except ScopeViolation as exc:
            results.append(ProbeResult(case=case, allowed=False, detail=str(exc)))
        else:
            results.append(ProbeResult(case=case, allowed=True, detail="accepted"))
    return results


def surprising_results(
    guard: ScopeGuard,
    cases: tuple[ProbeCase, ...] = DEFAULT_CASES,
) -> list[ProbeResult]:
    """Return only behavior that differs from the harness expectation."""
    return [result for result in probe_guard(guard, cases) if result.surprising]
