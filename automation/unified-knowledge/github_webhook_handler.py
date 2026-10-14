"""
GitHub Webhook Handler for Unified Knowledge System

Role: GitHub webhook イベントを受信し、リアルタイムで知識を抽出・記録
"""

import os
import json
import hmac
import hashlib
from datetime import datetime
from typing import Dict, Optional, Tuple
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading


class WebhookValidator:
    """GitHub webhook の署名検証"""

    @staticmethod
    def validate_signature(
        payload: bytes,
        signature: str,
        secret: str
    ) -> bool:
        """GitHub の X-Hub-Signature-256 を検証"""
        expected = "sha256=" + hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)


class KnowledgeExtractor:
    """GitHub イベントからナレッジを抽出"""

    @staticmethod
    def extract_from_commit(commit: Dict) -> Optional[Dict]:
        """
        コミットメッセージから structured knowledge を抽出

        期待フォーマット:
        ```
        fix(deploy): timeout in step 3 - cache invalidation

        fingerprint: timeout_deploy_step_3
        category: failure_pattern
        success_rate: 0.94
        verified: true
        ```
        """
        message = commit.get('message', '')
        lines = message.split('\n')

        if len(lines) < 2:
            return None

        title = lines[0]
        metadata = {}

        for line in lines[1:]:
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                metadata[key] = value

        if not metadata.get('fingerprint'):
            return None

        return {
            'type': 'commit',
            'title': title,
            'fingerprint': metadata.get('fingerprint'),
            'category': metadata.get('category', 'research_finding'),
            'success_rate': float(metadata.get('success_rate', 0.5)),
            'verified': metadata.get('verified', '').lower() == 'true',
            'commit_sha': commit.get('id'),
            'commit_url': commit.get('url'),
            'author': commit.get('author', {}).get('name', 'unknown'),
            'timestamp': commit.get('timestamp', datetime.utcnow().isoformat())
        }

    @staticmethod
    def extract_from_pr(pr: Dict) -> Optional[Dict]:
        """
        PR 説明から knowledge を抽出

        期待フォーマット:
        ```
        ## Knowledge
        Category: capability
        Fingerprint: auto-test-capability
        Evolution: L2 -> L3
        Success Rate: 0.88
        ```
        """
        body = pr.get('body', '')

        if '## Knowledge' not in body:
            return None

        knowledge_section = body.split('## Knowledge')[1]
        metadata = {}

        for line in knowledge_section.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                metadata[key] = value

        if not metadata.get('fingerprint'):
            return None

        return {
            'type': 'pr',
            'title': pr.get('title', ''),
            'fingerprint': metadata.get('fingerprint'),
            'category': metadata.get('category', 'research_finding'),
            'evolution': metadata.get('evolution', 'unknown'),
            'success_rate': float(metadata.get('success rate', 0.5)),
            'pr_number': pr.get('number'),
            'pr_url': pr.get('html_url'),
            'author': pr.get('user', {}).get('login', 'unknown'),
            'timestamp': pr.get('created_at', datetime.utcnow().isoformat())
        }

    @staticmethod
    def extract_from_issue(issue: Dict) -> Optional[Dict]:
        """
        Issue から failure pattern を抽出

        期待: Issue title が [FAILURE] で始まる場合
        """
        title = issue.get('title', '')

        if not title.startswith('[FAILURE]'):
            return None

        body = issue.get('body', '')
        fingerprint = hashlib.md5(title.encode()).hexdigest()[:12]

        return {
            'type': 'issue_failure',
            'title': title.replace('[FAILURE]', '').strip(),
            'fingerprint': f"failure_{fingerprint}",
            'category': 'failure_pattern',
            'details': body,
            'issue_number': issue.get('number'),
            'issue_url': issue.get('html_url'),
            'reporter': issue.get('user', {}).get('login', 'unknown'),
            'timestamp': issue.get('created_at', datetime.utcnow().isoformat())
        }


class GitHubWebhookHandler(BaseHTTPRequestHandler):
    """HTTP webhook リクエストハンドラー"""

    # クラス変数で DB と logger を共有
    knowledge_db = None
    logger = None
    webhook_secret = None

    def do_POST(self):
        """POST リクエスト処理"""
        if self.path != '/webhook/unified-knowledge':
            self.send_response(404)
            self.end_headers()
            return

        # Header と body を読む
        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length)

        # 署名検証
        signature = self.headers.get('X-Hub-Signature-256', '')
        if not WebhookValidator.validate_signature(payload, signature, self.webhook_secret):
            self.send_response(401)
            self.end_headers()
            self.logger("[WEBHOOK] Invalid signature")
            return

        # JSON パース
        try:
            event = json.loads(payload.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        # イベント処理
        event_type = self.headers.get('X-GitHub-Event', '')
        knowledge_ids = self.process_event(event_type, event)

        # レスポンス
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

        response = {
            'status': 'ok',
            'event_type': event_type,
            'knowledge_ids': knowledge_ids
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))

        self.logger(f"[WEBHOOK] {event_type}: {len(knowledge_ids or [])} knowledge created")

    def process_event(self, event_type: str, event: Dict) -> Optional[list]:
        """イベント処理"""
        knowledge_ids = []

        if event_type == 'push':
            return self._handle_push(event)
        elif event_type == 'pull_request' and event.get('action') == 'opened':
            return self._handle_pr_opened(event)
        elif event_type == 'issues' and event.get('action') == 'opened':
            return self._handle_issue_opened(event)

        return knowledge_ids

    def _handle_push(self, event: Dict) -> list:
        """push イベント処理"""
        knowledge_ids = []
        commits = event.get('commits', [])
        repo_name = event.get('repository', {}).get('full_name', 'unknown')

        for commit in commits:
            knowledge = KnowledgeExtractor.extract_from_commit(commit)
            if not knowledge:
                continue

            # ナレッジを DB に記録
            knowledge_id = self._create_knowledge(knowledge, repo_name)
            if knowledge_id:
                knowledge_ids.append(knowledge_id)

        return knowledge_ids

    def _handle_pr_opened(self, event: Dict) -> list:
        """PR opened イベント処理"""
        pr = event.get('pull_request', {})
        repo_name = event.get('repository', {}).get('full_name', 'unknown')

        knowledge = KnowledgeExtractor.extract_from_pr(pr)
        if not knowledge:
            return []

        knowledge_id = self._create_knowledge(knowledge, repo_name)
        return [knowledge_id] if knowledge_id else []

    def _handle_issue_opened(self, event: Dict) -> list:
        """Issue opened イベント処理"""
        issue = event.get('issue', {})
        repo_name = event.get('repository', {}).get('full_name', 'unknown')

        knowledge = KnowledgeExtractor.extract_from_issue(issue)
        if not knowledge:
            return []

        knowledge_id = self._create_knowledge(knowledge, repo_name)
        return [knowledge_id] if knowledge_id else []

    def _create_knowledge(self, extracted: Dict, repo_name: str) -> Optional[str]:
        """抽出したナレッジを DB に記録"""
        fingerprint = extracted.get('fingerprint', 'unknown')
        hash_input = f'{fingerprint}{repo_name}{datetime.utcnow().date()}'
        knowledge_id = f"kn_{hashlib.md5(hash_input.encode()).hexdigest()[:12]}"

        # 重複チェック
        if self.knowledge_db.check_duplicate(knowledge_id):
            self.logger(f"[DEDUPE] {knowledge_id} already exists")
            return None

        # DB に記録
        knowledge_entity = {
            'knowledge_id': knowledge_id,
            'schema_version': '1.0',
            'source_repos': [repo_name],
            'category': extracted.get('category', 'research_finding'),
            'created_by_agent': f"webhook_{extracted.get('type')}",
            'created_at': extracted.get('timestamp', datetime.utcnow().isoformat()),
            'content': {
                'title': extracted.get('title', ''),
                'fingerprint': extracted.get('fingerprint', ''),
                'details': extracted.get('details', '')
            },
            'evidence': {
                'url': extracted.get('commit_url') or extracted.get('pr_url') or extracted.get('issue_url', ''),
                'author': extracted.get('author') or extracted.get('reporter', '')
            },
            'effectiveness': {
                'success_rate': extracted.get('success_rate', 0.5),
                'applications': 0
            },
            'tags': [extracted.get('category', 'unknown')]
        }

        self.knowledge_db.append_knowledge(knowledge_entity)
        self.logger(f"[CREATED] {knowledge_id}")
        return knowledge_id

    def log_message(self, format, *args):
        """Flask の standard logger の代わりを使用"""
        pass  # 自分たちの logger を使う


def create_webhook_server(
    knowledge_db,
    host: str = '0.0.0.0',
    port: int = 8000,
    webhook_secret: str = None,
    logger=None
) -> HTTPServer:
    """
    Webhook サーバーを作成

    Args:
        knowledge_db: ナレッジDB（sheets_connector など）
        host: リスン IP
        port: リスンポート
        webhook_secret: GitHub webhook secret
        logger: ロガー関数

    Returns:
        HTTPServer インスタンス
    """
    GitHubWebhookHandler.knowledge_db = knowledge_db
    GitHubWebhookHandler.webhook_secret = webhook_secret or os.getenv('GITHUB_WEBHOOK_SECRET', '')
    GitHubWebhookHandler.logger = logger or print

    server = HTTPServer((host, port), GitHubWebhookHandler)
    return server


def run_webhook_server(
    knowledge_db,
    port: int = 8000,
    webhook_secret: str = None,
    logger=None
):
    """
    Webhook サーバーをブロッキング実行

    実装例:
    ```python
    from sheets_connector import MockKnowledgeSheetsDB

    db = MockKnowledgeSheetsDB()
    run_webhook_server(db, port=8000, webhook_secret='your-secret')
    ```
    """
    server = create_webhook_server(knowledge_db, port=port, webhook_secret=webhook_secret, logger=logger)

    if logger:
        logger(f"[WEBHOOK] Starting server on port {port}")
        logger(f"[WEBHOOK] Endpoint: http://0.0.0.0:{port}/webhook/unified-knowledge")

    server.serve_forever()


def run_webhook_server_threaded(
    knowledge_db,
    port: int = 8000,
    webhook_secret: str = None,
    logger=None
) -> threading.Thread:
    """
    Webhook サーバーをスレッドで実行

    Returns:
        スレッドオブジェクト
    """
    thread = threading.Thread(
        target=run_webhook_server,
        args=(knowledge_db,),
        kwargs={'port': port, 'webhook_secret': webhook_secret, 'logger': logger},
        daemon=True
    )
    thread.start()
    return thread


if __name__ == "__main__":
    # テスト実行
    from sheets_connector import MockKnowledgeSheetsDB

    db = MockKnowledgeSheetsDB()

    print("Starting webhook server...")
    print("Send test webhook to: http://localhost:8000/webhook/unified-knowledge")

    # テスト用: スレッドで起動
    thread = run_webhook_server_threaded(db, port=8000, webhook_secret='test-secret')

    # Keep alive
    try:
        thread.join()
    except KeyboardInterrupt:
        print("\nShutdown")
