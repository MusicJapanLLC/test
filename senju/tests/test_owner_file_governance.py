from __future__ import annotations

from pathlib import Path

from senju.owner_file_governance import build_owner_governance_inventory, discover_owner_files, is_owner_named


def test_owner_name_detection_is_path_wide() -> None:
    assert is_owner_named("senju/config/owner-frontier-council.json")
    assert is_owner_named("owner-tools/readme.md")
    assert is_owner_named("senju/owner_scope.py")
    assert not is_owner_named("senju/config/frontier.json")


def test_inventory_routes_all_owner_named_files_to_senju_without_direct_mutation(tmp_path: Path) -> None:
    (tmp_path / "senju/config").mkdir(parents=True)
    (tmp_path / "senju/tests").mkdir(parents=True)
    (tmp_path / "other").mkdir(parents=True)
    (tmp_path / "senju/config/owner-frontier-council.json").write_text("{}")
    (tmp_path / "senju/tests/test_owner_scope.py").write_text("pass")
    (tmp_path / "other/neutral.txt").write_text("x")

    rows = discover_owner_files(tmp_path)
    assert {row["path"] for row in rows} == {
        "senju/config/owner-frontier-council.json",
        "senju/tests/test_owner_scope.py",
    }
    assert all(row["managed_by"] == "SENJU" for row in rows)
    assert all(row["direct_mutation_allowed"] is False for row in rows)
    assert all(row["authority_activation_allowed"] is False for row in rows)

    inventory = build_owner_governance_inventory(tmp_path, now=100)
    assert inventory["managed_by"] == "SENJU"
    assert inventory["owner_named_file_count"] == 2
    assert inventory["management_rights"]["research_route"] is True
    assert inventory["management_rights"]["propose_change"] is True
    assert inventory["management_rights"]["direct_mutation"] is False
    assert inventory["management_rights"]["security_boundary_override"] is False
