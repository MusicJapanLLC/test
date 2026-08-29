#!/usr/bin/env python3
"""Evidence-to-revenue bridge.

Turns verified internal operating evidence into buyer-readable proof packages and a
ranked commercial next step. It never claims revenue without a real commercial event
and never contacts prospects by itself.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def proof_strength(value: dict[str, Any], performance: dict[str, Any]) -> tuple[int, list[str]]:
    score = 0
    evidence: list[str] = []
    pillars = value.get("pillars") or {}
    if pillars.get("operations") == "healthy":
        score += 20
        evidence.append("operations healthy")
    if pillars.get("security") == "guarded":
        score += 25
        evidence.append("security guarded")
    if pillars.get("ai_evolution") == "stable":
        score += 25
        evidence.append("Senju shadow stable")
    mgr = value.get("manager") or {}
    if int(mgr.get("unresolved", 0) or 0) == 0:
        score += 15
        evidence.append("no unresolved worker incident")
    summary = performance.get("summary") or {}
    if int(summary.get("reassign_candidates", 0) or 0) == 0:
        score += 15
        evidence.append("no repeated low-performance reassignment candidate")
    return min(100, score), evidence


def previous_cursor(previous: dict[str, Any]) -> int:
    value = previous.get("prospect_cursor", -1)
    if value is None:
        return -1
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


def build(catalog: dict[str, Any], value: dict[str, Any], performance: dict[str, Any], previous: dict[str, Any]) -> dict[str, Any]:
    products = catalog.get("products") or []
    strength, evidence = proof_strength(value, performance)
    prior_idx = previous_cursor(previous)
    bridges: list[dict[str, Any]] = []

    for product in products:
        prospects = list(product.get("named_prospects") or [])
        cursor = (prior_idx + 1) % len(prospects) if prospects else 0
        prospect = prospects[cursor] if prospects else "UNASSIGNED"
        proof = []
        mappings = product.get("proof_mappings") or {}
        pillars = value.get("pillars") or {}
        for pillar, claim in mappings.items():
            state = pillars.get(pillar)
            if state in {"healthy", "guarded", "stable", "behavioral"}:
                proof.append({"pillar": pillar, "claim": claim, "state": state})

        if strength >= 70 and prospect != "UNASSIGNED":
            distance = "D5 -> D4"
            next_action = f"{prospect}向けに、検証済みproofを1枚にまとめて営業司令室30の30分診断を提案できる状態へする"
        elif strength >= 45:
            distance = "D6 -> D5"
            next_action = "不足しているCI/運用証拠を閉じ、顧客向けproofとして再利用できる状態にする"
        else:
            distance = "D6 hold"
            next_action = "売り文句を増やさず、未解決・不安定要素の検証を優先する"

        bridges.append({
            "product_id": product.get("id"),
            "product": product.get("name"),
            "monthly_yen": product.get("monthly_yen"),
            "setup_yen": product.get("setup_yen"),
            "proof_strength": strength,
            "evidence": evidence,
            "buyer_proof": proof,
            "named_prospect": prospect,
            "revenue_distance": distance,
            "next_action": next_action,
            "commercial_claim_rule": "Do not call this revenue until a real meeting/proposal/order/payment is recorded."
        })

    first_prospects = list(products[0].get("named_prospects", [])) if products else []
    next_cursor = ((prior_idx + 1) % len(first_prospects)) if first_prospects else -1
    return {
        "schema": "revenue-bridge-report/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "prospect_cursor": next_cursor,
        "bridges": bridges,
    }


def render(report: dict[str, Any]) -> str:
    lines = ["# REVENUE BRIDGE", ""]
    for b in report.get("bridges", []):
        lines += [
            f"## {b['product']}",
            f"- proof strength: **{b['proof_strength']}/100**",
            f"- target: {b['named_prospect']}",
            f"- revenue distance: **{b['revenue_distance']}**",
            f"- next: {b['next_action']}",
            f"- evidence: {', '.join(b['evidence']) if b['evidence'] else 'none'}",
            "",
        ]
    lines += ["> Internal research only becomes business value when verified proof is attached to a real buyer path.", ""]
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--catalog", default="automation/revenue_bridge/catalog.json")
    p.add_argument("--value", default="reports/value-loop/daily-value.json")
    p.add_argument("--performance", default="reports/performance/board.json")
    p.add_argument("--previous", default="previous-revenue-bridge.json")
    p.add_argument("--out-json", default="reports/revenue-bridge/latest.json")
    p.add_argument("--out-md", default="reports/revenue-bridge/latest.md")
    args = p.parse_args()
    report = build(load(args.catalog), load(args.value), load(args.performance), load(args.previous))
    j, m = Path(args.out_json), Path(args.out_md)
    j.parent.mkdir(parents=True, exist_ok=True)
    m.parent.mkdir(parents=True, exist_ok=True)
    j.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    m.write_text(render(report), encoding="utf-8")
    print(json.dumps({"bridges": len(report["bridges"]), "cursor": report["prospect_cursor"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
