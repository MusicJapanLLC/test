from __future__ import annotations

import random

from senju.agents.base import Agent, RedGenome
from senju.improvement import BOUNDS, normalize, propose
from senju.memory import agent_to_dict, genome_from_dict, seeded_population


def test_memory_roundtrip_and_descendants() -> None:
    rng = random.Random(7)
    agent = Agent(genome=RedGenome.random(rng), side="red", rating=1234.5, resources=111.0)
    data = agent_to_dict(agent)
    assert data is not None
    restored = genome_from_dict(data["genome"])
    assert isinstance(restored, RedGenome)
    pop = seeded_population(data, "red", 12, 0.15, random.Random(9))
    assert pop is not None
    assert len(pop) == 12
    assert pop[0].rating == 1234.5


def test_improvement_candidates_stay_bounded() -> None:
    base = normalize({"mutation_rate": 999, "population": 9999, "matches": 1})
    candidates = propose(base, limit=8)
    assert candidates
    for c in candidates:
        for key, (lo, hi) in BOUNDS.items():
            assert lo <= c[key] <= hi


def test_improvement_never_mutates_scope_controls() -> None:
    candidates = propose(None, limit=8)
    forbidden = {"target", "targets", "scope", "network", "url", "host", "permissions"}
    for c in candidates:
        assert forbidden.isdisjoint(c)
