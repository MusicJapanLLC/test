#!/usr/bin/env python3
"""
Senju Target Watcher — 許可済みターゲットの自動検出・スウォーム投入

outward_targets.json を監視し、新規ターゲットが追加されたら:
1. TrustedScope に自動登録
2. 即座にスウォームへ投入（authorized_assessment + spear検査）
3. 結果をredteam_ledger.json に記録

安全境界（動かせない）:
  - outward_targets.json に明示的に記載されたドメイン以外は絶対に触らない
  - authorized_assessmentの SAFE_CHECKS のみ実行（破壊的操作なし）
  - ScopeGuard を通過しない参照は全て拒否
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "senju"))

TARGETS_FILE = REPO_ROOT / "senju" / "outward_targets.json"
LEDGER_FILE = Path("/tmp/senju-swarm/redteam_ledger.json")
SEEN_TARGETS_FILE = Path("/tmp/senju-swarm/seen_targets.json")

SAFE_CHECKS = ["reachability", "root_snapshot", "security_txt", "robots_txt", "options"]


def load_targets() -> list[dict[str, Any]]:
    if not TARGETS_FILE.exists():
        return []
    data = json.loads(TARGETS_FILE.read_text())
    return data.get("targets", [])


def load_seen() -> set[str]:
    if not SEEN_TARGETS_FILE.exists():
        return set()
    return set(json.loads(SEEN_TARGETS_FILE.read_text()).get("seen", []))


def save_seen(seen: set[str]) -> None:
    SEEN_TARGETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SEEN_TARGETS_FILE.write_text(json.dumps({"seen": sorted(seen)}))


def run_assessment_on_target(target: dict[str, Any]) -> dict[str, Any]:
    """authorized_assessmentを使って単一ターゲットを安全に検査する。"""
    from senju.authorized_assessment import AssessmentPlan, run_plan
    from senju.external import ExternalContactPolicy

    base_url = target["base_url"]
    root = target["root"]

    policy = ExternalContactPolicy(
        allow_https=True,
        allow_http=False,
        read_timeout=10.0,
        max_redirects=3,
        rate_limit_rps=2.0,
    )

    plan = AssessmentPlan(
        engagement_id=f"auto-watch-{root}-{int(time.time())}",
        authorized_roots=[root],
        checks=list(SAFE_CHECKS),
        base_url=base_url,
        contact_policy=policy,
    )

    try:
        result = run_plan(plan)
        return {
            "target": root,
            "base_url": base_url,
            "timestamp": time.time(),
            "status": "success",
            "checks": result,
        }
    except Exception as exc:
        return {
            "target": root,
            "base_url": base_url,
            "timestamp": time.time(),
            "status": "error",
            "error": str(exc),
        }


def append_ledger(entry: dict[str, Any]) -> None:
    LEDGER_FILE.parent.mkdir(parents=True, exist_ok=True)
    ledger: list[dict[str, Any]] = []
    if LEDGER_FILE.exists():
        try:
            ledger = json.loads(LEDGER_FILE.read_text())
        except json.JSONDecodeError:
            ledger = []
    ledger.append(entry)
    # 直近200件だけ保持
    LEDGER_FILE.write_text(json.dumps(ledger[-200:], indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Senju Target Watcher")
    parser.add_argument("--force-all", action="store_true", help="全ターゲットを再検査（差分無視）")
    parser.add_argument("--dry-run", action="store_true", help="検査せず対象の表示のみ")
    args = parser.parse_args()

    targets = load_targets()
    seen = load_seen() if not args.force_all else set()

    new_targets = [t for t in targets if t["root"] not in seen]

    if not new_targets:
        print("[watcher] 新規ターゲットなし。現在の許可済みリスト:")
        for t in targets:
            print(f"  ✓ {t['root']} ({t['base_url']})")
        return

    print(f"[watcher] {len(new_targets)} 件の新規ターゲットを検出:")
    for t in new_targets:
        print(f"  → {t['root']} ({t['base_url']})")

    if args.dry_run:
        print("[watcher] --dry-run モード: 実際の検査はスキップ")
        return

    results = []
    for t in new_targets:
        print(f"[watcher] 検査開始: {t['root']}", flush=True)
        result = run_assessment_on_target(t)
        results.append(result)
        append_ledger(result)
        seen.add(t["root"])
        status = result["status"]
        if status == "success":
            checks = result.get("checks", {})
            print(f"  ✓ {t['root']}: {status} — {list(checks.keys())}")
        else:
            print(f"  ✗ {t['root']}: {status} — {result.get('error', '?')}")

    save_seen(seen)

    success_count = sum(1 for r in results if r["status"] == "success")
    print(f"\n[watcher] 完了: {success_count}/{len(results)} 成功 → {LEDGER_FILE}")

    # CI用: 全部失敗なら非ゼロ
    if success_count == 0 and results:
        sys.exit(1)


if __name__ == "__main__":
    main()
