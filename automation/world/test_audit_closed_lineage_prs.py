from __future__ import annotations

import json

from automation.world.audit_closed_lineage_prs import parse_receipt


def test_parse_closed_lineage_receipt():
    receipt = {
        "lineage_id": "lineage-abc",
        "task_id": "repair",
        "output_file": "automation/world/repair.py",
        "selected_code_sha256": "abc123",
        "target_ref": "main",
    }
    body = "before\n<!-- CLOSED_LINEAGE_RECEIPT\n" + json.dumps(receipt) + "\nCLOSED_LINEAGE_RECEIPT -->\nafter"
    assert parse_receipt(body) == receipt


def test_non_lineage_pr_has_no_receipt():
    assert parse_receipt("ordinary pull request") is None
