#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
from urllib import request, error


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--agent', required=True)
    p.add_argument('--file', required=True)
    p.add_argument('--status', default='unknown')
    args = p.parse_args()

    webhook = os.getenv('TOMOKI_SLACK_WEBHOOK_URL', '').strip()
    if not webhook:
        print('BLOCKED: TOMOKI_SLACK_WEBHOOK_URL is not configured; report not sent.')
        return 0

    path = Path(args.file)
    if path.exists():
        body = path.read_text(encoding='utf-8', errors='replace').strip()
    else:
        body = 'レポートファイルが生成されませんでした。GitHub Actions runを確認してください。'

    body = body[:32000]
    text = f'*TOMOKI / {args.agent}*  |  `{args.status}`\n{body}'
    payload = json.dumps({'text': text}, ensure_ascii=False).encode('utf-8')
    req = request.Request(webhook, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with request.urlopen(req, timeout=15) as res:
            if res.status < 200 or res.status >= 300:
                raise RuntimeError(f'Slack returned HTTP {res.status}')
    except (error.URLError, RuntimeError) as exc:
        print(f'Slack delivery failed: {type(exc).__name__}')
        return 1
    print('Slack report delivered to TOMOKI webhook.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
