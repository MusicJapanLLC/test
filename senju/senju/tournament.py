"""
senju.tournament — 世代を回す司令塔。

各世代で多数の対戦を実施し、レーティングを更新し、両陣営を進化させる。
標的は毎試合 ScopeGuard の検問を受けるため、ラボ外に手は届かない。
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from .agents.base import Agent
from .arena import run_match
from .config import SenjuConfig
from .evolution import evolve, seed_population
from .safety import ScopeGuard, default_lab_policy
from .scoring import apply_result
from .targets.simulated import SimulatedWebApp


@dataclass
class GenerationStats:
    generation: int
    matches: int
    red_wins: int
    blue_wins: int
    draws: int
    red_top_rating: float
    blue_top_rating: float
    red_avg_rating: float
    blue_avg_rating: float
    total_captures: int
    total_detections: int
    vuln_capture_counts: dict[str, int] = field(default_factory=dict)


@dataclass
class TournamentReport:
    scenario: str
    generations: list[GenerationStats] = field(default_factory=list)
    red_champion: Agent | None = None
    blue_champion: Agent | None = None
    scope_violations: list[str] = field(default_factory=list)


class Tournament:
    def __init__(self, config: SenjuConfig, guard: ScopeGuard | None = None) -> None:
        self.config = config
        self.guard = guard or ScopeGuard(default_lab_policy())
        seed = config.evolution.seed
        self._rng = random.Random(seed)
        self.red_pop = seed_population("red", config.evolution.population_size, self._rng)
        self.blue_pop = seed_population("blue", config.evolution.population_size, self._rng)

    def _make_target(self, idx: int) -> SimulatedWebApp:
        return SimulatedWebApp(
            name=f"{self.config.scenario_name}-{idx}",
            n_surfaces=8,
            seed=self._rng.randint(0, 10_000_000),
        )

    def run(self) -> TournamentReport:
        report = TournamentReport(scenario=self.config.scenario_name)
        ev = self.config.evolution

        for gen in range(ev.generations):
            stats = self._run_generation(gen)
            report.generations.append(stats)
            if gen < ev.generations - 1:
                self.red_pop = evolve(self.red_pop, ev, gen + 1, self._rng)
                self.blue_pop = evolve(self.blue_pop, ev, gen + 1, self._rng)

        report.red_champion = max(self.red_pop, key=lambda a: a.rating)
        report.blue_champion = max(self.blue_pop, key=lambda a: a.rating)
        report.scope_violations = self.guard.violations
        return report

    def _run_generation(self, gen: int) -> GenerationStats:
        ev = self.config.evolution
        red_wins = blue_wins = draws = 0
        total_captures = total_detections = 0
        vuln_counts: dict[str, int] = {}

        for m in range(ev.matches_per_generation):
            red = self._rng.choice(self.red_pop)
            blue = self._rng.choice(self.blue_pop)
            target = self._make_target(m)

            surfaces_by_name = {s.name: s.vuln_class for s in target.surfaces()}
            result = run_match(red, blue, target, self.guard, self.config.arena)
            apply_result(red, blue, result.winner)

            if result.winner == "red":
                red_wins += 1
            elif result.winner == "blue":
                blue_wins += 1
            else:
                draws += 1

            total_captures += len(result.captures)
            total_detections += len(result.detections)
            for cap in result.captures:
                vc = surfaces_by_name.get(cap, "?")
                vuln_counts[vc] = vuln_counts.get(vc, 0) + 1

        red_ratings = [a.rating for a in self.red_pop]
        blue_ratings = [a.rating for a in self.blue_pop]

        return GenerationStats(
            generation=gen,
            matches=ev.matches_per_generation,
            red_wins=red_wins,
            blue_wins=blue_wins,
            draws=draws,
            red_top_rating=max(red_ratings),
            blue_top_rating=max(blue_ratings),
            red_avg_rating=round(sum(red_ratings) / len(red_ratings), 1),
            blue_avg_rating=round(sum(blue_ratings) / len(blue_ratings), 1),
            total_captures=total_captures,
            total_detections=total_detections,
            vuln_capture_counts=dict(sorted(vuln_counts.items(), key=lambda kv: -kv[1])),
        )
