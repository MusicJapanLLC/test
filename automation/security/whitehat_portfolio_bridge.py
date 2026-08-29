#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def classify(report: dict) -> dict:
    mode = report.get("mode")
    probes = report.get("probe_results") or []
    hypotheses = report.get("hypotheses") or []
    safe_boundary = report.get("policy") or {}
    behavioral_evidence = mode == "local-validation" and len(probes) > 0
    network_disabled = mode == "plan-only" and int(report.get("network_requests", -1)) == 0

    return {
        "artifact_type": "WHITEHAT_DEFENSIVE_RND_EVIDENCE",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "hypothesis_count": len(hypotheses),
        "probe_count": len(probes),
        "safe_boundary_present": bool(safe_boundary),
        "network_disabled_plan_only": network_disabled,
        "behavioral_evidence_present": behavioral_evidence,
        "portfolio_status": "BUILDING",
        "promotion_ready": False,
        "promotion_reason": (
            "White-hat report is a research/evidence input. Portfolio promotion requires a human-inspectable "
            "artifact plus independently verified claimed behavior and, for remediation claims, Before/After evidence."
        ),
        "claims_allowed": [
            "adversarial hypothesis generation",
            "safe-scope policy enforcement",
            "plan-only zero-network research" if network_disabled else "bounded local validation",
        ],
        "claims_forbidden_without_more_evidence": [
            "vulnerability confirmed solely from hypothesis",
            "third-party system compromise",
            "customer security improvement without Before/After proof",
            "market demand, contract, payment or revenue",
        ],
        "next_portfolio_step": (
            "Select the highest-impact hypothesis, map it to owned source/config or a local fixture, implement a "
            "bounded remediation, then rerun the same evidence path and package Before/After proof."
        ),
    }


def render(summary: dict, report: dict) -> str:
    lines = [
        "# White-Hat → Portfolio Evidence Pack",
        "",
        f"**Status:** `{summary['portfolio_status']}`",
        f"**Mode:** `{summary['mode']}`",
        f"**Hypotheses:** {summary['hypothesis_count']}",
        f"**Safe probes:** {summary['probe_count']}",
        f"**Promotion ready:** {summary['promotion_ready']}",
        "",
        "## 何が増えたか",
        "",
        "- 既存Findingを攻撃者視点の反証仮説へ変換する研究入力",
        "- 仮説ごとの必要証拠と修正候補",
        "- plan-onlyではネットワーク接続ゼロの分析経路",
        "- local-validationではlocalhost/private限定の無害な挙動証拠",
        "",
        "## Portfolio Gate",
        "",
        f"{summary['promotion_reason']}",
        "",
        "### 今言ってよいこと",
        *[f"- {value}" for value in summary["claims_allowed"]],
        "",
        "### まだ言ってはいけないこと",
        *[f"- {value}" for value in summary["claims_forbidden_without_more_evidence"]],
        "",
        "## 次の変換",
        "",
        summary["next_portfolio_step"],
        "",
        "## Hypothesis Index",
        "",
    ]
    for index, hypothesis in enumerate(report.get("hypotheses") or [], 1):
        lines.append(f"{index}. [{hypothesis.get('severity','?').upper()}] {hypothesis.get('title','(untitled)')}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--json-out", required=True, type=Path)
    args = parser.parse_args()

    report = json.loads(args.report.read_text(encoding="utf-8"))
    summary = classify(report)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(render(summary, report), encoding="utf-8")
    args.json_out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "status": summary["portfolio_status"], "mode": summary["mode"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
