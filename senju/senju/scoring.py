"""senju.scoring — ELOレーティングと報酬/罰の更新。"""
from __future__ import annotations

from .agents.base import Agent

K_FACTOR = 32.0


def _expected(a: float, b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((b - a) / 400.0))


def apply_result(red: Agent, blue: Agent, winner: str) -> None:
    """
    対戦結果でレーティングを更新する。
    勝ち=報酬(レーティング増), 負け=罰(レーティング減)。
    """
    exp_red = _expected(red.rating, blue.rating)
    exp_blue = _expected(blue.rating, red.rating)

    if winner == "red":
        s_red, s_blue = 1.0, 0.0
        red.wins += 1
        blue.losses += 1
    elif winner == "blue":
        s_red, s_blue = 0.0, 1.0
        blue.wins += 1
        red.losses += 1
    else:
        s_red = s_blue = 0.5
        red.draws += 1
        blue.draws += 1

    red.rating = round(red.rating + K_FACTOR * (s_red - exp_red), 1)
    blue.rating = round(blue.rating + K_FACTOR * (s_blue - exp_blue), 1)
