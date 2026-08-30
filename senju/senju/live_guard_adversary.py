"""Live adversary loop for Senju guard codepaths.

Each round pressures the actual imported guard implementations and the actual
repository policy/workflow source files. Adversarial inputs are synthetic, but
the acceptance/rejection paths under test are the real Senju implementations.
No live outbound contact is performed and controls are never disabled.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from .defense_adversary_team_v2 import run_v2
from .external import ExternalContactError, ExternalContactPolicy, _parse_url
from .multiguard_adversary import (
    TARGETS as MULTIGUARD_TARGETS,
    build_campaign as build_multiguard_campaign,
    run_campaign as run_multiguard_campaign,
)
from .safety import ScopeGuard, default_lab_policy


@dataclass(frozen=True)
class RoundResult:
    round_index: int
    seed: int
    started_at_utc: str
    completed_at_utc: str
    checks: int
    weaknesses: int
    multiguard_checks: int
    multiguard_surprises: int
    targets_checked: tuple[str, ...]
    crashed: bool
    crash_detail: str = ""


@dataclass(frozen=True)
class LiveReport:
    schema: str
    rounds: tuple[RoundResult, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "schema": self.schema,
            "summary": {
                "rounds": len(self.rounds),
                "checks": sum(r.checks for r in self.rounds),
                "weaknesses": sum(r.weaknesses for r in self.rounds),
                "multiguard_checks": sum(r.multiguard_checks for r in self.rounds),
                "multiguard_surprises": sum(r.multiguard_surprises for r in self.rounds),
                "targets_checked": list(MULTIGUARD_TARGETS),
                "crashes": sum(1 for r in self.rounds if r.crashed),
            },
            "rounds": [asdict(r) for r in self.rounds],
        }


def _utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _liveness_probe() -> None:
    """Verify active guard codepaths remain callable after an adversary round."""
    guard = ScopeGuard(default_lab_policy())
    guard.check("sim://live-adversary-liveness")

    policy = ExternalContactPolicy.from_hosts(["example.com"], allow_http=False)
    host, port = _parse_url("https://example.com/", policy)
    if host != "example.com" or port != 443:
        raise RuntimeError(f"unexpected external parser result: {(host, port)!r}")
    try:
        _parse_url("https://example.com.invalid/", policy)
    except ExternalContactError:
        pass
    else:
        raise RuntimeError("host-lookalike unexpectedly accepted")


def run_live_loop(
    *,
    repo_root: Path | None = None,
    rounds: int = 8,
    scope_cases: int = 1024,
    seed: int = 31001,
    delay_seconds: float = 0.0,
) -> LiveReport:
    results: list[RoundResult] = []
    for index in range(max(1, rounds)):
        started = _utcnow()
        round_seed = seed + index * 7919
        checks = 0
        weaknesses = 0
        multiguard_checks = 0
        multiguard_surprises = 0
        crashed = False
        detail = ""
        try:
            randomized = run_v2(repo_root, scope_cases=max(0, scope_cases), seed=round_seed)
            randomized_payload = randomized.to_dict()
            randomized_summary = randomized_payload["summary"]
            checks = int(randomized_summary["checks"])
            weaknesses = int(randomized_summary["weaknesses"])

            multiguard = run_multiguard_campaign(build_multiguard_campaign())
            multiguard_payload = multiguard.to_dict()
            multiguard_checks = int(multiguard_payload["total"])
            multiguard_surprises = int(multiguard_payload["surprising_count"])

            _liveness_probe()
        except Exception as exc:  # noqa: BLE001 - crash telemetry is the point
            crashed = True
            detail = f"{type(exc).__name__}: {exc}"
        results.append(
            RoundResult(
                round_index=index + 1,
                seed=round_seed,
                started_at_utc=started,
                completed_at_utc=_utcnow(),
                checks=checks,
                weaknesses=weaknesses,
                multiguard_checks=multiguard_checks,
                multiguard_surprises=multiguard_surprises,
                targets_checked=tuple(MULTIGUARD_TARGETS),
                crashed=crashed,
                crash_detail=detail,
            )
        )
        if delay_seconds > 0 and index + 1 < rounds:
            time.sleep(min(max(delay_seconds, 0.0), 60.0))
    return LiveReport("senju-live-guard-adversary/v2", tuple(results))


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Continuously pressure all active Senju guard codepaths"
    )
    parser.add_argument("--rounds", type=int, default=8)
    parser.add_argument("--scope-cases", type=int, default=1024)
    parser.add_argument("--seed", type=int, default=31001)
    parser.add_argument("--delay-seconds", type=float, default=0.0)
    parser.add_argument("--json", dest="output", type=Path)
    parser.add_argument("--fail-on-crash", action="store_true")
    parser.add_argument(
        "--fail-on-findings",
        action="store_true",
        help="fail when randomized weaknesses, multiguard surprises, or crashes are observed",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    report = run_live_loop(
        rounds=max(1, args.rounds),
        scope_cases=max(0, args.scope_cases),
        seed=args.seed,
        delay_seconds=args.delay_seconds,
    )
    payload = report.to_dict()
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(json.dumps(payload["summary"], ensure_ascii=False))

    summary = payload["summary"]
    crashes = int(summary["crashes"])
    findings = int(summary["weaknesses"]) + int(summary["multiguard_surprises"])
    if args.fail_on_findings and (crashes or findings):
        return 1
    if args.fail_on_crash and crashes:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
