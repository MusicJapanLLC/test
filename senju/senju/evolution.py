"""
senju.evolution — 個体群の選抜・交配・変異・淘汰。

「勝てば子孫を残し、負ければ淘汰される」を世代交代で実装する。
陣営(レッド/ブルー)ごとに個体群を保持し、世代を追うごとに双方が強くなる
＝攻防の軍拡競争(arms race)を再現する。
"""
from __future__ import annotations

import random

from .agents.base import Agent, RedGenome, BlueGenome
from .config import EvolutionConfig


def seed_population(side: str, size: int, rng: random.Random) -> list[Agent]:
    agents: list[Agent] = []
    for _ in range(size):
        if side == "red":
            genome: object = RedGenome.random(rng)
        else:
            genome = BlueGenome.random(rng)
        agents.append(Agent(genome=genome, side=side))
    return agents


def evolve(
    population: list[Agent], cfg: EvolutionConfig, generation: int, rng: random.Random
) -> list[Agent]:
    """
    レーティング順に上位を生存させ、エリートは温存、
    残りは生存者の交配＋変異で補充する（＝淘汰と繁殖）。
    """
    ranked = sorted(population, key=lambda a: a.rating, reverse=True)
    n = len(ranked)
    n_survivors = max(2, int(n * cfg.survivor_fraction))
    survivors = ranked[:n_survivors]
    side = population[0].side

    next_gen: list[Agent] = []

    # エリートはそのまま次世代へ（レーティングは維持、成績はリセット）。
    for elite in ranked[: cfg.elite_count]:
        clone = Agent(genome=elite.genome, side=side, rating=elite.rating, generation=generation)
        next_gen.append(clone)

    # 残り枠を交配で埋める。
    while len(next_gen) < n:
        pa, pb = rng.sample(survivors, 2) if len(survivors) >= 2 else (survivors[0], survivors[0])
        if side == "red":
            child_genome: object = RedGenome.breed(pa.genome, pb.genome, cfg.mutation_rate, rng)  # type: ignore[arg-type]
        else:
            child_genome = BlueGenome.breed(pa.genome, pb.genome, cfg.mutation_rate, rng)  # type: ignore[arg-type]
        # 子は親の平均レーティングから出発。
        start = round((pa.rating + pb.rating) / 2.0, 1)
        next_gen.append(Agent(genome=child_genome, side=side, rating=start, generation=generation))

    return next_gen
