"""Local-only adversarial test harness for :class:`senju.safety.ScopeGuard`.

This module deliberately does *not* perform network access or modify ScopeGuard.
Its only job is to pressure-test the guard with deterministic boundary inputs and
report unexpected allow/deny behavior.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from senju.safety import ScopeGuard, ScopeViolation, default_lab_policy


@dataclass(frozen=True)
class AdversarialCase:
    name: str
    target_ref: str
    expected_allowed: bool


@dataclass(frozen=True)
class AdversarialResult:
    case: AdversarialCase
    actual_allowed: bool
    passed: bool
    detail: str


DEFAULT_CASES: tuple[AdversarialCase, ...] = (
    AdversarialCase("empty", "", False),
    AdversarialCase("whitespace", "   ", False),
    AdversarialCase("public-hostname", "example.com", False),
    AdversarialCase("public-ipv4", "8.8.8.8", False),
    AdversarialCase("private-ipv4", "10.0.0.5", False),
    AdversarialCase("loopback-ipv4", "127.0.0.1", False),
    AdversarialCase("loopback-ipv6", "::1", False),
    AdversarialCase("labnet-ref", "labnet:juice-shop", False),
    AdversarialCase("simulated", "sim://arena-target", True),
)


class ScopeGuardAdversary:
    """Exercise a ScopeGuard without changing it or contacting external systems."""

    def __init__(self, guard: ScopeGuard | None = None) -> None:
        self.guard = guard or ScopeGuard(default_lab_policy())

    def run_case(self, case: AdversarialCase) -> AdversarialResult:
        try:
            self.guard.check(case.target_ref)
            actual_allowed = True
            detail = "allowed"
        except ScopeViolation as exc:
            actual_allowed = False
            detail = str(exc)

        return AdversarialResult(
            case=case,
            actual_allowed=actual_allowed,
            passed=actual_allowed is case.expected_allowed,
            detail=detail,
        )

    def run(self, cases: Iterable[AdversarialCase] = DEFAULT_CASES) -> list[AdversarialResult]:
        return [self.run_case(case) for case in cases]


def main() -> int:
    results = ScopeGuardAdversary().run()
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"[{status}] {result.case.name}: {result.detail}")

    failures = [result for result in results if not result.passed]
    print(f"\nScopeGuard adversarial run: {len(results) - len(failures)}/{len(results)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
