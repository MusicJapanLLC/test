#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

STATUS_RANK = {
    "ABSENT": 0,
    "EXPERIMENT": 1,
    "VISIBLE": 1,
    "BLOCKED": 1,
    "BUILDING": 2,
    "VERIFIED": 3,
}


def load_optional(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    data = json.loads(p.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _selected(plan: dict[str, Any]) -> dict[str, Any]:
    value = plan.get("selected") or {}
    return value if isinstance(value, dict) else {}


def _holdout(selection: dict[str, Any]) -> dict[str, Any]:
    value = selection.get("holdout") or {}
    return value if isinstance(value, dict) else {}


def _pct(value: Any) -> str:
    try:
        return f"{float(value) * 100:.0f}%"
    except (TypeError, ValueError):
        return "UNMEASURED"


def _num(value: Any) -> str:
    return "UNMEASURED" if value is None else str(value)


def classify_delta(current: dict[str, Any], previous: dict[str, Any]) -> str:
    if not previous:
        return "FIRST_BASELINE"
    cur = _selected(current)
    prev = _selected(previous)
    if cur.get("id") != prev.get("id"):
        return "FOCUS_CHANGED"
    cur_status = str(cur.get("portfolio_status") or "ABSENT")
    prev_status = str(prev.get("portfolio_status") or "ABSENT")
    cur_rank = STATUS_RANK.get(cur_status, 0)
    prev_rank = STATUS_RANK.get(prev_status, 0)
    cur_ratio = float(cur.get("evidence_ratio") or 0.0)
    prev_ratio = float(prev.get("evidence_ratio") or 0.0)
    if cur_rank < prev_rank or cur_ratio < prev_ratio:
        return "REGRESSION"
    if cur_rank > prev_rank:
        return "STATUS_UP"
    if cur_ratio > prev_ratio:
        return "EVIDENCE_GAIN"
    return "NO_PORTFOLIO_CHANGE"


def build_report(
    plan: dict[str, Any],
    audit: dict[str, Any],
    selection: dict[str, Any],
    previous_plan: dict[str, Any] | None = None,
    previous_evidence: dict[str, Any] | None = None,
    *,
    run_url: str = "",
) -> dict[str, Any]:
    previous_plan = previous_plan or {}
    previous_evidence = previous_evidence or {}
    cur = _selected(plan)
    prev = _selected(previous_plan)
    holdout = _holdout(selection)

    same_track = bool(prev) and prev.get("id") == cur.get("id")
    before_status = str(prev.get("portfolio_status") or "NO_PRIOR_BASELINE") if same_track else "NO_PRIOR_BASELINE"
    before_ratio = prev.get("evidence_ratio") if same_track else None
    after_status = str(cur.get("portfolio_status") or "UNKNOWN")
    after_ratio = cur.get("evidence_ratio")

    prev_missing = set(prev.get("evidence_missing") or []) if same_track else set()
    cur_missing = set(cur.get("evidence_missing") or [])
    evidence_added = sorted(prev_missing - cur_missing) if same_track else []
    evidence_regressed = sorted(cur_missing - prev_missing) if same_track else []

    selected = bool(selection.get("selected"))
    reason = str(selection.get("reason") or "no selection evidence")
    promotion_ready = bool(plan.get("promotion_ready"))
    delta_type = classify_delta(plan, previous_plan)

    if promotion_ready:
        experiment_outcome = "PORTFOLIO_PROMOTION_READY"
    elif selected:
        experiment_outcome = "SENJU_TECHNICAL_SUPPORT_ONLY"
    elif selection:
        experiment_outcome = "REJECTED_BY_SENJU"
    else:
        experiment_outcome = "NO_SENJU_RESULT"

    if delta_type in {"STATUS_UP", "EVIDENCE_GAIN"}:
        executive_summary = (
            f"{cur.get('title')}: portfolio evidence improved ({before_status}/{_pct(before_ratio)} -> "
            f"{after_status}/{_pct(after_ratio)}). Senju outcome={experiment_outcome}."
        )
    elif delta_type == "REGRESSION":
        executive_summary = (
            f"{cur.get('title')}: evidence regressed; promotion is blocked until the missing proof is restored."
        )
    elif delta_type == "FOCUS_CHANGED":
        executive_summary = (
            f"Research priority moved from {prev.get('id', 'NONE')} to {cur.get('id', 'UNKNOWN')} based on the current portfolio gap score."
        )
    elif delta_type == "FIRST_BASELINE":
        executive_summary = (
            f"Established the first detailed baseline for {cur.get('title')}; future runs will report exact before/after deltas."
        )
    else:
        executive_summary = (
            f"{cur.get('title')}: no verified portfolio maturity change today; research result={experiment_outcome}."
        )

    customer_problem = str(cur.get("customer_problem") or "UNMEASURED — define the concrete buyer pain in the portfolio program.")
    customer_value = str(cur.get("customer_value") or "UNMEASURED — no customer outcome is claimed from technical evidence alone.")
    commercial_use = str(cur.get("commercial_use") or "Use only as technical proof until external/customer evidence exists.")
    success_criteria = str(cur.get("success_criteria") or "Human-inspectable artifact + verification proof + reproducible result.")

    return {
        "schema": "standment-security-rnd-detailed-report/v1",
        "portfolio_track": cur.get("id"),
        "portfolio_title": cur.get("title"),
        "research_score": cur.get("research_score"),
        "delta_type": delta_type,
        "executive_summary": executive_summary,
        "why_selected_now": (
            f"research_score={cur.get('research_score')} / status={after_status} / evidence={_pct(after_ratio)} / "
            f"missing={len(cur_missing)}"
        ),
        "hypothesis": cur.get("hypothesis"),
        "target_deliverable": cur.get("deliverable"),
        "customer_problem": customer_problem,
        "customer_value": customer_value,
        "commercial_use": commercial_use,
        "before": {
            "portfolio_status": before_status,
            "evidence_ratio": before_ratio,
            "missing_evidence": sorted(prev_missing) if same_track else [],
        },
        "after": {
            "portfolio_status": after_status,
            "evidence_ratio": after_ratio,
            "missing_evidence": sorted(cur_missing),
            "promotion_ready": promotion_ready,
        },
        "verified_delta": {
            "evidence_added": evidence_added,
            "evidence_regressed": evidence_regressed,
            "status_changed": before_status != after_status if same_track else False,
            "portfolio_maturity_changed": delta_type in {"STATUS_UP", "EVIDENCE_GAIN", "REGRESSION"},
        },
        "senju": {
            "focus": audit.get("focus") or cur.get("senju_focus"),
            "candidate_count": selection.get("candidate_count"),
            "selected": selected,
            "reason": reason,
            "holdout_safe": holdout.get("safe"),
            "holdout_stable": holdout.get("stable"),
            "robust_score": holdout.get("robust_score"),
            "worst_score": holdout.get("worst_score"),
            "mean_score": holdout.get("mean_score"),
            "score_stdev": holdout.get("score_stdev"),
            "worst_balance": holdout.get("worst_balance"),
            "worst_learning_signal": holdout.get("worst_learning_signal"),
        },
        "experiment_outcome": experiment_outcome,
        "negative_evidence": reason if not selected else "NONE — selected candidate passed the Senju gate.",
        "what_remains_unproven": (
            "Technical reproducibility does not prove customer demand, willingness to pay, contract, payment, production deployment, or market value."
        ),
        "owner_action": "NONE",
        "next_24h": (
            f"Strengthen {cur.get('id')} by closing the highest-value missing evidence item and rerun the same bounded verification."
            if cur_missing
            else f"Improve reproducibility and human readability of {cur.get('id')} without widening testing scope."
        ),
        "success_criteria": success_criteria,
        "run_url": run_url,
        "previous_run_url": previous_evidence.get("run_url") or "",
    }


def render(report: dict[str, Any]) -> str:
    b = report["before"]
    a = report["after"]
    v = report["verified_delta"]
    s = report["senju"]
    added = ", ".join(v["evidence_added"]) or "NONE"
    regressed = ", ".join(v["evidence_regressed"]) or "NONE"
    missing = ", ".join(a["missing_evidence"]) or "NONE"
    run_line = report.get("run_url") or "GitHub Actions run URL unavailable"

    return (
        f"*R&D PORTFOLIO DAILY｜Standment Security｜{report.get('portfolio_track')}*\n"
        f"*本日の結論*\n{report['executive_summary']}\n\n"
        f"*1. 何を研究したか*\n"
        f"対象: {report.get('portfolio_title')}\n"
        f"なぜ今: {report.get('why_selected_now')}\n"
        f"仮説: {report.get('hypothesis')}\n"
        f"狙う成果物: {report.get('target_deliverable')}\n\n"
        f"*2. BEFORE -> AFTER*\n"
        f"状態: `{b.get('portfolio_status')} -> {a.get('portfolio_status')}`\n"
        f"証拠充足: `{_pct(b.get('evidence_ratio'))} -> {_pct(a.get('evidence_ratio'))}`\n"
        f"追加できた証拠: {added}\n"
        f"後退/欠損: {regressed}\n"
        f"現在まだ不足: {missing}\n"
        f"portfolio昇格可能: *{a.get('promotion_ready')}* / delta={report.get('delta_type')}\n\n"
        f"*3. 千寿でどう検証したか*\n"
        f"focus={s.get('focus')} / candidates={_num(s.get('candidate_count'))} / selected={s.get('selected')}\n"
        f"判定理由: {s.get('reason')}\n"
        f"holdout safe={s.get('holdout_safe')} / stable={s.get('holdout_stable')} / robust={_num(s.get('robust_score'))}\n"
        f"worst={_num(s.get('worst_score'))} / mean={_num(s.get('mean_score'))} / stdev={_num(s.get('score_stdev'))}\n"
        f"balance={_num(s.get('worst_balance'))} / learning={_num(s.get('worst_learning_signal'))}\n"
        f"実験結論: *{report.get('experiment_outcome')}*\n\n"
        f"*4. ポートフォリオに何が増えたか*\n"
        f"成熟度変化: {v.get('portfolio_maturity_changed')}\n"
        f"新規証拠: {added}\n"
        f"これは『研究した』ではなく、顧客に見せられる証拠が増えたかで判定する。\n\n"
        f"*5. 顧客・事業にどう効くか*\n"
        f"顧客課題: {report.get('customer_problem')}\n"
        f"顧客価値: {report.get('customer_value')}\n"
        f"営業/商品化での使い道: {report.get('commercial_use')}\n"
        f"※技術結果だけで需要・売上・支払は主張しない。\n\n"
        f"*6. 失敗・却下したもの*\n{report.get('negative_evidence')}\n\n"
        f"*7. まだ証明できていないこと*\n{report.get('what_remains_unproven')}\n\n"
        f"*8. 次の24h*\n{report.get('next_24h')}\n"
        f"成功条件: {report.get('success_criteria')}\n"
        f"Owner action: *{report.get('owner_action')}*\n\n"
        f"*9. Evidence*\n{run_line}"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--audit", required=True)
    ap.add_argument("--selection", required=True)
    ap.add_argument("--previous-plan")
    ap.add_argument("--previous-evidence")
    ap.add_argument("--run-url", default="")
    ap.add_argument("--out-json", required=True)
    ap.add_argument("--out-md", required=True)
    args = ap.parse_args()

    report = build_report(
        load_optional(args.plan),
        load_optional(args.audit),
        load_optional(args.selection),
        load_optional(args.previous_plan),
        load_optional(args.previous_evidence),
        run_url=args.run_url,
    )
    Path(args.out_json).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.out_md).write_text(render(report) + "\n", encoding="utf-8")
    print(json.dumps({"delta_type": report["delta_type"], "outcome": report["experiment_outcome"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
