#!/usr/bin/env python3
"""Convert elite white-hat R&D output into evidence-first Standment portfolio candidates.

This module does not perform active testing. It consumes the bounded Agent Factory
worker result and translates it into a human-inspectable portfolio candidate. A
candidate is never promoted to VERIFIED by this bridge.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

GOVERNANCE_REFS = [
    "company-society/FAITH.md",
    "company-society/RESEARCH_FREEDOM_DOCTRINE.md",
    "company-society/AUTONOMY.md",
    "standment-security/ELITE_WHITEHAT_CELL.md",
    "standment-security/WHITEHAT_PORTFOLIO_OPERATING_PLAN.md",
]


def load(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def load_workers(workers_dir: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for path in sorted(workers_dir.glob("*.json")):
        try:
            worker = load(path)
        except Exception:
            continue
        if worker.get("role") == "elite_whitehat":
            out.append(worker)
    return out


def select_whitehat(workers: list[dict[str, Any]]) -> dict[str, Any]:
    if not workers:
        raise ValueError("elite_whitehat worker output is required")
    return max(
        workers,
        key=lambda w: (
            bool(w.get("eligible")),
            int(w.get("score") or 0),
            len(w.get("evidence_refs") or []),
        ),
    )


def fingerprint(worker: dict[str, Any], mission: str) -> str:
    payload = "\n".join([
        mission,
        str(worker.get("hypothesis") or ""),
        str((worker.get("proposed_change") or {}).get("summary") or ""),
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


def render(worker: dict[str, Any], plan: dict[str, Any], now: datetime, fp: str) -> str:
    mission = plan.get("mission") or {}
    track = plan.get("security_track") or {}
    proposed = worker.get("proposed_change") or {}
    evidence = [str(x) for x in worker.get("evidence_refs") or []]
    observations = [str(x) for x in worker.get("observations") or []]
    counter = [str(x) for x in worker.get("counterevidence") or []]
    tests = [str(x) for x in proposed.get("tests") or []]
    limitations = [str(x) for x in worker.get("limitations") or []]

    return "\n".join([
        f"# White-Hat Portfolio Candidate — {track.get('id') or mission.get('research_id')}",
        "",
        "**Status: WHITEHAT_CANDIDATE / NOT VERIFIED**",
        "",
        f"- fingerprint: `{fp}`",
        f"- generated_at_jst: `{now.astimezone(JST).isoformat()}`",
        f"- worker: `{worker.get('agent_id')}`",
        f"- role: `elite_whitehat`",
        f"- mission: `{mission.get('research_id')}`",
        f"- track: `{track.get('id')}` — {track.get('title')}",
        f"- tournament eligible: `{bool(worker.get('eligible'))}`",
        f"- internal score: `{int(worker.get('score') or 0)}`",
        "",
        "## PURPOSE",
        "Convert adversarial security research into a customer-inspectable Standment security asset with a reproducible remediation and retest path.",
        "",
        "## RESEARCH_QUESTION",
        str(worker.get("hypothesis") or proposed.get("summary") or "Which security boundary can be challenged and strengthened with evidence?"),
        "",
        "## PLAN",
        "1. Confirm owned/explicitly-authorized scope and trust boundary.",
        "2. Reproduce the control failure safely in the bounded lab.",
        "3. Preserve before-state evidence and counterevidence.",
        "4. Apply the smallest defensive remediation.",
        "5. Retest independently, preserve after-state evidence, and record residual risk.",
        "6. Translate the verified delta into a customer-readable case study or evidence pack.",
        "",
        "## SAFE_EXPERIMENT / RETEST CRITERIA",
        *([f"- [ ] {x}" for x in tests] or ["- [ ] Define a reproducible authorized-lab test before promotion."]),
        "",
        "## EVIDENCE_GAINED",
        *([f"- `{x}`" for x in evidence] or ["- NONE — promotion blocked"]),
        "",
        "## OBSERVATIONS",
        *([f"- {x}" for x in observations] or ["- NONE"]),
        "",
        "## COUNTEREVIDENCE / DISSENT",
        *([f"- {x}" for x in counter] or ["- No counterevidence supplied; promotion blocked."]),
        "",
        "## DEFENSIVE CHANGE",
        f"- proposed: {proposed.get('summary') or 'NONE'}",
        f"- expected delta: {proposed.get('expected_delta') or 'UNKNOWN'}",
        f"- rollback: {proposed.get('rollback') or 'Must be defined before implementation.'}",
        "",
        "## CUSTOMER / REAL_WORLD_VALUE",
        "A buyer should be able to see the exact boundary tested, the evidence of failure, the remediation, the independent retest and the residual uncertainty without trusting a generic security claim.",
        "",
        "## LIMITATIONS",
        *([f"- {x}" for x in limitations] or ["- Runtime verification has not yet been completed."]),
        "",
        "## GOVERNANCE INHERITANCE",
        *[f"- `{x}`" for x in GOVERNANCE_REFS],
        "",
        "This candidate follows `LIMITLESS MIND / BOUNDED EXECUTION`: hypothesis space may be broad, but active security work remains restricted to owned/explicitly-authorized targets and safe lab conditions.",
        "",
        "## PROMOTION GATE",
        "This file may become a customer-facing portfolio item only after authorization evidence, safe reproduction, before/after proof, independent retest, counterevidence, limitations and rollback/recovery notes are all inspectable.",
        "",
    ])


def render_index(output_dir: Path, now: datetime) -> str:
    candidates = sorted(p for p in output_dir.glob("*.md") if p.name != "INDEX.md")
    rows = [f"| [{p.stem}]({p.name}) | WHITEHAT_CANDIDATE | NOT VERIFIED |" for p in candidates]
    return "\n".join([
        "# Standment Security — White-Hat Candidate Index",
        "",
        f"Updated JST: `{now.astimezone(JST).isoformat()}`",
        "",
        "These are adversarial R&D portfolio candidates, not verified customer claims.",
        "",
        "| Candidate | Stage | Verification |",
        "|---|---|---|",
        *(rows or ["| none | - | - |"]),
        "",
        "Promotion follows `WHITEHAT_PORTFOLIO_OPERATING_PLAN.md` and requires before/after evidence plus independent retest.",
        "",
    ])


def build(plan: dict[str, Any], workers_dir: Path, output_dir: Path, now: datetime) -> dict[str, Any]:
    worker = select_whitehat(load_workers(workers_dir))
    mission = str((plan.get("mission") or {}).get("research_id") or "UNKNOWN")
    fp = fingerprint(worker, mission)
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{fp}.md"
    created = False
    if not path.exists():
        path.write_text(render(worker, plan, now, fp), encoding="utf-8")
        created = True

    index = output_dir / "INDEX.md"
    index_text = render_index(output_dir, now)
    index_updated = not index.exists() or index.read_text(encoding="utf-8") != index_text
    if index_updated:
        index.write_text(index_text, encoding="utf-8")

    result = {
        "schema": "standment-whitehat-portfolio-bridge/v2",
        "fingerprint": fp,
        "candidate_path": str(path.as_posix()),
        "index_path": str(index.as_posix()),
        "created": created,
        "index_updated": index_updated,
        "role": "elite_whitehat",
        "eligible": bool(worker.get("eligible")),
        "score": int(worker.get("score") or 0),
        "verification_claimed": False,
        "governance_refs": GOVERNANCE_REFS,
    }
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--workers-dir", required=True)
    ap.add_argument("--output-dir", default="standment-security/whitehat-candidates")
    ap.add_argument("--json", default="reports/standment-security-rnd/whitehat-bridge.json")
    args = ap.parse_args()

    result = build(load(Path(args.plan)), Path(args.workers_dir), Path(args.output_dir), datetime.now(JST))
    out = Path(args.json)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
