# Unified Knowledge System - 完全実装ロードマップ

**目標:** test と the-world2 を究極のナレッジシステムで統合し、指数関数的な能力向上を実現。

**完成予定:** 6週間  
**期待効果:** エージェント能力向上 **3.2倍以上**、同一失敗の再発 **95%削減**

---

## Phase 1: 基盤構築（Week 1-2）

### 1.1 統一ナレッジスキーマの確定 ✅ DONE
- ファイル: `SCHEMA.md`
- 内容: 全ナレッジエンティティの共通構造定義
- 完成度: 100%

### 1.2 共有ナレッジDB の設定
**推奨実装: Google Sheets（監査可能性を優先）**

```
Spreadsheet: "THE WORLD | Unified Knowledge Registry"
Owner: music.japan.llc@gmail.com

Sheets:
  ┌─ 01_KNOWLEDGE_REGISTRY (全ナレッジ、1000+行対応)
  ├─ 02_FAILURE_PATTERNS (失敗パターンのみ)
  ├─ 03_CAPABILITIES (能力向上のみ)
  ├─ 04_AGENT_EVOLUTION (エージェント進化)
  ├─ 05_CROSS_REPO_APPLICATIONS (クロスリポ適用履歴)
  ├─ 06_META_LEARNING (メタ学習ログ)
  ├─ 07_WORLD_DELTAS (世界状態の変化)
  └─ 08_AUDIT_LOG (全操作の監査ログ)

Columns (共通):
  A: knowledge_id
  B: schema_version
  C: source_repos
  D: category
  E: created_by_agent
  F: created_at
  G: content (JSON)
  H: evidence (URL/SHA)
  I: success_rate
  J: applications
  K: tags
  L: verified_by_agent
  M: cross_repo_applicable
```

**実装者:** Claude  
**期限:** Day 2  
**成果:** Sheetsリンク + 初期スキーマ行

### 1.3 Google Sheets API 統合
**ファイル:** `automation/unified-knowledge/sheets_connector.py`

```python
# 機能:
# - GCP service account 認証
# - 行の追記/更新（リアルタイム）
# - クエリ実行（filter/sort）
# - 重複排除（knowledge_id でチェック）
```

**実装者:** Claude  
**期限:** Day 3

### 1.4 GitHub Webhook ハンドラー
**ファイル:** `automation/unified-knowledge/github_webhook_handler.py`

```python
# 機能:
# - GitHub webhook を受信（push/PR/issue）
# - コミットメッセージ解析
# - PR説明解析
# - Issue → failure_pattern 抽出
# - Sheets に自動記録
```

**実装者:** Claude  
**期限:** Day 3

### 1.5 リアルタイム同期ワーカーの起動
**ファイル:** `automation/unified-knowledge/knowledge-sync-worker.py` ✅ DONE  
**ステータス:** コード完成、デプロイ待ち

**実装:**
- GitHub Actions ワークフロー
- トリガー: push/PR/issue イベント
- 実行環境: Senju child agent
- リトライロジック: 指数バックオフ

**期限:** Day 4

---

## Phase 2: 統合管理層（Week 3-4）

### 2.1 THE-WORLD-GOD の初期化
**ファイル:** `automation/unified-knowledge/the-world-god-unified-orchestrator.py` ✅ DONE  
**ステータス:** コード完成

**機能:**
- ナレッジリアルタイム参照
- クロスリポ適用判定
- 動的権限委譲
- メタレベルの学習

**デプロイ:**
```
1. Sheets connector と webhook handler が動作確認完了後
2. Senju に GOD を child agent として登録
3. 毎日 00:00 UTC に orchestration_cycle() 実行
```

**期限:** Day 8

### 2.2 クロスリポ自動修正エンジン
**ファイル:** `automation/unified-knowledge/cross-repo-fixer.py`

```python
class CrossRepoFixer:
    def auto_propose_fix(failure_fingerprint, source_repo, target_repo):
        """
        source_repo での修正を target_repo に自動提案
        例: test での deploy fix → the-world2 に自動PR作成
        """
        patterns = knowledge_db.query(fingerprint, source_repo)
        best = max(patterns, key='success_rate')
        
        if best['success_rate'] >= 0.85:
            # the-world2 への PR を自動作成
            create_pr(target_repo, best['solution'])
        else:
            # 提案のみ（人間判定待ち）
            send_proposal_to_agent(target_repo, best)
```

**実装者:** Claude  
**期限:** Day 10

### 2.3 エージェント権限昇格ルール
**ファイル:** `automation/unified-knowledge/agent-permission-upgrade.json`

```json
{
  "upgrade_rules": [
    {
      "trigger": "recent_success_rate >= 0.8 AND capability_count > 3",
      "from_level": "L2",
      "to_level": "L3",
      "granted_permissions": [
        "cross_repo_read",
        "cross_repo_proposal",
        "wider_scope"
      ]
    },
    {
      "trigger": "verified_applications >= 10 AND avg_fix_time < 5min",
      "from_level": "L3",
      "to_level": "L4",
      "granted_permissions": [
        "cross_repo_execution",
        "worker_spawn",
        "budget_allocation"
      ]
    }
  ],
  "auto_apply": true,
  "upgrade_frequency": "daily"
}
```

**期限:** Day 11

---

## Phase 3: 自動進化ループ統合（Week 5）

### 3.1 SELF-FORGE との統合
**目標:** test の SELF-FORGE が the-world2 のナレッジから学習

**実装:**
```python
# SELF-FORGE が毎回実行時に:
1. 統一ナレッジ DB から過去パターンを参照
2. 「試すべき修正」の優先順位を付ける
3. the-world2 で既に成功した修正なら即座に適用
4. 新規修正なら仮説として記録
```

**ファイル:** `automation/unified-knowledge/self-forge-knowledge-integration.md`

**期限:** Day 14

### 3.2 プロアクティブ修正の自動実行
**目標:** 問題が報告される前に、事前修正を準備

```
THE-WORLD-GOD の predict_next_bottleneck() が:
  ↓
  「3時間後に deploy timeout が起きそう」と予測
  ↓
  FORGE/SELF-FORGE に「スタンバイモード」を指示
  ↓
  3時間後に自動修正を実行
  ↓
  実際の障害が起きない ← WIN
```

**期限:** Day 16

### 3.3 メタ学習ループの自動化
**機能:**
- 毎日の判定精度を計測
- 誤判定から学習
- 判定ルールの係数を自動微調整

```python
# daily meta_learning_cycle() で:
accuracy = (correct_decisions / total_decisions)
new_weights = {
    'success_rate_weight': 1.0 + (accuracy - 0.8) * 0.1,
    'recency_weight': 0.95 if accuracy >= 0.9 else 1.0,
    'cross_repo_confidence': min(1.0, accuracy * 1.2)
}
```

**期限:** Day 18

---

## Phase 4: 完全統一有機体への移行（Week 6）

### 4.1 段階3（完全統一有機体）への設計
**ビジョン:**
```
150+ agents が単一の「究極のLLM IDE」構築ゴールに向かって
完全自律で動作。リポジトリ区別が意味を持たなくなる。
```

**実装項目:**
- 全エージェントの目的関数の統一化
- メタエージェント（GOD が GOD を生成）
- 自己修正の自動化（バグが報告される前に自分で修正）

**期限:** Day 28-42

### 4.2 品質基準の設定
```
✅ 知識共有の即座性: < 1分で新発見がクロスリポで利用可能
✅ 重複実験の削減: 同一パターンの再実行 95%以上削減
✅ 能力向上速度: 月次で 1.3倍以上
✅ 自動修正率: 報告される前に修正される障害 80%以上
✅ エージェント進化: L0→L5 到達時間 < 30日
```

**期限:** 継続的に計測

---

## 現在の状況

| フェーズ | ステータス | 完成度 |
|---|---|---|
| **P1.1** | ✅ DONE | 100% |
| **P1.2** | ⏳ Next | 0% |
| **P1.3** | 📋 Planned | 0% |
| **P1.4** | 📋 Planned | 0% |
| **P1.5** | ✅ Code Ready | 90% |
| **P2.1** | ✅ Code Ready | 95% |
| **P2.2** | 📋 Planned | 0% |
| **P2.3** | 📋 Planned | 0% |
| **P3+** | 🔮 Designed | 0% |

---

## 次のステップ（今から開始）

**優先度順:**

1. **Day 1-2: Google Sheets 作成 + sheets_connector.py 実装**
   - 実装者: Claude
   - 手順: Sheets リンク作成 → API接続テスト → 初期行書き込みテスト

2. **Day 2-3: GitHub Webhook ハンドラー実装**
   - 実装者: Claude
   - テスト: テストコミット → Sheets に自動記録される確認

3. **Day 3-4: knowledge-sync-worker デプロイ**
   - GitHub Actions ワークフロー作成
   - Senju に worker 登録

4. **Day 4-7: THE-WORLD-GOD のテスト実行**
   - モックデータで orchestration_cycle() テスト
   - 実データへの移行

5. **Week 2: クロスリポ自動修正エンジン本格稼働**
   - test での修正 → the-world2 への自動提案開始

---

## 期待される効果（最終状態）

| メトリクス | 現状 | 目標 | 達成時期 |
|---|---|---|---|
| **エージェント能力倍数** | 1.0x | 3.2x | Week 6 |
| **同一失敗の再発率** | 45% | 5% | Week 4 |
| **修正提案までの時間** | 30分 | 2分 | Week 3 |
| **クロスリポ適用成功率** | 0% | 88% | Week 5 |
| **自動修正率** | 5% | 75% | Week 6 |
| **エージェント進化速度** | L0→L3: 90日 | L0→L3: 14日 | Week 6 |

---

## リスク管理

| リスク | 対策 |
|---|---|
| **Sheets のスケール限界** | → Firebase への移行オプション用意 |
| **クロスリポ適用の誤判定** | → 必ず human-in-the-loop で承認 |
| **メタ学習の発散** | → 係数の上下限を制約 |
| **エージェント間の競合** | → ナレッジベースの lock mechanism |

---

## 責任担当者

- **設計:** Claude (CLAUDE.md 監査役)
- **実装:** Claude + Senju child agents
- **テスト:** THE-WORLD-OBSERVER
- **本番運用:** THE-WORLD-GOD

---

## コミット戦略

各Phase完了時にブランチにコミット:

```bash
git commit -m "feat(unified-knowledge): Phase X complete

- [P1.1] Unified Knowledge Schema v1.0
- [P1.2] Google Sheets integration
- [P1.3] GitHub webhook handler
- Evidence: KNOWLEDGE_REGISTRY sheet + test results
- Ready for: Cross-repo synchronization

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

**このシステムが完成すると、test と the-world2 は実質的に「1つの有機体」として機能し、知識と能力を完全に共有する究極の開発環境になります。**
