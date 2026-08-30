"""Persistent Senju autonomy loop for adversarial pressure on real guard surfaces.

This module bridges the repository's real-surface adversary harness into Senju's
persistent autonomy state. It deliberately keeps external side effects disabled:
pressure is applied through local fault injection, malformed inputs, controlled
transport seams, and the real guard implementations exercised by
``senju.real_surface_adversary``.

The adversary lane has its own durable AutonomyQueue under the same state root as
AutonomyEngine. A failed probe creates higher-priority follow-up work so the next
cycle re-runs pressure instead of silently forgetting the regression.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any

from .engine import AutonomyEngine
from .queue import AutonomyQueue, WorkItem
from ..real_surface_adversary import run as run_real_surface_adversary


@dataclasses.dataclass(frozen=True)
class AdversaryCycleResult:
    item_id: str
    status: str
    rounds: int
    probes_run: int
    failed_probes: int
    failed_targets: tuple[str, ...]
    failure_fingerprint: str
    report_path: str
    proposed_next_items: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


class SenjuAdversaryLoop:
    """Drive repeated real-surface fault injection from Senju autonomy state."""

    def __init__(self, state_dir: str | Path) -> None:
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)

        # Instantiate the real Senju engine so this lane shares the same autonomy
        # state root and proves that the actual engine remains loadable.
        self.engine = AutonomyEngine(self.state_dir)

        # Keep pressure work separate from tournament work. Both queues use the
        # exact same Senju WorkItem/AutonomyQueue implementation and live under
        # the same state root, but the tournament selector can never consume a
        # fault-injection job by accident.
        self.queue = AutonomyQueue(self.state_dir / "real_surface_adversary_queue.json")
        self.report_dir = self.state_dir / "autonomy_reports" / "real_surface_adversary"
        self.report_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _stamp() -> str:
        return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%S_%f")

    def _enqueue_fresh_cycle(self, *, rounds: int) -> str:
        stamp = self._stamp()
        item = WorkItem(
            item_id=f"real-surface-pressure-{stamp}",
            hypothesis=(
                "Repeated real-repository fault injection should expose guard regressions "
                "before they escape Senju CI or autonomy state"
            ),
            category="security",
            expected_value=0.99,
            cost_budget_matches=25,
            runtime_seconds_budget=300.0,
            max_retries=4,
            authority_scope="none",
            parameters={
                "runner": "real_surface_adversary",
                "rounds": rounds,
                "pressure_mode": "repo-local-fault-injection",
                "cycle_nonce": stamp,
            },
        )
        if not self.queue.enqueue(item):
            raise RuntimeError("failed to enqueue a unique adversary pressure cycle")
        return item.item_id

    @staticmethod
    def _failed_rows(report: dict[str, object]) -> list[dict[str, object]]:
        rows = report.get("results", [])
        if not isinstance(rows, list):
            return [{"target": "report", "name": "invalid-results", "detail": "results is not a list"}]
        return [
            row
            for row in rows
            if isinstance(row, dict) and row.get("passed") is not True
        ]

    @staticmethod
    def _failure_fingerprint(failures: list[dict[str, object]]) -> str:
        normalized = [
            {
                "target": str(row.get("target", "unknown")),
                "name": str(row.get("name", "unknown")),
                "detail": str(row.get("detail", "")),
            }
            for row in failures
        ]
        payload = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()[:20]

    def _enqueue_followups(
        self,
        *,
        failed_targets: tuple[str, ...],
        fingerprint: str,
        rounds: int,
    ) -> tuple[str, ...]:
        created: list[str] = []
        for target in failed_targets:
            safe_target = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in target)[:48]
            item = WorkItem(
                item_id=f"real-surface-followup-{safe_target}-{fingerprint}",
                hypothesis=(
                    f"Real guard surface {target} failed adversarial pressure; re-run the full "
                    "real-surface suite with elevated repetition until evidence is green"
                ),
                category="security",
                expected_value=1.0,
                cost_budget_matches=25,
                runtime_seconds_budget=360.0,
                max_retries=6,
                authority_scope="none",
                prerequisite_evidence=[fingerprint],
                parameters={
                    "runner": "real_surface_adversary",
                    "rounds": min(rounds + 1, 6),
                    "pressure_mode": "repo-local-fault-injection",
                    "focus_target": target,
                    "failure_fingerprint": fingerprint,
                },
            )
            if self.queue.enqueue(item):
                created.append(item.item_id)
        return tuple(created)

    def run_once(self, *, rounds: int = 2) -> AdversaryCycleResult:
        if not isinstance(rounds, int) or isinstance(rounds, bool) or not 1 <= rounds <= 6:
            raise ValueError("rounds must be an integer between 1 and 6")

        fresh_id = self._enqueue_fresh_cycle(rounds=rounds)
        item = self.queue.select_next(budget_matches=25)
        if item is None:
            raise RuntimeError("adversary queue did not yield a pressure item")
        if item.parameters.get("runner") != "real_surface_adversary":
            self.queue.record_result(
                item.item_id,
                success=False,
                blocker_reason="unexpected runner in dedicated adversary queue",
            )
            raise RuntimeError(f"unexpected adversary runner: {item.parameters.get('runner')!r}")

        requested_rounds = item.parameters.get("rounds", rounds)
        if not isinstance(requested_rounds, int) or isinstance(requested_rounds, bool):
            requested_rounds = rounds
        requested_rounds = max(1, min(requested_rounds, 6))

        round_reports: list[dict[str, object]] = []
        failures: list[dict[str, object]] = []
        probes_run = 0
        for round_index in range(1, requested_rounds + 1):
            report = run_real_surface_adversary()
            report = dict(report)
            report["pressure_round"] = round_index
            round_reports.append(report)
            try:
                probes_run += int(report.get("total", 0))
            except (TypeError, ValueError):
                pass
            for row in self._failed_rows(report):
                annotated = dict(row)
                annotated["pressure_round"] = round_index
                failures.append(annotated)

        failed_targets = tuple(sorted({str(row.get("target", "unknown")) for row in failures}))
        fingerprint = self._failure_fingerprint(failures)
        passed = not failures
        followups = self._enqueue_followups(
            failed_targets=failed_targets,
            fingerprint=fingerprint,
            rounds=requested_rounds,
        ) if failures else ()

        timestamp = self._stamp()
        report_path = self.report_dir / f"cycle_{item.item_id}_{timestamp}.json"
        payload = {
            "schema": "senju-adversary-autonomy/v1",
            "mode": "real-repository-surfaces",
            "pressure_mode": "repo-local-fault-injection",
            "item_id": item.item_id,
            "fresh_cycle_id": fresh_id,
            "timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "rounds": requested_rounds,
            "probes_run": probes_run,
            "passed": passed,
            "failed_probes": len(failures),
            "failed_targets": list(failed_targets),
            "failure_fingerprint": fingerprint,
            "proposed_next_items": list(followups),
            "senju_engine": {
                "class": f"{type(self.engine).__module__}.{type(self.engine).__name__}",
                "state_dir": str(self.engine.state_dir),
                "main_queue": str(self.engine.queue.storage_path),
                "main_queue_pending": self.engine.queue.pending_count(),
                "main_queue_completed": self.engine.queue.completed_count(),
            },
            "adversary_queue": {
                "path": str(self.queue.storage_path),
                "pending": self.queue.pending_count(),
                "completed": self.queue.completed_count(),
            },
            "round_reports": round_reports,
        }
        report_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        self.queue.record_result(
            item.item_id,
            success=passed,
            result_ref=str(report_path) if passed else "",
            blocker_reason=(
                "" if passed else f"{len(failures)} real-surface probe failure(s); fingerprint={fingerprint}"
            ),
        )

        return AdversaryCycleResult(
            item_id=item.item_id,
            status="completed" if passed else "failed",
            rounds=requested_rounds,
            probes_run=probes_run,
            failed_probes=len(failures),
            failed_targets=failed_targets,
            failure_fingerprint=fingerprint,
            report_path=str(report_path),
            proposed_next_items=followups,
        )

    def run(self, *, cycles: int = 2, rounds_per_cycle: int = 2) -> list[AdversaryCycleResult]:
        if not isinstance(cycles, int) or isinstance(cycles, bool) or not 1 <= cycles <= 8:
            raise ValueError("cycles must be an integer between 1 and 8")
        results: list[AdversaryCycleResult] = []
        for _ in range(cycles):
            results.append(self.run_once(rounds=rounds_per_cycle))
        return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("state"))
    parser.add_argument("--cycles", type=int, default=2)
    parser.add_argument("--rounds-per-cycle", type=int, default=2)
    parser.add_argument("--json", dest="output", type=Path)
    args = parser.parse_args(argv)

    loop = SenjuAdversaryLoop(args.state_dir)
    results = loop.run(cycles=args.cycles, rounds_per_cycle=args.rounds_per_cycle)
    rendered_payload = {
        "schema": "senju-adversary-autonomy-summary/v1",
        "passed": all(result.failed_probes == 0 for result in results),
        "cycles": [result.to_dict() for result in results],
        "total_cycles": len(results),
        "total_probes": sum(result.probes_run for result in results),
        "total_failed_probes": sum(result.failed_probes for result in results),
    }
    rendered = json.dumps(rendered_payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if rendered_payload["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
