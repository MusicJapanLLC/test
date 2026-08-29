# Senju 隔離ラボ — 実標的への拡張（安全設計）

仮想標的で戦略を鍛えた後、**あなたのマシン上の隔離環境**に意図的に脆弱な本物の
アプリを立て、より現実的な攻防に進むための足場です。

## 安全の三重ガード

1. **ネットワーク隔離（物理）**: `docker-compose.internal.yml` の `labnet` は
   `internal: true`。標的コンテナは**外部インターネットへ出られない**。
   標的はホストにポートを公開しない（`ports:` を書かない）。
2. **ScopeGuard（論理）**: `labnet:<name>` 標的は、`allow_private_network=True`
   かつ許可ホストを明示した時だけ到達可能。公開ホスト名/公開IPは常に全拒否。
3. **交戦規定 RoE（宣言）**: `roe.example.json` に対象・強度の上限を宣言。
   逸脱は実行前に停止する運用にする。

## 起動

```bash
cd senju
docker compose -f lab/docker-compose.internal.yml up -d
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' senju-juice-shop
# 得られたIPを lab/targets/juice-shop.manifest.json の "host" に設定
```

## 重要な線引き

- ここに置くのは **学習用に意図的に脆弱化された公開OSS**（Juice Shop, DVWA, WebGoat 等）だけ。
- **本番資産・第三者資産は絶対に置かない。**
- `LabNetTarget` は**攻撃コードを含まない**。読み込むのは「どのエンドポイントがどの
  脆弱性クラスか」という構造宣言（manifest）と、任意の**生存確認のみ**。
  実際のエクスプロイト実装は、この隔離ラボ内であなたの管理下で拡張してください。
  Senju本体はその成否を確率モデルとして抽象化し、戦略の進化に用います。
