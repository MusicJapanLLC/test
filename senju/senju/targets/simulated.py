"""
senju.targets.simulated — in-process 仮想標的（完全に安全）

実ネットワーク・実ホスト・実ペイロードを一切使わない。
「脆弱なWebアプリ」を確率モデルとして表現し、攻防の駆け引きだけを抽象化する。
ref は sim:// スキームなので ScopeGuard を通しても常にラボ内に留まる。
"""
from __future__ import annotations

import random

from .base import Surface, VULN_CLASSES


class SimulatedWebApp:
    """脆弱面をランダム生成する仮想Webアプリ標的。"""

    def __init__(self, name: str, n_surfaces: int = 8, seed: int | None = None) -> None:
        self.ref = f"sim://{name}"
        self.name = name
        self._n = n_surfaces
        self._rng = random.Random(seed)
        self._surfaces: list[Surface] = []
        self.reset()

    def reset(self) -> None:
        rng = self._rng
        self._surfaces = []
        for i in range(self._n):
            vuln = rng.choice(VULN_CLASSES)
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
