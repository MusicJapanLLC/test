#!/usr/bin/env python3
"""Bidirectional R&D <-> Senju exchange.

R&D may choose a bounded technical research focus and candidate budget. Senju returns
technical evidence. The bridge never treats simulator strength as willingness to pay,
market demand, contract value, or real revenue.
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


def build_exchange(queue: dict[str, Any], senju: dict[str, Any], shadow: dict[str, Any]) -> dict[str, Any]:
    research = choose_research(queue)
    directive = build_directive(research)
    evidence = technical_evidence(senju, shadow)
    counterevidence: list[str] = []
    if evidence["shadow_stable"] is False:
        counterevidence.append("multi-seed/holdout stability failed")
    if evidence["shadow_safe"] is False:
        counterevidence.append("shadow safety failed")
    if evidence["worst_balance"] is not None and evidence["worst_balance"] < 0.35:
        counterevidence.append("seed-sensitive competitive imbalance")
    if evidence["worst_learning_signal"] is not None and evidence["worst_learning_signal"] < 0.05:
        counterevidence.append("weak worst-case learning signal")
    return {
        "schema": "rnd-senju-exchange/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "research": {k: research.get(k) for k in ALLOWED_RESEARCH_KEYS if k in research},
        "directive_to_senju": directive,
        "technical_evidence_from_senju": evidence,
        "counterevidence": counterevidence,
        "rnd_next": (
            "mutate/retest under the same research question"
            if counterevidence
            else "preserve evidence and test whether it improves a customer-facing deliverable"
        ),
        "market_truth": {
            "market_validated": False,
            "real_revenue_yen": 0,
            "rule": "Senju technical evidence can strengthen proof, but cannot create willingness-to-pay, market validation, contracts, payments, or revenue.",
        },
    }


def render(report: dict[str, Any]) -> str:
    r = report["research"]
    e = report["technical_evidence_from_senju"]
    d = report["directive_to_senju"]
    lines = [
        "# R&D x Senju Exchange",
        "",
        f"- research: **{r.get('research_id')}** — {r.get('title')}",
        f"- focus sent to Senju: **{d.get('focus')}** / candidates={d.get('candidate_count')}",
        f"- Senju safe: **{e.get('senju_safe')}**",
        f"- shadow stable: **{e.get('shadow_stable')}**",
        f"- worst score: {e.get('worst_score')}",
        f"- worst balance: {e.get('worst_balance')}",
        f"- worst learning: {e.get('worst_learning_signal')}",
        f"- counterevidence: {', '.join(report['counterevidence']) or 'NONE'}",
        f"- R&D next: {report['rnd_next']}",
        "",
        "> Senjuの強さは技術証拠。顧客需要・契約・入金は別証拠が必要。",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", default="value-lab/research_queue.json")
    ap.add_argument("--senju", default="senju/state/last-evolution-summary.json")
    ap.add_argument("--shadow", default=None)
    ap.add_argument("--out", default="reports/rnd-senju")
    args = ap.parse_args()

    report = build_exchange(load_json(args.queue), load_json(args.senju), load_json(args.shadow))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "exchange.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "exchange.md").write_text(render(report), encoding="utf-8")
    (out / "directive.json").write_text(json.dumps(report["directive_to_senju"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "research_id": report["directive_to_senju"]["research_id"],
        "focus": report["directive_to_senju"]["focus"],
        "candidate_count": report["directive_to_senju"]["candidate_count"],
        "counterevidence": len(report["counterevidence"]),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
