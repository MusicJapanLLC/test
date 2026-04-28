"""Gmail OAuth ブートストラップ。

事前準備:
  1. Google Cloud Console で OAuth クライアント (Desktop App) を作成
  2. 認証情報JSONを `gmail_credentials.json` として配置
  3. `python -m scripts.gmail_auth` を実行 → ブラウザで認可 → token.json 生成

以後 src/mail_client.py の GmailClient は token.json を読んで送信する。
"""

import argparse
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--credentials", default="./gmail_credentials.json")
    parser.add_argument("--token", default="./token.json")
    args = parser.parse_args()

    if not Path(args.credentials).exists():
        raise SystemExit(f"OAuth クライアント認証情報が見つかりません: {args.credentials}")

    flow = InstalledAppFlow.from_client_secrets_file(args.credentials, SCOPES)
    creds = flow.run_local_server(port=0)
    Path(args.token).write_text(creds.to_json(), encoding="utf-8")
    print(f"[ok] token saved to {args.token}")


if __name__ == "__main__":
    main()
