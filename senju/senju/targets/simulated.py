"""
senju.targets.simulated — in-process 仮想標的（完全に安全）

実ネットワーク・実ホスト・実ペイロードを一切使わない。
アーキタイプに応じて脆弱性クラスの分布を変え、攻防の駆け引きだけを抽象化する。
ref は sim:// スキームなので ScopeGuard を通しても常にラボ内に留まる。
"""
from __future__ import annotations

import random

from .base import ARCHETYPES, Surface, VULN_CLASSES, archetype_weight


class SimulatedTarget:
    """脆弱面をアーキタイプ重みでランダム生成する仮想標的。"""

    def __init__(
        self,
        name: str,
        archetype: str = "web_app",
        n_surfaces: int = 8,
        seed: int | None = None,
    ) -> None:
        self.ref = f"sim://{name}"
        self.name = name
        self.archetype = archetype if archetype in ARCHETYPES else "web_app"
        self._n = n_surfaces
        self._rng = random.Random(seed)
        self._surfaces: list[Surface] = []
        self.reset()

    def _pick_vuln(self) -> str:
        weights = [archetype_weight(self.archetype, v) for v in VULN_CLASSES]
        return self._rng.choices(VULN_CLASSES, weights=weights, k=1)[0]

    def reset(self) -> None:
        rng = self._rng
        self._surfaces = []
        for i in range(self._n):
            vuln = self._pick_vuln()
            self._surfaces.append(
                Surface(
                    name=f"{self.name}:ep{i}",
                    vuln_class=vuln,
                    difficulty=round(rng.uniform(0.2, 0.95), 3),
                    mitigated=False,
                    monitored=False,
                )
            )

    def surfaces(self) -> list[Surface]:
        return self._surfaces


# 後方互換のエイリアス（旧名）。
SimulatedWebApp = SimulatedTarget
