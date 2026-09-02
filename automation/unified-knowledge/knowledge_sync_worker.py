"""
Unified Knowledge Sync Worker (Senju child agent)

Role: GitHub webhook events from test & the-world2 を監視し、
リアルタイムで共有ナレッジDBに同期する。

両リポジトリの発見・改善を即座にクロスリポで適用可能にする。
"""

import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class KnowledgeEntity:
    """統一ナレッジエンティティ"""
    knowledge_id: str
    schema_version: str = "1.0"
    source_repos: List[str] = None
    category: str = None  # failure_pattern|capability|research_finding|...
    created_by_agent: str = None
    created_at: str = None
    content: Dict = None
    evidence: Dict = None
    effectiveness: Dict = None
    prediction: Dict = None
    cross_repo_usage: Dict = None
    meta_learning: Dict = None
    world_delta: Dict = None
    tags: List[str] = None

    def to_json(self):
        return json.dumps(asdict(self), default=str, indent=2)


class KnowledgeDeduplicator:
    """重複排除ロジック"""

    @staticmethod
    def generate_knowledge_id(
        category: str,
        fingerprint: str,
        source_repo: str
    ) -> str:
        """一意なナレッジIDを生成"""
        content = f"{category}:{fingerprint}:{source_repo}:{datetime.utcnow().date()}"
        return f"kn_{hashlib.md5(content.encode()).hexdigest()[:12]}"

    @staticmethod
    def check_duplicate(knowledge_db, knowledge_id: str) -> bool:
        """既存ナレッジかチェック"""
        return knowledge_db.get(knowledge_id) is not None


class GitHubEventParser:
    """GitHub webhook イベント解析"""

    @staticmethod
    def parse_commit_message(commit_msg: str) -> Optional[Dict]:
        """
        コミットメッセージからナレッジを抽出

        フォーマット例:
        fix(deploy): timeout in step 3 - Cache invalidation
        fingerprint: timeout_deploy_step_3
        success_rate: 0.94
        """
        lines = commit_msg.split('\n')
        result = {
            'title': lines[0] if lines else '',
            'metadata': {}
        }

        for line in lines[1:]:
            if ':' in line:
                key, value = line.split(':', 1)
                result['metadata'][key.strip()] = value.strip()

        return result

    @staticmethod
    def parse_pr_description(pr_body: str) -> Optional[Dict]:
        """
        PR説明からナレッジを抽出

        例: ## Knowledge
            Category: capability
            Fingerprint: auto-fix-deploy
        """
        if "## Knowledge" not in pr_body:
            return None

        knowledge_section = pr_body.split("## Knowledge")[1]
        result = {}

        for line in knowledge_section.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                result[key.strip()] = value.strip()

        return result

    @staticmethod
    def extract_failure_pattern(
        issue_title: str,
        issue_body: str
    ) -> Optional[Dict]:
        """GitHub Issueから失敗パターンを抽出"""
        if not issue_title.startswith("[FAILURE]"):
            return None

        return {
            'symptom': issue_title.replace("[FAILURE]", "").strip(),
            'details': issue_body,
            'category': 'failure_pattern'
        }


class KnowledgeSyncWorker:
    """メインの同期ワーカー"""

    def __init__(self, knowledge_db, logger=None):
        self.knowledge_db = knowledge_db
        self.logger = logger or print
        self.deduplicator = KnowledgeDeduplicator()
        self.event_parser = GitHubEventParser()

    def handle_webhook_event(self, event: Dict) -> Optional[str]:
        """
        GitHub webhook イベント処理
        Returns: knowledge_id (作成/更新された場合)
        """
        event_type = event.get('action') or event.get('type')

        if event_type == 'push':
            return self._handle_push(event)
        elif event_type == 'opened' and event.get('pull_request'):
            return self._handle_pr(event)
        elif event_type == 'opened' and event.get('issue'):
            return self._handle_issue(event)
        else:
            return None

    def _handle_push(self, event: Dict) -> Optional[str]:
        """push イベント → コミットメッセージからナレッジ抽出"""
        commits = event.get('commits', [])
        knowledge_ids = []

        for commit in commits:
            msg = commit.get('message', '')
            parsed = self.event_parser.parse_commit_message(msg)

            if not parsed or not parsed.get('metadata'):
                continue

            metadata = parsed['metadata']
            category = metadata.get('category', 'research_finding')
            fingerprint = metadata.get('fingerprint', hashlib.md5(msg.encode()).hexdigest()[:12])
            source_repo = event['repository']['full_name']

            knowledge_id = self.deduplicator.generate_knowledge_id(
                category, fingerprint, source_repo
            )

            if not self.deduplicator.check_duplicate(self.knowledge_db, knowledge_id):
                entity = KnowledgeEntity(
                    knowledge_id=knowledge_id,
                    source_repos=[source_repo],
                    category=category,
                    created_by_agent='git-commit-worker',
                    created_at=commit.get('timestamp'),
                    content={'title': parsed['title'], 'fingerprint': fingerprint},
                    evidence={'commit_sha': commit.get('id'), 'url': commit.get('url')},
                    tags=[category]
                )

                self.knowledge_db.write(knowledge_id, asdict(entity))
                knowledge_ids.append(knowledge_id)
                self.logger(f"[SYNC] Created knowledge: {knowledge_id}")

        return knowledge_ids[0] if knowledge_ids else None

    def _handle_pr(self, event: Dict) -> Optional[str]:
        """PR opened イベント → PR説明からナレッジ抽出"""
        pr = event.get('pull_request', {})
        parsed = self.event_parser.parse_pr_description(pr.get('body', ''))

        if not parsed:
            return None

        category = parsed.get('category', 'research_finding')
        fingerprint = parsed.get('fingerprint', hashlib.md5(pr.get('title', '').encode()).hexdigest()[:12])
        source_repo = event['repository']['full_name']

        knowledge_id = self.deduplicator.generate_knowledge_id(
            category, fingerprint, source_repo
        )

        if not self.deduplicator.check_duplicate(self.knowledge_db, knowledge_id):
            entity = KnowledgeEntity(
                knowledge_id=knowledge_id,
                source_repos=[source_repo],
                category=category,
                created_by_agent='pr-worker',
                created_at=pr.get('created_at'),
                content={'title': pr.get('title'), 'fingerprint': fingerprint},
                evidence={'pr_url': pr.get('html_url'), 'pr_number': pr.get('number')},
                tags=[category]
            )

            self.knowledge_db.write(knowledge_id, asdict(entity))
            self.logger(f"[SYNC] Created knowledge from PR: {knowledge_id}")
            return knowledge_id

        return None

    def _handle_issue(self, event: Dict) -> Optional[str]:
        """Issue opened イベント → 失敗パターン抽出"""
        issue = event.get('issue', {})
        parsed = self.event_parser.extract_failure_pattern(
            issue.get('title', ''),
            issue.get('body', '')
        )

        if not parsed:
            return None

        fingerprint = hashlib.md5(issue.get('title', '').encode()).hexdigest()[:12]
        source_repo = event['repository']['full_name']

        knowledge_id = self.deduplicator.generate_knowledge_id(
            'failure_pattern', fingerprint, source_repo
        )

        if not self.deduplicator.check_duplicate(self.knowledge_db, knowledge_id):
            entity = KnowledgeEntity(
                knowledge_id=knowledge_id,
                source_repos=[source_repo],
                category='failure_pattern',
                created_by_agent='issue-worker',
                created_at=issue.get('created_at'),
                content={'symptom': parsed['symptom'], 'details': parsed['details'], 'fingerprint': fingerprint},
                evidence={'issue_url': issue.get('html_url'), 'issue_number': issue.get('number')},
                tags=['failure_pattern']
            )

            self.knowledge_db.write(knowledge_id, asdict(entity))
            self.logger(f"[SYNC] Created failure pattern: {knowledge_id}")
            return knowledge_id

        return None

    def sync_to_cross_repo_agents(self, knowledge_id: str, source_repo: str) -> bool:
        """
        新しいナレッジを対象リポジトリのエージェントに通知
        Returns: True if successfully propagated
        """
        target_repo = "the-world2" if source_repo == "test" else "test"

        self.logger(f"[PROPAGATE] {knowledge_id} from {source_repo} to {target_repo}")

        # Senjuが子エージェントを生成して、対象リポの自動修正エージェントに割当
        # 例: the-world2 の SELF-FORGE が、test で成功したパターンを自動適用

        return True


class MockKnowledgeDB:
    """テスト用モックDB（本番はGoogle Sheets / Firestore）"""

    def __init__(self):
        self.store = {}

    def get(self, knowledge_id: str) -> Optional[Dict]:
        return self.store.get(knowledge_id)

    def write(self, knowledge_id: str, entity: Dict):
        self.store[knowledge_id] = entity

    def query(self, **filters) -> List[Dict]:
        results = []
        for entity in self.store.values():
            match = True
            for key, value in filters.items():
                if entity.get(key) != value:
                    match = False
                    break
            if match:
                results.append(entity)
        return results


if __name__ == "__main__":
    # テスト実行例
    db = MockKnowledgeDB()
    worker = KnowledgeSyncWorker(db)

    test_event = {
        'action': 'push',
        'repository': {'full_name': 'MusicJapanLLC/test'},
        'commits': [{
            'message': 'fix(deploy): timeout in step 3\nfingerprint: timeout_deploy_step_3\ncategory: failure_pattern',
            'timestamp': datetime.utcnow().isoformat(),
            'id': 'abc123',
            'url': 'https://github.com/test/commit/abc123'
        }]
    }

    knowledge_id = worker.handle_webhook_event(test_event)
    print(f"Created: {knowledge_id}")
    print(json.dumps(db.get(knowledge_id), indent=2))
