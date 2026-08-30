"""Live adversary loop for Senju guard codepaths.

This runner exercises the actual imported guard implementations repeatedly.
It does not clone/reimplement guard logic, disable controls, mutate production
policy files, or perform live outbound contact. The goal is to surface crashes,
exceptions, invariant breaks, and regressions under continuously varied inputs.
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
from .safety import ScopeGuard, default_lab_policy


@dataclass(frozen=True)
class RoundResult:
    round_index: int
    seed: int
    started_at_utc: str
    completed_at_utc: str
    checks: int
    weaknesses: int
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
        crashed = False
        detail = ""
        try:
            report = run_v2(repo_root, scope_cases=max(0, scope_cases), seed=round_seed)
            payload = report.to_dict()
            summary = payload["summary"]
            checks = int(summary["checks"])
            weaknesses = int(summary["weaknesses"])
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
                crashed=crashed,
                crash_detail=detail,
            )
        )
        if delay_seconds > 0 and index + 1 < rounds:
            time.sleep(min(max(delay_seconds, 0.0), 60.0))
    return LiveReport("senju-live-guard-adversary/v1", tuple(results))


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Continuously pressure active Senju guard codepaths")
    parser.add_argument("--rounds", type=int, default=8)
    parser.add_argument("--scope-cases", type=int, default=1024)
    parser.add_argument("--seed", type=int, default=31001)
    parser.add_argument("--delay-seconds", type=float, default=0.0)
    parser.add_argument("--json", dest="output", type=Path)
    parser.add_argument("--fail-on-crash", action="store_true")
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
    crashes = int(payload["summary"]["crashes"])
    return 1 if args.fail_on_crash and crashes else 0


if __name__ == "__main__":
    raise SystemExit(main())
