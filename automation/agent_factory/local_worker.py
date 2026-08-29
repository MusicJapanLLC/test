#!/usr/bin/env python3
"""Quota-independent local evidence workers for THE WORLD Agent Factory.

These are not pretend LLMs. They are deterministic specialist agents that inspect
repository evidence and emit falsifiable, testable improvement proposals when the
primary model provider is unavailable. Their purpose is graceful degradation: the
research factory keeps producing evidence and counterevidence instead of stopping
at an API quota wall.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

CORE_EVIDENCE = [
    "automation/security/portfolio_rnd.py",
    "automation/security/test_portfolio_rnd.py",
    "standment-security/CONTROL_EVIDENCE_TEMPLATE.md",
    "standment-security/security_portfolio_program.json",
    "standment-security/ELITE_WHITEHAT_CELL.md",
    "value-lab/research_queue.json",
    ".github/workflows/standment-security-portfolio-rnd.yml",
]

ROLE_CHANGE = {
    "evidence_hunter": (
        "Make security portfolio evidence completeness mechanically checkable rather than inferred from file presence alone.",
        ["automation/security/portfolio_rnd.py"],
        ["run portfolio_rnd unit tests", "generate two reports from unchanged inputs and compare evidence fields"],
        "portfolio evidence gaps become explicit and machine-comparable across runs",
    ),
    "red_skeptic": (
        "Add explicit counterevidence criteria for the currently selected security portfolio claim.",
        ["standment-security/CONTROL_EVIDENCE_TEMPLATE.md"],
        ["verify every promoted claim has a falsifier", "verify limitations remain explicit when evidence is incomplete"],
        "false-completion risk decreases because each claim has a documented way to be disproved",
    ),
    "replicator": (
        "Strengthen independent rerun coverage for the portfolio planner output.",
        ["automation/security/test_portfolio_rnd.py"],
        ["run the same fixture twice", "compare selected track and promotion decision across reruns"],
        "reproducibility becomes test evidence instead of a prose requirement",
    ),
    "test_engineer": (
        "Add a regression test that prevents an evidence-poor BUILDING item from being promoted as VERIFIED.",
        ["automation/security/test_portfolio_rnd.py"],
        ["run portfolio_rnd unit tests", "force missing evidence and assert promotion_ready is false"],
        "portfolio promotion becomes harder to overstate after future refactors",
    ),
    "systems_engineer": (
        "Separate evidence completeness from portfolio status so the planner cannot equate labels with verification.",
        ["automation/security/portfolio_rnd.py"],
        ["run planner tests", "simulate VERIFIED label with missing evidence and require non-promotion"],
        "the planner makes promotion decisions from proof coverage rather than status text alone",
    ),
    "elite_whitehat": (
        "Add an adversarial-validation contract that forces every security finding to include an owned/authorized attack-path hypothesis, safe reproduction conditions, remediation, independent retest and residual-risk evidence.",
        ["standment-security/ELITE_WHITEHAT_CELL.md", "standment-security/CONTROL_EVIDENCE_TEMPLATE.md"],
        ["verify authorization basis is present before any active test", "verify each finding contains reproduction/remediation/retest/residual-risk fields", "verify unknown authorization fails closed"],
        "R&D findings become reproducible defensive evidence instead of severity labels or security theater",
    ),
    "portfolio_translator": (
        "Make the customer evidence pack expose a compact before-after-verification summary before technical detail.",
        ["standment-security/CONTROL_EVIDENCE_TEMPLATE.md"],
        ["verify summary is understandable without source code", "verify limitations and evidence references remain present"],
        "security proof becomes faster for a buyer or operator to judge without losing technical provenance",
    ),
    "failure_archaeologist": (
        "Preserve repeated security R&D failure fingerprints as reusable negative evidence.",
        ["automation/security/portfolio_rnd.py"],
        ["feed the same failure twice and verify stable fingerprinting", "verify repeated failure does not appear as new progress"],
        "the research loop repeats fewer known-failed approaches and reports recurrence accurately",
    ),
    "reliability_engineer": (
        "Make missing optional evidence degrade the R&D report explicitly instead of silently disappearing.",
        ["automation/security/portfolio_rnd.py"],
        ["remove one optional evidence file in a fixture", "verify report records the missing capability without crashing"],
        "daily research keeps running while clearly exposing partial evidence and blockers",
    ),
    "security_reviewer": (
        "Strengthen the evidence-pack authorization section so active tests cannot be promoted without owned or explicit scope proof.",
        ["standment-security/CONTROL_EVIDENCE_TEMPLATE.md"],
        ["verify authorization owner and scope are mandatory promotion fields", "verify unknown ownership blocks promotion"],
        "customer-facing evidence more clearly separates authorized defensive work from unverified scope",
    ),
    "efficiency_researcher": (
        "Reduce repeated portfolio parsing by computing one normalized evidence snapshot per run and reusing it across scoring.",
        ["automation/security/portfolio_rnd.py"],
        ["run existing tests", "compare output before and after on the same fixture"],
        "research cycles do less duplicate work without changing the selected result",
    ),
    "novelty_researcher": (
        "Add an orthogonal proof dimension that distinguishes reproducibility from mere evidence-file availability.",
        ["automation/security/portfolio_rnd.py", "automation/security/test_portfolio_rnd.py"],
        ["construct equal evidence coverage with different rerun outcomes", "verify reproducibility changes the decision"],
        "the research system can discover quality differences that file-count scoring misses",
    ),
    "integration_engineer": (
        "Expose the selected security portfolio track and evidence gap in a stable handoff contract for Senju and reporting consumers.",
        ["automation/security/portfolio_rnd.py"],
        ["generate handoff JSON", "validate stable keys and bounded Senju focus"],
        "R&D, Senju and Slack reporting consume the same evidence-backed research decision",
    ),
    "counterevidence_curator": (
        "Require preserved counterevidence to travel with the evidence manifest when a security artifact is promoted.",
        ["standment-security/CONTROL_EVIDENCE_TEMPLATE.md"],
        ["verify a promotion package contains counterevidence", "verify contradictory rerun evidence remains visible"],
        "later reviewers can see why a claim survived challenge instead of seeing only positive proof",
    ),
    "reproducibility_engineer": (
        "Add deterministic report assertions for selected track, evidence ratio and promotion decision.",
        ["automation/security/test_portfolio_rnd.py"],
        ["run identical fixtures twice", "assert stable selected track, evidence ratio and promotion decision"],
        "portfolio research results become independently repeatable across unchanged runs",
    ),
}


def load(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain an object")
    return data


def build_worker(root: Path, plan: dict[str, Any], slot: int) -> dict[str, Any]:
    agents = plan.get("agents") or []
    if slot < 0 or slot >= len(agents):
        raise ValueError("slot outside generated swarm")
    agent = agents[slot]
    role = str(agent.get("role") or "")
    if role not in ROLE_CHANGE:
        raise ValueError(f"unsupported local role: {role}")

    track = plan.get("security_track") or {}
    configured = [str(x) for x in (track.get("evidence_files") or []) if isinstance(x, str)]
    candidates = configured + CORE_EVIDENCE
    refs: list[str] = []
    for item in candidates:
        if item not in refs and (root / item).exists():
            refs.append(item)
        if len(refs) >= 4:
            break
    if len(refs) < 3:
        raise ValueError("local evidence worker requires at least three real repository evidence refs")

    present = [p for p in configured if (root / p).exists()]
    missing = [p for p in configured if not (root / p).exists()]
    summary, paths, tests, expected_delta = ROLE_CHANGE[role]
    mission = plan.get("mission") or {}

    observations = [
        f"selected mission={mission.get('research_id')} priority={mission.get('priority')} focus={mission.get('focus')}",
        f"security track={track.get('id')} configured evidence present={len(present)} missing={len(missing)}",
    ]
    if missing:
        observations.append("missing configured evidence: " + ", ".join(missing[:5]))
    else:
        observations.append("all configured evidence paths exist, but path existence alone does not prove runtime behavior")
    if role == "elite_whitehat":
        observations.append("elite white-hat output is valid only for owned/explicitly authorized scope and must terminate in remediation + retest")

    return {
        "schema": "agent-factory-worker/v1",
        "agent_id": agent.get("agent_id"),
        "role": role,
        "stance": agent.get("stance"),
        "hypothesis": summary,
        "evidence_refs": refs,
        "observations": observations,
        "counterevidence": [
            "Static repository evidence may not match current runtime behavior; a clean rerun can falsify this proposal.",
            "Internal technical proof does not establish customer demand, willingness-to-pay, contracts or revenue.",
        ],
        "proposed_change": {
            "summary": summary,
            "allowed_paths": paths,
            "tests": tests,
            "expected_delta": expected_delta,
            "rollback": "Revert only the bounded files changed by the champion implementation and rerun the same validation.",
        },
        "limitations": [
            "This fallback worker is deterministic repository analysis, not a substitute for broad external research or market validation.",
            "The proposal must still survive independent tournament scoring and the champion forge verification gate.",
        ],
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--plan", required=True)
    p.add_argument("--slot", type=int, required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    root = Path.cwd()
    plan = load(Path(args.plan))
    worker = build_worker(root, plan, args.slot)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(worker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"agent_id": worker["agent_id"], "role": worker["role"], "fallback": "local_evidence"}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
