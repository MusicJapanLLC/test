from __future__ import annotations

from pathlib import Path

import pytest

import validate_host_activation_pr as validator


def _target_doc(*hosts: str) -> dict:
    return {
        "targets": [
            {"host": host, "owner_authorization": "explicit"}
            for host in hosts
        ]
    }


def _policy_doc(*hosts: str) -> dict:
    return {
        "action_profiles": {
            host: {"owner_authorization": "explicit"}
            for host in hosts
        }
    }


def _bundle(host: str, *, enabled: bool = True, learning: bool = True) -> dict:
    return {
        "host": host,
        "senju_experimentation": {
            "enabled": enabled,
            "same_host_only": True,
            "synthetic_only": True,
            "allowed_methods": ["GET", "HEAD"],
            "trial_paths": ["/", "/health"],
            "max_actions_per_cycle": 6,
            "payload_variants_per_route": 1,
            "allow_path_learning": learning,
            "allow_method_switch": False,
        },
    }


def _wire(monkeypatch, tmp_path: Path, *, base_targets=(), head_targets=(), base_profiles=(), head_profiles=(), bundles=None):
    bundle_map = bundles or {}
    fake_paths = [tmp_path / f"{host}.json" for host in bundle_map]
    path_to_host = {str(path): host for path, host in zip(fake_paths, bundle_map)}

    def fake_json_at(ref: str, path: str):
        if path == validator.TARGETS_PATH:
            return _target_doc(*(base_targets if ref == "base" else head_targets))
        if path == validator.POLICY_PATH:
            return _policy_doc(*(base_profiles if ref == "base" else head_profiles))
        return {}

    monkeypatch.setattr(validator, "_json_at", fake_json_at)
    monkeypatch.setattr(validator, "_changed_bundle_paths", lambda base, head, repo_root: fake_paths)
    monkeypatch.setattr(validator, "load_bundle", lambda path: bundle_map[path_to_host[str(path)]])
    monkeypatch.setattr(
        validator,
        "check_bundle_alignment",
        lambda root, path: {
            "host": path_to_host[str(path)],
            "aligned": True,
            "canonical_authorization": True,
            "authorized_target": True,
            "senju_trial_profile": True,
        },
    )


def test_new_target_without_same_pr_profile_is_rejected(monkeypatch, tmp_path: Path) -> None:
    _wire(
        monkeypatch,
        tmp_path,
        head_targets=("new.example",),
        head_profiles=(),
        bundles={"new.example": _bundle("new.example")},
    )
    with pytest.raises(validator.PRContractError, match="fragmented"):
        validator.validate_pr("base", "head", repo_root=tmp_path)


def test_new_target_and_profile_without_bundle_is_rejected(monkeypatch, tmp_path: Path) -> None:
    _wire(
        monkeypatch,
        tmp_path,
        head_targets=("new.example",),
        head_profiles=("new.example",),
        bundles={},
    )
    with pytest.raises(validator.PRContractError, match="missing activation bundle"):
        validator.validate_pr("base", "head", repo_root=tmp_path)


def test_new_host_bundle_must_enable_real_senju_trial_axis(monkeypatch, tmp_path: Path) -> None:
    _wire(
        monkeypatch,
        tmp_path,
        head_targets=("new.example",),
        head_profiles=("new.example",),
        bundles={"new.example": _bundle("new.example", learning=False)},
    )
    with pytest.raises(validator.PRContractError, match="trial-and-error freedom"):
        validator.validate_pr("base", "head", repo_root=tmp_path)


def test_complete_new_host_pr_reaches_all_three_outputs(monkeypatch, tmp_path: Path) -> None:
    _wire(
        monkeypatch,
        tmp_path,
        head_targets=("new.example",),
        head_profiles=("new.example",),
        bundles={"new.example": _bundle("new.example")},
    )
    result = validator.validate_pr("base", "head", repo_root=tmp_path)
    assert result["new_explicit_targets"] == ["new.example"]
    assert result["new_explicit_profiles"] == ["new.example"]
    assert result["changed_active_bundles"] == ["new.example"]
    assert result["senju_trial_ready"]["new.example"]["enabled"] is True
    assert result["new_hosts_complete_in_single_pr"] is True
    assert result["partial_new_host_pr_allowed"] is False


def test_existing_host_bundle_update_is_allowed_if_still_aligned(monkeypatch, tmp_path: Path) -> None:
    _wire(
        monkeypatch,
        tmp_path,
        base_targets=("existing.example",),
        head_targets=("existing.example",),
        base_profiles=("existing.example",),
        head_profiles=("existing.example",),
        bundles={"existing.example": _bundle("existing.example")},
    )
    result = validator.validate_pr("base", "head", repo_root=tmp_path)
    assert result["new_explicit_targets"] == []
    assert result["changed_active_bundles"] == ["existing.example"]
