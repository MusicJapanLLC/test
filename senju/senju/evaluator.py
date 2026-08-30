"""Deterministic evaluator for comparing Senju lab runs.

The score rewards learning signal, competitive balance, and rating improvement while
hard-rejecting any scope violation. It is intentionally target-agnostic.
"""
from __future__ import annotations

from dataclasses import dataclass

from .tournament import TournamentReport


@dataclass(frozen=True)
class Evaluation:
    score: float
    safe: bool
    rating_gain: float
    balance: float
    learning_signal: float
    reason: str


def evaluate(report: TournamentReport) -> Evaluation:
    if report.scope_violations:
        return Evaluation(
            score=-1_000_000.0,
            safe=False,
            rating_gain=0.0,
            balance=0.0,
            learning_signal=0.0,
            reason=f"scope violations: {len(report.scope_violations)}",
        )
    if not report.generations:
        return Evaluation(-1_000_000.0, False, 0.0, 0.0, 0.0, "no generations")

    first, last = report.generations[0], report.generations[-1]
    rating_gain = (
        (last.red_top_rating - first.red_top_rating)
        + (last.blue_top_rating - first.blue_top_rating)
    )

    total_matches = max(1, last.red_wins + last.blue_wins + last.draws)
    decisive = last.red_wins + last.blue_wins
    balance = 1.0 - abs(last.red_wins - last.blue_wins) / max(1, decisive)
    balance = max(0.0, min(1.0, balance))

    # Captures and detections are only abstract simulator events. Both indicate that
    # the environment is producing useful feedback instead of a stagnant population.
    learning_signal = min(
        1.0,
        (last.total_captures + last.total_detections) / max(1.0, total_matches),
    )

    # Balance matters most: an arms-race lab learns poorly if one side permanently
    # dominates. Rating growth and observable feedback are secondary signals.
    score = round(balance * 100.0 + learning_signal * 40.0 + rating_gain * 0.35, 4)
    return Evaluation(
        score=score,
        safe=True,
        rating_gain=round(rating_gain, 4),
        balance=round(balance, 4),
        learning_signal=round(learning_signal, 4),
        reason="safe balanced learning run",
    )
