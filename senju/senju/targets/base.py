"""senju.targets.base — 標的の抽象定義。"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Protocol


# 攻撃対象となりうる脆弱性クラス。実コード/実ペイロードは持たない。
# ここでは「攻防の抽象モデル」としてのみ扱う（安全）。
VULN_CLASSES: tuple[str, ...] = (
    "sqli",        # SQLインジェクション
    "xss",         # クロスサイトスクリプティング
    "auth_bypass", # 認証回避
    "idor",        # 権限のない直接オブジェクト参照
    "ssrf",        # サーバサイドリクエストフォージェリ
    "rce",         # リモートコード実行
    "path_trav",   # パストラバーサル
    "deserial",    # 危険なデシリアライズ
)


@dataclass
class Surface:
    """標的の攻撃面。1つの脆弱性クラスと難易度を持つ。"""

    name: str
    vuln_class: str
    difficulty: float   # 0.0(容易) .. 1.0(困難)
    mitigated: bool = False   # ブルーが対策済みか
    monitored: bool = False   # ブルーが監視下に置いているか


class Target(Protocol):
    """標的インターフェース。"""

    ref: str  # ScopeGuard が検問する参照文字列

    def surfaces(self) -> list[Surface]: ...

    def reset(self) -> None: ...
