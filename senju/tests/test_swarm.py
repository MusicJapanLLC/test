"""senju.swarm のユニットテスト。"""
from __future__ import annotations

import random

import pytest

from senju.swarm import Swarm, SwarmAgent


def test_initial_size():
    s = Swarm(initial_size=10, rng=random.Random(0))
    assert len(s.agents) == 10


def test_agent_elo_update_win():
    a = SwarmAgent(agent_id=0, seed=1)
    a.update_elo(won=True, opponent_elo=1000.0)
    assert a.elo > 1000.0
    assert a.wins == 1
    assert a.losses == 0


def test_agent_elo_update_loss():
    a = SwarmAgent(agent_id=0, seed=1)
    a.update_elo(won=False, opponent_elo=1000.0)
    assert a.elo < 1000.0
    assert a.losses == 1


def test_should_replicate():
    a = SwarmAgent(agent_id=0, seed=1, elo=1200.0, wins=5, losses=0)
    assert a.should_replicate()


def test_should_not_replicate_low_games():
    a = SwarmAgent(agent_id=0, seed=1, elo=1200.0, wins=1, losses=0)
    assert not a.should_replicate()


def test_should_retire():
    a = SwarmAgent(agent_id=0, seed=1, elo=800.0, wins=0, losses=5)
    assert a.should_retire()


def test_evolve_grows_swarm():
    rng = random.Random(42)
    s = Swarm(initial_size=5, rng=rng, autonomous_growth=True)
    result = s.evolve()
    assert result["new_children"] > 0
    assert len(s.agents) > 5


def test_evolve_retires_low_elo():
    rng = random.Random(0)
    s = Swarm(initial_size=5, rng=rng)
    for a in s.agents[:3]:
        a.elo = 800.0
        a.losses = 5
    result = s.evolve()
    assert result["retired"] == 3


def test_top_k():
    s = Swarm(initial_size=10, rng=random.Random(1))
    s.agents[0].elo = 1500.0
    top = s.top_k(1)
    assert top[0].elo == 1500.0


def test_summary_keys():
    s = Swarm(initial_size=3, rng=random.Random(7))
    summary = s.summary()
    for key in ("generation", "size", "elo_mean", "elo_max", "elo_min", "top3_ids"):
        assert key in summary


def test_max_size_cap():
    rng = random.Random(99)
    s = Swarm(initial_size=5, rng=rng)
    for a in s.agents:
        a.elo = 1500.0
        a.wins = 10
    for _ in range(20):
        s.evolve()
    assert len(s.agents) <= Swarm.MAX_SIZE
