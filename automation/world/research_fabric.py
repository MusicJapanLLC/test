#!/usr/bin/env python3
"""Closed-model autonomous research network for THE WORLD.

Eight labs repeatedly explore synthetic models of THE WORLD itself.  The purpose is
not to claim real-world truth; it is to create a dense, auditable stream of internal
hypotheses, negative results, replications, contradictions, and cross-lab inspiration.

No network, credentials, external targets, or real balances are modified here.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


@dataclass(frozen=True)
class Param:
    low: float
    high: float
    integer: bool = False


@dataclass(frozen=True)
class LabSpec:
    params: dict[str, Param]
    baseline: dict[str, float]
    metric_names: tuple[str, str, str]
    simulator: Callable[[dict[str, float], random.Random, dict[str, Any]], dict[str, float]]


def _bounded(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _bell(x: float, center: float, width: float) -> float:
    return math.exp(-((x - center) ** 2) / max(1e-9, 2.0 * width * width))


def _noise(rng: random.Random, sd: float = 0.025) -> float:
    return rng.gauss(0.0, sd)


def _coordination(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    team = c["team_size"]
    spec = c["specialization"]
    sync = c["sync_rate"]
    red = c["redundancy"]
    throughput = _bounded(0.35 + 0.42 * spec + 0.22 * _bell(team, 6.0, 2.2) + 0.15 * sync - 0.18 * red + _noise(rng))
    collision_avoidance = _bounded(0.30 + 0.48 * sync + 0.20 * red - 0.025 * max(0.0, team - 7.0) + _noise(rng))
    adaptability = _bounded(0.35 + 0.30 * (1.0 - spec) + 0.24 * red + 0.18 * _bell(sync, 0.58, 0.22) + _noise(rng))
    return {"throughput": throughput, "collision_avoidance": collision_avoidance, "adaptability": adaptability}


def _learning(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    exp = c["exploration"]
    mem = c["memory_weight"]
    div = c["ensemble_diversity"]
    pressure = c["selection_pressure"]
    senju_runs = float((ctx.get("experiment_snapshot") or {}).get("runs") or 0)
    prior = min(0.08, math.log1p(senju_runs) / 40.0)
    adaptation = _bounded(0.30 + 0.40 * _bell(exp, 0.40 + prior, 0.18) + 0.20 * div + 0.10 * pressure + _noise(rng))
    stability = _bounded(0.30 + 0.38 * mem + 0.20 * (1.0 - exp) + 0.18 * _bell(pressure, 0.55, 0.22) + _noise(rng))
    knowledge = _bounded(0.26 + 0.30 * mem + 0.30 * div + 0.24 * exp - 0.12 * pressure + _noise(rng))
    return {"adaptation_speed": adaptation, "stability": stability, "knowledge_gain": knowledge}


def _resilience(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    redundancy = c["redundancy"]
    retry = c["retry_budget"]
    checkpoint = c["checkpoint_rate"]
    isolation = c["fault_isolation"]
    recovery = _bounded(0.28 + 0.27 * redundancy + 0.20 * retry + 0.24 * checkpoint + 0.22 * isolation + _noise(rng))
    efficiency = _bounded(0.70 - 0.25 * redundancy - 0.17 * retry - 0.11 * checkpoint + 0.16 * isolation + _noise(rng))
    survival = _bounded(0.26 + 0.30 * redundancy + 0.23 * checkpoint + 0.31 * isolation + _noise(rng))
    return {"recovery": recovery, "efficiency": efficiency, "survival": survival}


def _memory(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    retention = c["retention"]
    compression = c["compression"]
    depth = c["retrieval_depth"]
    provenance = c["provenance_weight"]
    recall = _bounded(0.25 + 0.42 * retention + 0.22 * depth + 0.20 * provenance - 0.20 * compression + _noise(rng))
    cost = _bounded(0.84 - 0.33 * compression - 0.20 * (1.0 - retention) - 0.16 * (1.0 - depth) + _noise(rng))
    trust = _bounded(0.28 + 0.46 * provenance + 0.18 * retention + 0.12 * compression + _noise(rng))
    return {"recall_quality": recall, "storage_efficiency": cost, "provenance_trust": trust}


def _society(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    trust = c["trust_update"]
    mixing = c["group_mixing"]
    forgiveness = c["forgiveness"]
    novelty = c["novelty_bias"]
    cooperation = _bounded(0.30 + 0.30 * trust + 0.22 * mixing + 0.18 * forgiveness - 0.08 * novelty + _noise(rng))
    diversity = _bounded(0.26 + 0.40 * mixing + 0.32 * novelty - 0.12 * trust + _noise(rng))
    recovery = _bounded(0.25 + 0.38 * forgiveness + 0.22 * trust + 0.18 * mixing + _noise(rng))
    return {"cooperation": cooperation, "diversity": diversity, "conflict_recovery": recovery}


def _economy(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    merit = c["merit_weight"]
    base = c["base_access"]
    reinvest = c["reinvestment"]
    grants = c["exploration_grants"]
    wallets = float((ctx.get("economy_snapshot") or {}).get("wallet_count") or 1)
    participation = _bounded(0.22 + 0.35 * base + 0.24 * grants + 0.17 * merit + min(0.06, math.log1p(wallets) / 100.0) + _noise(rng))
    concentration_control = _bounded(0.27 + 0.31 * base + 0.22 * reinvest + 0.17 * grants - 0.18 * merit + _noise(rng))
    innovation = _bounded(0.25 + 0.30 * merit + 0.27 * reinvest + 0.28 * grants - 0.12 * base + _noise(rng))
    return {"participation": participation, "concentration_control": concentration_control, "innovation": innovation}


def _creativity(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    recomb = c["recombination"]
    diversity = c["source_diversity"]
    constraint = c["constraint_strength"]
    curation = c["curation"]
    novelty = _bounded(0.20 + 0.38 * recomb + 0.38 * diversity - 0.20 * constraint - 0.10 * curation + _noise(rng))
    coherence = _bounded(0.26 + 0.36 * curation + 0.32 * constraint + 0.13 * recomb - 0.12 * diversity + _noise(rng))
    propagation = _bounded(0.25 + 0.25 * recomb + 0.27 * diversity + 0.29 * curation - 0.10 * constraint + _noise(rng))
    return {"novelty": novelty, "coherence": coherence, "propagation": propagation}


def _governance(c: dict[str, float], rng: random.Random, ctx: dict[str, Any]) -> dict[str, float]:
    quorum = c["quorum"]
    review = c["review_depth"]
    delegation = c["delegation"]
    veto = c["veto_threshold"]
    quality = _bounded(0.27 + 0.27 * quorum + 0.34 * review + 0.14 * delegation + 0.13 * veto + _noise(rng))
    speed = _bounded(0.82 - 0.31 * quorum - 0.32 * review + 0.24 * delegation - 0.16 * veto + _noise(rng))
    capture_resistance = _bounded(0.24 + 0.29 * quorum + 0.24 * review - 0.17 * delegation + 0.30 * veto + _noise(rng))
    return {"decision_quality": quality, "decision_speed": speed, "capture_resistance": capture_resistance}


SPECS: dict[str, LabSpec] = {
    "COORDINATION": LabSpec({"team_size": Param(2, 12, True), "specialization": Param(0, 1), "sync_rate": Param(0, 1), "redundancy": Param(0, 1)}, {"team_size": 6, "specialization": .55, "sync_rate": .50, "redundancy": .30}, ("throughput", "collision_avoidance", "adaptability"), _coordination),
    "LEARNING": LabSpec({"exploration": Param(.05, .95), "memory_weight": Param(0, 1), "ensemble_diversity": Param(0, 1), "selection_pressure": Param(0, 1)}, {"exploration": .35, "memory_weight": .60, "ensemble_diversity": .50, "selection_pressure": .55}, ("adaptation_speed", "stability", "knowledge_gain"), _learning),
    "RESILIENCE": LabSpec({"redundancy": Param(0, 1), "retry_budget": Param(0, 1), "checkpoint_rate": Param(0, 1), "fault_isolation": Param(0, 1)}, {"redundancy": .35, "retry_budget": .40, "checkpoint_rate": .45, "fault_isolation": .55}, ("recovery", "efficiency", "survival"), _resilience),
    "MEMORY": LabSpec({"retention": Param(0, 1), "compression": Param(0, 1), "retrieval_depth": Param(0, 1), "provenance_weight": Param(0, 1)}, {"retention": .68, "compression": .45, "retrieval_depth": .55, "provenance_weight": .72}, ("recall_quality", "storage_efficiency", "provenance_trust"), _memory),
    "SOCIETY": LabSpec({"trust_update": Param(0, 1), "group_mixing": Param(0, 1), "forgiveness": Param(0, 1), "novelty_bias": Param(0, 1)}, {"trust_update": .55, "group_mixing": .48, "forgiveness": .62, "novelty_bias": .45}, ("cooperation", "diversity", "conflict_recovery"), _society),
    "ECONOMY": LabSpec({"merit_weight": Param(0, 1), "base_access": Param(0, 1), "reinvestment": Param(0, 1), "exploration_grants": Param(0, 1)}, {"merit_weight": .62, "base_access": .32, "reinvestment": .45, "exploration_grants": .35}, ("participation", "concentration_control", "innovation"), _economy),
    "CREATIVITY": LabSpec({"recombination": Param(0, 1), "source_diversity": Param(0, 1), "constraint_strength": Param(0, 1), "curation": Param(0, 1)}, {"recombination": .58, "source_diversity": .62, "constraint_strength": .42, "curation": .55}, ("novelty", "coherence", "propagation"), _creativity),
    "GOVERNANCE": LabSpec({"quorum": Param(.1, .95), "review_depth": Param(0, 1), "delegation": Param(0, 1), "veto_threshold": Param(0, 1)}, {"quorum": .55, "review_depth": .58, "delegation": .45, "veto_threshold": .62}, ("decision_quality", "decision_speed", "capture_resistance"), _governance),
}


def _seed(run_id: int, program: str) -> int:
    raw = hashlib.sha256(f"{run_id}:{program}:world-research-v1".encode()).digest()[:8]
    return int.from_bytes(raw, "big") & 0x7FFFFFFF


def _score(metrics: dict[str, float]) -> float:
    vals = list(metrics.values())
    return 100.0 * (0.44 * statistics.mean(vals) + 0.34 * min(vals) + 0.22 * (1.0 - statistics.pstdev(vals)))


def _clamp_config(spec: LabSpec, cfg: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for key, p in spec.params.items():
        value = float(cfg.get(key, spec.baseline[key]))
        value = max(p.low, min(p.high, value))
        out[key] = float(round(value)) if p.integer else round(value, 6)
    return out


def _previous_center(spec: LabSpec, recent: list[dict[str, Any]], program: str) -> dict[str, float]:
    for f in recent:
        if f.get("program_key") != program:
            continue
        best = (f.get("evidence") or {}).get("best_config")
        if isinstance(best, dict):
            return _clamp_config(spec, best)
    return dict(spec.baseline)


def _sample_config(spec: LabSpec, center: dict[str, float], exploration: float, rng: random.Random) -> dict[str, float]:
    out: dict[str, float] = {}
    for key, p in spec.params.items():
        span = p.high - p.low
        if rng.random() < 0.16 + 0.50 * exploration:
            value = rng.uniform(p.low, p.high)
        else:
            value = float(center[key]) + rng.gauss(0.0, span * (0.06 + 0.20 * exploration))
        value = max(p.low, min(p.high, value))
        out[key] = float(round(value)) if p.integer else round(value, 6)
    return out


def _eval(spec: LabSpec, cfg: dict[str, float], seed: int, ctx: dict[str, Any], repeats: int) -> tuple[float, dict[str, float], float]:
    scores: list[float] = []
    metrics_rows: list[dict[str, float]] = []
    for i in range(repeats):
        rng = random.Random(seed + i * 7919)
        metrics = spec.simulator(cfg, rng, ctx)
        metrics_rows.append(metrics)
        scores.append(_score(metrics))
    avg_metrics = {k: statistics.mean(row[k] for row in metrics_rows) for k in spec.metric_names}
    return statistics.mean(scores), avg_metrics, statistics.pstdev(scores) if len(scores) > 1 else 0.0


def _pick_residents(config: dict[str, Any], program: str, run_id: int, count: int = 4) -> list[str]:
    rows = list(((config.get("resident_snapshot") or {}).get("sample") or []))
    if not rows:
        return []
    rng = random.Random(_seed(run_id, program) ^ 0xA11CE)
    by_class: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_class.setdefault(str(row.get("identity_class") or "other"), []).append(row)
    classes = list(by_class)
    rng.shuffle(classes)
    picked: list[str] = []
    for cls in classes:
        choices = by_class[cls]
        rng.shuffle(choices)
        key = str(choices[0].get("resident_key") or "")
        if key:
            picked.append(key)
        if len(picked) >= count:
            break
    while len(picked) < min(count, len(rows)):
        key = str(rng.choice(rows).get("resident_key") or "")
        if key and key not in picked:
            picked.append(key)
    return picked


def _target_for_replication(config: dict[str, Any], program: str, rng: random.Random, bias: float) -> dict[str, Any] | None:
    candidates = [x for x in (config.get("open_replications") or []) if x.get("program_key") == program]
    if candidates and rng.random() < bias:
        candidates.sort(key=lambda x: (int(x.get("replication_count") or 0), -float(x.get("novelty") or 0)))
        return candidates[0]
    return None


def _foreign_inspiration(config: dict[str, Any], program: str, rng: random.Random) -> dict[str, Any] | None:
    candidates = [x for x in (config.get("recent_findings") or []) if x.get("program_key") != program and float(x.get("novelty") or 0) >= 0.35]
    return rng.choice(candidates[:24]) if candidates and rng.random() < 0.32 else None


def run_lab(program_cfg: dict[str, Any], config: dict[str, Any], run_id: int, slot: int) -> dict[str, Any]:
    program = str(program_cfg["program_key"])
    spec = SPECS[program]
    seed = _seed(run_id, program)
    rng = random.Random(seed)
    exploration = float(program_cfg.get("exploration_rate") or 0.35)
    budget = int(program_cfg.get("trial_budget") or 2500)
    recent = list(config.get("recent_findings") or [])
    center = _previous_center(spec, recent, program)
    replication = _target_for_replication(config, program, rng, float(program_cfg.get("replication_bias") or 0.3))
    inspiration = None if replication else _foreign_inspiration(config, program, rng)
    mode = "REPLICATE" if replication else ("CROSS_POLLINATE" if inspiration else "EXPLORE")

    if replication:
        target_cfg = ((replication.get("evidence") or {}).get("best_config") or {})
        if isinstance(target_cfg, dict) and target_cfg:
            center = _clamp_config(spec, target_cfg)
    if inspiration:
        # Cross-lab findings alter only the random exploration geometry, never execution scope.
        foreign = float(inspiration.get("metric_value") or 0.0)
        nudge = math.tanh(foreign / 100.0) * 0.04
        for key, p in spec.params.items():
            center[key] = max(p.low, min(p.high, float(center[key]) + (p.high - p.low) * nudge))
        center = _clamp_config(spec, center)

    baseline_score, baseline_metrics, baseline_sd = _eval(spec, center, seed ^ 0x101, config, 24)
    micro: list[tuple[float, dict[str, float]]] = []
    for i in range(budget):
        cfg = _sample_config(spec, center, exploration, rng)
        score, _, _ = _eval(spec, cfg, seed + 100000 + i, config, 1)
        micro.append((score, cfg))
    micro.sort(key=lambda x: x[0], reverse=True)

    top = micro[:32]
    deep: list[tuple[float, float, dict[str, float], dict[str, float]]] = []
    for rank, (_, cfg) in enumerate(top):
        score, metrics, sd = _eval(spec, cfg, seed + 500000 + rank * 101, config, 8)
        deep.append((score, sd, cfg, metrics))
    deep.sort(key=lambda x: (x[0] - 0.35 * x[1]), reverse=True)
    _, _, best_cfg, _ = deep[0]

    best_score, best_metrics, best_sd = _eval(spec, best_cfg, seed + 900000, config, 32)
    holdout_base, holdout_base_metrics, holdout_base_sd = _eval(spec, center, seed + 1900000, config, 32)
    delta = best_score - holdout_base
    reproducibility = _bounded(1.0 - (best_sd + holdout_base_sd) / 18.0)
    confidence = _bounded(0.48 + abs(delta) / 18.0 + 0.18 * reproducibility)

    distances: list[float] = []
    for key, p in spec.params.items():
        span = max(1e-9, p.high - p.low)
        distances.append(abs(float(best_cfg[key]) - float(center[key])) / span)
    novelty = _bounded(0.35 * statistics.mean(distances) + 0.45 * min(1.0, abs(delta) / 8.0) + 0.20 * exploration)

    if delta > 0.75:
        finding_type = "POSITIVE"
        direction = "improved"
    elif delta < -0.75:
        finding_type = "NEGATIVE"
        direction = "degraded"
    else:
        finding_type = "NULL"
        direction = "no_clear_change"

    replication_outcome = "inconclusive"
    if replication:
        old_delta = float((replication.get("evidence") or {}).get("delta") or 0.0)
        if abs(delta) >= 0.45 and abs(old_delta) >= 0.45:
            replication_outcome = "support" if (delta > 0) == (old_delta > 0) else "contradict"

    dominant = max(spec.params, key=lambda k: abs(float(best_cfg[k]) - float(center[k])) / max(1e-9, spec.params[k].high - spec.params[k].low))
    hypothesis = (
        f"Closed {program.lower()} model: changing {dominant} away from the current center may produce a measurable composite change."
        if not replication else f"Replicate prior {program.lower()} finding under fresh seeds and holdout contexts."
    )
    if inspiration:
        hypothesis += f" Cross-pollinated from {inspiration.get('program_key')} finding {inspiration.get('finding_id')}."

    claim = (
        f"In the closed {program.lower()} model, the best holdout configuration {direction} the composite score by {delta:+.3f} points versus the current center."
    )
    method_claim = (
        f"{program} replication quality in this cycle was {reproducibility:.3f}; this is model evidence only and does not establish real-world causality."
    )

    trial_count = budget + 32 * 8 + 32 + 32 + 24
    return {
        "program_key": program,
        "lab_slot": slot,
        "mode": mode,
        "hypothesis": hypothesis,
        "question": f"Which bounded {program.lower()} configuration performs best under fresh synthetic contexts?",
        "method": "random micro-search -> top-32 deep repeats -> best-vs-current unseen holdout; all inside a closed synthetic model",
        "seed": seed,
        "selected_resident_keys": _pick_residents(config, program, run_id),
        "inspired_by_finding_id": inspiration.get("finding_id") if inspiration else None,
        "replicate_of_finding_id": replication.get("finding_id") if replication else None,
        "replication_outcome": replication_outcome,
        "trial_count": trial_count,
        "score": round(best_score, 6),
        "novelty": round(novelty, 6),
        "confidence": round(confidence, 6),
        "reproducibility": round(reproducibility, 6),
        "findings": [
            {
                "finding_type": finding_type,
                "claim": claim,
                "metric_name": "holdout_score_delta",
                "metric_value": round(delta, 6),
                "confidence": round(confidence, 6),
                "novelty": round(novelty, 6),
                "evidence": {
                    "closed_model": True,
                    "direction": direction,
                    "delta": round(delta, 6),
                    "best_config": best_cfg,
                    "baseline_config": center,
                    "best_metrics": {k: round(v, 6) for k, v in best_metrics.items()},
                    "baseline_metrics": {k: round(v, 6) for k, v in holdout_base_metrics.items()},
                    "micro_candidates": budget,
                    "deep_candidates": 32,
                    "deep_repeats_each": 8,
                    "holdout_repeats_each": 32,
                    "baseline_precheck_score": round(baseline_score, 6),
                    "baseline_precheck_sd": round(baseline_sd, 6),
                },
            },
            {
                "finding_type": "METHOD",
                "claim": method_claim,
                "metric_name": "reproducibility",
                "metric_value": round(reproducibility, 6),
                "confidence": round(confidence, 6),
                "novelty": round(novelty * 0.35, 6),
                "evidence": {"closed_model": True, "best_sd": round(best_sd, 6), "baseline_holdout_sd": round(holdout_base_sd, 6)},
            },
        ],
        "artifact": {
            "schema": "the-world-research-cycle/v1",
            "closed_model": True,
            "program": program,
            "trial_budget": budget,
            "micro_top_score": round(micro[0][0], 6),
            "deep_top_score": round(deep[0][0], 6),
            "holdout_best_score": round(best_score, 6),
            "holdout_baseline_score": round(holdout_base, 6),
            "holdout_delta": round(delta, 6),
            "mode": mode,
        },
    }


def build_batch(config: dict[str, Any], run_id: int, max_programs: int = 8, force: bool = False) -> dict[str, Any]:
    programs = [p for p in (config.get("programs") or []) if p.get("program_key") in SPECS and (force or p.get("due"))]
    programs.sort(key=lambda p: (-int(p.get("priority") or 0), str(p.get("program_key"))))
    programs = programs[:max_programs]
    cycles = [run_lab(p, config, run_id, slot) for slot, p in enumerate(programs)]
    return {
        "schema": "the-world-research-batch/v1",
        "github_run_id": run_id,
        "closed_model": True,
        "program_count": len(cycles),
        "trial_count": sum(int(c["trial_count"]) for c in cycles),
        "cycles": cycles,
    }


def _report(batch: dict[str, Any]) -> str:
    lines = [
        "# THE WORLD Autonomous Research Fabric",
        "",
        f"- labs executed: **{batch['program_count']}**",
        f"- closed-model trials: **{batch['trial_count']:,}**",
        "- rule: negative/null results are preserved; only replicated findings become shared canon",
        "",
    ]
    for c in batch["cycles"]:
        delta = float(c["artifact"]["holdout_delta"])
        lines.extend([
            f"## {c['program_key']} / {c['mode']}",
            f"- trials: {c['trial_count']:,}",
            f"- delta: {delta:+.3f}",
            f"- novelty: {c['novelty']:.3f} / confidence: {c['confidence']:.3f} / reproducibility: {c['reproducibility']:.3f}",
            f"- fellows: {', '.join(c['selected_resident_keys']) or 'none'}",
            f"- hypothesis: {c['hypothesis']}",
            "",
        ])
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--run-id", type=int, required=True)
    ap.add_argument("--max-programs", type=int, default=8)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    batch = build_batch(config, args.run_id, max(1, min(8, args.max_programs)), args.force)
    (out / "batch.json").write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "report.md").write_text(_report(batch), encoding="utf-8")
    cycles_dir = out / "cycles"
    cycles_dir.mkdir(exist_ok=True)
    for cycle in batch["cycles"]:
        (cycles_dir / f"{cycle['lab_slot']:02d}-{cycle['program_key'].lower()}.json").write_text(json.dumps(cycle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"labs": batch["program_count"], "trials": batch["trial_count"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
