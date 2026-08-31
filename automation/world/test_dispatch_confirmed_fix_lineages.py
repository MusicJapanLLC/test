from __future__ import annotations

from automation.world.dispatch_confirmed_fix_lineages import collect_dispatches, matching_task_ids


def test_matches_explicit_detection_surface():
    tasks = {
        "repair-widget": {
            "detection_surfaces": ["widget_runtime"],
        }
    }
    hypothesis = {"status": "confirmed", "surfaces": ["widget_runtime"]}
    assert matching_task_ids("H-1", hypothesis, tasks) == ("repair-widget",)


def test_matches_explicit_hypothesis_id():
    tasks = {
        "repair-widget": {
            "detection_hypothesis_ids": ["H-42"],
        }
    }
    hypothesis = {"status": "confirmed", "surfaces": ["other"]}
    assert matching_task_ids("H-42", hypothesis, tasks) == ("repair-widget",)


def test_matches_task_id_to_surface_implicitly():
    tasks = {"widget-runtime": {}}
    hypothesis = {"status": "confirmed", "surfaces": ["widget runtime"]}
    assert matching_task_ids("H-1", hypothesis, tasks) == ("widget-runtime",)


def test_dispatch_collection_only_uses_confirmed_and_dedupes_ledger():
    tracker = {
        "H-confirmed": {"status": "confirmed", "surfaces": ["widget"]},
        "H-pending": {"status": "pending", "surfaces": ["widget"]},
    }
    tasks = {"widget": {}}
    ledger = {"sent": {"H-old:widget": {}}}
    rows = collect_dispatches(tracker, tasks, ledger)
    assert rows == ({"key": "H-confirmed:widget", "hypothesis_id": "H-confirmed", "task_id": "widget"},)

    ledger["sent"]["H-confirmed:widget"] = {}
    assert collect_dispatches(tracker, tasks, ledger) == ()
