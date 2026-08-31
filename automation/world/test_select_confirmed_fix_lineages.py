from __future__ import annotations

import json
from pathlib import Path

import automation.world.select_confirmed_fix_lineages as selector
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
    assert all(row["source"] == "explicit_task" for row in rows)


def test_unique_surface_scout_file_infers_repair_task(monkeypatch, tmp_path: Path):
    root = tmp_path
    source = root / "automation" / "world" / "widget_runtime.py"
    test_file = root / "automation" / "world" / "test_widget_runtime.py"
    source.parent.mkdir(parents=True)
    source.write_text("def run():\n    return 1\n", encoding="utf-8")
    test_file.write_text("def test_run():\n    assert True\n", encoding="utf-8")

    monkeypatch.setattr(selector, "ROOT", root)
    monkeypatch.setattr(selector, "AUTO_PREFIXES", ("automation/world/",))
    finding = {
        "status": "confirmed",
        "confidence": 0.8,
        "statement": "widget runtime regressed",
        "surfaces": ["auto:file_io:widget_runtime"],
    }
    rows = selector.collect_candidates({"H-auto": finding}, {}, target_ref="prod")
    assert len(rows) == 1
    row = rows[0]
    assert row["source"] == "inferred_unique_surface"
    assert row["task"]["output_file"] == "automation/world/widget_runtime.py"
    assert row["task"]["test_cmd"] == "python -m pytest automation/world/test_widget_runtime.py -q"


def test_materialized_auto_task_is_git_excluded(monkeypatch, tmp_path: Path):
    root = tmp_path
    tasks_dir = root / "automation" / "codegen" / "tasks"
    exclude = root / ".git" / "info" / "exclude"
    exclude.parent.mkdir(parents=True)
    monkeypatch.setattr(selector, "ROOT", root)
    monkeypatch.setattr(selector, "TASKS_DIR", tasks_dir)

    selected = [{
        "task_id": "meta-auto-widget-abc",
        "task": {
            "name": "auto",
            "goal": "repair",
            "output_file": "automation/world/widget.py",
            "test_cmd": "python -m pytest automation/world/test_widget.py -q",
        },
    }]
    assert selector.materialize_selected(selected) == 1
    task_path = tasks_dir / "meta-auto-widget-abc.json"
    assert json.loads(task_path.read_text(encoding="utf-8"))["goal"] == "repair"
    assert "automation/codegen/tasks/meta-auto-widget-abc.json" in exclude.read_text(encoding="utf-8")
