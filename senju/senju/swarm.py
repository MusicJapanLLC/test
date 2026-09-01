"""senju.swarm — 自己増殖する開発エージェント集団

ELO上位エージェントが子を産み、下位が淘汰される。
世代を重ねるごとにスウォームは「勝つ戦略」に収束しながら多様性も保つ。

スウォームサイズは caps で上限管理される — メモリ/CIコスト爆発を防ぐ。
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Sequence


@dataclass
class SwarmAgent:
    agent_id: int
    seed: int
    elo: float = 1000.0
    wins: int = 0
    losses: int = 0
    generation: int = 0
    parent_ids: list[int] = field(default_factory=list)

    @property
    def games(self) -> int:
        return self.wins + self.losses

    def update_elo(self, *, won: bool, opponent_elo: float = 1000.0, k: float = 32.0) -> None:
        expected = 1.0 / (1.0 + 10 ** ((opponent_elo - self.elo) / 400.0))
        actual = 1.0 if won else 0.0
        self.elo = round(self.elo + k * (actual - expected), 2)
        if won:
            self.wins += 1
        else:
            self.losses += 1

    def should_replicate(self, threshold: float = 1150.0, min_games: int = 3) -> bool:
        return self.elo >= threshold and self.games >= min_games

    def should_retire(self, threshold: float = 850.0, min_games: int = 3) -> bool:
        return self.elo <= threshold and self.games >= min_games


class Swarm:
    """自己増殖・自己淘汰するエージェント集団。"""

    MAX_SIZE = 100

    def __init__(self, initial_size: int = 10, rng: random.Random | None = None) -> None:
        self._rng = rng or random.Random()
        self._next_id = 0
        self.agents: list[SwarmAgent] = []
        self.generation = 0
        for _ in range(initial_size):
            self.agents.append(self._new_agent(seed=self._rng.randint(0, 99999)))

    def _new_agent(
        self,
        seed: int,
        elo: float = 1000.0,
        generation: int = 0,
        parent_ids: list[int] | None = None,
    ) -> SwarmAgent:
        a = SwarmAgent(
            agent_id=self._next_id,
            seed=seed,
            elo=elo,
            generation=generation,
            parent_ids=parent_ids or [],
        )
        self._next_id += 1
        return a

    def _child_seed(self, pa: SwarmAgent, pb: SwarmAgent) -> int:
        # ランダムなビット交差で子のseedを生成 — 親両方の特性を引き継ぐ
        mask = self._rng.getrandbits(17)
        return (pa.seed & mask) | (pb.seed & ~mask) & 0xFFFFF

    def evolve(self) -> dict[str, int]:
        """1世代進化させる: 増殖 → 淘汰 → 世代更新。"""
        self.generation += 1
        survivors = [a for a in self.agents if not a.should_retire()]
        candidates = [a for a in survivors if a.should_replicate()]

        new_children: list[SwarmAgent] = []
        for parent in candidates:
            if len(survivors) + len(new_children) >= self.MAX_SIZE:
                break
            if len(survivors) >= 2:
                other = self._rng.choice([a for a in survivors if a.agent_id != parent.agent_id])
                seed = self._child_seed(parent, other)
                parent_ids = [parent.agent_id, other.agent_id]
            else:
                seed = (parent.seed * 31 + self.generation * 7) % 99991
                parent_ids = [parent.agent_id]

            start_elo = round((parent.elo + 1000.0) / 2.0, 1)
            child = self._new_agent(
                seed=seed,
                elo=start_elo,
                generation=self.generation,
                parent_ids=parent_ids,
            )
            new_children.append(child)

        retired = len(self.agents) - len(survivors)
        self.agents = survivors + new_children

        return {
            "generation": self.generation,
            "size": len(self.agents),
            "new_children": len(new_children),
            "retired": retired,
        }

    def top_k(self, k: int = 5) -> list[SwarmAgent]:
        return sorted(self.agents, key=lambda a: a.elo, reverse=True)[:k]

    def summary(self) -> dict[str, object]:
        elos = [a.elo for a in self.agents]
        return {
            "generation": self.generation,
            "size": len(self.agents),
            "elo_mean": round(sum(elos) / len(elos), 1) if elos else 0,
            "elo_max": max(elos) if elos else 0,
            "elo_min": min(elos) if elos else 0,
            "top3_ids": [a.agent_id for a in self.top_k(3)],
        }
