#!/usr/bin/env python3
"""
Senju Swarm Coordinator — 100x 開発速度エンジン

N個の開発エージェントが並列で改善候補を提案し、
最速・最高品質の候補をチャンピオンとして採用する。

設計原則:
- 各エージェントは独立した乱数シードで動作（多様性保証）
- ELO差が閾値以上のエージェントは自動で「増殖」→スウォームが成長する
- 失敗が続くエージェントは「淘汰」→スウォームが最適化される
- 全結果はvelocity_tracker.pyへ送信されリアルタイム速度計測
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "senju"))

from senju.autopilot import run_candidate
from senju.improvement import normalize
from senju.memory import load_state


SWARM_STATE_PATH = Path("/tmp/senju-swarm/state.json")
VELOCITY_LOG_PATH = Path("/tmp/senju-swarm/velocity.jsonl")


@dataclass
class AgentWorker:
    worker_id: int
    seed_offset: int
    wins: int = 0
    losses: int = 0
    total_score: float = 0.0
    generation: int = 0

    @property
    def elo(self) -> float:
        if self.wins + self.losses == 0:
            return 1000.0
        return 1000.0 + (self.wins - self.losses) * 32.0

    def should_replicate(self, threshold: float = 1200.0) -> bool:
        return self.elo >= threshold and self.wins >= 3

    def should_retire(self, threshold: float = 800.0) -> bool:
        return self.elo <= threshold and self.losses >= 3


@dataclass
class SwarmResult:
    worker_id: int
    score: float
    candidate: dict[str, Any]
    elapsed_seconds: float
    stable: bool
    safe: bool
    seed_offset: int


def run_worker(worker: AgentWorker, base_state: dict[str, Any], timeout: float = 60.0) -> SwarmResult:
    """単一エージェントを実行し結果を返す。スレッドセーフ。"""
    t0 = time.monotonic()
    rng = random.Random(base_state.get("rng_seed", 42) + worker.seed_offset)

    try:
        candidate = normalize(base_state.get("strategy", {}), rng)
        result = run_candidate(candidate, base_state, rng=rng)
        elapsed = time.monotonic() - t0
        return SwarmResult(
            worker_id=worker.worker_id,
            score=float(result.get("score", 0.0)),
            candidate=candidate,
            elapsed_seconds=elapsed,
            stable=bool(result.get("stable", False)),
            safe=bool(result.get("safe", True)),
            seed_offset=worker.seed_offset,
        )
    except Exception as exc:
        elapsed = time.monotonic() - t0
        return SwarmResult(
            worker_id=worker.worker_id,
            score=0.0,
            candidate={},
            elapsed_seconds=elapsed,
            stable=False,
            safe=True,
            seed_offset=worker.seed_offset,
        )


def load_swarm_state(path: Path, initial_size: int) -> list[AgentWorker]:
    if path.exists():
        data = json.loads(path.read_text())
        workers = [AgentWorker(**w) for w in data.get("workers", [])]
        if workers:
            return workers
    return [
        AgentWorker(worker_id=i, seed_offset=i * 7 + 13)
        for i in range(initial_size)
    ]


def save_swarm_state(path: Path, workers: list[AgentWorker]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"workers": [asdict(w) for w in workers]}, indent=2))


def log_velocity(path: Path, entry: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def replicate_worker(parent: AgentWorker, all_workers: list[AgentWorker]) -> AgentWorker:
    """成功エージェントの子を生成。シードはシャッフルして多様性を確保。"""
    next_id = max(w.worker_id for w in all_workers) + 1
    child_seed = parent.seed_offset * 3 + next_id * 17
    child = AgentWorker(
        worker_id=next_id,
        seed_offset=child_seed % 9973,  # prime mod for spread
        generation=parent.generation + 1,
    )
    return child


def run_swarm(
    n_workers: int,
    max_workers_cap: int,
    state_path: Path,
    output_path: Path,
    parallelism: int,
) -> dict[str, Any]:
    """メインスウォームループ。並列実行→選抜→増殖→淘汰。"""
    base_state = load_state()
    workers = load_swarm_state(state_path, n_workers)
    t_start = time.monotonic()

    results: list[SwarmResult] = []

    # 並列実行
    with ThreadPoolExecutor(max_workers=parallelism) as pool:
        futures = {pool.submit(run_worker, w, base_state): w for w in workers}
        for future in as_completed(futures):
            r = future.result()
            results.append(r)

    # 結果でELO更新
    results.sort(key=lambda r: r.score, reverse=True)
    winner = results[0] if results else None

    worker_map = {w.worker_id: w for w in workers}
    for rank, r in enumerate(results):
        w = worker_map[r.worker_id]
        if r.stable and r.safe and r.score > 0:
            w.wins += 1
        else:
            w.losses += 1
        w.total_score += r.score

    # 増殖：高ELOエージェントが子を産む
    new_children: list[AgentWorker] = []
    for w in workers:
        if w.should_replicate() and len(workers) + len(new_children) < max_workers_cap:
            child = replicate_worker(w, workers + new_children)
            new_children.append(child)

    # 淘汰：低ELOエージェントを削除
    workers = [w for w in workers if not w.should_retire()]
    workers.extend(new_children)

    save_swarm_state(state_path, workers)

    elapsed_total = time.monotonic() - t_start
    throughput = len(results) / elapsed_total if elapsed_total > 0 else 0.0

    summary = {
        "timestamp": time.time(),
        "n_workers_ran": len(results),
        "n_workers_now": len(workers),
        "n_new_children": len(new_children),
        "best_score": winner.score if winner else 0.0,
        "best_worker_id": winner.worker_id if winner else -1,
        "best_candidate": winner.candidate if winner else {},
        "elapsed_seconds": elapsed_total,
        "throughput_per_sec": round(throughput, 3),
        "stable_count": sum(1 for r in results if r.stable),
        "safe_count": sum(1 for r in results if r.safe),
    }
    log_velocity(output_path, summary)

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Senju Swarm Coordinator")
    parser.add_argument("--workers", type=int, default=10, help="初期並列エージェント数")
    parser.add_argument("--max-workers", type=int, default=50, help="スウォーム上限")
    parser.add_argument("--parallelism", type=int, default=8, help="同時実行スレッド数")
    parser.add_argument("--state", type=Path, default=SWARM_STATE_PATH)
    parser.add_argument("--output", type=Path, default=VELOCITY_LOG_PATH)
    args = parser.parse_args()

    summary = run_swarm(
        n_workers=args.workers,
        max_workers_cap=args.max_workers,
        state_path=args.state,
        output_path=args.output,
        parallelism=args.parallelism,
    )

    print(json.dumps(summary, indent=2))

    # 最良候補をstdoutへ（CIパイプラインが拾う）
    if summary["best_score"] > 0:
        best_path = args.output.parent / "best_candidate.json"
        best_path.write_text(json.dumps(summary["best_candidate"], indent=2))
        print(f"[swarm] best_score={summary['best_score']:.4f} → {best_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
