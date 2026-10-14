#!/usr/bin/env python3
"""
Unified Knowledge System - Webhook Server (Production)

本番環境用ウェブフックサーバー
- Google Sheets との同期
- リアルタイムナレッジ同期
- THE-WORLD-GOD への通知
"""

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler('/var/log/unified-knowledge/webhook.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('webhook-server')

def setup_environment():
    """環境変数の検証と設定"""
    required_vars = [
        'KNOWLEDGE_REGISTRY_SHEET_ID',
        'GOOGLE_SHEETS_KEY',
        'GITHUB_WEBHOOK_SECRET'
    ]

    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        logger.error(f"Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    return {
        'sheet_id': os.getenv('KNOWLEDGE_REGISTRY_SHEET_ID'),
        'gcp_key': os.getenv('GOOGLE_SHEETS_KEY'),
        'webhook_secret': os.getenv('GITHUB_WEBHOOK_SECRET'),
        'host': os.getenv('WEBHOOK_HOST', '0.0.0.0'),
        'port': int(os.getenv('WEBHOOK_PORT', '8000'))
    }

def main():
    """メインサーバー起動"""
    logger.info("Unified Knowledge System - Webhook Server starting...")

    # Setup
    config = setup_environment()
    logger.info(f"Configuration loaded (Sheet: {config['sheet_id'][:20]}...)")

    # Import components
    try:
        from sheets_connector import GoogleSheetsConnector
        from github_webhook_handler import run_webhook_server
    except ImportError as e:
        logger.error(f"Failed to import modules: {e}")
        sys.exit(1)

    # Initialize database
    try:
        db = GoogleSheetsConnector(config['sheet_id'], config['gcp_key'])
        logger.info("✓ Google Sheets connected")
    except Exception as e:
        logger.error(f"Failed to connect to Google Sheets: {e}")
        sys.exit(1)

    # Start webhook server
    logger.info(f"Starting webhook server on {config['host']}:{config['port']}")
    try:
        run_webhook_server(
            db,
            port=config['port'],
            webhook_secret=config['webhook_secret'],
            logger=logger.info
        )
    except KeyboardInterrupt:
        logger.info("Webhook server shutdown")
    except Exception as e:
        logger.error(f"Webhook server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
