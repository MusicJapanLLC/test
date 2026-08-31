from __future__ import annotations

from automation.world.select_confirmed_fix_lineages import collect_candidates, matching_task_ids


def test_explicit_surface_maps_confirmed_finding_to_task():
    tasks = {"repair-widget": {"detection_surfaces": ["widget_runtime"]}}
    finding = {"status": "confirmed", "surfaces": ["widget_runtime"]}
    assert matching_task_ids("H-1", finding, tasks) == ("repair-widget",)


def test_explicit_hypothesis_id_maps_to_task():
    tasks = {"repair-widget": {"detection_hypothesis_ids": ["H-42"]}}
    finding = {"status": "confirmed", "surfaces": ["other"]}
    assert matching_task_ids("H-42", finding, tasks) == ("repair-widget",)


def test_only_confirmed_findings_become_candidates_and_highest_confidence_first():
    tracker = {
        "H-low": {"status": "confirmed", "confidence": 0.5, "surfaces": ["repair-widget"]},
        "H-high": {"status": "confirmed", "confidence": 0.9, "surfaces": ["repair-widget"]},
        "H-pending": {"status": "pending", "confidence": 1.0, "surfaces": ["repair-widget"]},
    }
    tasks = {"repair-widget": {}}
    rows = collect_candidates(tracker, tasks, target_ref="main")
    assert [row["hypothesis_id"] for row in rows] == ["H-high", "H-low"]
    assert all(str(row["lineage_id"]).startswith("lineage-") for row in rows)
