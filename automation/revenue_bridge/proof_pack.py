#!/usr/bin/env python3
"""Generate a buyer-readable proof pack from verified Revenue Bridge evidence.

The pack is intentionally conservative: it becomes SELL_READY only when evidence is
strong enough. Weak evidence produces HOLD_FOR_EVIDENCE rather than marketing copy.
"""
from __future__ import annotations

import argparse
import json
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


def classify(bridge: dict[str, Any]) -> tuple[str, list[str]]:
    strength = int(bridge.get("proof_strength", 0) or 0)
    proofs = list(bridge.get("buyer_proof") or [])
    evidence = list(bridge.get("evidence") or [])
    reasons: list[str] = []
    if strength < 70:
        reasons.append(f"proof strength {strength} < 70")
    if len(proofs) < 2:
        reasons.append(f"buyer proof count {len(proofs)} < 2")
    if len(evidence) < 3:
        reasons.append(f"evidence count {len(evidence)} < 3")
    return ("SELL_READY" if not reasons else "HOLD_FOR_EVIDENCE"), reasons


def render(report: dict[str, Any]) -> str:
    bridges = list(report.get("bridges") or [])
    if not bridges:
        return "# CUSTOMER PROOF PACK\n\n**HOLD_FOR_EVIDENCE** — no commercial bridge exists.\n"

    b = bridges[0]
    status, reasons = classify(b)
    outcomes = list(b.get("buyer_outcomes") or [])
    proofs = list(b.get("buyer_proof") or [])
    evidence = list(b.get("evidence") or [])

    lines = [
        "# CUSTOMER PROOF PACK",
        "",
        f"**Status: {status}**",
        f"Product: **{b.get('product', 'UNKNOWN')}**",
        f"Target: **{b.get('named_prospect', 'UNASSIGNED')}**",
        f"Proof strength: **{int(b.get('proof_strength', 0) or 0)}/100**",
        f"Revenue distance: **{b.get('revenue_distance', 'D6')}**",
        "",
    ]
    if reasons:
        lines += ["## 販売を止めている理由"] + [f"- {x}" for x in reasons] + [""]

    lines += ["## 顧客に約束してよい成果"]
    if outcomes:
        lines += [f"- {x}" for x in outcomes]
    else:
        lines.append("- まだ十分な商品成果定義がない")

    lines += ["", "## 検証済みProof"]
    if proofs:
        for p in proofs:
            lines.append(f"- {p.get('claim')} — evidence state: `{p.get('state')}`")
    else:
        lines.append("- まだ顧客向けに転用できる検証済みProofがない")

    lines += ["", "## 内部Evidence"]
    lines += [f"- {x}" for x in evidence] if evidence else ["- NONE"]

    lines += [
        "",
        "## 次の商流",
        f"- {b.get('next_action', '検証を続行')}",
        "",
        "## Truth Guard",
        f"- 現実売上: **¥{int(report.get('real_revenue_yen', 0) or 0):,}**",
        f"- verified commercial stage: **{b.get('verified_commercial_stage') or 'NONE'}**",
        "- WLD、研究スコア、内部評価、商談、提案、契約を入金として表現しない",
        "- 顧客向け説明では、この文書に載っていない性能・安全性・成果を推測で追加しない",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--bridge", default="reports/revenue-bridge/latest.json")
    p.add_argument("--out", default="reports/revenue-bridge/customer-proof-pack.md")
    args = p.parse_args()
    report = load(args.bridge)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(report), encoding="utf-8")
    bridge = (report.get("bridges") or [{}])[0]
    status, reasons = classify(bridge)
    print(json.dumps({"status": status, "reasons": reasons}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
