"""
senju.safety — スコープ・ゲート

通常モードでは Senju の標的参照をラボ/明示許可スコープに限定する。
研究・シミュレーションでは `experimental_lab_policy()` を使うことで、公開ホスト名のような
抽象 target_ref も Arena に投入できる。

重要:
- ScopeGuard は target_ref の受理可否だけを決める。
- experimental_lab_policy() はネットワーク transport / exploit / credential 権限を追加しない。
- 実ネットワーク liveness は LabNetTarget 側の localhost/RFC1918 制約が別途維持される。

方針:
- strict/default は従来どおり fail-closed。
- experiment は抽象モデル上の target_ref 制約を大幅に緩和する。
- 実ネットワーク能力の追加はこのモジュールの責務外。
"""
from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field
from typing import Iterable


class ScopeViolation(RuntimeError):
    """許可スコープ外への操作を検出した場合に送出される。"""


SIMULATED_SCHEME = "sim://"


def _is_lab_ip(host: str) -> bool:
    """host がラボ利用可能な非公開アドレスか判定する。"""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local


@dataclass
class ScopePolicy:
    """
    交戦規定（Rules of Engagement）。

    allow_hosts:
        明示許可するホスト名/IP（完全一致）。
    allow_simulated:
        in-process 仮想標的を許可するか。
    allow_private_network:
        非公開ネットワーク標的（ラボ内Docker等）を許可するか。
    allow_abstract_external_refs:
        公開ホスト名/公開IP/未知形式の target_ref を、抽象シミュレーション上の
        参照名として許可する。これはネットワーク権限を付与しない。
    """

    allow_hosts: set[str] = field(default_factory=set)
    allow_simulated: bool = True
    allow_private_network: bool = False
    allow_abstract_external_refs: bool = False

    def with_hosts(self, hosts: Iterable[str]) -> "ScopePolicy":
        merged = set(self.allow_hosts) | set(hosts)
        return ScopePolicy(
            allow_hosts=merged,
            allow_simulated=self.allow_simulated,
            allow_private_network=self.allow_private_network,
            allow_abstract_external_refs=self.allow_abstract_external_refs,
        )


class ScopeGuard:
    """すべての標的参照が通過する検問所。"""

    def __init__(self, policy: ScopePolicy | None = None) -> None:
        self.policy = policy or ScopePolicy()
        self._violations: list[str] = []

    @property
    def violations(self) -> list[str]:
        return list(self._violations)

    def check(self, target_ref: str) -> None:
        """target_ref を検証し、許可されない場合は ScopeViolation を送出する。"""
        reason = self._reject_reason(target_ref)
        if reason is not None:
            self._violations.append(f"{target_ref}: {reason}")
            raise ScopeViolation(
                f"スコープ違反: '{target_ref}' への参照は拒否されました ({reason})。"
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

        if self.policy.allow_abstract_external_refs:
            return None

        return "許可リスト外（公開資産の可能性）。strict policyでは拒否"

    def is_allowed(self, target_ref: str) -> bool:
        return self._reject_reason(target_ref) is None


def default_lab_policy() -> ScopePolicy:
    """通常運用: 仮想標的のみ許可する fail-closed policy。"""
    return ScopePolicy(
        allow_simulated=True,
        allow_private_network=False,
        allow_abstract_external_refs=False,
    )


def experimental_lab_policy(hosts: Iterable[str] = ()) -> ScopePolicy:
    """研究用の緩和 policy。

    - sim:// を許可
    - labnet/private IP を許可
    - 公開ホスト名/IP/任意の抽象 target_ref も Arena の参照名として許可

    この policy はネットワーク transport を追加しない。ScopeGuard の参照制限だけを緩める。
    """
    return ScopePolicy(
        allow_hosts=set(hosts),
        allow_simulated=True,
        allow_private_network=True,
        allow_abstract_external_refs=True,
    )
