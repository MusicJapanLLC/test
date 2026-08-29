#!/usr/bin/env python3
"""Build a bounded cross-assist packet for THE WORLD AI + Security R&D.

The packet is intentionally evidence-only. It never turns proxy scores, repository
coverage, or cross-system agreement into a VERIFIED security/capability claim.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ALLOWED_AI_FOCUS = {
    "correctness",
    "architecture",
    "reliability",
    "security",
    "observability",
    "efficiency",
    "productization",
}


def _load(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _first(*values: Any, default: Any = None) -> Any:
    for value in values:
        if value not in (None, "", [], {}):
            return value
    return default


def _research_signal(d: dict[str, Any]) -> dict[str, Any]:
    cycles = d.get("cycles") if isinstance(d.get("cycles"), list) else []
    ranked = []
    for row in cycles:
        if not isinstance(row, dict):
            continue
        ranked.append({
            "program_key": row.get("program_key"),
            "mode": row.get("mode"),
            "novelty": float(row.get("novelty") or 0),
            "confidence": float(row.get("confidence") or 0),
            "reproducibility": float(row.get("reproducibility") or 0),
        })
    ranked.sort(key=lambda r: (r["reproducibility"], r["novelty"], r["confidence"]), reverse=True)
    top = ranked[0] if ranked else {}
    return {
        "github_run_id": d.get("github_run_id"),
        "program_count": int(d.get("program_count") or len(cycles)),
        "trial_count": int(d.get("trial_count") or 0),
        "top_program": top,
    }


def _build_handoff(
    *,
    seed: str,
    ai_focus: str,
    security_lens: str,
    security_stage: str,
    research_bias: str,
    ai_fingerprint: Any,
    security_run_id: Any,
    research_run_id: Any,
) -> dict[str, Any]:
    """Return the strict, machine-readable contract downstream lanes may consume.

    This is intentionally weaker than an instruction channel: it can influence priority
    and deterministic exploration geometry only. It cannot change permissions, scope,
    pass/fail gates, verification authority, or external targets.
    """
    normalized_ai_focus = str(ai_focus or "security").lower()
    if normalized_ai_focus not in ALLOWED_AI_FOCUS:
        normalized_ai_focus = "security"
    return {
        "schema": "the-world-ai-security-handoff/v1",
        "authority": "priority_only",
        "handoff_token": seed[:20],
        "freshness": {
            "max_consumer_cycles": 2,
            "stale_behavior": "ignore_and_fall_back_to_local_evidence",
        },
        "guidance": {
            "ai_priority_focus": normalized_ai_focus,
            "security_priority_lens": security_lens,
            "security_priority_stage": security_stage,
            "research_bias": research_bias,
        },
        "source": {
            "ai_fingerprint": ai_fingerprint,
            "security_run_id": security_run_id,
            "research_run_id": research_run_id,
        },
        "constraints": {
            "promotion_gate_unchanged": True,
            "permission_surface_unchanged": True,
            "external_scope_unchanged": True,
            "verification_authority_unchanged": True,
            "external_target_expansion_forbidden": True,
        },
    }


def build_packet(ai: dict[str, Any], security: dict[str, Any], research: dict[str, Any]) -> dict[str, Any]:
    ai_focus = str(_first(ai.get("weakest_next_focus"), "unknown"))
    sec_next = security.get("priority_next") if isinstance(security.get("priority_next"), dict) else {}
    sec_lens = str(_first(sec_next.get("lens_id"), "UNKNOWN"))
    sec_stage = str(_first(sec_next.get("stage"), "DISCOVERY"))
    sec_artifact = str(_first(sec_next.get("artifact"), "unresolved security evidence"))
    sec_improvement = str(_first(sec_next.get("next_improvement"), "collect independent behavioral evidence"))
    rs = _research_signal(research)
    top_program = str((rs.get("top_program") or {}).get("program_key") or "NONE")

    stable = {
        "ai_fingerprint": ai.get("report_fingerprint"),
        "ai_focus": ai_focus,
        "security_run_id": security.get("run_id"),
        "security_lens": sec_lens,
        "security_stage": sec_stage,
        "security_artifact": sec_artifact,
        "research_run_id": rs.get("github_run_id"),
        "research_top_program": top_program,
    }
    seed = hashlib.sha256(json.dumps(stable, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    upper = f"{ai_focus} {sec_lens} {sec_stage} {sec_artifact}".upper()
    if any(k in upper for k in ("RELIAB", "RECOVERY", "OBSERV", "RESILI")):
        research_bias = "RESILIENCE"
    elif any(k in upper for k in ("AUTH", "PERMISSION", "BOUNDARY", "SECURITY", "TOOL")):
        research_bias = "GOVERNANCE"
    elif any(k in upper for k in ("MEMORY", "DATA", "RETENTION")):
        research_bias = "MEMORY"
    elif any(k in upper for k in ("COORD", "AGENT", "INTEGRATION")):
        research_bias = "COORDINATION"
    else:
        research_bias = "LEARNING"

    question = (
        f"AIの最弱点 `{ai_focus}` を改善しつつ、Security `{sec_lens}/{sec_stage}` の"
        f"反証条件を悪化させず、`{sec_artifact}` の証拠をどう強くできるか？"
    )
    handoff = _build_handoff(
        seed=seed,
        ai_focus=ai_focus,
        security_lens=sec_lens,
        security_stage=sec_stage,
        research_bias=research_bias,
        ai_fingerprint=ai.get("report_fingerprint"),
        security_run_id=security.get("run_id"),
        research_run_id=rs.get("github_run_id"),
    )

    return {
        "schema": "the-world-ai-security-joint-assist/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "BUILDING",
        "assist_seed": seed,
        "assist_seed_short": seed[:20],
        "source": {
            "ai": {
                "report_fingerprint": ai.get("report_fingerprint"),
                "material_delta": bool(ai.get("material_delta")),
                "weakest_next_focus": ai_focus,
                "end_champion": ai.get("end_champion"),
                "rounds": int(ai.get("rounds") or 0),
            },
            "security": {
                "run_id": security.get("run_id"),
                "priority_next": sec_next,
                "frameworks_covered": security.get("frameworks_covered") or [],
                "average_repository_evidence_coverage": security.get("average_repository_evidence_coverage"),
            },
            "research": rs,
        },
        "joint_question": question,
        "joint_focus": {
            "ai": ai_focus,
            "security_lens": sec_lens,
            "security_stage": sec_stage,
            "research_bias": research_bias,
        },
        "handoff": handoff,
        "contracts": {
            "ai_assist": f"Explore `{ai_focus}` with the security evidence seed; core correctness/reliability/security regression gates remain mandatory.",
            "security_assist": f"Challenge AI changes through `{sec_lens}` at `{sec_stage}`; next proof gap: {sec_improvement}",
            "research_assist": f"Prefer `{research_bias}` questions when useful, but closed-model findings remain synthetic evidence only.",
        },
        "promotion_blockers": [
            "joint agreement is not independent verification",
            "AI Foundry values are strategy proxies, not model-weight capability proof",
            "repository/security evidence does not establish customer validation",
            "active security testing remains owned or explicitly authorized only",
        ],
        "owner_action": "NONE",
    }


def render(packet: dict[str, Any]) -> str:
    f = packet["joint_focus"]
    src = packet["source"]
    handoff = packet["handoff"]
    return "\n".join([
        "# THE WORLD — AI × Security Joint Lab",
        "",
        f"- status: **{packet['status']}**",
        f"- assist seed: `{packet['assist_seed_short']}`",
        f"- AI focus: **{f['ai']}**",
        f"- Security focus: **{f['security_lens']} / {f['security_stage']}**",
        f"- Research bias: **{f['research_bias']}**",
        f"- AI source fingerprint: `{src['ai'].get('report_fingerprint') or 'NONE'}`",
        f"- Security source run: `{src['security'].get('run_id') or 'NONE'}`",
        f"- Research source run: `{src['research'].get('github_run_id') or 'NONE'}`",
        f"- Handoff: **{handoff['authority']}** / token `{handoff['handoff_token']}` / max {handoff['freshness']['max_consumer_cycles']} consumer cycles",
        "",
        "## Joint question",
        packet["joint_question"],
        "",
        "## Assist contracts",
        f"- AI: {packet['contracts']['ai_assist']}",
        f"- Security: {packet['contracts']['security_assist']}",
        f"- Research: {packet['contracts']['research_assist']}",
        "",
        "## Handoff constraints",
        "- priority only; promotion gate unchanged",
        "- permission surface unchanged",
        "- external scope and verification authority unchanged",
        "- stale handoffs must be ignored in favor of local evidence",
        "",
        "## Claim boundary",
        *[f"- {x}" for x in packet["promotion_blockers"]],
        "",
    ])


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--ai-summary")
    p.add_argument("--security-index")
    p.add_argument("--research-batch")
    p.add_argument("--out", required=True)
    p.add_argument("--report", required=True)
    args = p.parse_args()
    packet = build_packet(_load(args.ai_summary), _load(args.security_index), _load(args.research_batch))
    out = Path(args.out)
    report = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report.write_text(render(packet), encoding="utf-8")
    print(json.dumps({"seed": packet["assist_seed_short"], "focus": packet["joint_focus"], "handoff": packet["handoff"]["handoff_token"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
