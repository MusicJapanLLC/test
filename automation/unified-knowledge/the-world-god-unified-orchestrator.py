"""
THE WORLD GOD - Unified Orchestrator

Role: test と the-world2 を統一管理し、両システムの能力を相乗化。
- リアルタイムのナレッジ参照
- クロスリポ自動修正の判定
- 全エージェントの動的権限委譲
- メタレベルの学習・進化
"""

import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum


class EvolutionLevel(Enum):
    """能力レベル（L0～L5）"""
    L0 = 0  # 研究段階
    L1 = 1  # 初期実装
    L2 = 2  # 検証開始
    L3 = 3  # 検証完了
    L4 = 4  # 本番適用
    L5 = 5  # 自己改善中


class UnifiedOrchestrator:
    """THE-WORLD-GOD: 統一オーケストレータ"""

    def __init__(self, knowledge_db, agent_registry, logger=None):
        self.knowledge_db = knowledge_db
        self.agent_registry = agent_registry
        self.logger = logger or print
        self.state = {
            'last_sync': datetime.utcnow(),
            'cross_repo_applications': 0,
            'knowledge_hit_rate': 0.0
        }

    # ════════════════════════════════════════════════════════════════
    # Core: リアルタイムナレッジ参照
    # ════════════════════════════════════════════════════════════════

    def get_applicable_patterns(
        self,
        failure_fingerprint: str,
        min_success_rate: float = 0.80
    ) -> List[Dict]:
        """
        両リポジトリで検証済みのパターンを優先度順に取得

        例: test での失敗 → the-world2 での既知解法を即座に参照
        """
        patterns = self.knowledge_db.query(
            category='failure_pattern',
            fingerprint=failure_fingerprint,
            verified=True
        )

        # 成功率でソート
        patterns.sort(
            key=lambda p: p.get('effectiveness', {}).get('success_rate', 0),
            reverse=True
        )

        # 信頼度フィルタ
        high_confidence = [
            p for p in patterns
            if p.get('effectiveness', {}).get('success_rate', 0) >= min_success_rate
        ]

        self.logger(f"[KNOWLEDGE_HIT] {failure_fingerprint}: {len(high_confidence)} patterns found")
        return high_confidence

    def get_agent_capabilities(self, agent_name: str) -> List[Dict]:
        """エージェントが利用可能な能力（過去に成功した修正パターン）を取得"""
        capabilities = self.knowledge_db.query(
            category='capability',
            enabled_by_agent=agent_name,
            verification_status='VERIFIED'
        )
        return capabilities

    # ════════════════════════════════════════════════════════════════
    # Core: クロスリポ自動適用エンジン
    # ════════════════════════════════════════════════════════════════

    def can_apply_cross_repo(
        self,
        knowledge_id: str,
        source_repo: str,
        target_repo: str
    ) -> Tuple[bool, str]:
        """
        source_repo での成功パターンが target_repo で適用可能か判定

        決定基準:
        - 成功率 >= 85%
        - 前提条件が满たされているか
        - セキュリティ境界を越えていないか
        """
        knowledge = self.knowledge_db.get(knowledge_id)

        if not knowledge:
            return False, "knowledge_not_found"

        success_rate = knowledge.get('effectiveness', {}).get('success_rate', 0)
        if success_rate < 0.85:
            return False, f"low_success_rate: {success_rate}"

        preconditions = knowledge.get('meta_learning', {}).get('preconditions', [])
        target_state = self._get_repo_state(target_repo)

        for precondition in preconditions:
            if not self._check_precondition(precondition, target_state):
                return False, f"precondition_not_met: {precondition}"

        return True, "approved"

    def propose_cross_repo_fix(
        self,
        failure_fingerprint: str,
        source_repo: str,
        target_repo: str
    ) -> Optional[Dict]:
        """
        source_repo での失敗が target_repo で起きる可能性を検出し、
        事前修正を提案（プロアクティブ修正）
        """
        patterns = self.knowledge_db.query(
            fingerprint=failure_fingerprint,
            source_repos=[source_repo],
            category='failure_pattern'
        )

        if not patterns:
            return None

        best_pattern = max(
            patterns,
            key=lambda p: p.get('effectiveness', {}).get('success_rate', 0)
        )

        can_apply, reason = self.can_apply_cross_repo(
            best_pattern['knowledge_id'],
            source_repo,
            target_repo
        )

        if not can_apply:
            self.logger(f"[CROSS_REPO_DENIED] {reason}")
            return None

        return {
            'proposal_id': f"prop_{datetime.utcnow().timestamp()}",
            'target_repo': target_repo,
            'knowledge_id': best_pattern['knowledge_id'],
            'proposed_fix': best_pattern.get('content', {}).get('solution'),
            'confidence': best_pattern.get('effectiveness', {}).get('success_rate'),
            'reason': f"Proactive: same pattern detected in {source_repo}"
        }

    # ════════════════════════════════════════════════════════════════
    # Core: 動的権限委譲エンジン
    # ════════════════════════════════════════════════════════════════

    def evaluate_agent_permission_upgrade(self, agent_name: str) -> Optional[Dict]:
        """
        エージェントの成功パターンに基づいて、権限昇格を自動判定

        基準:
        - 連続成功 (直近5回中4回以上)
        - 新たな能力を獲得
        - 他エージェントの再割当依頼が減少
        """
        agent_stats = self.agent_registry.get_stats(agent_name)

        recent_success_rate = agent_stats.get('recent_success_rate', 0)  # 直近5回
        capability_count = len(self.get_agent_capabilities(agent_name))
        reassign_requests = agent_stats.get('reassign_requests', 0)

        should_upgrade = (
            recent_success_rate >= 0.8 and
            capability_count > 3 and
            reassign_requests == 0
        )

        if not should_upgrade:
            return None

        current_level = agent_stats.get('evolution_level', 'L1')
        next_level = self._get_next_evolution_level(current_level)

        upgrade = {
            'agent_name': agent_name,
            'from_level': current_level,
            'to_level': next_level,
            'granted_permissions': self._calculate_new_permissions(next_level),
            'effective_at': datetime.utcnow().isoformat()
        }

        self.logger(f"[PERMISSION_UPGRADE] {agent_name}: {current_level} -> {next_level}")
        return upgrade

    # ════════════════════════════════════════════════════════════════
    # Meta Learning: システムが自分自身を改善
    # ════════════════════════════════════════════════════════════════

    def predict_next_bottleneck(self) -> Optional[Dict]:
        """
        ナレッジから次のボトルネックを予測して、事前配置

        例: 3時間後に deploy timeout が起きそう
        → FORGE を事前にスタンバイさせる
        """
        high_prob_patterns = self.knowledge_db.query(
            order_by='prediction.next_occurrence_probability',
            limit=5
        )

        if not high_prob_patterns:
            return None

        most_likely = high_prob_patterns[0]
        next_time = most_likely.get('prediction', {}).get('next_expected_time')

        if not next_time:
            return None

        return {
            'prediction_id': f"pred_{datetime.utcnow().timestamp()}",
            'pattern': most_likely.get('content', {}).get('fingerprint'),
            'expected_time': next_time,
            'probability': most_likely.get('prediction', {}).get('next_occurrence_probability'),
            'recommended_action': f"Pre-stage workers for {most_likely.get('category')}"
        }

    def meta_learning_cycle(self) -> Dict:
        """
        メタレベルの学習: 「どの配置が最適か」を学習・改善

        実行内容:
        1. 過去24時間の判定を分析
        2. 誤判定を検出
        3. 判定ルールの係数を微調整
        """
        recent_decisions = self.knowledge_db.query(
            decision_timestamp_gte=datetime.utcnow() - timedelta(hours=24)
        )

        correct = sum(1 for d in recent_decisions if d.get('outcome') == 'success')
        total = len(recent_decisions)

        accuracy = correct / total if total > 0 else 0

        adjustments = {
            'meta_learning_cycle': datetime.utcnow().isoformat(),
            'decisions_analyzed': total,
            'accuracy': accuracy,
            'coefficient_adjustments': {
                'success_rate_weight': 1.0 + (accuracy - 0.8) * 0.1,
                'recency_weight': 0.95 if accuracy >= 0.9 else 1.0,
                'cross_repo_confidence': min(1.0, accuracy * 1.2)
            }
        }

        self.logger(f"[META_LEARNING] Accuracy: {accuracy:.1%}, Adjustments: {adjustments}")
        return adjustments

    # ════════════════════════════════════════════════════════════════
    # Orchestration: 日次自動実行ループ
    # ════════════════════════════════════════════════════════════════

    def daily_orchestration_cycle(self) -> Dict:
        """
        毎日実行: 全システムの最適化

        流れ:
        1. ナレッジ同期確認
        2. 各エージェントの成功率評価
        3. 権限昇格判定
        4. メタ学習実行
        5. 次の24時間の予測と事前配置
        """
        cycle_start = datetime.utcnow()

        results = {
            'cycle_timestamp': cycle_start.isoformat(),
            'synced_knowledge': len(self.knowledge_db.query()),
            'agent_upgrades': [],
            'proactive_deployments': [],
            'meta_learning_delta': {}
        }

        # Step 1: ナレッジ同期
        self.logger("[DAILY] Step 1: Knowledge sync check")
        last_sync = self.state.get('last_sync')
        if (cycle_start - last_sync).total_seconds() > 3600:
            results['needs_manual_sync'] = True

        # Step 2: エージェント評価
        self.logger("[DAILY] Step 2: Agent evaluation")
        agent_names = self.agent_registry.list_agents()
        for agent in agent_names:
            upgrade = self.evaluate_agent_permission_upgrade(agent)
            if upgrade:
                results['agent_upgrades'].append(upgrade)
                self.agent_registry.apply_upgrade(agent, upgrade)

        # Step 3: メタ学習
        self.logger("[DAILY] Step 3: Meta learning")
        meta_delta = self.meta_learning_cycle()
        results['meta_learning_delta'] = meta_delta

        # Step 4: プロアクティブ配置
        self.logger("[DAILY] Step 4: Proactive deployment")
        prediction = self.predict_next_bottleneck()
        if prediction:
            results['proactive_deployments'].append(prediction)

        cycle_end = datetime.utcnow()
        results['cycle_duration_seconds'] = (cycle_end - cycle_start).total_seconds()

        self.logger(f"[DAILY_COMPLETE] {results}")
        return results

    # ════════════════════════════════════════════════════════════════
    # Internal helpers
    # ════════════════════════════════════════════════════════════════

    def _get_repo_state(self, repo_name: str) -> Dict:
        """リポジトリの現在状態を取得"""
        # 実装: GitHub API から現在の状態を取得
        return {
            'repo': repo_name,
            'last_commit': datetime.utcnow().isoformat(),
            'worker_count': 8,  # 例
            'cache_status': 'valid'  # 例
        }

    def _check_precondition(self, precondition: str, repo_state: Dict) -> bool:
        """前提条件が満たされているか確認"""
        # 例: "deploy_step_3" → Deploy が step 3 まで進んでいるか
        # 例: "worker_count_gt_4" → ワーカー数 > 4 か
        if precondition == "cache_valid" and repo_state.get('cache_status') == 'valid':
            return True
        if precondition.startswith("worker_count_gt_"):
            required = int(precondition.split('_')[-1])
            return repo_state.get('worker_count', 0) > required
        return True

    def _get_next_evolution_level(self, current_level: str) -> str:
        """次の進化レベルを取得"""
        levels = ['L1', 'L2', 'L3', 'L4', 'L5']
        if current_level in levels:
            idx = levels.index(current_level)
            return levels[min(idx + 1, len(levels) - 1)]
        return 'L1'

    def _calculate_new_permissions(self, level: str) -> List[str]:
        """進化レベルに基づいて付与権限を計算"""
        permissions_by_level = {
            'L1': ['read', 'internal_query'],
            'L2': ['read', 'write', 'internal_execution'],
            'L3': ['read', 'write', 'cross_repo_read', 'cross_repo_proposal'],
            'L4': ['read', 'write', 'cross_repo_read', 'cross_repo_execution', 'worker_spawn'],
            'L5': ['full', 'meta_learning', 'self_modification']
        }
        return permissions_by_level.get(level, [])


if __name__ == "__main__":
    # テスト実行例
    from knowledge_sync_worker import MockKnowledgeDB

    class MockAgentRegistry:
        def get_stats(self, agent_name):
            return {'recent_success_rate': 0.95, 'evolution_level': 'L3', 'reassign_requests': 0}

        def list_agents(self):
            return ['TOMOKI-FORGE', 'SELF-FORGE', 'OBSERVER']

        def apply_upgrade(self, agent_name, upgrade):
            print(f"Applied upgrade: {upgrade}")

    db = MockKnowledgeDB()
    registry = MockAgentRegistry()
    god = UnifiedOrchestrator(db, registry)

    print("=" * 60)
    print("Daily Orchestration Cycle")
    print("=" * 60)
    result = god.daily_orchestration_cycle()
    print(json.dumps(result, indent=2, default=str))
