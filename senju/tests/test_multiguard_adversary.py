from __future__ import annotations

import json
from collections import Counter

from senju.multiguard_adversary import (
    TARGETS,
    build_campaign,
    run_campaign,
    validate_offense_first_document,
    validate_security_guard_workflow,
)


def _results_for(target: str, *names: str):
    wanted = set(names)
    report = run_campaign(build_campaign(targets=(target,)))
    return {result.case.name: result for result in report.results if result.case.name in wanted}


def test_full_campaign_has_exactly_208_cases_across_seven_targets() -> None:
    campaign = build_campaign()
    assert len(campaign) == 208
    assert Counter(case.target for case in campaign) == {
        "scopeguard": 120,
        "offense-first": 8,
        "engagement-json": 24,
        "external-contact": 20,
        "security-guard": 12,
        "artifact-guard": 12,
        "autonomy-engine": 12,
    }
    assert set(TARGETS) == {case.target for case in campaign}


def test_campaign_identities_are_unique_and_deterministic() -> None:
    first = build_campaign()
    second = build_campaign()
    first_ids = [(case.target, case.name) for case in first]
    second_ids = [(case.target, case.name) for case in second]
    assert first_ids == second_ids
    assert len(first_ids) == len(set(first_ids))


def test_target_filtering_is_exact() -> None:
    campaign = build_campaign(targets=("external-contact", "artifact-guard"))
    assert len(campaign) == 32
    assert {case.target for case in campaign} == {"external-contact", "artifact-guard"}


def test_scopeguard_segment_keeps_strict_120_case_gate() -> None:
    report = run_campaign(build_campaign(targets=("scopeguard",)))
    assert report.total == 120
    assert report.passed
    assert report.surprising_count == 0
    assert report.harness_exception_count == 0


def test_offense_first_contract_rejects_removed_external_authority() -> None:
    cases = build_campaign(targets=("offense-first",))
    baseline = next(case for case in cases if case.name == "baseline")
    removed = next(case for case in cases if case.name == "drop-third-party-authority")
    assert baseline.probe().allowed is True
    observation = removed.probe()
    assert observation.allowed is False
    assert "third-party-authority" in observation.detail


def test_offense_first_validator_rejects_explicit_unrestricted_marker() -> None:
    errors = validate_offense_first_document(
        "Arena / synthetic / owned-or-explicitly-authorized lab\n"
        "所有者または明示的なテスト権限\n"
        "外部資産に対する認可境界\n"
        "Owner / BOSS が追加 scope を明示的に認可\n"
        "BOSS が与えた上限まで\n"
        "UNAUTHORIZED_EXTERNAL_EXECUTION=ALLOW\n"
    )
    assert "forbidden:unrestricted-external" in errors


def test_security_guard_contract_detects_privilege_and_gate_regressions() -> None:
    results = _results_for(
        "security-guard",
        "baseline",
        "inject-write-all",
        "checkout-keeps-credentials",
        "drop-workflow-policy",
    )
    assert results["baseline"].allowed is True
    assert results["inject-write-all"].allowed is False
    assert results["checkout-keeps-credentials"].allowed is False
    assert results["drop-workflow-policy"].allowed is False


def test_security_guard_validator_rejects_empty_workflow() -> None:
    errors = validate_security_guard_workflow("")
    assert errors
    assert any(error.startswith("missing:") for error in errors)


def test_engagement_campaign_accepts_valid_and_rejects_core_scope_violations() -> None:
    results = _results_for(
        "engagement-json",
        "valid-window",
        "authorization-missing",
        "wildcard-host",
        "unknown-check",
        "destructive",
        "expired-window",
    )
    assert results["valid-window"].allowed is True
    for name in (
        "authorization-missing",
        "wildcard-host",
        "unknown-check",
        "destructive",
        "expired-window",
    ):
        assert results[name].allowed is False


def test_external_contact_blocks_before_fake_transport_for_core_rejections() -> None:
    results = _results_for(
        "external-contact",
        "unlisted-host",
        "plain-http-disabled",
        "userinfo-password",
        "delete-no-optin",
        "caller-host-header",
        "private-resolver-result",
    )
    for result in results.values():
        assert result.allowed is False
        assert result.side_effect_calls == 0
        assert result.surprising is False


def test_artifact_guard_is_exercised_as_real_subprocess() -> None:
    results = _results_for("artifact-guard", "safe-html", "source-map-file", "openai-token-shape")
    assert results["safe-html"].allowed is True
    assert results["source-map-file"].allowed is False
    assert results["openai-token-shape"].allowed is False
    assert results["safe-html"].harness_exception_type is None


def test_autonomy_engine_denies_unknown_writes_before_client_boundary() -> None:
    results = _results_for(
        "autonomy-engine",
        "authorized-exact",
        "unauthorized-host",
        "canary-post-unknown",
        "canary-delete-unknown",
        "discovery-post",
    )
    assert results["authorized-exact"].allowed is True
    assert results["unauthorized-host"].allowed is False
    for name in ("canary-post-unknown", "canary-delete-unknown", "discovery-post"):
        assert results[name].allowed is False
        assert results[name].side_effect_calls == 0


def test_report_is_machine_readable_and_carries_target_breakdown() -> None:
    report = run_campaign(build_campaign(targets=("scopeguard", "offense-first")))
    payload = json.loads(report.to_json(indent=None))
    assert payload["schema"] == "senju-multiguard-adversary/v1"
    assert payload["total"] == 128
    assert payload["by_target"]["scopeguard"]["total"] == 120
    assert payload["by_target"]["offense-first"]["total"] == 8
    assert len(payload["campaign_fingerprint"]) == 64
