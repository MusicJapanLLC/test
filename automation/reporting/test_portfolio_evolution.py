from datetime import datetime, timezone

from automation.reporting.portfolio_evolution import build_plan, choose_primary, parse_portfolio


SAMPLE = """
# Portfolio

## 1. Stable Product

**状態: VERIFIED**

### 何に使える？
顧客向けレポート。

### 次の改善
軽微な文言改善。

---

## 2. Customer Demo

**状態: BUILDING**

### 何に使える？
顧客が開けるWeb appと診断レポート。

### 現在の残り
E2E未確認。公開環境の検証証拠が必要。

### 次の改善
公開デモを実測し、Before/After証拠をケーススタディ化する。

---
"""


def test_parse_and_choose_unverified_high_value_gap():
    items = parse_portfolio(SAMPLE)
    assert len(items) == 2
    primary = choose_primary(items)
    assert primary.title == "Customer Demo"
    assert primary.status == "BUILDING"
    assert primary.next_improvement.startswith("公開デモ")


def test_build_plan_is_p0_and_bounded_for_senju():
    plan = build_plan(parse_portfolio(SAMPLE), datetime(2026, 8, 30, tzinfo=timezone.utc))
    directive = plan["senju_directive"]
    assert plan["priority"] == "P0"
    assert directive["research_id"] == "RND-PORTFOLIO-P0-001"
    assert directive["focus"] in {"robustness", "learning", "balance", "efficiency"}
    assert 3 <= directive["candidate_count"] <= 9
    assert plan["gates"]["human_inspectable_artifact_required"] is True
    assert plan["gates"]["senju_technical_score_is_not_market_evidence"] is True


def test_verified_item_loses_to_material_building_gap():
    items = parse_portfolio(SAMPLE)
    scores = {item.title: item.score for item in items}
    assert scores["Customer Demo"] > scores["Stable Product"]
