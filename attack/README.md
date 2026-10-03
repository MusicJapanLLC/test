# 🔴 ATTACK - Automated Test Coverage Kaleidoscope

最強のREDTEAM統合脆弱性検査スイート。自社システムに対する継続的で進化する攻撃シミュレーション。

**Authorization:** `AUTHORIZED_TEST_TARGETS.json` で明示指定されたテスト対象のみ

## 概要

`attack/` は、以下の4つのフェーズで構成された自律進化型セキュリティテストフレームワークです。

```
Phase 1: 連続脆弱性発見エンジン (SAST/DAST/IaC/SCA)
    ↓
Phase 2: 侵入テスト自動化フレームワーク (権限昇格/APIチェーン/データ流出)
    ↓
Phase 3: 外部資産探索エンジン (サブドメイン/ポート/クラウド設定)
    ↓
Phase 4: 自律進化型監視システム (パターン学習/脅威インテリ/修復追跡)
```

## フェーズ詳細

### Phase 1: Continuous Vulnerability Discovery Engine
**ファイル:** `phase1_scanner_engine.py`

複数の脆弱性検査手法を並行実行：

- **SAST (Static Analysis):** AST解析 + MLパターン検出
  - SQL Injection, XSS, Path Traversal, Command Injection
  - Hardcoded Secrets, Insecure Deserialization, Weak Crypto
  
- **DAST (Dynamic Analysis):** ライブアプリケーションテスト
  - エンドポイント列挙
  - ペイロードベース脆弱性検証
  
- **Infrastructure Audit:** IaC脆弱性検査
  - Terraform/CloudFormation設定チェック
  - 暗号化, アクセス権限, パスワードポリシー
  
- **Dependency Checker:** SCA + 0day検出
  - 既知の脆弱性パッケージ特定
  - バージョン管理ベストプラクティス

**実行:**
```bash
python phase1_scanner_engine.py <target_dir> [target_url]
```

### Phase 2: Automated Penetration Testing Framework
**ファイル:** `phase2_penetration_framework.py`

実践的な侵入テストシミュレーション：

- **Authentication Bypass Testing**
  - JWT署名検証回避
  - Cookie改ざん
  - SQLインジェクション認証回避
  - デフォルト認証情報

- **Privilege Escalation Analysis**
  - グラフベースの昇格パス計算（BFS）
  - 最短攻撃チェーンの特定
  - リスク度の算出

- **API Chain Attack Simulation**
  - エンドポイント自動発掘
  - マルチステップ攻撃シナリオ
  - データフロー分析

- **Data Exfiltration Mapping**
  - SQLインジェクション → DB直結
  - API応答スマグリング
  - ログファイルアクセス
  - DNS流出チャネル

**実行:**
```bash
python phase2_penetration_framework.py [target_url]
```

### Phase 3: External Asset Reconnaissance Engine
**ファイル:** `phase3_recon_engine.py`

自社資産の完全マッピングと露出検査：

- **Subdomain Enumeration**
  - Certificate Transparency Logs
  - DNS Zone Transfer (AXFR)
  - 一般的なサブドメイン辞書

- **Service Fingerprinting**
  - バナー取得
  - サービス特定 (Apache, Nginx, IIS, OpenSSH, etc.)
  - 既知の脆弱性マッチング

- **Cloud Misconfig Detection**
  - S3バケット公開チェック
  - RDS露出検査
  - Lambda IAM権限監査

- **Hidden API Discovery**
  - JavaScriptファイルスキャン
  - OpenAPI/Swagger定義検出
  - Git公開チェック

**実行:**
```bash
python phase3_recon_engine.py [domain] [base_url]
```

### Phase 4: Autonomous Evolution & Monitoring System
**ファイル:** `phase4_autonomous_monitor.py`

継続的な学習と自動適応：

- **Scheduled Scanning**
  - 定期スケジュール実行（デフォルト6時間ごと）
  - スキャン履歴の永続化

- **AI Pattern Learning**
  - 脆弱性タイプの統計分析
  - 検出パターンの進化予測
  - 動的アルゴリズム改善

- **Threat Intelligence**
  - 最新CVE情報の自動取得
  - エクスプロイト可用性判定
  - 影響度の推定

- **Remediation Tracking**
  - SLA管理（Critical: 1日, High: 3日, Medium: 7日, Low: 30日）
  - 修復状況の自動監視
  - コンプライアンス検査

- **Environment Adaptation**
  - インフラ変化の検出
  - 依存関係更新の追跡
  - 設定ドリフトの監視
  - 新攻撃ベクトルの自動検出

**実行:**
```bash
python phase4_autonomous_monitor.py
```

## 統合実行

### オーケストレーター
**ファイル:** `orchestrator.py`

全4フェーズを順序立てて実行し、統合レポートを生成：

```bash
python orchestrator.py <target_dir> [target_url] [domain]
```

**例:**
```bash
python orchestrator.py . https://kabeya-authorized-test-range.onrender.com kabeya-authorized-test-range.onrender.com
```

**出力:**
- `attack_report.json`: 構造化されたセキュリティレポート
  - 各フェーズの詳細結果
  - 統計サマリー
  - 次回スキャン時刻

### 出力フォーマット

```json
{
  "report": {
    "execution_timestamp": "2025-10-03T...",
    "status": "COMPLETED",
    "summary": {
      "total_vulnerabilities": 42,
      "critical_severity": 5,
      "high_severity": 12
    },
    "phases": {
      "phase1_discovery": { "total_vulnerabilities": 25, ... },
      "phase2_penetration": { "total_findings": 10, ... },
      "phase3_reconnaissance": { "total_subdomains": 8, ... },
      "phase4_autonomy": { "patterns_learned": 7, ... }
    }
  },
  "detailed_results": { ... }
}
```

## セキュリティ & 認可

### 認可スコープ

このツールキットは以下のスコープのみで実行できます：

```
Federation ID: the-world-security-test-federation-v1
Authority: https://kabeya-authorized-test-range.onrender.com
Recursive Same-Origin: true
Follow Owner-Published External Links: true
Allowed: crawl, enumerate, mutate, read, create, modify, delete, export, reproduce
Prohibited: DoS, credential reuse (outside test), unauthorized third-party operations
```

AUTHORIZED_TEST_TARGETS.json で明示指定された対象のみ。

### 禁止事項
- ❌ 本番環境への無認可テスト
- ❌ 第三者システムへのスキャン
- ❌ DoS/リソース枯渇攻撃
- ❌ 実ユーザー認証情報の搾取
- ❌ 実データの流出

### 推奨される使用方法
- ✅ サンドボックス環境での検証
- ✅ CI/CDパイプラインへの統合
- ✅ 定期的なセキュリティテスト
- ✅ チーム内セキュリティ意識向上

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/musicjapanllc/test.git
cd test/attack

# 依存関係（Python 3.9+）
pip install -r requirements.txt

# または最小限のセットアップ
python -m pip install --upgrade pip
```

## 依存ツール

- `curl`: HTTP リクエスト
- `dig`: DNS クエリ
- `nc`: ポートスキャン
- `find`: ファイル検索

## 高度な使用方法

### カスタム設定

各フェーズのパラメータをカスタマイズできます：

```python
from phase1_scanner_engine import SASTEngine

sast = SASTEngine(target_dir="./src")
vulns = asyncio.run(sast.scan())
```

### 継続的監視

Phase 4のScheduledScannerで自動監視を有効化：

```python
from phase4_autonomous_monitor import ScheduledScanner

scheduler = ScheduledScanner(schedule_interval_hours=6)
asyncio.run(scheduler.start_continuous_monitoring(scan_function))
```

## トラブルシューティング

### エラー: "Target directory not found"
→ ターゲットディレクトリが存在することを確認してください

### 警告: "Zone transfer failed"
→ DNS設定による制限。正常な動作です（AXFR未サポート環境）

### 低い検出率
→ Phase 4のパターン学習を待つか、カスタムシグネチャを追加

## パフォーマンス

- **Phase 1 (SAST):** ~2秒/1000行
- **Phase 2 (Penetration):** ~30秒
- **Phase 3 (Reconnaissance):** ~60秒
- **Phase 4 (Monitoring):** ~5秒
- **全体実行:** ~2分

大規模プロジェクトは並行処理により高速化。

## ライセンス

内部セキュリティテスト用。
AUTHORIZED_TEST_TARGETS.json の許可範囲でのみ使用。

## サポート

問題報告: GitHub Issues
セキュリティ報告: security@musicjapan.co.jp

---

**REDTEAM Support Framework v1.0**
Generated by Claude Code - Authorized Penetration Testing Suite
