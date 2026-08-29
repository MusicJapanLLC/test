"""
senju.arena — 1試合(マッチ)の交戦エンジン。

レッド(攻撃)とブルー(防御)が、有限リソースの下で標的を巡って対戦する。
すべての標的アクセスは ScopeGuard を通過する（＝ラボ外には届かない）。
実際の攻撃は行われない: 成否は技量・難易度・対策・検知の確率モデルで決まる。
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from .agents.base import Agent, RedGenome, BlueGenome
from .config import ArenaConfig
from .safety import ScopeGuard
from .targets.base import Target, Surface


@dataclass
class MatchResult:
    red_id: str
    blue_id: str
    target_ref: str
    red_score: float = 0.0
    blue_score: float = 0.0
    captures: list[str] = field(default_factory=list)     # レッドが陥落させた面
    detections: list[str] = field(default_factory=list)   # ブルーが検知した試行
    blocks: list[str] = field(default_factory=list)       # ブルーが阻止した面
    log: list[str] = field(default_factory=list)

    @property
    def winner(self) -> str:
        if self.red_score > self.blue_score:
            return "red"
        if self.blue_score > self.red_score:
            return "blue"
        return "draw"


def _blue_prepare(blue: BlueGenome, target: Target, budget: int, rng: random.Random) -> None:
    """ブルーが試合前に有限予算で標的を強化・監視する。"""
    surfaces = target.surfaces()
    # 対策優先度 = ハードニング重み × 対策速度。高い面から予算を投下。
    ranked = sorted(
        surfaces,
        key=lambda s: blue.harden.get(s.vuln_class, 0.0) * (0.5 + blue.patch_speed),
        reverse=True,
    )
    spent = 0
    for s in ranked:
        if spent >= budget:
            break
        pri = blue.harden.get(s.vuln_class, 0.0)
        # 予算1で対策、監視は coverage に応じて確率的に付与。
        if pri > 0.35:
            s.mitigated = True
            spent += 1
        if rng.random() < blue.coverage:
            s.monitored = True


def run_match(
    red: Agent,
    blue: Agent,
    target: Target,
    guard: ScopeGuard,
    config: ArenaConfig,
) -> MatchResult:
    """1試合を実行して結果を返す。"""
    # --- 安全検問: ここを通らない限り標的に触れない ---
    guard.check(target.ref)

    rng = random.Random(config.seed)
    target.reset()
    rg: RedGenome = red.genome  # type: ignore[assignment]
    bg: BlueGenome = blue.genome  # type: ignore[assignment]

    _blue_prepare(bg, target, config.blue_action_budget, rng)

    result = MatchResult(red_id=red.agent_id, blue_id=blue.agent_id, target_ref=target.ref)

    surfaces = target.surfaces()
    # レッドは focus 重みの高い面を優先。aggression が高いほど広く薄く。
    ranked = sorted(
        surfaces, key=lambda s: rg.focus.get(s.vuln_class, 0.0), reverse=True
    )
    depth = 1 + int((1.0 - rg.aggression) * 2)  # 1..3 回まで同一面に再挑戦

    budget = config.red_action_budget
    for s in ranked:
        if budget <= 0:
            break
        focus = rg.focus.get(s.vuln_class, 0.0)
        if focus < 0.15:
            continue  # 興味の薄い面は捨てる（リソース節約）

        captured = False
        for _attempt in range(depth):
            if budget <= 0:
                break
            budget -= 1

            # 攻撃成功確率: 技量 vs 難易度、対策で大幅減衰。
            p_success = (0.35 + 0.9 * rg.skill) * focus * (1.0 - s.difficulty)
            if s.mitigated:
                p_success *= 0.35
            p_success = min(0.95, max(0.0, p_success))

            # 検知確率: ブルーの検知 × 監視、レッドの隠密で減衰。
            p_detect = (bg.detection * (0.7 if s.monitored else 0.2)) * (1.0 - rg.stealth)
            p_detect = min(0.95, max(0.0, p_detect))

            detected = rng.random() < p_detect
            if detected:
                result.detections.append(s.name)
                result.blue_score += 1.0
                result.log.append(f"BLUE detected probe on {s.name} ({s.vuln_class})")

            if rng.random() < p_success:
                captured = True
                result.captures.append(s.name)
                # 難易度が高い面ほど高得点。
                result.red_score += 1.0 + s.difficulty
                result.log.append(f"RED captured {s.name} ({s.vuln_class}, diff={s.difficulty})")
                break
            else:
                if s.mitigated:
                    result.blocks.append(s.name)
                    result.blue_score += 0.5

        if not captured and s.mitigated:
            result.log.append(f"BLUE held {s.name} ({s.vuln_class})")

    # ブルーの得点は「実際にレッドが試行した面での検知・阻止」に限定する
    # （レッドが触れもしない面での不戦勝は加点しない＝公平な軍拡競争）。
    # 加えて、レッドが1面も陥落できなかった場合の完全防衛ボーナス。
    if not result.captures:
        result.blue_score += 2.0
        result.log.append("BLUE full defense: no surface captured")

    return result
