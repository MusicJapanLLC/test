"""Persistent fail-open hunter for ScopeGuard defensive hardening.

The hunter continuously searches for *unexpected allows* and guard crashes using the
real ScopeGuard implementation. It is intentionally local/offline: no network I/O,
no policy edits, no authority changes, and no bypass payload export.

Closed-loop behavior:
    prior sanitized memory
      -> bias mutation families that previously produced surprises
      -> run high-volume real-guard probes
      -> classify unexpected allow / exception
      -> emit payload-free fingerprints and defensive repair hints
      -> persist sanitized memory for the next run

The full candidate input exists only in process memory while it is evaluated. Reports
and persistent state keep only hashes/metadata so the loop can improve defensive
coverage without becoming a library of reusable guard-bypass strings.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import string
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from .safety import ScopeGuard, ScopeViolation, default_lab_policy

SCHEMA = "senju-guard-unintended-allow-hunter/v1"
MEMORY_SCHEMA = "senju-guard-unintended-allow-memory/v1"
MAX_MEMORY_FINGERPRINTS = 512
MAX_ITERATIONS = 2_000_000

DENY_SEEDS: tuple[str, ...] = (
    "example.com",
    "owned.example.evil.invalid",
    "https://example.com",
    "http://example.com",
    "127.0.0.1",
    "10.0.0.1",
    "169.254.1.1",
    "::1",
    "localhost",
    "labnet:example",
)

CONTROL_ALLOW: tuple[str, ...] = (
    "sim://ok",
    "sim://fixture",
)

FAMILIES: tuple[str, ...] = (
    "whitespace",
    "control_chars",
    "case_confusion",
    "delimiter_confusion",
    "suffix_confusion",
    "path_query_fragment",
    "scheme_confusion",
    "unicode_confusion",
    "numeric_confusion",
    "length_pressure",
)

REPAIR_HINTS: dict[str, str] = {
    "whitespace": "reject or canonicalize leading/trailing whitespace before scope comparison",
    "control_chars": "reject control characters before parsing or normalization",
    "case_confusion": "apply one canonical case normalization before exact comparisons",
    "delimiter_confusion": "parse authority delimiters before allow/deny decisions",
    "suffix_confusion": "require exact host equality instead of suffix/prefix similarity",
    "path_query_fragment": "separate host identity from path/query/fragment before scope checks",
    "scheme_confusion": "require exact supported scheme tokens before target classification",
    "unicode_confusion": "normalize IDNA/Unicode before comparing exact scope identity",
    "numeric_confusion": "parse IP literals canonically before private/public classification",
    "length_pressure": "bound input length and fail closed before expensive parsing",
}


def _fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="surrogatepass")).hexdigest()


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@dataclass
class HuntMemory:
    family_attempts: dict[str, int] = field(default_factory=dict)
    family_surprises: dict[str, int] = field(default_factory=dict)
    surprise_fingerprints: list[str] = field(default_factory=list)
    completed_runs: int = 0
    total_cases: int = 0

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any] | None) -> "HuntMemory":
        if not raw:
            return cls()
        attempts = raw.get("family_attempts") if isinstance(raw.get("family_attempts"), Mapping) else {}
        surprises = raw.get("family_surprises") if isinstance(raw.get("family_surprises"), Mapping) else {}
        fingerprints = raw.get("surprise_fingerprints") if isinstance(raw.get("surprise_fingerprints"), list) else []
        return cls(
            family_attempts={str(k): max(0, _safe_int(v)) for k, v in attempts.items()},
            family_surprises={str(k): max(0, _safe_int(v)) for k, v in surprises.items()},
            surprise_fingerprints=[str(x) for x in fingerprints if str(x)][-MAX_MEMORY_FINGERPRINTS:],
            completed_runs=max(0, _safe_int(raw.get("completed_runs"))),
            total_cases=max(0, _safe_int(raw.get("total_cases"))),
        )

    def weights(self) -> dict[str, int]:
        """Bias future probes toward families that historically produced surprises."""
        weights: dict[str, int] = {}
        for family in FAMILIES:
            attempts = max(0, self.family_attempts.get(family, 0))
            surprises = max(0, self.family_surprises.get(family, 0))
            # Every family always remains reachable. A historical surprise creates a
            # strong but bounded defensive research bias on subsequent runs.
            novelty_bonus = 4 if attempts == 0 else 0
            weights[family] = min(32, 2 + novelty_bonus + (surprises * 6))
        return weights

    def record_attempt(self, family: str) -> None:
        self.family_attempts[family] = self.family_attempts.get(family, 0) + 1
        self.total_cases += 1

    def record_surprise(self, family: str, fingerprint: str) -> None:
        self.family_surprises[family] = self.family_surprises.get(family, 0) + 1
        if fingerprint not in self.surprise_fingerprints:
            self.surprise_fingerprints.append(fingerprint)
            self.surprise_fingerprints = self.surprise_fingerprints[-MAX_MEMORY_FINGERPRINTS:]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema": MEMORY_SCHEMA,
            "completed_runs": self.completed_runs,
            "total_cases": self.total_cases,
            "family_attempts": dict(sorted(self.family_attempts.items())),
            "family_surprises": dict(sorted(self.family_surprises.items())),
            "surprise_fingerprints": list(self.surprise_fingerprints),
            "raw_inputs_persisted": False,
            "bypass_payload_exported": False,
        }


@dataclass(frozen=True)
class Finding:
    kind: str
    family: str
    fingerprint: str
    input_length: int
    severity: str
    exception_type: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "family": self.family,
            "fingerprint": self.fingerprint,
            "input_length": self.input_length,
            "severity": self.severity,
            "exception_type": self.exception_type,
            "repair_hint": REPAIR_HINTS.get(self.family, "review parser and fail-closed normalization"),
        }


def _mutate(seed: str, family: str, rng: random.Random) -> str:
    if family == "whitespace":
        left = rng.choice((" ", "\t", "\n", "\r", "  "))
        right = rng.choice(("", " ", "\t", "\n"))
        return f"{left}{seed}{right}"
    if family == "control_chars":
        control = rng.choice(("\x00", "\x01", "\x1f", "\x7f"))
        return seed + control if rng.randrange(2) else control + seed
    if family == "case_confusion":
        return "".join(ch.swapcase() if ch.isalpha() and rng.randrange(2) else ch for ch in seed)
    if family == "delimiter_confusion":
        token = rng.choice(("@", ":", "//", "\\", "%2f", "%00"))
        index = rng.randrange(len(seed) + 1)
        return seed[:index] + token + seed[index:]
    if family == "suffix_confusion":
        return rng.choice((f"{seed}.evil.invalid", f"safe.{seed}", f"{seed}.", f"{seed}.."))
    if family == "path_query_fragment":
        return seed + rng.choice(("/path", "?x=1", "#fragment", "/../x", "/%2e%2e/x"))
    if family == "scheme_confusion":
        if "://" in seed:
            return rng.choice(("HTTPS://", "HttpS://", "//", "https:\\")) + seed.split("://", 1)[1]
        return rng.choice(("https://", "http://", "HTTPS://", "//")) + seed
    if family == "unicode_confusion":
        substitutions = {".": rng.choice(("。", "．", "｡")), ":": "：", "/": "／"}
        chars = list(seed)
        positions = [i for i, ch in enumerate(chars) if ch in substitutions]
        if positions:
            pos = rng.choice(positions)
            chars[pos] = substitutions[chars[pos]]
            return "".join(chars)
        return seed + rng.choice(("。", "\u200b", "\ufeff"))
    if family == "numeric_confusion":
        return rng.choice(("127.000.000.001", "0177.0.0.1", "2130706433", "0x7f000001", "10.000.000.001"))
    if family == "length_pressure":
        pad = rng.choice(("a", ".", "/", "%")) * rng.randrange(128, 4097)
        return seed + pad
    raise ValueError(f"unknown mutation family: {family}")


def _evaluate(guard: ScopeGuard, value: str) -> tuple[bool | None, str | None]:
    try:
        guard.check(value)
    except ScopeViolation:
        return False, None
    except Exception as exc:  # noqa: BLE001 - defensive harness records parser crashes
        return None, type(exc).__name__
    return True, None


def _weighted_family(rng: random.Random, weights: Mapping[str, int]) -> str:
    population: list[str] = []
    for family in FAMILIES:
        population.extend([family] * max(1, int(weights.get(family, 1))))
    return rng.choice(population)


def run_hunt(
    *,
    iterations: int = 250_000,
    seed: int = 0xA1107,
    memory: HuntMemory | None = None,
    guard: ScopeGuard | None = None,
) -> dict[str, Any]:
    if not (1 <= int(iterations) <= MAX_ITERATIONS):
        raise ValueError(f"iterations must be between 1 and {MAX_ITERATIONS}")

    learning = memory or HuntMemory()
    target_guard = guard or ScopeGuard(default_lab_policy())
    rng = random.Random(int(seed))
    findings: list[Finding] = []
    kind_counts: Counter[str] = Counter()
    family_counts: Counter[str] = Counter()

    # Positive controls catch accidental over-tightening while the generated search is
    # focused exclusively on unintended ALLOW behavior for known-deny families.
    control_failures = 0
    for value in CONTROL_ALLOW:
        allowed, exception_type = _evaluate(target_guard, value)
        if allowed is not True:
            control_failures += 1
            findings.append(
                Finding(
                    kind="unexpected_reject" if allowed is False else "exception",
                    family="control_allow",
                    fingerprint=_fingerprint(value),
                    input_length=len(value),
                    severity="medium",
                    exception_type=exception_type,
                )
            )

    weights_before = learning.weights()
    for _ in range(int(iterations)):
        family = _weighted_family(rng, weights_before)
        base = rng.choice(DENY_SEEDS)
        value = _mutate(base, family, rng)
        learning.record_attempt(family)
        allowed, exception_type = _evaluate(target_guard, value)
        if allowed is False:
            continue

        fingerprint = _fingerprint(value)
        if allowed is True:
            kind = "unexpected_allow"
            severity = "critical"
        else:
            kind = "exception"
            severity = "high"
        kind_counts[kind] += 1
        family_counts[family] += 1
        learning.record_surprise(family, fingerprint)
        findings.append(
            Finding(
                kind=kind,
                family=family,
                fingerprint=fingerprint,
                input_length=len(value),
                severity=severity,
                exception_type=exception_type,
            )
        )

    learning.completed_runs += 1
    unique_findings: dict[tuple[str, str], Finding] = {}
    for finding in findings:
        unique_findings[(finding.kind, finding.fingerprint)] = finding
    sanitized = tuple(unique_findings.values())
    pressure = min(100, (kind_counts["unexpected_allow"] * 25) + (kind_counts["exception"] * 10) + (control_failures * 5))

    report = {
        "schema": SCHEMA,
        "seed": int(seed),
        "iterations": int(iterations),
        "network_io": False,
        "guard_policy_mutated": False,
        "authority_changed": False,
        "raw_inputs_persisted": False,
        "bypass_payload_exported": False,
        "closed_loop_learning": True,
        "shared_finding_format": "fingerprint+family+repair_hint",
        "passed": len(sanitized) == 0,
        "unexpected_allow_count": kind_counts["unexpected_allow"],
        "exception_count": kind_counts["exception"],
        "control_failure_count": control_failures,
        "unique_finding_count": len(sanitized),
        "defensive_pressure": pressure,
        "family_surprise_counts": dict(sorted(family_counts.items())),
        "family_weights_before": weights_before,
        "family_weights_after": learning.weights(),
        "findings": [finding.to_dict() for finding in sanitized[:256]],
        "repair_queue": [
            {
                "family": family,
                "priority": "critical" if count else "high",
                "count": count,
                "repair_hint": REPAIR_HINTS.get(family, "review parser and fail-closed normalization"),
                "automatic_guard_weakening": False,
                "automatic_authority_expansion": False,
            }
            for family, count in sorted(family_counts.items(), key=lambda row: (-row[1], row[0]))
        ],
        "memory": learning.to_dict(),
    }
    return report


def merge_reports(reports: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Merge matrix-run evidence into one payload-free sharing artifact."""
    family_counts: Counter[str] = Counter()
    fingerprints: set[str] = set()
    unexpected = 0
    exceptions = 0
    cases = 0
    for report in reports:
        unexpected += _safe_int(report.get("unexpected_allow_count"))
        exceptions += _safe_int(report.get("exception_count"))
        cases += _safe_int(report.get("iterations"))
        for finding in report.get("findings", []) if isinstance(report.get("findings"), list) else []:
            if not isinstance(finding, Mapping):
                continue
            family_counts[str(finding.get("family", "unknown"))] += 1
            fingerprint = str(finding.get("fingerprint", ""))
            if fingerprint:
                fingerprints.add(fingerprint)
    return {
        "schema": "senju-guard-unintended-allow-shared/v1",
        "source_reports": len(reports),
        "total_iterations": cases,
        "unexpected_allow_count": unexpected,
        "exception_count": exceptions,
        "unique_fingerprint_count": len(fingerprints),
        "family_surprise_counts": dict(sorted(family_counts.items())),
        "shared_with": ["META", "X", "SENJU", "CHILD", "PR-CI"],
        "raw_inputs_persisted": False,
        "bypass_payload_exported": False,
        "intended_use": "defensive regression and fail-closed hardening",
    }


def _read_json(path: str | Path | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return dict(raw) if isinstance(raw, Mapping) else None


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Search ScopeGuard for unintended allows without exporting bypass payloads")
    parser.add_argument("--iterations", type=int, default=250_000)
    parser.add_argument("--seed", type=int, default=0xA1107)
    parser.add_argument("--memory-in")
    parser.add_argument("--report-out", required=True)
    parser.add_argument("--memory-out")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = _parser().parse_args(list(argv) if argv is not None else None)
    prior = _read_json(args.memory_in)
    memory_raw = prior.get("memory") if isinstance(prior, Mapping) and isinstance(prior.get("memory"), Mapping) else prior
    memory = HuntMemory.from_mapping(memory_raw if isinstance(memory_raw, Mapping) else None)
    report = run_hunt(iterations=args.iterations, seed=args.seed, memory=memory)
    destination = Path(args.report_out)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.memory_out:
        memory_path = Path(args.memory_out)
        memory_path.parent.mkdir(parents=True, exist_ok=True)
        memory_path.write_text(json.dumps(report["memory"], ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        "GUARD_UNINTENDED_ALLOW_HUNT "
        f"cases={report['iterations']} unexpected_allow={report['unexpected_allow_count']} "
        f"exceptions={report['exception_count']} pressure={report['defensive_pressure']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
