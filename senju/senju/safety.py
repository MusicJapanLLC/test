"""
senju.safety — Arena target_ref のスコープ制御。

外部HTTP(S)接触は `senju.external` が担当する。
Arena の target_ref 検査とネットワーク egress を混同しない。

方針:
- 通常運用は fail-closed。
- 仮想標的 / 明示許可したラボ参照だけを受理する。
- 研究モードでは抽象的な外部参照名をシミュレーション入力として扱えるが、
  それ自体はネットワーク transport を付与しない。
- Arena の ScopeGuard を完全 no-op にする実装は提供しない。
- target_ref の制御文字・前後空白・空 namespace を拒否し、文字列解釈の抜け道を減らす。
"""
from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field
from typing import Iterable


class ScopeViolation(RuntimeError):
    """許可スコープ外への操作を検出した場合に送出される。"""


SIMULATED_SCHEME = "sim://"
LABNET_SCHEME = "labnet:"


def _is_lab_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local


def _has_control_chars(value: str) -> bool:
    return any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in value)


def _has_clean_payload(target_ref: str, prefix: str) -> bool:
    payload = target_ref[len(prefix) :]
    return bool(payload) and payload == payload.strip() and not _has_control_chars(payload)


@dataclass
class ScopePolicy:
    """Arena が扱う target_ref の受理ポリシー。"""

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
    """Arena のすべての target_ref が通過する検問所。"""

    def __init__(self, policy: ScopePolicy | None = None) -> None:
        self.policy = policy or ScopePolicy()
        self._violations: list[str] = []

    @property
    def violations(self) -> list[str]:
        return list(self._violations)

    def check(self, target_ref: str) -> None:
        reason = self._reject_reason(target_ref)
        if reason is not None:
            self._violations.append(f"{target_ref}: {reason}")
            raise ScopeViolation(
                f"スコープ違反: '{target_ref}' への参照は拒否されました ({reason})。"
            )

    def _reject_reason(self, target_ref: str) -> str | None:
        if not target_ref:
            return "空の標的参照"

        if target_ref != target_ref.strip():
            return "標的参照の前後空白は許可されていない"

        if _has_control_chars(target_ref):
            return "標的参照に制御文字が含まれている"

        if target_ref.startswith(SIMULATED_SCHEME):
            if not self.policy.allow_simulated:
                return "仮想標的が無効化されている"
            if not _has_clean_payload(target_ref, SIMULATED_SCHEME):
                return "仮想標的 namespace が空または不正"
            return None

        if target_ref.startswith(LABNET_SCHEME):
            if not self.policy.allow_private_network:
                return "プライベートネット標的が無効化されている"
            if not _has_clean_payload(target_ref, LABNET_SCHEME):
                return "labnet namespace が空または不正"
            return None

        if target_ref in self.policy.allow_hosts:
            return None

        if _is_lab_ip(target_ref):
            return None if self.policy.allow_private_network else "非公開IPだが allow_private_network が無効"

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
    """研究用: 抽象参照は許可するがネットワーク能力は付与しない。"""
    return ScopePolicy(
        allow_hosts=set(hosts),
        allow_simulated=True,
        allow_private_network=True,
        allow_abstract_external_refs=True,
    )
