#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

SECTION_RE = re.compile(r"^##\s+\d+\.\s+(.+?)\s*$", re.MULTILINE)
STATUS_RE = re.compile(r"\*\*状態:\s*([A-Z]+)\*\*")
NEXT_RE = re.compile(r"###\s+次の改善\s*\n(.+?)(?=\n###|\n---|\Z)", re.DOTALL)

STATUS_BASE = {
    "BLOCKED": 105,
    "BUILDING": 82,
    "EXPERIMENT": 68,
    "VERIFIED": 18,
}

PROOF_GAP_TERMS = (
    "未確認", "未完了", "残り", "証拠", "実測", "e2e", "scheduled run",
    "初回", "secret", "blocked", "dogfood", "公開", "検証",
)
CUSTOMER_VALUE_TERMS = (
    "顧客", "営業", "商品", "納品", "売上", "saas", "レポート", "診断",
    "dashboard", "デモ", "web app", "website", "artifact", "成果物",
)


@dataclass(frozen=True)
class PortfolioItem:
    title: str
    status: str
    body: str
    next_improvement: str
    score: int
    reasons: tuple[str, ...]


def _blocks(text: str) -> Iterable[tuple[str, str]]:
    matches = list(SECTION_RE.finditer(text))
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        yield match.group(1).strip(), text[start:end].strip()


def score_item(title: str, status: str, body: str, next_improvement: str) -> tuple[int, tuple[str, ...]]:
    haystack = f"{title}\n{body}\n{next_improvement}".lower()
    score = STATUS_BASE.get(status, 55)
    reasons: list[str] = [f"status={status}"]

    gap_hits = sum(1 for term in PROOF_GAP_TERMS if term.lower() in haystack)
    if gap_hits:
        bonus = min(30, gap_hits * 5)
        score += bonus
        reasons.append(f"proof_gap+{bonus}")

    value_hits = sum(1 for term in CUSTOMER_VALUE_TERMS if term.lower() in haystack)
    if value_hits:
        bonus = min(18, value_hits * 3)
        score += bonus
        reasons.append(f"customer_value+{bonus}")

    if next_improvement:
        score += 10
        reasons.append("next_action+10")

    if status == "VERIFIED":
        score -= 12
        reasons.append("already_verified-12")

    return score, tuple(reasons)


def parse_portfolio(text: str) -> list[PortfolioItem]:
    items: list[PortfolioItem] = []
    for title, body in _blocks(text):
        status_match = STATUS_RE.search(body)
        status = status_match.group(1).upper() if status_match else "UNKNOWN"
        next_match = NEXT_RE.search(body)
        next_improvement = " ".join(next_match.group(1).strip().split()) if next_match else ""
        score, reasons = score_item(title, status, body, next_improvement)
        items.append(PortfolioItem(title, status, body, next_improvement, score, reasons))
    return items


def choose_primary(items: list[PortfolioItem]) -> PortfolioItem:
    if not items:
        raise ValueError("PORTFOLIO.md contains no numbered portfolio sections")
    return sorted(items, key=lambda item: (item.score, item.title), reverse=True)[0]


def choose_senju_focus(item: PortfolioItem) -> str:
    text = f"{item.title} {item.body} {item.next_improvement}".lower()
    if any(term in text for term in ("安全", "security", "安定", "検証", "証拠", "replay", "risk")):
        return "robustness"
    if any(term in text for term in ("速度", "効率", "工数", "自動", "定期", "運用", "delivery", "report")):
        return "efficiency"
    if any(term in text for term in ("balance", "偏り", "公平", "coverage", "カバレッジ")):
        return "balance"
    return "learning"


def build_plan(items: list[PortfolioItem], now: datetime) -> dict:
    primary = choose_primary(items)
    focus = choose_senju_focus(primary)
    next_step = primary.next_improvement or "人間が開ける成果物と、その中核挙動の検証証拠を1つ増やす"
    research_id = "RND-PORTFOLIO-P0-001"
    return {
        "schema": "the-world-portfolio-evolution/v1",
        "generated_at": now.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "priority": "P0",
        "doctrine": "One material portfolio improvement per day; evidence before claims.",
        "portfolio_count": len(items),
        "primary": {
            "title": primary.title,
            "status": primary.status,
            "score": primary.score,
            "reasons": list(primary.reasons),
            "today_target": next_step,
        },
        "senju_directive": {
            "schema": "rnd-senju-directive/v1",
            "research_id": research_id,
            "focus": focus,
            "candidate_count": 7,
            "hypothesis": (
                f"Portfolio P0: '{primary.title}' の proof-to-artifact conversion を最優先にし、"
                f"Senju の {focus} 観点で技術証拠生成の再現性を高めれば、"
                "人間が確認できる VERIFIED 成果物への昇格速度を上げられる。"
            )[:600],
        },
        "gates": {
            "human_inspectable_artifact_required": True,
            "verified_requires_access_and_behavioral_evidence": True,
            "code_or_pr_alone_is_not_portfolio": True,
            "senju_technical_score_is_not_market_evidence": True,
        },
        "daily_loop": [
            "OBSERVE PORTFOLIO.md",
            "RANK proof/value gaps",
            "CHOOSE exactly one primary bet",
            "FORM hypothesis and counterevidence target",
            "SEND bounded directive to Senju",
            "BUILD/VERIFY through existing workers",
            "PORTFOLIO GATE human-inspectable output",
            "REPORT material delta to Slack",
            "SAVE next hypothesis",
        ],
    }


def render_slack(plan: dict) -> str:
    p = plan["primary"]
    d = plan["senju_directive"]
    return (
        "*THE WORLD｜R&D PORTFOLIO P0 — DAILY EVOLUTION*\n"
        f"今日の最優先: *{p['title']}* / status=`{p['status']}` / score={p['score']}\n"
        f"今日の改善: {p['today_target']}\n"
        f"千寿連携: `{d['research_id']}` / focus=`{d['focus']}` / candidates={d['candidate_count']}\n"
        f"仮説: {d['hypothesis']}\n"
        "Gate: 人間が開ける実物 + 中核挙動の証拠が揃うまで VERIFIED にしない。コード/PRだけはポートフォリオ扱いしない。\n"
        "運用: 1日1つのmaterial improvementを優先。反証・失敗も保存し、翌日の仮説へ戻す。\n"
        "※千寿の技術スコアは市場需要・契約・入金の証拠ではない。"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--portfolio", default="PORTFOLIO.md")
    ap.add_argument("--out", default="reports/portfolio-evolution/plan.json")
    ap.add_argument("--slack", default="reports/portfolio-evolution/slack.md")
    ap.add_argument("--directive", default="reports/portfolio-evolution/directive.json")
    args = ap.parse_args()

    text = Path(args.portfolio).read_text(encoding="utf-8")
    items = parse_portfolio(text)
    plan = build_plan(items, datetime.now(timezone.utc))

    out = Path(args.out)
    slack = Path(args.slack)
    directive = Path(args.directive)
    out.parent.mkdir(parents=True, exist_ok=True)
    slack.parent.mkdir(parents=True, exist_ok=True)
    directive.parent.mkdir(parents=True, exist_ok=True)

    out.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    slack.write_text(render_slack(plan) + "\n", encoding="utf-8")
    directive.write_text(json.dumps(plan["senju_directive"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "ok": True,
        "priority": plan["priority"],
        "primary": plan["primary"]["title"],
        "status": plan["primary"]["status"],
        "senju_focus": plan["senju_directive"]["focus"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
