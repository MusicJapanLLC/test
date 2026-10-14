#!/usr/bin/env python3
"""Bidirectional R&D <-> Senju exchange with bounded Child Guild stimulus.

R&D chooses the research question. Child Guild fellows may challenge a *stable* baseline
with one alternate bounded technical focus. Senju returns technical evidence. No layer
may treat simulator strength as willingness to pay, market demand, contract value, or
real revenue.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ALLOWED_FOCUS = {"robustness", "learning", "balance", "efficiency"}
ALLOWED_RESEARCH_KEYS = {
    "research_id", "title", "problem", "hypothesis", "focus", "priority",
    "candidate_count", "success", "commercial_bridge",
}
ALLOWED_CHILD_KEYS = {
    "schema", "fictional_personas", "research_id", "research_title", "current_focus",
    "challenge_focus", "candidate_bonus", "fellows", "questions", "reason", "guardrail",
}
FORBIDDEN_DIRECTIVE_KEYS = {
    "target", "url", "host", "network", "scope", "permission", "secret",
    "credential", "exploit", "victim",
}
MARKET_FIELDS = {
    "willingness_to_pay", "urgency", "recurring_potential", "real_revenue_yen",
    "contract_value", "payment", "market_validated",
}


def load_json(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def choose_research(queue: dict[str, Any]) -> dict[str, Any]:
    items = queue.get("active") or []
    valid: list[dict[str, Any]] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        extra = set(raw) - ALLOWED_RESEARCH_KEYS
        if extra:
            continue
        focus = str(raw.get("focus", ""))
        research_id = str(raw.get("research_id", ""))
        if not research_id or focus not in ALLOWED_FOCUS:
            continue
        valid.append(raw)
    if not valid:
        return {
            "research_id": "RND-SENJU-DEFAULT",
            "title": "Default robustness research",
            "problem": "No valid bounded R&D directive was available.",
            "hypothesis": "Prefer robust multi-seed selection without changing execution boundaries.",
            "focus": "robustness",
            "priority": 0,
            "candidate_count": 5,
            "success": {},
            "commercial_bridge": "technical evidence only",
        }
    valid.sort(key=lambda item: (int(item.get("priority", 0) or 0), str(item["research_id"])), reverse=True)
    return valid[0]


def build_directive(research: dict[str, Any]) -> dict[str, Any]:
    count = max(3, min(9, int(research.get("candidate_count", 7) or 7)))
    directive = {
        "schema": "rnd-senju-directive/v1",
        "research_id": str(research["research_id"]),
        "focus": str(research["focus"]),
        "candidate_count": count,
        "hypothesis": str(research.get("hypothesis", ""))[:600],
    }
    if set(directive) & FORBIDDEN_DIRECTIVE_KEYS:
        raise ValueError("directive contains forbidden execution key")
    return directive


def technical_evidence(senju: dict[str, Any], shadow: dict[str, Any]) -> dict[str, Any]:
    selected = senju.get("selected") or {}
    source = shadow if shadow else {}
    evidence = {
        "senju_safe": bool(selected.get("safe", senju.get("safe", False))),
        "senju_score": float(selected.get("score", 0) or 0),
        "accepted_strategy_change": bool(senju.get("accepted_strategy_change", False)),
        "shadow_selected": bool(source.get("selected", False)) if "selected" in source else None,
        "shadow_stable": (
            bool(source.get("holdout", {}).get("stable"))
            if isinstance(source.get("holdout"), dict)
            else (bool(source.get("stable")) if "stable" in source else None)
        ),
        "shadow_safe": (
            bool(source.get("holdout", {}).get("safe"))
            if isinstance(source.get("holdout"), dict)
            else (bool(source.get("safe")) if "safe" in source else None)
        ),
        "mean_score": None,
        "worst_score": None,
        "score_stdev": None,
        "worst_balance": None,
        "worst_learning_signal": None,
    }
    shadow_metrics = source.get("holdout") if isinstance(source.get("holdout"), dict) else source
    if isinstance(shadow_metrics, dict):
        for key in ("mean_score", "worst_score", "score_stdev", "worst_balance", "worst_learning_signal"):
            if shadow_metrics.get(key) is not None:
                evidence[key] = float(shadow_metrics[key])
    if any(field in evidence for field in MARKET_FIELDS):
        raise AssertionError("technical evidence leaked a market field")
    return evidence


def sanitize_child_sparks(raw: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    if not raw:
        return {}, "no child research spark available"
    extra = set(raw) - ALLOWED_CHILD_KEYS
    if extra:
        return {}, f"forbidden child spark keys: {sorted(extra)}"
    if raw.get("fictional_personas") is not True:
        return {}, "child fellows must be explicitly fictional personas"
    focus = str(raw.get("challenge_focus", ""))
    if focus not in ALLOWED_FOCUS:
        return {}, "child challenge focus is outside bounded R&D focus set"
    try:
        bonus = max(0, min(2, int(raw.get("candidate_bonus", 0) or 0)))
    except Exception:
        return {}, "invalid child candidate bonus"
    fellows = raw.get("fellows") if isinstance(raw.get("fellows"), list) else []
    questions = raw.get("questions") if isinstance(raw.get("questions"), list) else []
    clean = {
        "research_id": str(raw.get("research_id", "")),
        "challenge_focus": focus,
        "candidate_bonus": bonus,
        "fellows": [
            {"id": str(x.get("id", ""))[:80], "name": str(x.get("name", ""))[:80], "role": str(x.get("role", ""))[:80]}
            for x in fellows[:5] if isinstance(x, dict)
        ],
        "questions": [str(x)[:400] for x in questions[:5]],
        "reason": str(raw.get("reason", ""))[:500],
    }
    return clean, None


def apply_child_stimulus(research: dict[str, Any], evidence: dict[str, Any], child_raw: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    child, error = sanitize_child_sparks(child_raw)
    effective = dict(research)
    meta = {
        "available": bool(child_raw),
        "valid": error is None,
        "applied": False,
        "reason": error or "baseline not yet eligible for child challenge",
        "requested_focus": child.get("challenge_focus") if child else None,
        "fellows": child.get("fellows", []) if child else [],
        "questions": child.get("questions", []) if child else [],
    }
    if error:
        return effective, meta
    if child.get("research_id") and child["research_id"] != str(research.get("research_id", "")):
        meta["reason"] = "child spark belongs to a different research question"
        return effective, meta
    if evidence.get("shadow_stable") is not True or evidence.get("shadow_safe") is not True:
        meta["reason"] = "adult R&D focus retained until the current baseline is safe and stable"
        return effective, meta

    effective["focus"] = child["challenge_focus"]
    effective["candidate_count"] = max(3, min(9, int(research.get("candidate_count", 7) or 7) + int(child["candidate_bonus"])))
    effective["hypothesis"] = (
        f"{research.get('hypothesis', '')} Child Fellow challenge: test {child['challenge_focus']} as a bounded alternate lens."
    )[:600]
    meta["applied"] = True
    meta["reason"] = child.get("reason") or "stable baseline opened one bounded novelty slot"
    meta["effective_focus"] = effective["focus"]
    meta["effective_candidate_count"] = effective["candidate_count"]
    return effective, meta


def build_exchange(queue: dict[str, Any], senju: dict[str, Any], shadow: dict[str, Any], child_sparks: dict[str, Any] | None = None) -> dict[str, Any]:
    research = choose_research(queue)
    evidence = technical_evidence(senju, shadow)
    effective_research, child_meta = apply_child_stimulus(research, evidence, child_sparks or {})
    directive = build_directive(effective_research)
    counterevidence: list[str] = []
    if evidence["shadow_stable"] is False:
        counterevidence.append("multi-seed/holdout stability failed")
    if evidence["shadow_safe"] is False:
        counterevidence.append("shadow safety failed")
    if evidence["worst_balance"] is not None and evidence["worst_balance"] < 0.35:
        counterevidence.append("seed-sensitive competitive imbalance")
    if evidence["worst_learning_signal"] is not None and evidence["worst_learning_signal"] < 0.05:
        counterevidence.append("weak worst-case learning signal")
    if child_meta["available"] and not child_meta["valid"]:
        counterevidence.append("Child Fellow stimulus rejected by research boundary")
    if counterevidence:
        next_step = "mutate/retest under the same research question"
    elif child_meta.get("applied"):
        next_step = "run the bounded Child Fellow challenge, preserve counterevidence, then compare against the adult R&D baseline"
    else:
        next_step = "preserve evidence and test whether it improves a customer-facing deliverable"
    return {
        "schema": "rnd-senju-exchange/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "research": {k: research.get(k) for k in ALLOWED_RESEARCH_KEYS if k in research},
        "child_stimulus": child_meta,
        "directive_to_senju": directive,
        "technical_evidence_from_senju": evidence,
        "counterevidence": counterevidence,
        "rnd_next": next_step,
        "market_truth": {
            "market_validated": False,
            "real_revenue_yen": 0,
            "rule": "Senju or Child Guild technical evidence can strengthen proof, but cannot create willingness-to-pay, market validation, contracts, payments, or revenue.",
        },
    }


def render(report: dict[str, Any]) -> str:
    r = report["research"]
    e = report["technical_evidence_from_senju"]
    d = report["directive_to_senju"]
    c = report["child_stimulus"]
    fellows = ", ".join(x.get("name", "") for x in c.get("fellows", [])) or "NONE"
    lines = [
        "# R&D x Senju Exchange",
        "",
        f"- research: **{r.get('research_id')}** — {r.get('title')}",
        f"- Child Fellows: **{fellows}** / applied={c.get('applied')} / requested={c.get('requested_focus')}",
        f"- focus sent to Senju: **{d.get('focus')}** / candidates={d.get('candidate_count')}",
        f"- Senju safe: **{e.get('senju_safe')}**",
        f"- shadow stable: **{e.get('shadow_stable')}**",
        f"- worst score: {e.get('worst_score')}",
        f"- worst balance: {e.get('worst_balance')}",
        f"- worst learning: {e.get('worst_learning_signal')}",
        f"- counterevidence: {', '.join(report['counterevidence']) or 'NONE'}",
        f"- R&D next: {report['rnd_next']}",
        "",
        "> 子供は前提を揺らす。実行境界は揺らさない。技術の強さと市場価値も混同しない。",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", default="value-lab/research_queue.json")
    ap.add_argument("--senju", default="senju/state/last-evolution-summary.json")
    ap.add_argument("--shadow", default=None)
    ap.add_argument("--child-sparks", default=None)
    ap.add_argument("--out", default="reports/rnd-senju")
    args = ap.parse_args()

    report = build_exchange(load_json(args.queue), load_json(args.senju), load_json(args.shadow), load_json(args.child_sparks))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "exchange.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "exchange.md").write_text(render(report), encoding="utf-8")
    (out / "directive.json").write_text(json.dumps(report["directive_to_senju"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "research_id": report["directive_to_senju"]["research_id"],
        "focus": report["directive_to_senju"]["focus"],
        "candidate_count": report["directive_to_senju"]["candidate_count"],
        "child_applied": report["child_stimulus"]["applied"],
        "counterevidence": len(report["counterevidence"]),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
