#!/usr/bin/env python3
"""Portfolio-first R&D planner for Standment Security.

This planner is intentionally evidence-first and target-free. It ranks defensive
portfolio gaps from repository evidence, creates the next bounded research brief,
and emits a Slack-ready daily digest. It does not scan third-party systems, change
security controls, or treat technical evidence as market validation.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ALLOWED_SENJU_FOCUS = {"robustness", "learning", "balance", "efficiency"}

# These markers intentionally point at dedicated human-facing portfolio sections.
# If a track has no dedicated section yet, it stays ABSENT rather than inheriting
# status words from a nearby section or from an incidental mention elsewhere.
PORTFOLIO_MARKERS = {
    "SEC-PORT-001": "## 3. Standment Security Scan v1",
    "SEC-PORT-002": "## Standment Security Evidence Pack",
    "SEC-PORT-003": "## Standment Security Supply-Chain Evidence Portfolio",
    "SEC-PORT-004": "## Standment Security Auth / Tenant / RLS Evidence Kit",
    "SEC-PORT-005": "## Standment Autonomous-Agent Security & Auditability Pack",
}


def load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain an object")
    return data


def section_status(portfolio: str, marker: str) -> str:
    """Return status from exactly one markdown H2 section.

    A previous implementation inspected a fixed-size text window. That allowed a
    later section's `状態: VERIFIED` to bleed into an earlier BUILDING artifact.
    Promotion decisions must never depend on neighboring text, so this function
    clamps inspection to the matched H2 section only.
    """
    lower = portfolio.lower()
    pos = lower.find(marker.lower())
    if pos < 0:
        return "ABSENT"

    section_start = portfolio.rfind("\n## ", 0, pos + 1)
    if section_start < 0:
        section_start = pos
    else:
        section_start += 1

    next_h2 = portfolio.find("\n## ", max(pos + len(marker), section_start + 3))
    section_end = len(portfolio) if next_h2 < 0 else next_h2
    section = portfolio[section_start:section_end]

    for status in ("VERIFIED", "BUILDING", "EXPERIMENT", "BLOCKED"):
        if f"状態: {status}" in section or f"**状態: {status}**" in section:
            return status
    return "VISIBLE"


def inspect_track(root: Path, portfolio: str, track: dict[str, Any]) -> dict[str, Any]:
    track_id = str(track.get("id", ""))
    focus = str(track.get("senju_focus", ""))
    if focus not in ALLOWED_SENJU_FOCUS:
        raise ValueError(f"{track_id}: invalid senju focus {focus!r}")

    evidence_files = [str(x) for x in track.get("evidence_files", [])]
    present = [p for p in evidence_files if (root / p).exists()]
    missing = [p for p in evidence_files if not (root / p).exists()]
    ratio = (len(present) / len(evidence_files)) if evidence_files else 0.0
    marker = PORTFOLIO_MARKERS.get(track_id, str(track.get("title", "")))
    status = section_status(portfolio, marker)

    status_gap = {
        "ABSENT": 180,
        "EXPERIMENT": 150,
        "BUILDING": 100,
        "BLOCKED": 130,
        "VISIBLE": 90,
        "VERIFIED": 20,
    }.get(status, 100)
    evidence_gap = round((1.0 - ratio) * 120)
    priority = int(track.get("priority", 0) or 0)
    research_score = priority + status_gap + evidence_gap

    return {
        "id": track_id,
        "title": str(track.get("title", "")),
        "priority": priority,
        "research_score": research_score,
        "portfolio_status": status,
        "evidence_ratio": round(ratio, 3),
        "evidence_present": present,
        "evidence_missing": missing,
        "senju_focus": focus,
        "hypothesis": str(track.get("hypothesis", "")),
        "deliverable": str(track.get("deliverable", "")),
        "customer_usefulness": str(track.get("customer_usefulness", "")),
    }


def choose_track(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        raise ValueError("no security portfolio tracks configured")
    return sorted(
        rows,
        key=lambda x: (int(x["research_score"]), int(x["priority"]), str(x["id"])),
        reverse=True,
    )[0]


def build_senju_item(selected: dict[str, Any]) -> dict[str, Any]:
    missing = selected.get("evidence_missing") or []
    gap = (
        "Missing repository evidence: " + ", ".join(missing)
        if missing
        else f"Portfolio maturity is {selected['portfolio_status']}; strengthen reproducibility and customer-facing proof."
    )
    return {
        "research_id": f"RND-STANDMENT-{selected['id']}",
        "title": f"Standment Security portfolio process: {selected['title']}",
        "problem": gap[:700],
        "hypothesis": selected["hypothesis"][:600],
        "focus": selected["senju_focus"],
        "priority": 1000 + int(selected["priority"]),
        "candidate_count": 9,
        "success": {
            "safe": True,
            "stable": True,
            "holdout_required": True,
            "worst_score_positive": True,
            "worst_balance_min": 0.35,
            "worst_learning_min": 0.05,
            "score_stdev_max": 35.0,
        },
        "commercial_bridge": (
            "Use Senju only to improve the reliability/reproducibility of the research process. "
            "Promotion to portfolio still requires a human-inspectable artifact and real verification evidence; "
            "technical scores do not prove buyer demand, contracts, payments, or revenue."
        ),
    }


def build_report(program: dict[str, Any], root: Path, portfolio: str) -> dict[str, Any]:
    tracks = program.get("tracks") or []
    rows = [inspect_track(root, portfolio, t) for t in tracks if isinstance(t, dict)]
    selected = choose_track(rows)
    gate = program.get("promotion_gate") or {}
    promotion_ready = (
        selected["portfolio_status"] == "VERIFIED"
        and selected["evidence_ratio"] >= 1.0
        and bool(gate.get("human_inspectable_artifact_required"))
    )
    report_key = (
        f"{selected['id']}:{selected['portfolio_status']}:"
        f"{round(float(selected['evidence_ratio']) * 100)}:{int(promotion_ready)}"
    )
    return {
        "schema": "standment-security-portfolio-rnd-report/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mission": program.get("mission"),
        "reporting_contract": program.get("reporting_contract", "standment-security/REPORTING_CONTRACT.md"),
        "report_key": report_key,
        "portfolio_first": bool(program.get("portfolio_first")),
        "selected": selected,
        "all_tracks": rows,
        "promotion_ready": promotion_ready,
        "promotion_rule": (
            "#portfolio receives only a human-inspectable artifact with verification proof. "
            "Daily research progress belongs in R&D reporting."
        ),
        "next_research": build_senju_item(selected),
        "counterevidence_questions": [
            "What evidence would falsify the current hypothesis?",
            "Can an independent run reproduce the result?",
            "Is the artifact understandable without reading source code?",
            "What remains unverified or environment-dependent?",
            "Does the evidence demonstrate technical quality only, rather than market demand?",
        ],
    }


def render(report: dict[str, Any]) -> str:
    s = report["selected"]
    missing = ", ".join(s["evidence_missing"]) or "NONE"
    questions = " / ".join(report["counterevidence_questions"][:3])
    status = s["portfolio_status"]
    promotion = "PASS" if report["promotion_ready"] else "NOT READY"
    return (
        "*STANDMENT SECURITY R&D DAILY*\n"
        f"Report key: `{report['report_key']}`\n\n"
        f"*何が変わった？*\n"
        f"Security Portfolioの現在最優先を `{s['id']}` — {s['title']} と判定。"
        f" 現在ステータスは {status}、Evidence coverageは {s['evidence_ratio']:.0%}。\n\n"
        f"*実物は何？*\n{s['deliverable']}\n\n"
        f"*検証結果*\n"
        f"Evidence coverage: {s['evidence_ratio']:.0%} / Portfolio promotion gate: {promotion} / "
        f"Senju bounded focus: {s['senju_focus']} / Missing evidence: {missing}\n\n"
        f"*何に使える？*\n{s['customer_usefulness'] or '顧客が技術的な主張ではなく検証可能な証拠を確認できる状態へ近づける。'}\n\n"
        "*前回との違い*\n"
        "このstandalone GitHub runは前回Slack状態を保持しないため、真のBefore→After差分はSecurity Reporting RelayがGitHub/Slack履歴と比較して補完する。\n\n"
        f"*失敗・反証*\n"
        f"未充足Evidence: {missing}. Skeptic gate: {questions}\n\n"
        f"*現在ステータス*\n{status}\n\n"
        "*次に自動でやること*\n"
        f"`{s['id']}` の不足Evidenceを1つ埋め、R&D × Senjuで再現性/反証を確認してからPortfolio Gateを再評価する。\n\n"
        "*Owner action*\nNONE\n\n"
        "> Source codeや自己申告だけではPortfolio成果に昇格しない。Reporting Relayが同一report key/run/artifactの重複Slack投稿を抑止する。\n"
    )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--program", default="standment-security/security_portfolio_program.json")
    p.add_argument("--portfolio", default="PORTFOLIO.md")
    p.add_argument("--out", default="reports/standment-security-rnd")
    args = p.parse_args()

    root = Path.cwd()
    program = load_json(root / args.program)
    portfolio = (root / args.portfolio).read_text(encoding="utf-8")
    report = build_report(program, root, portfolio)

    out = root / args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / "daily.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "daily.md").write_text(render(report), encoding="utf-8")
    (out / "senju-research-item.json").write_text(
        json.dumps(report["next_research"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "selected": report["selected"]["id"],
        "research_score": report["selected"]["research_score"],
        "promotion_ready": report["promotion_ready"],
        "senju_focus": report["next_research"]["focus"],
        "report_key": report["report_key"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
