#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
from urllib import request, error


def load_json(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def state_counts(workers: list[dict], key: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for worker in workers:
        value = str(worker.get(key) or 'UNKNOWN')
        out[value] = out.get(value, 0) + 1
    return out


def fmt_counts(counts: dict[str, int]) -> str:
    if not counts:
        return 'no evidence'
    return ', '.join(f'{k}={v}' for k, v in sorted(counts.items()))


def manager_change_header(status: str) -> str:
    snapshot = load_json('tomoki-manager-snapshot.json')
    applied = load_json('tomoki-manager-apply.json')
    if not snapshot:
        return ''

    workers = [w for w in (snapshot.get('workers') or []) if isinstance(w, dict)]
    before = state_counts(workers, 'status')
    after = state_counts(workers, 'action_result')
    repairs = int(snapshot.get('repairs_used', 0) or 0)
    unresolved = len(snapshot.get('unresolved') or [])
    changed = sum(
        1 for w in workers
        if str(w.get('status') or 'UNKNOWN') != str(w.get('action_result') or 'UNKNOWN')
    )
    recovering = sum(1 for w in workers if str(w.get('action_result')) == 'RECOVERING')
    healthy_after = sum(1 for w in workers if str(w.get('action_result')) in {'HEALTHY', 'SUCCESS'})
    problematic_before = sum(
        1 for w in workers if str(w.get('status') or 'UNKNOWN') not in {'HEALTHY', 'ACTIVE', 'SUCCESS'}
    )
    problematic_after = sum(
        1 for w in workers if str(w.get('action_result') or 'UNKNOWN') not in {'HEALTHY', 'ACTIVE', 'SUCCESS'}
    )

    if unresolved:
        conclusion = f'内部修復後も未解決が{unresolved}件残存。診断と実修復を分離し、未解決を成功扱いしていない。'
        owner_benefit = f'全workerログではなく、残った未解決{unresolved}件だけを上位判断候補として扱える。'
        risk = f'未解決{unresolved}件。RECOVERING={recovering}はまだHEALTHY扱いしない。'
    elif repairs:
        conclusion = f'検知した問題に対し内部修復を{repairs}件実行し、Ownerへ未解決を残していない。'
        owner_benefit = 'routineな復旧確認をOwnerが追わず、TOMOKI側で検知→処置→再判定まで閉じられる。'
        risk = f'現在の未解決は0件。RECOVERING={recovering}は次cycleで再検証する。'
    else:
        conclusion = 'このcycleでは新しい修復実績はなし。監視結果のみで、能力向上を捏造しない。'
        owner_benefit = '変化がないcycleを作業実績として膨らませず、本当に状態が変わった時だけ差分を読むことができる。'
        risk = f'未解決={unresolved}; RECOVERING={recovering}。'

    if changed:
        capability = f'{changed} workerで状態遷移を確認。bounded recovery actions={repairs}。'
    elif repairs:
        capability = f'内部処置は{repairs}件実行したが、まだ状態遷移の検証待ち。修復済みとは呼ばない。'
    else:
        capability = '新規のrecovery capabilityはこのcycleでは未証明。'

    next_target = str(
        applied.get('next_improvement')
        or 'RECOVERINGをHEALTHYへ、UNRESOLVEDを解消へ進め、次cycleの独立再検証で確認する。'
    )[:600]
    success = (
        '次cycleで対象workerのafterがHEALTHY/SUCCESSになり、同一fingerprintの再発がなく、'
        '未解決件数が減ること。'
    )
    business = str(applied.get('business_effect') or '').strip()
    if not business:
        business = '運用停止・誤成功報告・Ownerの監視負担を減らす方向の効果。金額/時間効果は未計測。'

    lines = [
        f'*TOMOKI DELTA｜MANAGER*  |  `{status}`',
        f'*監査結論:* {conclusion}',
        f'*Before:* {fmt_counts(before)}',
        f'*After:* {fmt_counts(after)}',
        f'*実際に変わったもの:* state transitions={changed} / internal recovery actions={repairs} / healthy-after={healthy_after}',
        f'*Reliability / autonomy gain:* {capability}',
        f'*Owner benefit:* {owner_benefit}',
        f'*Business effect:* {business}',
        f'*Measured delta:* problematic workers `{problematic_before} -> {problematic_after}` / unresolved-now `{unresolved}` / repairs `0 -> {repairs}`',
        f'*Regression risk:* {risk}',
        f'*Next verification:* {next_target}',
        f'*Success criteria:* {success}',
        '*Technical evidence follows below*',
    ]
    return '\n'.join(lines)


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

    body = body[:28000]
    if args.agent.strip().upper() == 'MANAGER':
        header = manager_change_header(args.status)
        text = f'{header}\n\n---\n*監査詳細 / evidence*\n{body}' if header else f'*TOMOKI / {args.agent}*  |  `{args.status}`\n{body}'
    else:
        text = f'*TOMOKI / {args.agent}*  |  `{args.status}`\n{body}'

    text = text[:32000]
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
