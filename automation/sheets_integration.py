#!/usr/bin/env python3
"""
NASA JAPAN ← → Google Sheets 自動連携エンジン

Service Account方式での自動化実装
- 同じSheetに日付ごとのタブで追記
- 30分ごとのループで自動更新

セットアップ:
  1. Google Cloud Console で Service Account を作成
  2. 認証JSONキーを /tmp/nasa-japan-sheets-key.json に配置
  3. スクリプト実行 → Sheetが自動作成される
"""

import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import datetime

try:
    from google.oauth2.service_account import Credentials
    from google.auth.transport.requests import Request
    import googleapiclient.discovery
    SHEETS_AVAILABLE = True
except ImportError:
    SHEETS_AVAILABLE = False
    print("⚠️  google-auth-oauthlib not installed")
    print("   Run: pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client")


class NASAJapanSheets:
    """Google Sheets自動管理クラス"""

    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    SHEET_TITLE = '🚀 NASA JAPAN - 宇宙開発×AI研究ナレッジグラフ'

    def __init__(self, credentials_path: str = '/tmp/nasa-japan-sheets-key.json'):
        self.credentials_path = Path(credentials_path)
        self.service = None
        self.sheet_id = None

        if self.credentials_path.exists():
            self._authenticate()
        else:
            print(f"⚠️  Credentials file not found: {credentials_path}")
            print("   Service Account setup required (see README)")

    def _authenticate(self):
        """Google Sheets APIで認証"""
        if not SHEETS_AVAILABLE:
            print("❌ Google API libraries not available")
            return

        try:
            credentials = Credentials.from_service_account_file(
                self.credentials_path, scopes=self.SCOPES
            )
            self.service = googleapiclient.discovery.build('sheets', 'v4', credentials=credentials)
            print("✅ Google Sheets API authenticated")
        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            self.service = None

    def get_or_create_sheet(self) -> Optional[str]:
        """
        既存のNASA JAPANシートを探す、なければ作成
        Returns: Sheet ID
        """
        if not self.service:
            print("⚠️  Sheets service not available")
            return None

        try:
            # 既存Sheetをドライブで検索
            drive = googleapiclient.discovery.build('drive', 'v3', credentials=self.service._http)
            query = f"name='{self.SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet'"
            results = drive.files().list(q=query, spaces='drive', pageSize=1).execute()

            if results.get('files'):
                sheet_id = results['files'][0]['id']
                print(f"✅ Found existing sheet: {sheet_id}")
                self.sheet_id = sheet_id
                return sheet_id
            else:
                # 新規作成
                sheet_id = self._create_new_sheet()
                return sheet_id

        except Exception as e:
            print(f"⚠️  Sheet search error: {e}")
            return None

    def _create_new_sheet(self) -> Optional[str]:
        """新規Sheetを作成"""
        try:
            sheet_body = {'properties': {'title': self.SHEET_TITLE}}
            sheet = self.service.spreadsheets().create(body=sheet_body).execute()
            sheet_id = sheet.get('spreadsheetId')
            print(f"✅ Created new sheet: {sheet_id}")
            self.sheet_id = sheet_id

            # 概要タブを追加
            self._add_overview_tab()

            return sheet_id

        except Exception as e:
            print(f"❌ Sheet creation failed: {e}")
            return None

    def _add_overview_tab(self):
        """概要タブ（メタデータ）を追加"""
        if not self.sheet_id or not self.service:
            return

        try:
            overview_data = [
                ['NASA JAPAN Research Engine Dashboard'],
                [''],
                ['Project', '宇宙開発×AI自動研究システム'],
                ['Loop Interval', '30分'],
                ['Data Sources', 'arXiv, NASA, GitHub, IEEE'],
                ['Update Method', 'Service Account (Auto)'],
                ['Created', datetime.datetime.now().isoformat()],
                [''],
                ['Sheet Management'],
                ['Latest Data Tab', '→ 常に最新の日付タブを参照'],
                ['Historical Data', '→ 日付ごとのタブで履歴管理'],
            ]

            batch_update_body = {
                'requests': [
                    {
                        'addSheet': {
                            'properties': {
                                'title': '📊 Overview',
                                'sheetId': 0,
                                'gridProperties': {'rowCount': 100, 'columnCount': 4}
                            }
                        }
                    }
                ]
            }

            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.sheet_id,
                body=batch_update_body
            ).execute()

            # データ書き込み
            self.service.spreadsheets().values().update(
                spreadsheetId=self.sheet_id,
                range='Overview!A1:B11',
                valueInputOption='RAW',
                body={'values': overview_data}
            ).execute()

            print("✅ Overview tab created")

        except Exception as e:
            print(f"⚠️  Overview tab creation error: {e}")

    def add_data_tab(self, data: Dict[str, List[List]], timestamp: str):
        """
        日付ごとのタブを追加してデータを書き込む
        """
        if not self.sheet_id or not self.service:
            print("⚠️  Sheets not available")
            return

        try:
            # タブ名: 日付 + 時刻
            tab_name = datetime.datetime.fromisoformat(timestamp).strftime('%Y-%m-%d %H:%M')

            # 既存タブを確認
            sheet_metadata = self.service.spreadsheets().get(
                spreadsheetId=self.sheet_id
            ).execute()

            existing_tabs = {s['properties']['title']: s['properties']['sheetId']
                           for s in sheet_metadata.get('sheets', [])}

            if tab_name in existing_tabs:
                print(f"⚠️  Tab already exists: {tab_name}")
                return

            # 新規タブ作成
            batch_update_body = {
                'requests': [
                    {
                        'addSheet': {
                            'properties': {
                                'title': tab_name,
                                'gridProperties': {'rowCount': 1000, 'columnCount': 10}
                            }
                        }
                    }
                ]
            }

            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.sheet_id,
                body=batch_update_body
            ).execute()

            print(f"✅ Tab created: {tab_name}")

            # データ書き込み
            self._write_tab_data(tab_name, data)

        except Exception as e:
            print(f"❌ Tab creation error: {e}")

    def _write_tab_data(self, tab_name: str, data: Dict[str, List[List]]):
        """タブにデータを書き込む（複数シート対応）"""
        try:
            current_row = 1

            for sheet_name, rows in data.items():
                if not rows:
                    continue

                # シート名をヘッダーとして追加
                header_range = f"{tab_name}!A{current_row}"
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.sheet_id,
                    range=header_range,
                    valueInputOption='RAW',
                    body={'values': [[f"📋 {sheet_name}"]]}
                ).execute()

                current_row += 1

                # データ書き込み
                data_range = f"{tab_name}!A{current_row}"
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.sheet_id,
                    range=data_range,
                    valueInputOption='RAW',
                    body={'values': rows}
                ).execute()

                current_row += len(rows) + 2  # データ + 空行

            print(f"✅ Data written to tab: {tab_name}")
            self._print_sheet_link()

        except Exception as e:
            print(f"❌ Data write error: {e}")

    def _print_sheet_link(self):
        """Sheetへのリンクを表示"""
        if self.sheet_id:
            url = f"https://docs.google.com/spreadsheets/d/{self.sheet_id}/edit"
            print(f"\n🔗 Sheet URL: {url}\n")

    def get_sheet_url(self) -> Optional[str]:
        """Sheetへのリンクを返す"""
        if self.sheet_id:
            return f"https://docs.google.com/spreadsheets/d/{self.sheet_id}/edit"
        return None


def integrate_with_research_engine(research_data: Dict[str, Any]) -> Optional[str]:
    """
    研究エンジンの結果をGoogle Sheetsに統合

    Called from space_ai_research_engine.py
    """
    if not SHEETS_AVAILABLE:
        print("⚠️  Skipping Sheets integration (Google API not installed)")
        return None

    sheets = NASAJapanSheets()

    # Sheetを作成/取得
    sheet_id = sheets.get_or_create_sheet()
    if not sheet_id:
        return None

    # データを追加
    sheets.add_data_tab(research_data['sheets'], research_data['timestamp'])

    return sheets.get_sheet_url()


# ============================================================================
# CLI: スタンドアロン実行用
# ============================================================================

if __name__ == '__main__':
    print("NASA JAPAN - Google Sheets Integration")
    print("=" * 60)

    sheets = NASAJapanSheets()

    if sheets.service:
        sheet_id = sheets.get_or_create_sheet()
        if sheet_id:
            print(f"\n✅ Ready for automated data sync")
            print(f"   Sheet ID: {sheet_id}")
            print(f"   30-min loop will auto-append data tabs")
    else:
        print("\n❌ Google Sheets integration not available")
        print("\nSetup instructions:")
        print("  1. Go to: https://console.cloud.google.com/")
        print("  2. Create Service Account")
        print("  3. Download JSON key file")
        print("  4. Save to: /tmp/nasa-japan-sheets-key.json")
        print("  5. Share Sheet with Service Account email")
