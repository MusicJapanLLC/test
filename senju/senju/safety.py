"""
senju.safety — 非バイパス型スコープ・ゲート

このモジュールは Senju における「絶対条件」を担う。
攻撃系エージェントが触れてよいのは、明示的に許可された「ラボ標的」だけ。
実在の第三者・公開インターネット上の資産には、設計上、手が届かない。

方針:
- 許可はホワイトリスト方式（デフォルト全拒否）。
- 標的はすべて lab スコープ（プライベート/予約/ループバック、または in-process 仮想標的）に限定。
- ここを通らないネットワーク動作はフレームワークに存在しない。
"""
from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field
from typing import Iterable


class ScopeViolation(RuntimeError):
    """許可スコープ外への操作を検出した場合に送出される。"""


# in-process 仮想標的（実ネットワークを一切使わない）を示す擬似スキーム
SIMULATED_SCHEME = "sim://"


def _is_lab_ip(host: str) -> bool:
    """host がラボ利用可能な非公開アドレスか判定する。"""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    # ループバック / プライベート / リンクローカル のみ許可。
    return ip.is_loopback or ip.is_private or ip.is_link_local


@dataclass
class ScopePolicy:
    """
    交戦規定（Rules of Engagement）。

    allow_hosts: 明示許可するホスト名/IP（完全一致）。
    allow_simulated: in-process 仮想標的を許可するか。
    allow_private_network: 非公開ネットワーク標的（ラボ内Docker等）を許可するか。
    公開インターネットは、いかなる設定でも許可されない。
    """

    allow_hosts: set[str] = field(default_factory=set)
    allow_simulated: bool = True
    allow_private_network: bool = False

    def with_hosts(self, hosts: Iterable[str]) -> "ScopePolicy":
        merged = set(self.allow_hosts) | set(hosts)
        return ScopePolicy(
            allow_hosts=merged,
            allow_simulated=self.allow_simulated,
            allow_private_network=self.allow_private_network,
        )


class ScopeGuard:
    """すべての標的アクセスが通過する検問所。"""

    def __init__(self, policy: ScopePolicy | None = None) -> None:
        self.policy = policy or ScopePolicy()
        self._violations: list[str] = []

    @property
    def violations(self) -> list[str]:
        return list(self._violations)

    def check(self, target_ref: str) -> None:
        """
        target_ref を検証する。許可されない場合は ScopeViolation を送出。
        target_ref 例:
          - "sim://web-shop-1"           仮想標的
          - "127.0.0.1", "10.0.0.5"       ラボIP
          - "labnet:dvwa"                 プライベートネット標的（要 allow_private_network）
        """
        reason = self._reject_reason(target_ref)
        if reason is not None:
            self._violations.append(f"{target_ref}: {reason}")
            raise ScopeViolation(
                f"スコープ違反: '{target_ref}' へのアクセスは拒否されました ({reason})。"
                " Senjuはラボ標的以外を攻撃しません。"
            )

    def _reject_reason(self, target_ref: str) -> str | None:
        if not target_ref:
            return "空の標的参照"

        if target_ref.startswith(SIMULATED_SCHEME):
            return None if self.policy.allow_simulated else "仮想標的が無効化されている"

        if target_ref.startswith("labnet:"):
            return None if self.policy.allow_private_network else (
                "プライベートネット標的が無効化されている"
            )

        if target_ref in self.policy.allow_hosts:
            return None

        if _is_lab_ip(target_ref):
            if self.policy.allow_private_network:
                return None
            return "非公開IPだが allow_private_network が無効"

        # ここに到達 = 公開ホスト名 or 公開IP or 未知形式 → 常に拒否
        return "許可リスト外（公開資産の可能性）。ホワイトリストにありません"

    def is_allowed(self, target_ref: str) -> bool:
        return self._reject_reason(target_ref) is None


def default_lab_policy() -> ScopePolicy:
    """デフォルト: 仮想標的のみ許可（最も安全）。"""
    return ScopePolicy(allow_simulated=True, allow_private_network=False)
