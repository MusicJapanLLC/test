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

import json
from pathlib import Path

from .base import ARCHETYPES, Surface


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
        """ラボ内ホストの生存確認のみ（攻撃ではない）。到達不能なら False。"""
        if not self.host:
            return False
        import urllib.request

        # ラボ内プライベートアドレスのみ（http, 平文, タイムアウト厳格）。
        url = f"http://{self.host}/"
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
                return 200 <= resp.status < 500
        except Exception:
            return False
