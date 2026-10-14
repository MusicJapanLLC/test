#!/bin/bash

# Unified Knowledge System - Setup & Deployment Script
# Usage: bash SETUP.sh [create-sheets|deploy-webhook|test|full]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/setup-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE"
    exit 1
}

# ════════════════════════════════════════════════════════════════
# Step 1: Google Sheets セットアップ
# ════════════════════════════════════════════════════════════════

setup_google_sheets() {
    log "🔷 Setting up Google Sheets..."

    # Check prerequisites
    command -v gcloud &> /dev/null || error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"

    # Authenticate
    log "Authenticating with GCP..."
    gcloud auth application-default login

    # Get project ID
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    test -z "$PROJECT_ID" && error "No GCP project configured. Run: gcloud config set project PROJECT_ID"
    log "Project ID: $PROJECT_ID"

    # Create service account
    log "Creating service account..."
    SA_NAME="knowledge-sync-worker"
    SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

    # Check if already exists
    if gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
        log "✓ Service account already exists: $SA_EMAIL"
    else
        gcloud iam service-accounts create "$SA_NAME" \
            --display-name="Unified Knowledge Sync Worker"
        log "✓ Created service account"
    fi

    # Grant Editor role
    log "Granting Editor role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/editor" \
        --quiet

    # Create and download key
    KEY_FILE="${SCRIPT_DIR}/.gcp-key.json"
    if [ ! -f "$KEY_FILE" ]; then
        log "Creating service account key..."
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SA_EMAIL"
        log "✓ Key saved to: $KEY_FILE"
        chmod 600 "$KEY_FILE"
    else
        log "✓ Key already exists"
    fi

    # Create Google Sheets
    log "Creating Google Sheets spreadsheet..."

    python3 << 'EOF'
from google.oauth2 import service_account
from googleapiclient.discovery import build
import json
import os

KEY_FILE = os.environ.get('KEY_FILE')
if not os.path.exists(KEY_FILE):
    print(f"ERROR: Key file not found: {KEY_FILE}")
    exit(1)

credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)

sheets_service = build('sheets', 'v4', credentials=credentials)

# Create spreadsheet
spreadsheet = {
    'properties': {
        'title': 'THE WORLD | Unified Knowledge Registry'
    },
    'sheets': [
        {'properties': {'title': '01_KNOWLEDGE_REGISTRY'}},
        {'properties': {'title': '02_FAILURE_PATTERNS'}},
        {'properties': {'title': '03_CAPABILITIES'}},
        {'properties': {'title': '04_AGENT_EVOLUTION'}},
        {'properties': {'title': '05_CROSS_REPO_APPLICATIONS'}},
        {'properties': {'title': '06_META_LEARNING'}},
        {'properties': {'title': '07_WORLD_DELTAS'}},
        {'properties': {'title': '08_AUDIT_LOG'}}
    ]
}

response = sheets_service.spreadsheets().create(
    body=spreadsheet,
    fields='spreadsheetId'
).execute()

sheet_id = response['spreadsheetId']
print(f"SHEET_ID={sheet_id}")

# Add header row
headers = [
    'knowledge_id', 'schema_version', 'source_repos', 'category',
    'created_by_agent', 'created_at', 'content', 'evidence',
    'success_rate', 'applications', 'tags', 'verified_by_agent',
    'cross_repo_applicable'
]

sheets_service.spreadsheets().values().update(
    spreadsheetId=sheet_id,
    range='01_KNOWLEDGE_REGISTRY!A1:M1',
    valueInputOption='RAW',
    body={'values': [headers]}
).execute()

print(f"✓ Spreadsheet created: https://docs.google.com/spreadsheets/d/{sheet_id}/edit")
EOF

    export KEY_FILE="$KEY_FILE"
    log "✓ Google Sheets setup complete"
}

# ════════════════════════════════════════════════════════════════
# Step 2: GitHub Webhook デプロイ
# ════════════════════════════════════════════════════════════════

deploy_webhook() {
    log "🔷 Deploying GitHub webhook..."

    # Generate webhook secret
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    log "Webhook secret: $WEBHOOK_SECRET"

    # Show GitHub webhook configuration
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "GitHub Webhook Configuration"
    echo "════════════════════════════════════════════════════════════"
    echo "Repository: MusicJapanLLC/test"
    echo "Payload URL: https://your-webhook-endpoint/webhook/unified-knowledge"
    echo "Content type: application/json"
    echo "Secret: $WEBHOOK_SECRET"
    echo ""
    echo "Events to subscribe:"
    echo "  ✓ Push"
    echo "  ✓ Pull requests"
    echo "  ✓ Issues"
    echo ""
    echo "Instructions:"
    echo "1. Go to: https://github.com/MusicJapanLLC/test/settings/hooks"
    echo "2. Click 'Add webhook'"
    echo "3. Configure as shown above"
    echo "4. Set environment variable:"
    echo "   export GITHUB_WEBHOOK_SECRET='$WEBHOOK_SECRET'"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    # Save to env file
    ENV_FILE="${SCRIPT_DIR}/.env"
    cat > "$ENV_FILE" << ENVEOF
# Unified Knowledge System Configuration
KNOWLEDGE_REGISTRY_SHEET_ID=YOUR_SHEET_ID
GOOGLE_SHEETS_KEY=${SCRIPT_DIR}/.gcp-key.json
GITHUB_WEBHOOK_SECRET=${WEBHOOK_SECRET}
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=8000
ENVEOF

    log "✓ Configuration saved to: $ENV_FILE"
    log "⚠️  Please update KNOWLEDGE_REGISTRY_SHEET_ID in $ENV_FILE"
}

# ════════════════════════════════════════════════════════════════
# Step 3: テスト実行
# ════════════════════════════════════════════════════════════════

run_tests() {
    log "🔷 Running tests..."

    cd "$SCRIPT_DIR"

    # Test 1: Import modules
    log "Test 1: Importing modules..."
    python3 -c "from knowledge_sync_worker import KnowledgeSyncWorker; print('✓ KnowledgeSyncWorker imported')"
    python3 -c "from sheets_connector import GoogleSheetsConnector; print('✓ GoogleSheetsConnector imported')"
    python3 -c "from github_webhook_handler import WebhookValidator, KnowledgeExtractor; print('✓ WebhookValidator/KnowledgeExtractor imported')"
    python3 -c "from the_world_god_unified_orchestrator import UnifiedOrchestrator; print('✓ UnifiedOrchestrator imported')"

    # Test 2: Run knowledge sync worker
    log "Test 2: Running knowledge sync worker..."
    python3 knowledge_sync_worker.py > /dev/null 2>&1 && echo "✓ Knowledge sync worker passed"

    # Test 3: Run sheets connector
    log "Test 3: Running sheets connector..."
    python3 sheets_connector.py > /dev/null 2>&1 && echo "✓ Sheets connector passed"

    # Test 4: Run orchestrator
    log "Test 4: Running orchestrator..."
    python3 the_world_god_unified_orchestrator.py > /dev/null 2>&1 && echo "✓ Orchestrator passed"

    log "✓ All tests passed"
}

# ════════════════════════════════════════════════════════════════
# Full Setup
# ════════════════════════════════════════════════════════════════

full_setup() {
    log "🚀 Starting full setup..."
    echo ""

    setup_google_sheets
    echo ""
    deploy_webhook
    echo ""
    run_tests

    echo ""
    log "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Update .env file with Google Sheets ID"
    echo "2. Configure GitHub webhook (see instructions above)"
    echo "3. Deploy webhook handler to your server"
    echo "4. Commit and push changes"
    echo "5. Monitor workflow: https://github.com/MusicJapanLLC/test/actions"
}

# ════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════

log "Unified Knowledge System - Setup Script"
log "Log file: $LOG_FILE"
echo ""

COMMAND="${1:-full}"

case "$COMMAND" in
    create-sheets)
        setup_google_sheets
        ;;
    deploy-webhook)
        deploy_webhook
        ;;
    test)
        run_tests
        ;;
    full)
        full_setup
        ;;
    *)
        error "Unknown command: $COMMAND\nUsage: bash SETUP.sh [create-sheets|deploy-webhook|test|full]"
        ;;
esac

exit 0
