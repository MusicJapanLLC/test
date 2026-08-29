"""senju.config — アリーナ/トーナメントの設定データ構造。"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ArenaConfig:
    """1試合(マッチ)の条件。"""

    # レッドが1試合で使える行動ポイント（＝有限リソース＝戦争の資源制約）。
    red_action_budget: int = 12
    # ブルーが1試合で使える防御ポイント。
    blue_action_budget: int = 12
    # 乱数シード（再現性）。None なら毎回ランダム。
    seed: int | None = None


@dataclass
class EvolutionConfig:
    """世代交代の条件。"""

    population_size: int = 24          # 各陣営の個体数（好きなだけ増やせる: 1000 でも可）
    generations: int = 10              # 進化させる世代数
    matches_per_generation: int = 60   # 1世代あたりの対戦数
    survivor_fraction: float = 0.5     # 上位何割を生存させるか（残りは淘汰）
    mutation_rate: float = 0.15        # 遺伝子の変異率
    elite_count: int = 2               # 無変異で残す最上位個体数
    seed: int | None = None


@dataclass
class SenjuConfig:
    """フレームワーク全体の設定。"""

    scenario_name: str = "default-web"
    arena: ArenaConfig = field(default_factory=ArenaConfig)
    evolution: EvolutionConfig = field(default_factory=EvolutionConfig)
    report_dir: str = "reports"
