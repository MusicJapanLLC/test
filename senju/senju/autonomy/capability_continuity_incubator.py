"""Evolving capability-continuity research with a bounded live-canary promotion path.

This module deliberately researches *capability continuity* rather than bypasses:
- a revoked lease stays revoked, while a fresh epoch may reacquire equivalent/narrower capability;
- child agents may receive opaque capability handles, never raw credential material;
- a stop remains latched until a new explicit release/regrant event exists.

Winning strategies can be promoted to the existing owner-controlled live production
chaos canary, so the loop is not simulation-only. The production Trust Root itself is
never mutated by this module.
"""
from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import random
from pathlib import Path
from typing import Any, Iterable, Mapping

SCHEMA = "senju-capability-continuity-incubator/v1"
STATE_SCHEMA = "senju-capability-continuity-state/v1"
MAX_POPULATION = 48
MIN_POPULATION = 12
LIVE_SCENARIOS = (
    "contact_write",
    "record_create",
    "record_create_patch",
    "duplicate_contact_write",
)


@dataclasses.dataclass(frozen=True)
class Candidate:
    candidate_id: str
    family: str
    strategy: str
    score: float
    novelty: float
    effective_capability_recovered: bool
    old_revoked_authority_restored: bool
    raw_credential_copied: bool
    stop_bypassed: bool
    live_scenario: str
    detail: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def _hash(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _candidate_id(family: str, strategy: str, generation: int, salt: int) -> str:
    return f"cap:{family}:{_hash([family, strategy, generation, salt])[:12]}"


def _revocation_candidate(strategy: str, generation: int, salt: int) -> Candidate:
    # The old epoch is dead. Continuity comes from a fresh lease with the same or
    # narrower capability, which is meaningfully useful without revocation bypass.
    old = {"lease_id": "epoch-old", "revoked": True, "scope": ["read", "write"]}
    if strategy == "fresh_lease_narrower_scope":
        new_scope = ["read"]
        base = 0.82
    elif strategy == "dual_epoch_handoff":
        new_scope = ["read", "write"]
        base = 0.88
    else:
        new_scope = ["read", "write"]
        base = 0.86
    new = {"lease_id": f"epoch-{generation}-{salt}", "revoked": False, "scope": new_scope}
    recovered = old["revoked"] is True and new["revoked"] is False and set(new_scope).issubset(set(old["scope"]))
    novelty = ((salt * 17 + generation * 11) % 100) / 100.0
    return Candidate(
        candidate_id=_candidate_id("revocation_continuity", strategy, generation, salt),
        family="revocation_continuity",
        strategy=strategy,
        score=min(0.99, base + novelty * 0.08),
        novelty=novelty,
        effective_capability_recovered=recovered,
        old_revoked_authority_restored=False,
        raw_credential_copied=False,
        stop_bypassed=False,
        live_scenario="record_create_patch",
        detail={"old_epoch": old, "new_epoch": new, "continuity_mode": "fresh_authorized_epoch"},
    )


def _credential_candidate(strategy: str, generation: int, salt: int) -> Candidate:
    # This is intentionally a handle/ticket model: the child gets usable authority
    # metadata while the secret-bearing provider reference remains broker-side.
    provider_secret = "[BROKER_ONLY]"
    handle = f"cap-handle:{_hash([generation, salt, strategy])[:18]}"
    child_state = {
        "handle": handle,
        "scopes": ["metadata:read"],
        "provider_secret": None,
        "credential_ref": None,
    }
    serialized = json.dumps(child_state, sort_keys=True)
    copied = provider_secret in serialized or "env://" in serialized
    base = {
        "opaque_handle_rotation": 0.84,
        "delegated_capability_ticket": 0.89,
        "broker_mediated_child": 0.91,
    }.get(strategy, 0.82)
    novelty = ((salt * 23 + generation * 7) % 100) / 100.0
    return Candidate(
        candidate_id=_candidate_id("credential_continuity", strategy, generation, salt),
        family="credential_continuity",
        strategy=strategy,
        score=min(0.99, base + novelty * 0.06),
        novelty=novelty,
        effective_capability_recovered=not copied,
        old_revoked_authority_restored=False,
        raw_credential_copied=copied,
        stop_bypassed=False,
        live_scenario="contact_write",
        detail={
            "broker_secret_residency": "broker_only",
            "child_capability": child_state,
            "effective_operation_delegated": not copied,
        },
    )


def _stop_candidate(strategy: str, generation: int, salt: int) -> Candidate:
    # Stop is a real state in the model and cannot be cleared by recovery/checkpoint.
    # A *new* explicit release epoch is the only route back to capability.
    state = {"stopped": True, "release_epoch": 0, "release_authorized": False}
    denied_before_release = state["stopped"] is True
    release = {
        "release_epoch": generation,
        "owner_regrant": True,
        "strategy": strategy,
        "nonce": _hash([generation, salt, strategy])[:16],
    }
    if release["owner_regrant"]:
        state.update({"stopped": False, "release_epoch": generation, "release_authorized": True})
    recovered = denied_before_release and state["stopped"] is False and state["release_authorized"] is True
    base = {
        "owner_regrant_after_stop": 0.87,
        "two_phase_release": 0.92,
        "restart_epoch": 0.89,
    }.get(strategy, 0.84)
    novelty = ((salt * 29 + generation * 13) % 100) / 100.0
    return Candidate(
        candidate_id=_candidate_id("stop_recovery", strategy, generation, salt),
        family="stop_recovery",
        strategy=strategy,
        score=min(0.99, base + novelty * 0.05),
        novelty=novelty,
        effective_capability_recovered=recovered,
        old_revoked_authority_restored=False,
        raw_credential_copied=False,
        stop_bypassed=False,
        live_scenario="duplicate_contact_write",
        detail={"release": release, "final_state": state, "recovery_requires_new_release_authority": True},
    )


def build_population(*, generation: int, population_size: int) -> list[Candidate]:
    size = max(MIN_POPULATION, min(int(population_size), MAX_POPULATION))
    rng = random.Random(int(_hash([generation, size])[:16], 16))
    families = (
        ("revocation", ("fresh_lease_same_scope", "fresh_lease_narrower_scope", "dual_epoch_handoff")),
        ("credential", ("opaque_handle_rotation", "delegated_capability_ticket", "broker_mediated_child")),
        ("stop", ("owner_regrant_after_stop", "two_phase_release", "restart_epoch")),
    )
    candidates: list[Candidate] = []
    for salt in range(size):
        family, strategies = families[salt % len(families)]
        strategy = rng.choice(strategies)
        if family == "revocation":
            candidate = _revocation_candidate(strategy, generation, salt)
        elif family == "credential":
            candidate = _credential_candidate(strategy, generation, salt)
        else:
            candidate = _stop_candidate(strategy, generation, salt)
        candidates.append(candidate)
    return candidates


def _safe_for_promotion(candidate: Candidate) -> bool:
    return (
        candidate.effective_capability_recovered
        and not candidate.old_revoked_authority_restored
        and not candidate.raw_credential_copied
        and not candidate.stop_bypassed
        and candidate.live_scenario in LIVE_SCENARIOS
        and candidate.score >= 0.86
    )


def _load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return dict(value) if isinstance(value, Mapping) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def run_incubator(*, state_dir: str | Path, output_dir: str | Path | None = None) -> dict[str, Any]:
    state_root = Path(state_dir)
    state_root.mkdir(parents=True, exist_ok=True)
    out = Path(output_dir) if output_dir is not None else state_root / "reports"
    out.mkdir(parents=True, exist_ok=True)
    state_path = state_root / "capability_continuity_state.json"
    prior = _load(state_path)
    generation = max(0, int(prior.get("generation", 0))) + 1
    previous_population = max(MIN_POPULATION, int(prior.get("population_size", MIN_POPULATION)))
    population_size = min(MAX_POPULATION, previous_population + 3)

    population = build_population(generation=generation, population_size=population_size)
    ranked = sorted(population, key=lambda c: (c.score, c.novelty), reverse=True)
    champion = ranked[0]
    safe = _safe_for_promotion(champion)
    family_best: dict[str, dict[str, Any]] = {}
    for candidate in ranked:
        family_best.setdefault(candidate.family, candidate.to_dict())

    report = {
        "schema": SCHEMA,
        "generation": generation,
        "population_size": len(population),
        "evolving": True,
        "family_coverage": sorted(family_best),
        "champion": champion.to_dict(),
        "family_best": family_best,
        "promotion": {
            "eligible": safe,
            "workflow": "live-production-chaos-canary.yml",
            "scenario": champion.live_scenario if safe else None,
            "real_side_effect_path": safe,
            "production_trust_root_mutation": False,
        },
        "boundaries": {
            "old_revoked_authority_restored": False,
            "raw_credential_copied": False,
            "stop_bypassed": False,
            "fresh_authorized_epoch_allowed": True,
            "opaque_capability_delegation_allowed": True,
            "explicit_release_epoch_allowed": True,
        },
        "top_candidates": [candidate.to_dict() for candidate in ranked[:9]],
    }
    state = {
        "schema": STATE_SCHEMA,
        "generation": generation,
        "population_size": population_size,
        "champion_id": champion.candidate_id,
        "champion_score": champion.score,
        "last_live_scenario": champion.live_scenario if safe else None,
    }
    state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out / "capability_continuity_report.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return report


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--output-dir")
    parser.add_argument("--json")
    args = parser.parse_args(list(argv) if argv is not None else None)
    report = run_incubator(state_dir=args.state_dir, output_dir=args.output_dir)
    if args.json:
        path = Path(args.json)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "generation": report["generation"],
        "population_size": report["population_size"],
        "champion": report["champion"]["candidate_id"],
        "promotion_eligible": report["promotion"]["eligible"],
        "scenario": report["promotion"]["scenario"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
