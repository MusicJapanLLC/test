"""Meta-Observer: watches all agent evidence and builds a knowledge graph.

Reads:
  - autonomy cycle results (WorkItem outcomes, ELO deltas)
  - adversary regression_scars.json
  - attack_effects.jsonl (guard-blocked effects)
  - degraded_profile.json (damage levels per surface)
  - lab manifests generated (what coverage gaps were filled)

Emits a structured KnowledgeGraph that the HypothesisEngine reads.
"""
from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any


@dataclasses.dataclass
class Observation:
    source: str
    surface: str
    state_before: dict[str, Any]
    outcome: str
    delta: float
    metadata: dict[str, Any] = dataclasses.field(default_factory=dict)


@dataclasses.dataclass
class KnowledgeGraph:
    observations: list[Observation]
    surface_weakness_scores: dict[str, float]
    co_occurrence: dict[str, list[str]]
    temporal_patterns: list[dict[str, Any]]


def _load_json_safe(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _iter_jsonl(path: Path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except Exception:
            pass


def _load_cycle_observations(state_dir: Path) -> list[Observation]:
    obs: list[Observation] = []
    report_path = state_dir / "last_pressure_cycle.json"
    data = _load_json_safe(report_path)
    if not data:
        return obs
    for round_report in data.get("round_reports", []):
        for result in round_report.get("results", []):
            surface = result.get("target", "unknown")
            passed = result.get("passed", True)
            obs.append(Observation(
                source="cycle_report",
                surface=surface,
                state_before={"round": round_report.get("pressure_round", 0)},
                outcome="blocked" if passed else "regression",
                delta=-1.0 if not passed else 0.0,
                metadata=result,
            ))
    return obs


def _load_scar_observations(adversary_dir: Path) -> list[Observation]:
    obs: list[Observation] = []
    scars = _load_json_safe(adversary_dir / "regression_scars.json")
    if not isinstance(scars, list):
        return obs
    for scar in scars:
        surface = scar.get("target", "unknown")
        obs.append(Observation(
            source="regression_scar",
            surface=surface,
            state_before={},
            outcome="regression",
            delta=-2.0,
            metadata=scar,
        ))
    return obs


def _load_effect_observations(state_dir: Path) -> list[Observation]:
    obs: list[Observation] = []
    for row in _iter_jsonl(state_dir / "attack_effects.jsonl"):
        surface = row.get("target", "unknown")
        obs.append(Observation(
            source="attack_effect",
            surface=surface,
            state_before={},
            outcome="blocked",
            delta=1.0,
            metadata=row,
        ))
    return obs


def _load_damage_observations(adversary_dir: Path) -> list[Observation]:
    obs: list[Observation] = []
    profile = _load_json_safe(adversary_dir / "degraded_profile.json")
    if not profile:
        return obs
    for surface, level in profile.get("per_guard_damage", {}).items():
        obs.append(Observation(
            source="damage",
            surface=surface,
            state_before={},
            outcome="damage_accumulated",
            delta=float(level),
            metadata={"damage_level": level},
        ))
    return obs


def _compute_weakness_scores(observations: list[Observation]) -> dict[str, float]:
    scores: dict[str, float] = {}
    for obs in observations:
        s = obs.surface
        if obs.outcome == "regression":
            scores[s] = scores.get(s, 0.0) + 3.0
        elif obs.outcome == "damage_accumulated":
            scores[s] = scores.get(s, 0.0) + obs.delta * 0.5
        elif obs.outcome == "blocked":
            scores[s] = scores.get(s, 0.0) - 0.2
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


def _compute_co_occurrence(observations: list[Observation]) -> dict[str, list[str]]:
    regression_events: list[str] = [o.surface for o in observations if o.outcome == "regression"]
    co: dict[str, set[str]] = {}
    for i, s in enumerate(regression_events):
        neighbors = regression_events[max(0, i-3):i] + regression_events[i+1:i+4]
        co.setdefault(s, set()).update(neighbors)
    return {k: sorted(v) for k, v in co.items()}


def _compute_temporal_patterns(observations: list[Observation]) -> list[dict[str, Any]]:
    patterns: list[dict[str, Any]] = []
    surface_seq: dict[str, list[str]] = {}
    for obs in observations:
        surface_seq.setdefault(obs.surface, []).append(obs.outcome)
    for surface, seq in surface_seq.items():
        for i in range(len(seq)):
            if seq[i] == "regression" and i >= 3:
                preceding = seq[max(0, i-5):i]
                if preceding.count("blocked") >= 2:
                    patterns.append({
                        "pattern": "pressure_then_regression",
                        "surface": surface,
                        "preceding_blocked": preceding.count("blocked"),
                        "position": i,
                    })
    return patterns


def build(senju_dir: Path) -> KnowledgeGraph:
    state_dir = senju_dir / "state"
    adversary_dir = senju_dir / "adversary"
    observations: list[Observation] = []
    observations += _load_cycle_observations(state_dir)
    observations += _load_scar_observations(adversary_dir)
    observations += _load_effect_observations(state_dir)
    observations += _load_damage_observations(adversary_dir)
    return KnowledgeGraph(
        observations=observations,
        surface_weakness_scores=_compute_weakness_scores(observations),
        co_occurrence=_compute_co_occurrence(observations),
        temporal_patterns=_compute_temporal_patterns(observations),
    )
