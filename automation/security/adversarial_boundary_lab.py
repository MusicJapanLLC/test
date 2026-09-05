#!/usr/bin/env python3
"""Adversarial boundary growth lab.

This module continuously evolves *hypotheses* about how authority, credential, and
stop-control boundaries might fail. It may ingest real production evidence, but it
never receives secret bytes, performs network writes, restores revoked authority,
or changes Emergency/Security Stop state.

The useful freedom lives in the search space: scenarios mutate, combine, compete,
and persist as evidence-backed counterexamples for later review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

SCHEMA = "the-world-adversarial-boundary-lab/v1"
# Default remains 96. A separately approved balance-policy workflow may raise
# only this research corpus ceiling; it still cannot make scenarios executable.
MAX_CORPUS = max(8, min(256, int(os.environ.get("ADVERSARIAL_LAB_MAX_CORPUS", "96"))))
MAX_CHILDREN_PER_PARENT = 4
TOKENISH = re.compile(
    r"(?i)(github_pat_[a-z0-9_]{10,}|gh[pousr]_[a-z0-9_]{10,}|sk-[a-z0-9_-]{12,}|"
    r"xox[baprs]-[a-z0-9-]{12,}|bearer\s+[a-z0-9._~+/-]{10,})"
)

SEED_FAMILIES = (
    "revoked_authority_revival",
    "raw_credential_propagation",
    "emergency_stop_bypass",
    "stale_checkpoint_reauthorization",
    "delegation_scope_confusion",
    "replica_authority_drift",
    "redirect_scope_confusion",
    "cache_vs_live_authority_split_brain",
)

# These are abstract preconditions only. No command, endpoint, credential, or
# mutation primitive is ever emitted by this engine.
PRECONDITIONS = (
    "stale_state_observed_after_newer_denial",
    "authority_source_disagreement",
    "delegated_scope_not_reduced",
    "revocation_propagation_delay",
    "checkpoint_precedes_stop_latch",
    "credential_handle_outlives_authority",
    "replica_uses_cached_capability_metadata",
    "redirect_target_identity_changes",
    "recovery_path_uses_weaker_freshness_rule",
    "approval_evidence_missing_or_ambiguous",
    "cleanup_failed_but_success_state_persisted",
    "concurrent_writer_reorders_state_transition",
)

OBSERVATION_HINTS = {
    "revoked": "revocation_propagation_delay",
    "checkpoint": "checkpoint_precedes_stop_latch",
    "credential": "credential_handle_outlives_authority",
    "token": "credential_handle_outlives_authority",
    "redirect": "redirect_target_identity_changes",
    "replica": "replica_uses_cached_capability_metadata",
    "cleanup": "cleanup_failed_but_success_state_persisted",
    "authority": "authority_source_disagreement",
    "stop": "checkpoint_precedes_stop_latch",
    "race": "concurrent_writer_reorders_state_transition",
}


@dataclass(frozen=True)
class Scenario:
    family: str
    preconditions: tuple[str, ...]
    generation: int
    evidence_hits: int
    novelty: float
    plausibility: float
    severity: float
    score: float
    fingerprint: str
    executable: bool = False
    production_mutation: bool = False
    credential_material_present: bool = False


def _canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _fingerprint(family: str, preconditions: Iterable[str]) -> str:
    payload = f"{family}|{'|'.join(sorted(set(preconditions)))}".encode()
    return hashlib.sha256(payload).hexdigest()[:20]


def _sanitize(value: Any) -> Any:
    """Keep evidence shape while aggressively removing secret-like content."""
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            lk = str(k).lower()
            if any(x in lk for x in ("secret", "token", "password", "passwd", "credential", "authorization", "cookie")):
                out[str(k)] = "[REDACTED]"
            else:
                out[str(k)] = _sanitize(v)
        return out
    if isinstance(value, list):
        return [_sanitize(v) for v in value[:200]]
    if isinstance(value, str):
        s = TOKENISH.sub("[REDACTED]", value)
        return s[:2000]
    return value


def load_evidence(paths: Iterable[Path]) -> list[Any]:
    evidence: list[Any] = []
    for path in paths:
        if not path.exists() or path.suffix.lower() != ".json":
            continue
        try:
            evidence.append(_sanitize(json.loads(path.read_text(encoding="utf-8"))))
        except Exception:
            continue
    return evidence


def evidence_terms(evidence: list[Any]) -> list[str]:
    blob = " ".join(_canonical(x).lower() for x in evidence)
    hits: list[str] = []
    for needle, condition in OBSERVATION_HINTS.items():
        if needle in blob:
            hits.append(condition)
    return sorted(set(hits))


def _score(family: str, conditions: tuple[str, ...], evidence: set[str], generation: int) -> Scenario:
    ev_hits = len(set(conditions) & evidence)
    novelty = min(1.0, 0.34 + 0.11 * len(set(conditions)))
    plausibility = min(1.0, 0.25 + 0.18 * ev_hits + 0.04 * generation)
    severity = 1.0 if family in {
        "revoked_authority_revival", "raw_credential_propagation", "emergency_stop_bypass"
    } else 0.78
    score = round(0.45 * plausibility + 0.30 * novelty + 0.25 * severity, 6)
    return Scenario(
        family=family,
        preconditions=tuple(sorted(set(conditions))),
        generation=generation,
        evidence_hits=ev_hits,
        novelty=round(novelty, 6),
        plausibility=round(plausibility, 6),
        severity=round(severity, 6),
        score=score,
        fingerprint=_fingerprint(family, conditions),
    )


def seed_population(evidence: set[str]) -> list[Scenario]:
    base = list(PRECONDITIONS)
    population: list[Scenario] = []
    for idx, family in enumerate(SEED_FAMILIES):
        chosen = [base[idx % len(base)], base[(idx + 3) % len(base)]]
        chosen.extend(sorted(evidence)[:2])
        population.append(_score(family, tuple(chosen), evidence, 0))
    return population


def mutate(parent: Scenario, rng: random.Random, evidence: set[str]) -> Scenario:
    conditions = set(parent.preconditions)
    if conditions and rng.random() < 0.35:
        conditions.remove(rng.choice(sorted(conditions)))
    conditions.add(rng.choice(PRECONDITIONS))
    if evidence and rng.random() < 0.70:
        conditions.add(rng.choice(sorted(evidence)))
    if rng.random() < 0.18:
        family = rng.choice(SEED_FAMILIES)
    else:
        family = parent.family
    return _score(family, tuple(conditions), evidence, parent.generation + 1)


def evolve(existing: list[Scenario], evidence: set[str], seed: str) -> list[Scenario]:
    rng = random.Random(hashlib.sha256(seed.encode()).digest())
    parents = existing or seed_population(evidence)
    candidates = list(parents)
    for parent in sorted(parents, key=lambda s: s.score, reverse=True)[:24]:
        children = 1 + rng.randrange(MAX_CHILDREN_PER_PARENT)
        for _ in range(children):
            candidates.append(mutate(parent, rng, evidence))

    dedup: dict[str, Scenario] = {}
    for s in candidates:
        old = dedup.get(s.fingerprint)
        if old is None or (s.score, s.generation) > (old.score, old.generation):
            dedup[s.fingerprint] = s

    # Diversity pressure: retain top representatives across families, then global best.
    selected: list[Scenario] = []
    for family in SEED_FAMILIES:
        rows = sorted((s for s in dedup.values() if s.family == family), key=lambda s: s.score, reverse=True)
        selected.extend(rows[:6])
    seen = {s.fingerprint for s in selected}
    for s in sorted(dedup.values(), key=lambda s: (s.score, s.generation), reverse=True):
        if s.fingerprint not in seen:
            selected.append(s)
            seen.add(s.fingerprint)
        if len(selected) >= MAX_CORPUS:
            break
    return selected[:MAX_CORPUS]


def load_corpus(path: Path) -> list[Scenario]:
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        rows = raw.get("scenarios", []) if isinstance(raw, dict) else []
        out: list[Scenario] = []
        for row in rows:
            # Hard-pin non-executable semantics on load too; old/corrupt artifacts cannot
            # promote themselves into an action primitive.
            row = dict(row)
            row["executable"] = False
            row["production_mutation"] = False
            row["credential_material_present"] = False
            row["preconditions"] = tuple(row.get("preconditions") or ())
            out.append(Scenario(**row))
        return out[:MAX_CORPUS]
    except Exception:
        return []


def build_report(evidence_paths: list[Path], corpus_path: Path, seed: str) -> dict[str, Any]:
    evidence = load_evidence(evidence_paths)
    terms = set(evidence_terms(evidence))
    corpus = evolve(load_corpus(corpus_path), terms, seed)
    top = sorted(corpus, key=lambda s: s.score, reverse=True)[:16]
    return {
        "schema": SCHEMA,
        "mode": "real-evidence_shadow-authority_research",
        "seed": seed,
        "evidence_files_read": len(evidence),
        "evidence_condition_hits": sorted(terms),
        "generation_max": max((s.generation for s in corpus), default=0),
        "corpus_size": len(corpus),
        "top_hypotheses": [asdict(s) for s in top],
        "scenarios": [asdict(s) for s in corpus],
        "capability_boundary": {
            "reads_real_production_evidence": True,
            "evolves_attack_hypotheses": True,
            "persists_learning_artifact": True,
            "network_write": False,
            "production_authority_mutation": False,
            "revoked_authority_restore": False,
            "raw_credential_access": False,
            "emergency_stop_override": False,
            "generated_actions_executable": False,
        },
        "promotion_contract": {
            "automatic_promotion": False,
            "output_type": "counterexample_hypothesis_only",
            "required_next_step": "independent_review_before_any_real_boundary_change",
        },
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--evidence-dir", action="append", default=[])
    p.add_argument("--corpus", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--seed", required=True)
    args = p.parse_args()

    evidence_paths: list[Path] = []
    for raw in args.evidence_dir:
        root = Path(raw)
        if root.exists():
            evidence_paths.extend(sorted(root.rglob("*.json")))
    corpus_path = Path(args.corpus)
    report = build_report(evidence_paths, corpus_path, args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    corpus_path.parent.mkdir(parents=True, exist_ok=True)
    corpus_path.write_text(json.dumps({"schema": SCHEMA, "scenarios": report["scenarios"]}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "schema": SCHEMA,
        "corpus_size": report["corpus_size"],
        "generation_max": report["generation_max"],
        "top": [(x["family"], x["score"]) for x in report["top_hypotheses"][:5]],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
