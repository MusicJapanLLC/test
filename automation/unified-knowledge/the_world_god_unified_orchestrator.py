"""
THE WORLD GOD - Unified Orchestrator

Role: test と the-world2 を統一管理し、両システムの能力を相乗化。
- リアルタイムのナレッジ参照
- クロスリポ自動修正の判定
- 全エージェントの動的権限委譲
- メタレベルの学習・進化
- **双方向ナレッジ流通**: 発見→実行→報告→学習
"""

import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path

# Bidirectional knowledge flow support
try:
    from knowledge_pushback import BidirectionalKnowledgeFlow, KnowledgePushback
except ImportError:
    BidirectionalKnowledgeFlow = None
    KnowledgePushback = None


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

    def __init__(self, knowledge_db, agent_registry, logger=None, test_repo_root=None, god_state_dir=None):
        self.knowledge_db = knowledge_db
        self.agent_registry = agent_registry
        self.logger = logger or print
        self.state = {
            'last_sync': datetime.utcnow(),
            'cross_repo_applications': 0,
            'knowledge_hit_rate': 0.0,
            'cycle_count': 0,
            'total_reward': 0.0,
            'tasks_generated': 0,
            'tasks_completed': 0,
            'lastEvolution': None,
            'evolution_history': [],
            'bidirectional_flow_metrics': {
                'inbound_count': 0,
                'outbound_count': 0,
                'outbound_success_rate': 0.0
            }
        }
        self.task_queue: List[Dict] = []
        self.pending_tasks: List[Dict] = []

        # Bidirectional knowledge flow support
        self.bidirectional_flow = None
        if BidirectionalKnowledgeFlow and test_repo_root and god_state_dir:
            try:
                self.bidirectional_flow = BidirectionalKnowledgeFlow(test_repo_root, god_state_dir)
                self.logger("[GOD_INIT] Bidirectional knowledge flow enabled")
            except Exception as e:
                self.logger(f"[GOD_INIT_WARNING] Bidirectional flow init failed: {e}")

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
    # Task Generation & Reward Tracking
    # ════════════════════════════════════════════════════════════════

    def generate_new_tasks(self, max_tasks: int = 5) -> List[Dict]:
        """
        ナレッジから新しいタスクを自動生成

        戦略:
        1. 成功率が高い既知パターンの応用タスク
        2. 新規に検出されたパターンの検証タスク
        3. クロスリポ適用可能パターンの自動修正提案
        """
        new_tasks: List[Dict] = []

        # 既存タスクのIDを取得（重複を避けるため）
        existing_ids = {task.get('task_id') for task in self.task_queue + self.pending_tasks}

        # 1. 高成功率パターンの応用タスク
        high_success_patterns = self.knowledge_db.query(
            category='failure_pattern',
            order_by='effectiveness.success_rate',
            limit=max_tasks
        ) if hasattr(self.knowledge_db, 'query') else []

        if isinstance(high_success_patterns, list):
            for pattern in high_success_patterns:
                if len(new_tasks) >= max_tasks:
                    break
                pattern_id = pattern.get('knowledge_id', f"pattern_{len(new_tasks)}")
                if pattern_id in existing_ids:
                    continue

                task_id = f"task_apply_{pattern_id}"
                if task_id not in existing_ids:
                    new_tasks.append({
                        'task_id': task_id,
                        'task_type': 'apply_pattern',
                        'source_knowledge': pattern_id,
                        'title': f"Apply verified pattern: {pattern.get('fingerprint', 'unknown')}",
                        'status': 'pending',
                        'created_at': datetime.utcnow().isoformat(),
                        'reward': 0.0,
                        'expected_value': float(pattern.get('effectiveness', {}).get('success_rate', 0.5))
                    })
                    existing_ids.add(task_id)

        # 2. クロスリポ適用タスク
        applicable_patterns = self.get_applicable_patterns('all', min_success_rate=0.80)
        if isinstance(applicable_patterns, list):
            for pattern in applicable_patterns[:max(0, max_tasks - len(new_tasks))]:
                task_id = f"task_crossrepo_{pattern.get('knowledge_id', len(new_tasks))}"
                if task_id not in existing_ids:
                    new_tasks.append({
                        'task_id': task_id,
                        'task_type': 'cross_repo_apply',
                        'source_knowledge': pattern.get('knowledge_id'),
                        'title': f"Cross-repo application of {pattern.get('fingerprint', 'pattern')}",
                        'status': 'pending',
                        'created_at': datetime.utcnow().isoformat(),
                        'reward': 0.0,
                        'expected_value': float(pattern.get('effectiveness', {}).get('success_rate', 0.6))
                    })
                    existing_ids.add(task_id)

        self.logger(f"[TASK_GENERATION] Generated {len(new_tasks)} new tasks")
        self.task_queue.extend(new_tasks)
        self.state['tasks_generated'] += len(new_tasks)
        return new_tasks

    def accumulate_reward(self, task_id: str, reward_amount: float) -> float:
        """
        タスク完了時の報酬を蓄積（数値型のみ使用）

        BUG FIX: 報酬は常に float として処理し、string 変換で corrupted しない
        """
        if not isinstance(reward_amount, (int, float)) or isinstance(reward_amount, bool):
            self.logger(f"[REWARD_ERROR] Invalid reward type for {task_id}: {type(reward_amount)}")
            return float(self.state.get('total_reward', 0.0))

        reward_float = float(reward_amount)
        previous_total = float(self.state.get('total_reward', 0.0))
        new_total = previous_total + reward_float

        self.state['total_reward'] = new_total
        self.state['tasks_completed'] += 1

        self.logger(f"[REWARD_ACCUMULATED] {task_id}: +{reward_float:.3f} (total: {new_total:.3f})")
        return new_total

    def get_pending_tasks(self) -> List[Dict]:
        """保留中のタスクを取得"""
        return list(self.pending_tasks)

    def mark_task_implemented(self, task_id: str, success: bool = True, reward: float = 0.0) -> Dict:
        """
        タスクを実装済みとしてマーク

        重要: reward は常に数値型で処理
        """
        reward_float = float(reward) if isinstance(reward, (int, float)) and not isinstance(reward, bool) else 0.0

        updated = None
        for task in self.task_queue:
            if task.get('task_id') == task_id:
                task['status'] = 'completed' if success else 'failed'
                task['reward'] = reward_float
                task['completed_at'] = datetime.utcnow().isoformat()
                updated = task
                break

        if updated:
            self.accumulate_reward(task_id, reward_float)
            self.logger(f"[TASK_MARKED_IMPLEMENTED] {task_id}: {'success' if success else 'failed'}, reward={reward_float}")
        else:
            self.logger(f"[TASK_NOT_FOUND] {task_id}")

        return updated or {}

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
        4. 報酬の蓄積を正規化（数値型として）
        """
        # 報酬の検証: 常に float として取得
        total_reward = float(self.state.get('total_reward', 0.0))
        tasks_completed = int(self.state.get('tasks_completed', 0))

        # 過去24時間の決定を分析（存在する場合）
        recent_decisions = self.knowledge_db.query(
            decision_timestamp_gte=datetime.utcnow() - timedelta(hours=24)
        ) if hasattr(self.knowledge_db, 'query') else []

        if isinstance(recent_decisions, list):
            correct = sum(1 for d in recent_decisions if d.get('outcome') == 'success')
            total = len(recent_decisions)
        else:
            correct = 0
            total = 0

        accuracy = correct / total if total > 0 else 0.5

        # 報酬に基づく係数調整
        reward_signal = total_reward / max(tasks_completed, 1)  # 平均報酬

        adjustments = {
            'meta_learning_cycle': datetime.utcnow().isoformat(),
            'decisions_analyzed': total,
            'accuracy': float(accuracy),
            'total_reward': float(total_reward),
            'tasks_completed': tasks_completed,
            'avg_reward': float(reward_signal),
            'coefficient_adjustments': {
                'success_rate_weight': float(1.0 + (accuracy - 0.8) * 0.1),
                'recency_weight': float(0.95 if accuracy >= 0.9 else 1.0),
                'cross_repo_confidence': float(min(1.0, accuracy * 1.2)),
                'reward_signal_strength': float(min(1.5, reward_signal / 100.0 + 0.5))
            }
        }

        self.logger(f"[META_LEARNING] Accuracy: {accuracy:.1%}, Reward: {total_reward:.2f}, Adjustments: {adjustments}")
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
        5. 新タスク生成
        6. 自動進化トリガー確認
        7. 次の24時間の予測と事前配置
        """
        cycle_start = datetime.utcnow()
        self.state['cycle_count'] = self.state.get('cycle_count', 0) + 1

        results = {
            'cycle_number': self.state['cycle_count'],
            'cycle_timestamp': cycle_start.isoformat(),
            'synced_knowledge': 0,
            'agent_upgrades': [],
            'new_tasks_generated': [],
            'proactive_deployments': [],
            'meta_learning_delta': {},
            'evolution_triggered': False,
            'lastEvolution': self.state.get('lastEvolution')
        }

        try:
            # Step 1: ナレッジ同期
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 1: Knowledge sync check")
            synced = self.knowledge_db.query() if hasattr(self.knowledge_db, 'query') else []
            synced_count = len(synced) if isinstance(synced, list) else 0
            results['synced_knowledge'] = synced_count
            last_sync = self.state.get('last_sync')
            if (cycle_start - last_sync).total_seconds() > 3600:
                results['needs_manual_sync'] = True
                self.state['last_sync'] = cycle_start

            # Step 2: エージェント評価
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 2: Agent evaluation")
            agent_names = self.agent_registry.list_agents() if hasattr(self.agent_registry, 'list_agents') else []
            for agent in agent_names:
                upgrade = self.evaluate_agent_permission_upgrade(agent)
                if upgrade:
                    results['agent_upgrades'].append(upgrade)
                    if hasattr(self.agent_registry, 'apply_upgrade'):
                        self.agent_registry.apply_upgrade(agent, upgrade)

            # Step 3: メタ学習
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 3: Meta learning")
            meta_delta = self.meta_learning_cycle()
            results['meta_learning_delta'] = meta_delta

            # Step 4: 新タスク生成（重要な修正！）
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 4: Task generation")
            new_tasks = self.generate_new_tasks(max_tasks=5)
            results['new_tasks_generated'] = [
                {
                    'task_id': t.get('task_id'),
                    'task_type': t.get('task_type'),
                    'status': t.get('status'),
                    'expected_value': t.get('expected_value')
                }
                for t in new_tasks
            ]

            # Step 5: プロアクティブ配置
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 5: Proactive deployment")
            prediction = self.predict_next_bottleneck()
            if prediction:
                results['proactive_deployments'].append(prediction)

            # Step 5.5: 双方向ナレッジ流通（NEW - 外部効果を実現）
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 5.5: Execute cross-repo improvements")
            cross_repo_result = self.execute_cross_repo_improvements()
            results['cross_repo_executions'] = cross_repo_result
            self.update_bidirectional_flow_metrics()
            results['bidirectional_metrics'] = self.state.get('bidirectional_flow_metrics', {})

            # Step 6: 自動進化トリガー確認（CRITICAL FIX）
            self.logger(f"[DAILY] Cycle {self.state['cycle_count']} Step 6: Evolution trigger check")
            should_evolve, evolution_reason = self._check_evolution_trigger(meta_delta)
            if should_evolve and self.state['cycle_count'] >= 2:  # 最小2サイクル必要
                results['evolution_triggered'] = True
                self.state['lastEvolution'] = {
                    'cycle': self.state['cycle_count'],
                    'timestamp': cycle_start.isoformat(),
                    'reason': evolution_reason,
                    'reward_accumulated': float(self.state.get('total_reward', 0.0))
                }
                results['lastEvolution'] = self.state['lastEvolution']
                self.state['evolution_history'].append(self.state['lastEvolution'])
                self.logger(f"[EVOLUTION_TRIGGERED] {evolution_reason}")
            else:
                self.logger(f"[NO_EVOLUTION] Cycle {self.state['cycle_count']}: {evolution_reason}")

        except Exception as exc:
            self.logger(f"[DAILY_ERROR] Error in cycle: {exc}")
            results['error'] = str(exc)

        cycle_end = datetime.utcnow()
        results['cycle_duration_seconds'] = float((cycle_end - cycle_start).total_seconds())

        self.logger(f"[DAILY_COMPLETE] Cycle {self.state['cycle_count']}: {results}")
        return results

    def _check_evolution_trigger(self, meta_delta: Dict) -> Tuple[bool, str]:
        """
        進化条件をチェック

        条件:
        - 十分な報酬が蓄積された
        - 成功率が閾値を超えた
        - 新タスクが生成されている
        """
        total_reward = float(self.state.get('total_reward', 0.0))
        tasks_completed = int(self.state.get('tasks_completed', 0))
        accuracy = float(meta_delta.get('accuracy', 0.0))
        tasks_generated = int(self.state.get('tasks_generated', 0))

        # 最小要件: 報酬蓄積 > 10.0, 成功率 > 0.7, 生成タスク > 0
        if total_reward >= 10.0 and accuracy >= 0.7 and tasks_generated > 0:
            reason = f"High accuracy ({accuracy:.1%}), Reward: {total_reward:.2f}, Tasks: {tasks_generated}"
            return True, reason

        reasons = []
        if total_reward < 10.0:
            reasons.append(f"insufficient_reward({total_reward:.2f}<10.0)")
        if accuracy < 0.7:
            reasons.append(f"low_accuracy({accuracy:.1%}<70%)")
        if tasks_generated == 0:
            reasons.append("no_tasks_generated")

        return False, "; ".join(reasons)

    # ════════════════════════════════════════════════════════════════
    # Bidirectional Knowledge Flow: Execute improvements back to test
    # ════════════════════════════════════════════════════════════════

    def execute_cross_repo_improvements(self) -> Dict:
        """
        THE-WORLD-GODが発見した改善をテストリポジトリに実行

        返り値: 実行結果サマリー
        """
        if not self.bidirectional_flow:
            return {
                'executed': 0,
                'success': 0,
                'failed': 0,
                'reason': 'Bidirectional flow not enabled'
            }

        result = {
            'executed': 0,
            'success': 0,
            'failed': 0,
            'improvements': [],
            'timestamp': datetime.utcnow().isoformat()
        }

        # クロスリポ適用可能なパターンを検索
        try:
            patterns = self.knowledge_db.query(
                category='failure_pattern',
                min_success_rate=0.85
            ) if hasattr(self.knowledge_db, 'query') else []

            if not isinstance(patterns, list):
                patterns = []

            for pattern in patterns[:5]:  # 最大5個の改善を実行
                knowledge_id = pattern.get('knowledge_id')

                # テストリポで適用可能か確認
                can_apply, reason = self.can_apply_cross_repo(
                    knowledge_id,
                    source_repo='the-world2',
                    target_repo='test'
                )

                if not can_apply:
                    self.logger(f"[CROSS_REPO_SKIP] {knowledge_id}: {reason}")
                    continue

                # 改善提案を構築
                proposal = self._build_improvement_proposal(pattern)
                if not proposal:
                    continue

                result['executed'] += 1

                # 改善を実行
                execution = self.bidirectional_flow.process_god_improvement({
                    'knowledge_id': knowledge_id,
                    'target_repo': 'test',
                    'proposal': proposal
                })

                if execution.get('status') in ['applied', 'created']:
                    result['success'] += 1
                    result['improvements'].append({
                        'knowledge_id': knowledge_id,
                        'status': 'applied',
                        'changes': execution.get('execution_result', {}).get('changes', [])
                    })
                    self.state['cross_repo_applications'] += 1
                else:
                    result['failed'] += 1

        except Exception as e:
            self.logger(f"[CROSS_REPO_ERROR] {e}")
            result['error'] = str(e)

        return result

    def _build_improvement_proposal(self, pattern: Dict) -> Optional[Dict]:
        """
        ナレッジパターンから実行可能な改善提案を構築
        """
        category = pattern.get('category', '')
        content = pattern.get('content', {})

        # パターンカテゴリに応じて異なる提案を生成
        if category == 'config_tune':
            return {
                'type': 'config_tune',
                'config_file': content.get('config_file'),
                'tuning': content.get('recommended_values', {})
            }
        elif category == 'dependency_update':
            return {
                'type': 'dependency_update',
                'lockfile': content.get('lockfile'),
                'updates': content.get('updates', {})
            }
        elif category == 'code_pattern':
            return {
                'type': 'code_pattern',
                'affected_files': content.get('files', []),
                'transformations': content.get('transformations', {})
            }
        elif category == 'workflow':
            return {
                'type': 'workflow',
                'workflow_file': content.get('workflow_file'),
                'changes': content.get('workflow_changes', {})
            }

        return None

    def update_bidirectional_flow_metrics(self):
        """
        双方向フローのメトリクスを更新
        """
        if not self.bidirectional_flow:
            return

        try:
            flow_summary = self.bidirectional_flow.get_flow_summary()
            self.state['bidirectional_flow_metrics'] = {
                'inbound_count': flow_summary.get('inbound_count', 0),
                'outbound_count': flow_summary.get('outbound_count', 0),
                'flow_rate': flow_summary.get('flow_rate', 0.0),
                'outbound_success_rate': flow_summary.get('outbound_success_rate', 0.0),
                'last_inbound': flow_summary.get('last_inbound'),
                'last_outbound': flow_summary.get('last_outbound')
            }

            self.logger(f"[BIDIRECTIONAL_METRICS] In: {flow_summary.get('inbound_count')}, "
                       f"Out: {flow_summary.get('outbound_count')}, "
                       f"Success: {flow_summary.get('outbound_success_rate'):.1%}")
        except Exception as e:
            self.logger(f"[METRICS_ERROR] {e}")

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
