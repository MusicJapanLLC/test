#!/usr/bin/env python3
"""
Senju Velocity Tracker — 開発速度の計測・分析・最適化提案

何を測るか:
  - candidates_per_hour: 1時間あたりの候補生成数
  - verification_latency_p50/p95: 検証の応答時間
  - swarm_growth_rate: スウォームの成長速度
  - bottleneck_stage: 最も遅いステージ

出力:
  - velocity_report.json: 現在の速度指標
  - optimization_hints.json: ボトルネック解消のための提案
"""
from __future__ import annotations

import json
import math
import statistics
import sys
import time
from pathlib import Path
from typing import Any

VELOCITY_LOG = Path("/tmp/senju-swarm/velocity.jsonl")
REPORT_OUT = Path("/tmp/senju-swarm/velocity_report.json")
HINTS_OUT = Path("/tmp/senju-swarm/optimization_hints.json")


def load_logs(path: Path, max_lines: int = 500) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    lines = path.read_text().strip().splitlines()
    parsed = []
    for line in lines[-max_lines:]:
        try:
            parsed.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return parsed


def compute_velocity(logs: list[dict[str, Any]]) -> dict[str, Any]:
    if not logs:
        return {"status": "no_data"}

    now = time.time()
    one_hour_ago = now - 3600

    recent = [e for e in logs if e.get("timestamp", 0) >= one_hour_ago]
    all_elapsed = [e["elapsed_seconds"] for e in logs if "elapsed_seconds" in e]
    recent_throughput = [e["throughput_per_sec"] for e in recent if "throughput_per_sec" in e]
    all_workers = [e["n_workers_now"] for e in logs if "n_workers_now" in e]

    # candidates/hour = sum of workers ran in last hour
    cph = sum(e.get("n_workers_ran", 0) for e in recent)

    # latency percentiles
    if all_elapsed:
        sorted_e = sorted(all_elapsed)
        p50 = sorted_e[len(sorted_e) // 2]
        p95 = sorted_e[int(len(sorted_e) * 0.95)]
    else:
        p50 = p95 = 0.0

    # swarm growth rate (workers added per cycle)
    growth_deltas = [e.get("n_new_children", 0) for e in logs[-10:]]
    growth_rate = statistics.mean(growth_deltas) if growth_deltas else 0.0

    # best score trend
    scores = [e.get("best_score", 0.0) for e in logs[-20:] if "best_score" in e]
    score_trend = "improving" if len(scores) >= 2 and scores[-1] > scores[0] else "flat"

    # throughput trend
    tp_trend = "accelerating" if len(recent_throughput) >= 2 and recent_throughput[-1] > recent_throughput[0] else "stable"

    return {
        "timestamp": now,
        "candidates_per_hour": cph,
        "verification_latency_p50s": round(p50, 3),
        "verification_latency_p95s": round(p95, 3),
        "swarm_growth_rate": round(growth_rate, 2),
        "current_swarm_size": all_workers[-1] if all_workers else 0,
        "score_trend": score_trend,
        "throughput_trend": tp_trend,
        "total_cycles": len(logs),
        "recent_cycles_1h": len(recent),
    }


def generate_hints(velocity: dict[str, Any]) -> list[dict[str, Any]]:
    hints = []

    cph = velocity.get("candidates_per_hour", 0)
    if cph < 100:
        hints.append({
            "priority": "HIGH",
            "stage": "parallelism",
            "issue": f"候補生成が {cph}/h — 目標1万/hに遠い",
            "action": "swarm_coordinatorの--parallelismを増やす。GitHub Actionsのmatrix.parallelismを16→32へ",
        })

    p95 = velocity.get("verification_latency_p95s", 0)
    if p95 > 30:
        hints.append({
            "priority": "HIGH",
            "stage": "verification",
            "issue": f"検証レイテンシp95={p95:.1f}s — 目標5s以下",
            "action": "shadow_leagueのseedを減らす(5→3)か、timeout短縮。または複数runnerに分散",
        })

    swarm_size = velocity.get("current_swarm_size", 0)
    growth = velocity.get("swarm_growth_rate", 0)
    if swarm_size < 20 and growth < 1:
        hints.append({
            "priority": "MEDIUM",
            "stage": "replication",
            "issue": f"スウォームサイズ={swarm_size}、成長率={growth:.2f} — 自己増殖が機能していない",
            "action": "AgentWorker.should_replicate()のELO閾値を1200→1100へ下げる",
        })

    if velocity.get("score_trend") == "flat":
        hints.append({
            "priority": "MEDIUM",
            "stage": "diversity",
            "issue": "スコアが停滞している — 多様性の枯渇",
            "action": "mutation_rateを0.1→0.25へ上げる。新しいseed_offset戦略(prime stepping)を導入",
        })

    if not hints:
        hints.append({
            "priority": "LOW",
            "stage": "tuning",
            "issue": "全指標が良好",
            "action": "現状維持。次は--max-workersを50→100へ拡大して限界を探る",
        })

    return hints


def main() -> None:
    logs = load_logs(VELOCITY_LOG)
    velocity = compute_velocity(logs)
    hints = generate_hints(velocity)

    REPORT_OUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_OUT.write_text(json.dumps(velocity, indent=2))
    HINTS_OUT.write_text(json.dumps(hints, indent=2))

    print("=== Velocity Report ===")
    print(json.dumps(velocity, indent=2))
    print("\n=== Optimization Hints ===")
    for h in hints:
        print(f"[{h['priority']}] {h['stage']}: {h['issue']}")
        print(f"  → {h['action']}")

    # CI用exit code: HIGH hintがあれば非ゼロ（警告）
    high_count = sum(1 for h in hints if h["priority"] == "HIGH")
    if high_count > 0:
        print(f"\n⚠ {high_count} HIGH priority bottleneck(s) found", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
