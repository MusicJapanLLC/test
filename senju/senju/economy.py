"""
senju.economy — 極端な戦争経済（有限リソース・略奪・破産即死・繁殖コスト・飢餓）

思想: 「勝てば報酬、負ければ罰」を最後まで突き詰める。
- リソースは生存通貨。総量は有限（世界に固定量しか存在しない＝戦争）。
- 対戦は掛け金(ante)を賭ける。勝者は敗者の掛け金＋残資産の一部を略奪する。
- リソースが尽きた個体はその場で破産＝死（世代末を待たず淘汰）。
- 繁殖にはコストがかかる。富める者だけが子を残せる。
- 毎世代の維持費(upkeep)を払えなければ飢餓で死ぬ。
"""
from __future__ import annotations

from dataclasses import dataclass

from .agents.base import Agent


@dataclass
class EconomyConfig:
    """戦争経済のパラメータ。極端さはここで調整する。"""

    starting_resources: float = 100.0   # 初期資産
    total_pool_cap: float | None = None # 世界の総資源上限（None=個体数×初期資産）
    ante: float = 8.0                   # 1対戦の掛け金
    loot_fraction: float = 0.25         # 勝者が敗者の残資産から奪う割合（略奪）
    action_cost: float = 2.0            # 行動1ポイントのコスト（貧すれば戦えない）
    upkeep: float = 6.0                 # 毎世代の維持費（飢餓の圧力）
    reproduction_cost: float = 40.0     # 繁殖1体あたりの親の負担
    bankruptcy_threshold: float = 1.0   # これ以下で破産＝死
    draw_tax: float = 1.0               # 引き分け時に双方が失う額（消耗戦）
    reinforcement_ratio: float = 0.75   # 毎世代、維持費で失われた資源のうち補給として
                                        # 勝ち残りの富裕層に還元する割合（<1で純減＝希少化）
    reinforcement_top_k: int = 4        # 補給を分け合う上位個体数

    @staticmethod
    def extreme() -> "EconomyConfig":
        """さらに苛烈なプリセット（略奪多め・維持費高め・破産しやすい）。"""
        return EconomyConfig(
            starting_resources=100.0,
            ante=14.0,
            loot_fraction=0.5,
            action_cost=3.0,
            upkeep=12.0,
            reproduction_cost=60.0,
            bankruptcy_threshold=3.0,
            draw_tax=3.0,
            reinforcement_ratio=0.45,
            reinforcement_top_k=3,
        )


def fund_action_budget(agent: Agent, base_budget: int, cfg: EconomyConfig) -> int:
    """資産で賄える行動ポイント数を返す（貧困は戦力に直結）。"""
    if cfg.action_cost <= 0:
        return base_budget
    affordable = int(agent.resources // cfg.action_cost)
    return max(0, min(base_budget, affordable))


def score_match(red: Agent, blue: Agent, winner: str, red_margin: float, blue_margin: float) -> None:
    """
    対戦の戦果を各個体の当世代スコアに加算する（陣営間で資源は移動しない）。
    勝利=大きな戦果、僅差の善戦にも小さな戦果。この戦果が世代末の「食料」配分を決める。
    """
    if winner == "red":
        red.gen_score += 1.0 + 0.2 * red_margin
    elif winner == "blue":
        blue.gen_score += 1.0 + 0.2 * blue_margin
    else:
        red.gen_score += 0.25
        blue.gen_score += 0.25


def feed_population(population: list[Agent], food: float, cfg: EconomyConfig) -> float:
    """
    限定食料(food)を、当世代の戦果に比例して生存個体へ配分する。
    戦果ゼロの個体は食料を得られず、維持費で飢える＝敗者は淘汰される。
    陣営内での有限資源の奪い合い（＝内戦的な淘汰圧）。実際に配った量を返す。
    """
    if food <= 0:
        return 0.0
    alive = [a for a in population if a.alive]
    scored = [a for a in alive if a.gen_score > 0]
    total = sum(a.gen_score for a in scored)
    if total <= 0:
        return 0.0
    if cfg.total_pool_cap is not None:
        headroom = max(0.0, (cfg.total_pool_cap / 2.0) - total_resources(population))
        food = min(food, headroom)
    if food <= 0:
        return 0.0
    given = 0.0
    for a in scored:
        share = food * (a.gen_score / total)
        a.resources += share
        given += share
    return round(given, 2)


def reset_gen_scores(population: list[Agent]) -> None:
    for a in population:
        a.gen_score = 0.0


def charge_upkeep(population: list[Agent], cfg: EconomyConfig) -> float:
    """毎世代の維持費を全個体に課す（飢餓の圧力）。実際に徴収した総額を返す。"""
    charged = 0.0
    for a in population:
        pay = min(a.resources, cfg.upkeep)
        a.resources -= pay
        charged += pay
    return round(charged, 2)


def is_bankrupt(agent: Agent, cfg: EconomyConfig) -> bool:
    return agent.resources <= cfg.bankruptcy_threshold


def total_resources(population: list[Agent]) -> float:
    return round(sum(a.resources for a in population), 2)


def distribute_reinforcement(population: list["Agent"], amount: float, cfg: EconomyConfig) -> float:
    """
    限定補給(amount)を、資産上位(=強者)に集中配分する。
    総資源は total_pool_cap を超えない（世界の資源は有限）。
    返り値は実際に投入された補給量。強者だけが補給を得る＝格差が死を生む。
    """
    if amount <= 0:
        return 0.0
    alive = [a for a in population if a.alive]
    if not alive:
        return 0.0
    if cfg.total_pool_cap is not None:
        headroom = max(0.0, cfg.total_pool_cap - total_resources(population))
        amount = min(amount, headroom)
    if amount <= 0:
        return 0.0
    winners = sorted(alive, key=lambda a: a.resources, reverse=True)[: max(1, cfg.reinforcement_top_k)]
    share = amount / len(winners)
    for w in winners:
        w.resources += share
    return round(amount, 2)
