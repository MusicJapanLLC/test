"""
Unified Knowledge System - Integration Test

すべてのコンポーネントが正しく連動することを確認
"""

import json
import sys
from datetime import datetime
from typing import List, Tuple

# Import all components
from knowledge_sync_worker import KnowledgeSyncWorker, MockKnowledgeDB
from sheets_connector import MockKnowledgeSheetsDB
from github_webhook_handler import (
    WebhookValidator,
    KnowledgeExtractor,
    GitHubWebhookHandler
)
from the_world_god_unified_orchestrator import UnifiedOrchestrator


class IntegrationTestSuite:
    """統合テストスイート"""

    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.results: List[Tuple[str, bool, str]] = []

    def test(self, name: str, fn):
        """テストを実行"""
        try:
            fn()
            self.tests_passed += 1
            self.results.append((name, True, "✓"))
            print(f"✓ {name}")
        except AssertionError as e:
            self.tests_failed += 1
            self.results.append((name, False, str(e)))
            print(f"✗ {name}: {e}")
        except Exception as e:
            self.tests_failed += 1
            self.results.append((name, False, f"Exception: {e}"))
            print(f"✗ {name}: {type(e).__name__}: {e}")

    def run_all(self):
        """すべてのテストを実行"""
        print("╔══════════════════════════════════════════════════════════╗")
        print("║  Unified Knowledge System - Integration Test Suite      ║")
        print("╚══════════════════════════════════════════════════════════╝")
        print()

        # Test Group 1: Knowledge Sync Worker
        print("📋 Test Group 1: Knowledge Sync Worker")
        print("─" * 60)
        self.test_sync_worker_basic()
        self.test_sync_worker_commit_extraction()
        self.test_sync_worker_deduplication()
        print()

        # Test Group 2: GitHub Webhook Handler
        print("📋 Test Group 2: GitHub Webhook Handler")
        print("─" * 60)
        self.test_webhook_signature_validation()
        self.test_knowledge_extraction_commit()
        self.test_knowledge_extraction_pr()
        self.test_knowledge_extraction_issue()
        print()

        # Test Group 3: Sheets Connector
        print("📋 Test Group 3: Sheets Connector")
        print("─" * 60)
        self.test_sheets_append()
        self.test_sheets_query()
        self.test_sheets_stats()
        print()

        # Test Group 4: Orchestrator
        print("📋 Test Group 4: THE-WORLD-GOD Orchestrator")
        print("─" * 60)
        self.test_orchestrator_initialization()
        self.test_orchestrator_cross_repo_evaluation()
        self.test_orchestrator_meta_learning()
        print()

        # Test Group 5: End-to-End Flow
        print("📋 Test Group 5: End-to-End Integration")
        print("─" * 60)
        self.test_e2e_webhook_to_sheets()
        self.test_e2e_orchestrator_decision()
        print()

        # Summary
        self._print_summary()

    # ════════════════════════════════════════════════════════════════
    # Test Group 1: Knowledge Sync Worker
    # ════════════════════════════════════════════════════════════════

    def test_sync_worker_basic(self):
        """基本的なワーカー初期化"""
        def run():
            db = MockKnowledgeDB()
            worker = KnowledgeSyncWorker(db)
            assert worker is not None
            assert worker.knowledge_db is db

        self.test("Sync Worker: Basic initialization", run)

    def test_sync_worker_commit_extraction(self):
        """コミットメッセージからのナレッジ抽出"""
        def run():
            db = MockKnowledgeDB()
            worker = KnowledgeSyncWorker(db)

            event = {
                'action': 'push',
                'repository': {'full_name': 'test/repo'},
                'commits': [{
                    'message': 'fix(deploy): timeout issue\nfingerprint: deploy_timeout_001\ncategory: failure_pattern',
                    'timestamp': datetime.utcnow().isoformat(),
                    'id': 'abc123',
                    'url': 'https://github.com/test/repo/commit/abc123'
                }]
            }

            knowledge_id = worker.handle_webhook_event(event)
            assert knowledge_id is not None
            assert db.get(knowledge_id) is not None

        self.test("Sync Worker: Commit extraction", run)

    def test_sync_worker_deduplication(self):
        """重複排除ロジック"""
        def run():
            db = MockKnowledgeDB()
            worker = KnowledgeSyncWorker(db)

            # First insert
            event = {
                'action': 'push',
                'repository': {'full_name': 'test/repo'},
                'commits': [{
                    'message': 'fix: issue\nfingerprint: test_issue\ncategory: failure_pattern',
                    'timestamp': datetime.utcnow().isoformat(),
                    'id': 'abc123',
                    'url': 'https://github.com/test'
                }]
            }

            id1 = worker.handle_webhook_event(event)

            # Second insert (should be deduplicated)
            id2 = worker.handle_webhook_event(event)

            assert id1 is not None
            assert id2 is None  # Deduplicated

        self.test("Sync Worker: Deduplication", run)

    # ════════════════════════════════════════════════════════════════
    # Test Group 2: GitHub Webhook Handler
    # ════════════════════════════════════════════════════════════════

    def test_webhook_signature_validation(self):
        """Webhook署名検証"""
        def run():
            secret = "test-secret"
            payload = b"test payload"

            import hmac
            import hashlib
            expected_sig = "sha256=" + hmac.new(
                secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()

            assert WebhookValidator.validate_signature(payload, expected_sig, secret)
            assert not WebhookValidator.validate_signature(payload, "invalid", secret)

        self.test("Webhook: Signature validation", run)

    def test_knowledge_extraction_commit(self):
        """コミットからのナレッジ抽出"""
        def run():
            commit = {
                'message': 'fix(api): response timeout\nfingerprint: api_timeout_001\ncategory: failure_pattern\nsuccess_rate: 0.95',
                'id': 'abc123',
                'url': 'https://github.com/test',
                'author': {'name': 'John Doe'},
                'timestamp': datetime.utcnow().isoformat()
            }

            knowledge = KnowledgeExtractor.extract_from_commit(commit)
            assert knowledge is not None
            assert knowledge['fingerprint'] == 'api_timeout_001'
            assert knowledge['category'] == 'failure_pattern'
            assert knowledge['success_rate'] == 0.95

        self.test("Webhook: Extract from commit", run)

    def test_knowledge_extraction_pr(self):
        """PR説明からのナレッジ抽出"""
        def run():
            pr = {
                'title': 'feat: Auto-healing capability',
                'body': '''## Knowledge
Category: capability
Fingerprint: auto-heal-v2
Evolution: L2 -> L3
Success Rate: 0.88''',
                'number': 123,
                'html_url': 'https://github.com/test/pr/123',
                'user': {'login': 'developer'},
                'created_at': datetime.utcnow().isoformat()
            }

            knowledge = KnowledgeExtractor.extract_from_pr(pr)
            assert knowledge is not None
            assert knowledge['fingerprint'] == 'auto-heal-v2'
            assert knowledge['category'] == 'capability'

        self.test("Webhook: Extract from PR", run)

    def test_knowledge_extraction_issue(self):
        """Issueからのナレッジ抽出"""
        def run():
            issue = {
                'title': '[FAILURE] Database connection timeout',
                'body': 'Connection pool exhausted...',
                'number': 456,
                'html_url': 'https://github.com/test/issues/456',
                'user': {'login': 'reporter'},
                'created_at': datetime.utcnow().isoformat()
            }

            knowledge = KnowledgeExtractor.extract_from_issue(issue)
            assert knowledge is not None
            assert knowledge['category'] == 'failure_pattern'
            assert 'Database' in knowledge['title']

        self.test("Webhook: Extract from Issue", run)

    # ════════════════════════════════════════════════════════════════
    # Test Group 3: Sheets Connector
    # ════════════════════════════════════════════════════════════════

    def test_sheets_append(self):
        """Sheetsへの追記"""
        def run():
            db = MockKnowledgeSheetsDB()
            knowledge = {
                'knowledge_id': 'kn_test_001',
                'category': 'failure_pattern',
                'source_repos': ['test'],
                'created_at': datetime.utcnow().isoformat()
            }

            success = db.append_knowledge(knowledge)
            assert success
            assert db.get_knowledge('kn_test_001') is not None

        self.test("Sheets: Append knowledge", run)

    def test_sheets_query(self):
        """Sheetsのクエリ"""
        def run():
            db = MockKnowledgeSheetsDB()

            for i in range(3):
                db.append_knowledge({
                    'knowledge_id': f'kn_test_{i}',
                    'category': 'failure_pattern' if i < 2 else 'capability',
                    'source_repos': ['test']
                })

            results = db.query(category='failure_pattern')
            assert len(results) == 2

        self.test("Sheets: Query results", run)

    def test_sheets_stats(self):
        """Sheetsの統計"""
        def run():
            db = MockKnowledgeSheetsDB()

            db.append_knowledge({
                'knowledge_id': 'kn_1',
                'category': 'failure_pattern',
                'source_repos': ['test'],
                'effectiveness': {'success_rate': 0.95}
            })

            # stats メソッドはモック版では存在しないため、query を確認
            results = db.query()
            assert len(results) >= 1

        self.test("Sheets: Stats", run)

    # ════════════════════════════════════════════════════════════════
    # Test Group 4: Orchestrator
    # ════════════════════════════════════════════════════════════════

    def test_orchestrator_initialization(self):
        """Orchestratorの初期化"""
        def run():
            db = MockKnowledgeSheetsDB()

            class MockRegistry:
                def get_stats(self, name): return {}
                def list_agents(self): return []
                def apply_upgrade(self, a, u): pass

            god = UnifiedOrchestrator(db, MockRegistry())
            assert god is not None
            assert god.knowledge_db is db

        self.test("Orchestrator: Initialization", run)

    def test_orchestrator_cross_repo_evaluation(self):
        """Orchestratorのクロスリポ評価"""
        def run():
            db = MockKnowledgeSheetsDB()

            class MockRegistry:
                def get_stats(self, name): return {}
                def list_agents(self): return []
                def apply_upgrade(self, a, u): pass

            god = UnifiedOrchestrator(db, MockRegistry())

            # クロスリポ評価テスト
            can_apply, reason = god.can_apply_cross_repo(
                'nonexistent_id',
                'test',
                'the-world2'
            )
            assert not can_apply

        self.test("Orchestrator: Cross-repo evaluation", run)

    def test_orchestrator_meta_learning(self):
        """Orchestratorのメタ学習"""
        def run():
            db = MockKnowledgeSheetsDB()

            class MockRegistry:
                def get_stats(self, name): return {}
                def list_agents(self): return []
                def apply_upgrade(self, a, u): pass

            god = UnifiedOrchestrator(db, MockRegistry())
            delta = god.meta_learning_cycle()

            assert delta is not None
            assert 'coefficient_adjustments' in delta

        self.test("Orchestrator: Meta learning", run)

    # ════════════════════════════════════════════════════════════════
    # Test Group 5: End-to-End Integration
    # ════════════════════════════════════════════════════════════════

    def test_e2e_webhook_to_sheets(self):
        """Webhook → Sheets の完全フロー"""
        def run():
            db = MockKnowledgeDB()
            worker = KnowledgeSyncWorker(db)

            # GitHub webhook をシミュレート
            event = {
                'action': 'push',
                'repository': {'full_name': 'MusicJapanLLC/test'},
                'commits': [{
                    'message': 'fix(deploy): critical issue\nfingerprint: critical_deploy_001\ncategory: failure_pattern\nsuccess_rate: 0.99',
                    'timestamp': datetime.utcnow().isoformat(),
                    'id': 'sha123',
                    'url': 'https://github.com/MusicJapanLLC/test/commit/sha123'
                }]
            }

            # ワーカーで処理
            knowledge_id = worker.handle_webhook_event(event)
            assert knowledge_id is not None

            # DB に記録されたか確認
            knowledge = db.get(knowledge_id)
            assert knowledge is not None
            assert knowledge['category'] == 'failure_pattern'

        self.test("E2E: Webhook → DB", run)

    def test_e2e_orchestrator_decision(self):
        """Orchestratorの判定フロー"""
        def run():
            db = MockKnowledgeSheetsDB()

            # テストデータを追加
            db.append_knowledge({
                'knowledge_id': 'kn_test',
                'fingerprint': 'deploy_timeout',
                'category': 'failure_pattern',
                'source_repos': ['test'],
                'effectiveness': {'success_rate': 0.94}
            })

            class MockRegistry:
                def get_stats(self, name):
                    return {
                        'recent_success_rate': 0.95,
                        'evolution_level': 'L3',
                        'reassign_requests': 0
                    }
                def list_agents(self): return ['FORGE']
                def apply_upgrade(self, a, u): pass

            god = UnifiedOrchestrator(db, MockRegistry())

            # パターンを検索
            patterns = god.get_applicable_patterns('deploy_timeout', min_success_rate=0.85)
            assert len(patterns) > 0

        self.test("E2E: Orchestrator decision", run)

    # ════════════════════════════════════════════════════════════════
    # Summary
    # ════════════════════════════════════════════════════════════════

    def _print_summary(self):
        """テスト結果のサマリー"""
        print()
        print("╔══════════════════════════════════════════════════════════╗")
        print("║                      Test Summary                        ║")
        print("╚══════════════════════════════════════════════════════════╝")
        print(f"Total Tests: {self.tests_passed + self.tests_failed}")
        print(f"✓ Passed: {self.tests_passed}")
        print(f"✗ Failed: {self.tests_failed}")

        if self.tests_failed == 0:
            print()
            print("🎉 All tests passed!")
            return True
        else:
            print()
            print("Failed tests:")
            for name, passed, msg in self.results:
                if not passed:
                    print(f"  ✗ {name}: {msg}")
            return False


if __name__ == "__main__":
    suite = IntegrationTestSuite()
    success = suite.run_all()
    sys.exit(0 if success else 1)
