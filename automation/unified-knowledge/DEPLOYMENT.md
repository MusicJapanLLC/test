# Unified Knowledge System - Production Deployment Guide

## Overview

完全な Unified Knowledge System を本番環境にデプロイするための完全ガイド。

**デプロイ完了までの時間**: 約30分

---

## Prerequisites（前提条件）

### 必須
- Linux サーバー（Ubuntu 20.04+、RHEL 8+、または同等）
- Python 3.9+
- Docker（オプションだがお勧め）
- Google Cloud Platform アカウント
- GitHub Personal Access Token（webhook設定用）

### ネットワーク
- Webhook サーバーが外部からアクセス可能
- Google Sheets API へのアウトバウンド通信
- GitHub への HTTPS 通信

---

## Step 1: GCP セットアップ（15分）

### 1.1 Google Sheets 作成

```bash
# SETUP.sh を実行して自動セットアップ
cd /path/to/test/automation/unified-knowledge
bash SETUP.sh create-sheets
```

**出力例:**
```
[2026-09-02 19:30:00] Creating Google Sheets spreadsheet...
SHEET_ID=1a2b3c4d5e6f7g8h9i0j
✓ Spreadsheet created: https://docs.google.com/spreadsheets/d/1a2b.../edit
```

**手動でセットアップする場合:**

```bash
# 1. GCP プロジェクトを作成
gcloud projects create unified-knowledge --name="Unified Knowledge"
gcloud config set project unified-knowledge

# 2. Google Sheets API を有効化
gcloud services enable sheets.googleapis.com

# 3. Service Account を作成
gcloud iam service-accounts create knowledge-sync-worker \
  --display-name="Unified Knowledge Sync Worker"

# 4. キーを作成してダウンロード
gcloud iam service-accounts keys create /tmp/key.json \
  --iam-account=knowledge-sync-worker@unified-knowledge.iam.gserviceaccount.com

# 5. Service Account に Editor ロールを付与
gcloud projects add-iam-policy-binding unified-knowledge \
  --member="serviceAccount:knowledge-sync-worker@unified-knowledge.iam.gserviceaccount.com" \
  --role="roles/editor"

# 6. Google Sheets を作成（手動）
# → https://docs.google.com/spreadsheets/create
# → 名前: "THE WORLD | Unified Knowledge Registry"
# → Service Account に共有（Editor 権限）
```

### 1.2 環境変数の設定

```bash
# .env ファイルを作成
cat > /etc/unified-knowledge/webhook.env << EOF
# Google Sheets
KNOWLEDGE_REGISTRY_SHEET_ID=YOUR_SHEET_ID_HERE
GOOGLE_SHEETS_KEY=/opt/unified-knowledge/gcp-key.json

# GitHub Webhook
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Server Configuration
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=8000

# Logging
LOG_LEVEL=INFO
EOF

chmod 600 /etc/unified-knowledge/webhook.env
```

---

## Step 2: サーバー準備（5分）

### 2.1 ディレクトリ構成

```bash
# ディレクトリ作成
sudo mkdir -p /opt/unified-knowledge
sudo mkdir -p /var/log/unified-knowledge
sudo mkdir -p /etc/unified-knowledge

# 権限設定
sudo useradd -m -s /bin/bash webhook || true
sudo chown -R webhook:webhook /opt/unified-knowledge
sudo chown -R webhook:webhook /var/log/unified-knowledge
```

### 2.2 ファイルをコピー

```bash
# リポジトリから本番環境へコピー
sudo cp -r automation/unified-knowledge/*.py /opt/unified-knowledge/
sudo cp automation/unified-knowledge/requirements.txt /opt/unified-knowledge/
sudo cp automation/unified-knowledge/Dockerfile /opt/unified-knowledge/

# GCP キーをコピー
sudo cp /tmp/key.json /opt/unified-knowledge/gcp-key.json
sudo chown webhook:webhook /opt/unified-knowledge/gcp-key.json
sudo chmod 600 /opt/unified-knowledge/gcp-key.json
```

### 2.3 Python 依存関係をインストール

```bash
cd /opt/unified-knowledge

# 方法1: システムPython（推奨）
pip install -r requirements.txt

# 方法2: venv（よりクリーン）
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Step 3: デプロイ方法の選択

### オプション A: systemd サービス（推奨：本番環境向け）

```bash
# サービスファイルをコピー
sudo cp automation/unified-knowledge/unified-knowledge-webhook.service \
  /etc/systemd/system/

# サービスを有効化して起動
sudo systemctl daemon-reload
sudo systemctl enable unified-knowledge-webhook
sudo systemctl start unified-knowledge-webhook

# 状態確認
sudo systemctl status unified-knowledge-webhook
sudo journalctl -u unified-knowledge-webhook -f

# ログ確認
tail -f /var/log/unified-knowledge/webhook.log
```

### オプション B: Docker（スケーラビリティ向け）

```bash
# イメージをビルド
cd /opt/unified-knowledge
docker build -t unified-knowledge:latest .

# コンテナを実行
docker run -d \
  --name unified-knowledge-webhook \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file /etc/unified-knowledge/webhook.env \
  -v /var/log/unified-knowledge:/var/log/unified-knowledge \
  unified-knowledge:latest

# 状態確認
docker ps
docker logs -f unified-knowledge-webhook
```

### オプション C: 手動実行（テスト・デバッグ用）

```bash
# 環境変数をロード
source /etc/unified-knowledge/webhook.env

# サーバーを直接実行
cd /opt/unified-knowledge
python3 webhook-server.py
```

---

## Step 4: GitHub Webhook 設定（5分）

### 4.1 Webhook Secret を取得

```bash
# .env から取得
grep GITHUB_WEBHOOK_SECRET /etc/unified-knowledge/webhook.env
# 出力例: GITHUB_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 4.2 GitHub で Webhook を設定

1. **GitHub リポジトリを開く**
   - https://github.com/MusicJapanLLC/test

2. **Settings → Webhooks → Add webhook**

3. **以下を設定:**
   - **Payload URL**: `https://your-server.com:8000/webhook/unified-knowledge`
   - **Content type**: `application/json`
   - **Secret**: 上記で取得した値をペーストしてください
   - **Which events would you like to trigger this webhook?**
     - ✅ Push events
     - ✅ Pull requests
     - ✅ Issues
   - ✅ Active

4. **Add webhook をクリック**

5. **動作確認: Recent Deliveries タブで最新の配信を確認**

---

## Step 5: 動作確認テスト（5分）

### 5.1 Webhook エンドポイント確認

```bash
# テストペイロード送信
curl -X POST https://your-server.com:8000/webhook/unified-knowledge \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=test" \
  -H "X-GitHub-Event: push" \
  -d '{
    "action": "push",
    "repository": {"full_name": "MusicJapanLLC/test"},
    "commits": [{
      "message": "test: webhook verification\nfingerprint: webhook_test_001\ncategory: research_finding",
      "id": "abc123"
    }]
  }'

# 期待される応答: 200 OK
# {
#   "status": "ok",
#   "event_type": "push",
#   "knowledge_ids": ["kn_xxxxx"]
# }
```

### 5.2 Google Sheets で検証

```bash
# Google Sheets を開いて、新しいエントリが記録されているか確認
# https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
# → "01_KNOWLEDGE_REGISTRY" シートを確認
```

### 5.3 実際の GitHub イベントでテスト

```bash
# 1. テストコミットを push
git commit --allow-empty -m "test(knowledge): webhook test
fingerprint: github_webhook_test
category: research_finding
success_rate: 1.0"

git push origin claude/world-merge-collaboration-dmoec4

# 2. ウェブフックサーバーのログを確認
sudo journalctl -u unified-knowledge-webhook -f

# 期待される出力:
# [WEBHOOK] push: 1 knowledge created
# [CREATED] kn_xxxxx

# 3. Google Sheets で自動記録を確認
```

---

## Step 6: Monitoring & Maintenance

### 6.1 ログモニタリング

```bash
# systemd ログ（リアルタイム）
sudo journalctl -u unified-knowledge-webhook -f

# ログファイル
tail -f /var/log/unified-knowledge/webhook.log

# エラーのみを表示
grep ERROR /var/log/unified-knowledge/webhook.log
```

### 6.2 ヘルスチェック

```bash
# サービスの状態確認
sudo systemctl status unified-knowledge-webhook

# またはDocker の場合
docker inspect unified-knowledge-webhook

# サーバーが応答しているか確認
curl http://localhost:8000/ || echo "Server not responding"
```

### 6.3 定期メンテナンス

```bash
# ログのローテーション設定（logrotate）
sudo cat > /etc/logrotate.d/unified-knowledge << EOF
/var/log/unified-knowledge/*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 webhook webhook
  sharedscripts
  postrotate
    systemctl reload-or-restart unified-knowledge-webhook > /dev/null 2>&1 || true
  endscript
}
EOF
```

---

## Troubleshooting

### ❌ Webhook が到達しない

```bash
# 1. ファイアウォール確認
sudo ufw allow 8000/tcp

# 2. nginx/Apache でリバースプロキシを使用している場合
# → location /webhook/unified-knowledge { proxy_pass http://localhost:8000; }

# 3. GitHub Webhook の "Recent Deliveries" を確認
# → Response status 200 でない場合は、サーバーのログを確認
```

### ❌ Google Sheets に記録されない

```bash
# 1. 環境変数を確認
env | grep KNOWLEDGE
env | grep GOOGLE_SHEETS

# 2. GCP キーの権限を確認
gcloud projects get-iam-policy unified-knowledge

# 3. Sheet ID が正しいか確認
# → KNOWLEDGE_REGISTRY_SHEET_ID の値を確認
```

### ❌ パフォーマンス問題

```bash
# 1. リソース使用状況確認
free -h          # メモリ
df -h             # ディスク
top               # CPU

# 2. サーバーを再起動
sudo systemctl restart unified-knowledge-webhook

# 3. ログをクリア（必要に応じて）
sudo rm /var/log/unified-knowledge/*.log
```

---

## 完成確認チェックリスト

- ✅ GCP Service Account と Google Sheets が作成された
- ✅ WEBHOOK_SECRET が生成・設定された
- ✅ サーバーが 8000 ポートでリッスンしている
- ✅ GitHub Webhook が設定された
- ✅ テストコミット/PR で knowledge が自動記録された
- ✅ Google Sheets に知識が記録されている
- ✅ ログファイルにエラーがない
- ✅ ヘルスチェックが 200 OK を返す

---

## 本番環境への完全デプロイコマンド

```bash
#!/bin/bash
# 全手順を一括実行するスクリプト

set -e

echo "🚀 Unified Knowledge System - Full Deployment"
echo "================================================"

# Prerequisites
sudo apt-get update
sudo apt-get install -y curl git python3 python3-pip python3-venv

# Step 1: Directories
sudo mkdir -p /opt/unified-knowledge /var/log/unified-knowledge /etc/unified-knowledge
sudo useradd -m -s /bin/bash webhook || true

# Step 2: Copy files
sudo cp automation/unified-knowledge/*.py /opt/unified-knowledge/
sudo cp automation/unified-knowledge/requirements.txt /opt/unified-knowledge/
sudo cp automation/unified-knowledge/unified-knowledge-webhook.service /etc/systemd/system/

# Step 3: Install dependencies
cd /opt/unified-knowledge
sudo pip install -r requirements.txt

# Step 4: Setup systemd
sudo systemctl daemon-reload
sudo systemctl enable unified-knowledge-webhook
sudo systemctl start unified-knowledge-webhook

# Step 5: Verify
echo "✅ Deployment complete"
sudo systemctl status unified-knowledge-webhook

echo ""
echo "📋 Next steps:"
echo "1. Configure GitHub Webhook: https://github.com/MusicJapanLLC/test/settings/hooks"
echo "2. Test with: git commit --allow-empty -m 'test(knowledge): webhook test'"
echo "3. Monitor logs: sudo journalctl -u unified-knowledge-webhook -f"
```

保存して実行：
```bash
bash deploy.sh
```

---

## デプロイ完了

すべての手順が完了すると、Unified Knowledge System は本番稼働状態になります。

**確認項目:**
- ✅ サーバーが起動している
- ✅ GitHub からの webhook が受け取られている
- ✅ 知識が Google Sheets に自動記録されている
- ✅ ログが /var/log/unified-knowledge/webhook.log に記録されている

これでシステムは完全に稼働しています。
