"""アリーナと進化ループの健全性テスト。"""
from senju.agents.base import Agent, RedGenome, BlueGenome
from senju.arena import run_match
from senju.config import ArenaConfig, EvolutionConfig, SenjuConfig
from senju.safety import ScopeGuard, default_lab_policy
from senju.targets.simulated import SimulatedWebApp
from senju.tournament import Tournament
import random


def test_match_runs_and_produces_scores():
    rng = random.Random(1)
    red = Agent(genome=RedGenome.random(rng), side="red")
    blue = Agent(genome=BlueGenome.random(rng), side="blue")
    target = SimulatedWebApp("t", seed=1)
    guard = ScopeGuard(default_lab_policy())
    result = run_match(red, blue, target, guard, ArenaConfig(seed=1))
    assert result.red_score >= 0
    assert result.blue_score >= 0
    assert result.winner in ("red", "blue", "draw")


def test_tournament_is_deterministic_with_seed():
    cfg = SenjuConfig(
        evolution=EvolutionConfig(population_size=8, generations=3, matches_per_generation=20, seed=7),
        arena=ArenaConfig(seed=7),
    )
    r1 = Tournament(cfg).run()
    r2 = Tournament(cfg).run()
    assert [g.red_top_rating for g in r1.generations] == [g.red_top_rating for g in r2.generations]


def test_tournament_never_leaves_scope():
    cfg = SenjuConfig(
        evolution=EvolutionConfig(population_size=8, generations=2, matches_per_generation=20, seed=3),
    )
    report = Tournament(cfg).run()
    assert report.scope_violations == []


def test_population_evolves_ratings():
    cfg = SenjuConfig(
        evolution=EvolutionConfig(population_size=12, generations=5, matches_per_generation=40, seed=5),
    )
    report = Tournament(cfg).run()
    first, last = report.generations[0], report.generations[-1]
    # 少なくとも一方の陣営の最高レートは初期より上がっているはず（学習の証拠）。
    assert (last.red_top_rating > first.red_top_rating) or (last.blue_top_rating > first.blue_top_rating)
