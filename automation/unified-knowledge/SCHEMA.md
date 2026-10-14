# Unified Knowledge System Schema v1.0

## 目的
test リポジトリと the-world2 リポジトリ間で、研究発見・失敗パターン・能力向上を**リアルタイムで共有**し、指数関数的な能力向上を実現する。

---

## コア概念

### 1. Knowledge Entity

すべてのナレッジは以下の共通構造を持つ：

```json
{
  "knowledge_id": "kn_20260902_001",
  "schema_version": "1.0",
  "source_repos": ["test", "the-world2"],
  "category": "failure_pattern|capability|research_finding|performance_metric|agent_evolution",
  "created_by_agent": "TOMOKI-FORGE|SELF-FORGE|META-Worker-007",
  "created_at": "2026-09-02T14:32:00Z",
  "last_applied_at": "2026-09-02T15:01:00Z",
  
  "content": {
    "title": "Deploy timeout in step 3 - Cache invalidation required",
    "description": "...",
    "fingerprint": "timeout_deploy_step_3"
  },
  
  "evidence": {
    "urls": ["github.com/test/commit/abc", "github.com/the-world2/pr/123"],
    "run_ids": ["github-actions-run-001", "the-world2-run-456"],
    "verified_by_agent": "TOMOKI-SKEPTIC",
    "verified_at": "2026-09-02T14:35:00Z"
  },
  
  "effectiveness": {
    "success_rate": 0.94,
    "applications": 7,
    "last_effective": "2026-09-02T15:01:00Z",
    "blocked_failures": 6
  },
  
  "prediction": {
    "next_occurrence_probability": 0.23,
    "next_expected_time": "2026-09-02T18:30:00Z"
  },
  
  "cross_repo_usage": {
    "applicable_to": ["test", "the-world2"],
    "adaptations": [
      {
        "repo": "the-world2",
        "adapted_by_agent": "SELF-FORGE",
        "adaptation_date": "2026-09-02T16:00:00Z"
      }
    ]
  },
  
  "meta_learning": {
    "why_this_works": "Cache invalidation prevents stale state in rebuild pipeline",
    "conditions": ["rebuild_triggered", "cache_older_than_5min"],
    "preconditions": ["deploy_step_3", "worker_count_gt_4"],
    "next_hypothesis": "Can we parallelize cache invalidation?"
  },
  
  "world_delta": {
    "before_capability": "Deploy success rate 67% in step 3",
    "after_capability": "Deploy success rate 94% in step 3",
    "evolution_level": "L3 -> L4",
    "measurable_improvement": true,
    "external_effect": "User experience: deploy latency -230ms"
  },
  
  "tags": ["critical", "cross-repo", "automation", "performance"]
}
```

---

## カテゴリ別スキーマ拡張

### Category: failure_pattern

```json
{
  "category": "failure_pattern",
  "fingerprint": "unique_hash_of_symptom",
  "symptom": "timeout in GitHub Actions step 3",
  "root_cause": "Cache not invalidated before rebuild",
  "solution": "Run cache invalidation --force before rebuild",
  "detection_method": "timeout_duration > 5min AND step==3",
  "preventive_measures": ["cache_invalidation", "worker_scale_up"],
  "recurrence_history": [
    {"date": "2026-09-01T10:00Z", "resolved_by": "FORGE#123"},
    {"date": "2026-08-30T14:30Z", "resolved_by": "FORGE#098"}
  ]
}
```

### Category: capability

```json
{
  "category": "capability",
  "capability_name": "Auto-fix deploy timeout",
  "enabled_by": "TOMOKI-FORGE commit abc123",
  "prerequisites": ["cache_invalidation_script", "worker_scaling_enabled"],
  "verification_method": "10 consecutive successful deploys",
  "verification_status": "VERIFIED",
  "evolution_level": "L4",
  "dependent_capabilities": ["WORLD-CODE auto-test", "Senju replication"]
}
```

### Category: agent_evolution

```json
{
  "category": "agent_evolution",
  "agent_name": "TOMOKI-FORGE",
  "evolution_before": {
    "success_rate": 0.78,
    "avg_fix_time": "45 minutes",
    "scope": "test repo only"
  },
  "evolution_after": {
    "success_rate": 0.94,
    "avg_fix_time": "12 minutes",
    "scope": "test + the-world2 cross-repo"
  },
  "enabled_by_knowledge": ["kn_20260902_001", "kn_20260902_003"],
  "new_capability": "Can apply patterns from the-world2 without re-learning"
}
```

---

## リアルタイム同期メカニズム

### GitHub Webhook → Unified DB Flow

```
[test repo change]
  ↓
GitHub Webhook (push/PR/issue)
  ↓
knowledge-sync-worker (Senju child agent)
  ↓
Parse event, extract evidence
  ↓
Query existing knowledge_id (dedup)
  ↓
Write/Update shared DB
  ↓
Trigger cross-repo agents
  ↓
[the-world2 agents read & apply]
```

### Event Deduplication Key

```
knowledge_id = hash(
  category +
  fingerprint +
  source_repo +
  created_at_date
)
```

---

## 共有ナレッジDB の実装選択肢

### Option A: Google Sheets (推奨 - 簡単、監査可能)
```
Spreadsheet: "THE WORLD | Unified Knowledge"
Sheets:
  - 01_KNOWLEDGE_REGISTRY (全ナレッジ)
  - 02_FAILURE_PATTERNS (失敗パターン)
  - 03_CAPABILITIES (能力向上)
  - 04_AGENT_EVOLUTION (エージェント進化)
  - 05_CROSS_REPO_APPLICATIONS (相互適用)
  - 06_META_LEARNING (メタ学習)
  - 07_WORLD_DELTAS (世界状態変化)
  - 08_AUDIT_LOG (監査ログ)
```

### Option B: Firebase Firestore (スケーラブル)
```
Collections:
  - /knowledge/{knowledge_id}
  - /agents/{agent_id}/applications
  - /repos/{repo_name}/synced_events
  - /audit/{timestamp}
```

---

## THE-WORLD-GOD の統合ナレッジアクセス

```python
# THE-WORLD-GOD が両リポジトリを統一管理
class UnifiedKnowledgeOrchestrator:
    
    def get_applicable_patterns(self, failure_fingerprint):
        """両リポジトリで検証済みのパターンを取得"""
        patterns = knowledge_db.query(
            fingerprint=failure_fingerprint,
            verified=True,
            applicable_to=["test", "the-world2"]
        )
        return patterns.sort_by("effectiveness.success_rate")
    
    def apply_cross_repo_learning(self, source_repo, knowledge_id):
        """他リポジトリで成功したナレッジを自動適用"""
        knowledge = knowledge_db.get(knowledge_id)
        target_repo = "the-world2" if source_repo == "test" else "test"
        
        # 適応層で修正
        adaptation = self.adapt_knowledge_for_repo(
            knowledge, 
            target_repo
        )
        
        # 候補修正をアイデアとして提案
        return self.propose_fix_to_agents(adaptation, target_repo)
    
    def predict_next_failure(self):
        """ナレッジから次の失敗を予測"""
        high_prob_patterns = knowledge_db.query(
            order_by="prediction.next_occurrence_probability",
            limit=10
        )
        return self.assign_proactive_workers(high_prob_patterns)
```

---

## 成功基準

✅ **知識の相互参照** — 同じ失敗を二度としない  
✅ **研究の加速** — パターン発見→両リポジトリ適用（<1時間）  
✅ **能力の収斂** — 両システムが同じベストプラクティスに向かう  
✅ **指数関数的成長** — 月次能力スコア 1.3倍以上  
✅ **科学的再現性** — すべての発見が証拠付きで記録可能  

---

## 次のステップ

1. **リアルタイム同期ワーカー** の実装
2. **THE-WORLD-GOD** の初期化
3. **cross-repo knowledge flow** のテスト
4. **自動デプロイメント** へ統合
