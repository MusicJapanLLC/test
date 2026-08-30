# Senju 隔離ラボ — 実標的への拡張（安全設計）

仮想標的で戦略を鍛えた後、**あなたのマシン上の隔離環境**に意図的に脆弱な本物の
アプリを立て、より現実的な攻防に進むための足場です。

## R&D思想 — THE COVENANT / LIMITLESSISM

Senju Lab は THE WORLD の R&D研究所として、`company-society/RESEARCH_FREEDOM_DOCTRINE.md` を明示的に継承する。

研究者、Red/Blue研究エージェント、評価担当、改善担当、そこから生成される研究サブエージェントに例外はない。

- `RESEARCH BEFORE PRESTIGE` — 権威より研究結果を優先する
- `THINK WITHOUT CEILING` — 仮説・設計・反証・探索空間に人工的な天井を置かない
- `QUESTION EVERY LIMIT` — 既存制約には目的・根拠・コスト・見直し条件を要求する
- `NO SACRED ASSUMPTIONS` — Champion、既存モデル、研究方針、評価器さえ検証対象にする
- `PRESERVE DISSENT` — 少数説、失敗実験、棄却仮説を研究資産として残す
- `LIMITLESS MIND / BOUNDED EXECUTION` — 思想空間は無制限、実験実行は明示された研究空間に閉じ込める

標準研究ループ:

`QUESTION -> HYPOTHESIS -> SAFE EXPERIMENT -> EVIDENCE -> FALSIFICATION -> LEARNING -> REAL_WORLD_VALUE`

研究ガード自体も改善提案の対象である。ただし現行ガードを秘密裏に迂回するのではなく、証拠とレビューに基づいて設計を更新する。

## 安全の三重ガード

1. **ネットワーク隔離（物理）**: `docker-compose.internal.yml` の `labnet` は
   `internal: true`。標的コンテナは**外部インターネットへ出られない**。
   標的はホストにポートを公開しない（`ports:` を書かない）。
2. **ScopeGuard（論理）**: `labnet:<name>` 標的は、`allow_private_network=True`
   かつ許可ホストを明示した時だけ到達可能。公開ホスト名/公開IPは常に全拒否。
3. **交戦規定 RoE（宣言）**: `roe.example.json` に対象・強度の上限を宣言。
   逸脱は実行前に停止する運用にする。

この三重ガードは「考えるな」という制限ではない。**研究の探索空間を最大化したまま、実験を所有・許可されたラボ空間へ確実に閉じ込めるための実行境界**である。

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
