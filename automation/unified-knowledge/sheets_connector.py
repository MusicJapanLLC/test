"""
Google Sheets Connector for Unified Knowledge System

Role: 統一ナレッジレジストリ（Google Sheets）への読み書きを管理
- リアルタイムの知識追記
- クエリ実行（フィルタ、ソート）
- 重複排除
- 監査ログ
"""

import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib


class GoogleSheetsConnector:
    """
    Google Sheets API v4 統合

    前提:
    - GCP service account JSON key が GOOGLE_SHEETS_KEY 環境変数に
    - Sheets ID が KNOWLEDGE_REGISTRY_SHEET_ID に設定済み
    - Sheet が public with view link または service account が共有者
    """

    def __init__(self, sheet_id: Optional[str] = None, api_key: Optional[str] = None):
        """
        初期化

        Args:
            sheet_id: Google Sheets ID (env:KNOWLEDGE_REGISTRY_SHEET_ID から読む)
            api_key: GCP API key (env:GOOGLE_SHEETS_KEY から読む)
        """
        self.sheet_id = sheet_id or os.getenv('KNOWLEDGE_REGISTRY_SHEET_ID')
        self.api_key = api_key or os.getenv('GOOGLE_SHEETS_KEY')

        if not self.sheet_id:
            raise ValueError("KNOWLEDGE_REGISTRY_SHEET_ID not set")

        # 本番環境では google.auth で認証、ここではシミュレーション
        self.service = self._init_service()

        self.sheets_config = {
            '01_KNOWLEDGE_REGISTRY': 'A1:M1000',
            '02_FAILURE_PATTERNS': 'A1:M500',
            '03_CAPABILITIES': 'A1:M300',
            '04_AGENT_EVOLUTION': 'A1:M200',
            '05_CROSS_REPO_APPLICATIONS': 'A1:M500',
            '06_META_LEARNING': 'A1:M300',
            '07_WORLD_DELTAS': 'A1:M400',
            '08_AUDIT_LOG': 'A1:M2000'
        }

    def _init_service(self):
        """
        Google Sheets API サービスの初期化

        本番環境:
        ```python
        from google.oauth2.service_account import Credentials

        credentials = Credentials.from_service_account_file(
            self.api_key,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        service = build('sheets', 'v4', credentials=credentials)
        ```

        ここではモック実装
        """
        return None  # Mock

    def append_knowledge(self, knowledge: Dict) -> bool:
        """
        ナレッジを登録シートの末尾に追記

        Args:
            knowledge: KnowledgeEntity (dict形式)

        Returns:
            True if successful
        """
        row = self._knowledge_to_row(knowledge)
        sheet_name = '01_KNOWLEDGE_REGISTRY'

        # Google Sheets API 呼び出し (本番)
        # response = self.service.spreadsheets().values().append(
        #     spreadsheetId=self.sheet_id,
        #     range=f"'{sheet_name}'!A:M",
        #     valueInputOption="USER_ENTERED",
        #     body={'values': [row]}
        # ).execute()

        # モック実装
        print(f"[SHEETS] Appended to {sheet_name}: {knowledge['knowledge_id']}")
        self._audit_log('APPEND', sheet_name, knowledge['knowledge_id'])

        return True

    def update_knowledge(self, knowledge_id: str, updates: Dict) -> bool:
        """
        既存ナレッジを更新

        Args:
            knowledge_id: 更新するナレッジの ID
            updates: 更新フィールド

        Returns:
            True if successful
        """
        # Step 1: knowledge_id を持つ行を検索
        row_number = self._find_row_by_id(knowledge_id)

        if row_number is None:
            print(f"[ERROR] Knowledge {knowledge_id} not found")
            return False

        # Step 2: 更新
        sheet_name = '01_KNOWLEDGE_REGISTRY'

        # 本番: update_cells() で該当行を更新
        # モック実装
        print(f"[SHEETS] Updated {sheet_name} row {row_number}: {knowledge_id}")
        self._audit_log('UPDATE', sheet_name, knowledge_id)

        return True

    def query(
        self,
        category: Optional[str] = None,
        fingerprint: Optional[str] = None,
        source_repo: Optional[str] = None,
        verified_only: bool = False,
        min_success_rate: float = 0.0,
        limit: int = 100,
        order_by: Optional[str] = None
    ) -> List[Dict]:
        """
        ナレッジDB をクエリ

        Args:
            category: 'failure_pattern', 'capability', etc.
            fingerprint: 失敗パターンの指紋
            source_repo: 'test' or 'the-world2'
            verified_only: 検証済みのみ
            min_success_rate: 成功率の下限
            limit: 返す最大件数
            order_by: 'success_rate', 'created_at', etc.

        Returns:
            マッチするナレッジのリスト
        """
        sheet_name = '01_KNOWLEDGE_REGISTRY'

        # 本番: Google Sheets API の filter 機能または local filtering
        # SELECT * FROM knowledge WHERE category=? AND fingerprint=? ...

        # モック実装: 全行を読んで local filtering
        all_knowledge = self._read_all_rows(sheet_name)

        filtered = all_knowledge

        if category:
            filtered = [k for k in filtered if k.get('category') == category]
        if fingerprint:
            filtered = [k for k in filtered if k.get('fingerprint') == fingerprint]
        if source_repo:
            filtered = [k for k in filtered if source_repo in k.get('source_repos', [])]
        if verified_only:
            filtered = [k for k in filtered if k.get('verified_by_agent')]
        if min_success_rate > 0:
            filtered = [
                k for k in filtered
                if k.get('effectiveness', {}).get('success_rate', 0) >= min_success_rate
            ]

        if order_by:
            filtered.sort(
                key=lambda k: k.get(order_by, 0),
                reverse=True
            )

        return filtered[:limit]

    def get_knowledge(self, knowledge_id: str) -> Optional[Dict]:
        """ナレッジを ID で取得"""
        results = self.query()  # すべて読む（本番ではクエリ最適化）
        for k in results:
            if k.get('knowledge_id') == knowledge_id:
                return k
        return None

    def check_duplicate(self, knowledge_id: str) -> bool:
        """ナレッジIDが既に存在するかチェック"""
        return self.get_knowledge(knowledge_id) is not None

    def get_stats(self) -> Dict:
        """ナレッジDB の統計情報"""
        all_knowledge = self._read_all_rows('01_KNOWLEDGE_REGISTRY')

        stats = {
            'total_knowledge': len(all_knowledge),
            'by_category': {},
            'by_repo': {},
            'verified_count': 0,
            'avg_success_rate': 0.0,
            'last_updated': None
        }

        for k in all_knowledge:
            category = k.get('category', 'unknown')
            stats['by_category'][category] = stats['by_category'].get(category, 0) + 1

            for repo in k.get('source_repos', []):
                stats['by_repo'][repo] = stats['by_repo'].get(repo, 0) + 1

            if k.get('verified_by_agent'):
                stats['verified_count'] += 1

            stats['last_updated'] = k.get('created_at', stats['last_updated'])

        if all_knowledge:
            success_rates = [
                k.get('effectiveness', {}).get('success_rate', 0)
                for k in all_knowledge
            ]
            stats['avg_success_rate'] = sum(success_rates) / len(success_rates)

        return stats

    # ════════════════════════════════════════════════════════════════
    # Internal Helpers
    # ════════════════════════════════════════════════════════════════

    def _knowledge_to_row(self, knowledge: Dict) -> List[Any]:
        """KnowledgeEntity を Sheets 行に変換"""
        return [
            knowledge.get('knowledge_id', ''),
            knowledge.get('schema_version', '1.0'),
            ','.join(knowledge.get('source_repos', [])),
            knowledge.get('category', ''),
            knowledge.get('created_by_agent', ''),
            knowledge.get('created_at', datetime.utcnow().isoformat()),
            json.dumps(knowledge.get('content', {})),
            json.dumps(knowledge.get('evidence', {})),
            knowledge.get('effectiveness', {}).get('success_rate', 0),
            knowledge.get('effectiveness', {}).get('applications', 0),
            ','.join(knowledge.get('tags', [])),
            knowledge.get('evidence', {}).get('verified_by_agent', ''),
            'YES' if knowledge.get('cross_repo_usage') else 'NO'
        ]

    def _row_to_knowledge(self, row: List[Any]) -> Dict:
        """Sheets 行を KnowledgeEntity に変換"""
        if len(row) < 13:
            return {}

        return {
            'knowledge_id': row[0] or '',
            'schema_version': row[1] or '1.0',
            'source_repos': (row[2] or '').split(','),
            'category': row[3] or '',
            'created_by_agent': row[4] or '',
            'created_at': row[5] or '',
            'content': json.loads(row[6] or '{}'),
            'evidence': json.loads(row[7] or '{}'),
            'effectiveness': {
                'success_rate': float(row[8] or 0),
                'applications': int(row[9] or 0)
            },
            'tags': (row[10] or '').split(','),
            'verified_by_agent': row[11] or '',
            'cross_repo_applicable': row[12] == 'YES'
        }

    def _find_row_by_id(self, knowledge_id: str) -> Optional[int]:
        """knowledge_id を持つ行番号を検索"""
        all_rows = self._read_all_rows('01_KNOWLEDGE_REGISTRY')
        for i, row in enumerate(all_rows):
            if row.get('knowledge_id') == knowledge_id:
                return i + 2  # Sheet 行番号は 1-indexed, ヘッダー分 +1
        return None

    def _read_all_rows(self, sheet_name: str) -> List[Dict]:
        """シートのすべての行を読む（モック用）"""
        # 本番: API で get() して返す
        # response = self.service.spreadsheets().values().get(
        #     spreadsheetId=self.sheet_id,
        #     range=f"'{sheet_name}'!A:M"
        # ).execute()
        #
        # rows = response.get('values', [])[1:]  # Skip header

        # モック: 空リストを返す
        return []

    def _audit_log(self, operation: str, sheet_name: str, knowledge_id: str):
        """監査ログに記録"""
        audit_row = [
            datetime.utcnow().isoformat(),
            operation,
            sheet_name,
            knowledge_id,
            os.getenv('USER', 'unknown')
        ]

        # 本番: 08_AUDIT_LOG に append
        print(f"[AUDIT] {operation} {sheet_name}: {knowledge_id}")


class MockKnowledgeSheetsDB:
    """テスト用: メモリ内実装"""

    def __init__(self):
        self.store = {}

    def append_knowledge(self, knowledge: Dict) -> bool:
        self.store[knowledge['knowledge_id']] = knowledge
        return True

    def query(self, **filters) -> List[Dict]:
        results = []
        for k in self.store.values():
            match = True
            for key, value in filters.items():
                if isinstance(value, str):
                    if k.get(key) != value:
                        match = False
                elif isinstance(value, list):
                    if not any(v in k.get(key, []) for v in value):
                        match = False
            if match:
                results.append(k)
        return results

    def get_knowledge(self, knowledge_id: str) -> Optional[Dict]:
        return self.store.get(knowledge_id)

    def get(self, knowledge_id: str) -> Optional[Dict]:
        """Alias for get_knowledge for orchestrator compatibility"""
        return self.store.get(knowledge_id)

    def check_duplicate(self, knowledge_id: str) -> bool:
        return knowledge_id in self.store


if __name__ == "__main__":
    # テスト実行
    db = MockKnowledgeSheetsDB()

    test_knowledge = {
        'knowledge_id': 'kn_test_001',
        'schema_version': '1.0',
        'source_repos': ['test'],
        'category': 'failure_pattern',
        'created_by_agent': 'TOMOKI-FORGE',
        'created_at': datetime.utcnow().isoformat(),
        'content': {'fingerprint': 'test_pattern'},
        'effectiveness': {'success_rate': 0.95, 'applications': 3},
        'tags': ['critical', 'deploy']
    }

    db.append_knowledge(test_knowledge)

    print("Query results:", db.query(category='failure_pattern'))
    print("Get:", db.get_knowledge('kn_test_001'))
    print("Duplicate check:", db.check_duplicate('kn_test_001'))
