"""
senju.targets.labnet — 隔離ラボネット上の実標的アダプタ（安全ゲート必須）

意図的に脆弱な本物のアプリ（例: OWASP Juice Shop, DVWA）を、
外部への egress を遮断した Docker internal ネットワーク上に立て、
その「攻撃面の構造」をマニフェストから読み込む。

重要:
- このアダプタは **攻撃コード/エクスプロイトを一切含まない**。
  読み込むのは「どのエンドポイントがどの脆弱性クラスか」という構造宣言だけ。
  攻防の成否は他の標的と同じ確率モデルで抽象化する。
- 生成される ref は "labnet:<name>"。ScopeGuard で allow_private_network=True かつ
  明示許可した時だけ通過する。公開資産には設計上到達できない。
- 任意でラボ内ホストへの **生存確認(liveness)** のみ行う（urllib GET, 例外は握りつぶす）。
  攻撃ではなく、標的が起動しているかの確認。既定は無効。
"""
from __future__ import annotations

import ipaddress
import json
from pathlib import Path

from .base import ARCHETYPES, Surface


_LIVENESS_IPV4_ALLOWLIST = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
    )
)


def _is_allowed_liveness_host(host: object) -> bool:
    """Allow only literal IPv4 loopback/RFC1918 addresses used by the isolated lab.

    Deliberately reject hostnames, public/reserved ranges and all link-local space.
    In particular, 169.254.169.254 (common cloud metadata endpoint) must never be
    reachable through this optional liveness probe.
    """
    if not isinstance(host, str):
        return False
    try:
        ip = ipaddress.ip_address(host.strip())
    except ValueError:
        return False
    if not isinstance(ip, ipaddress.IPv4Address):
        return False
    return any(ip in network for network in _LIVENESS_IPV4_ALLOWLIST)


class LabNetTarget:
    """隔離ラボネット上の実標的（マニフェスト駆動）。"""

    def __init__(self, name: str, manifest_path: str | Path) -> None:
        self.ref = f"labnet:{name}"
        self.name = name
        data = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
        self.archetype = data.get("archetype", "web_app")
        if self.archetype not in ARCHETYPES:
            self.archetype = "web_app"
        self.host = data.get("host")  # 例: "10.13.0.5"（ラボ内プライベートIP）
        self._spec = data.get("surfaces", [])
        self._surfaces: list[Surface] = []
        self.reset()

    def reset(self) -> None:
        self._surfaces = [
            Surface(
                name=s.get("name", f"{self.name}:ep{i}"),
                vuln_class=s["vuln_class"],
                difficulty=float(s.get("difficulty", 0.5)),
            )
            for i, s in enumerate(self._spec)
        ]

    def surfaces(self) -> list[Surface]:
        return self._surfaces

    def liveness(self, timeout: float = 2.0) -> bool:
        """ラボ内ホストの生存確認のみ。許可済みIPv4以外はfail-closedで拒否する。"""
        if not _is_allowed_liveness_host(self.host):
            return False
        import urllib.request

        url = f"http://{self.host}/"
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
                return 200 <= resp.status < 500
        except Exception:
            return False
