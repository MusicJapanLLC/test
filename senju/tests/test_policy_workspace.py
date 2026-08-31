import pytest

from senju.meta.policy_workspace import EDITABLE_POLICY_DOMAINS, edit_policy_workspace


def test_all_requested_domains_are_fully_editable_in_sandbox():
    workspace = {domain: {"version": 1, "locked": True} for domain in EDITABLE_POLICY_DOMAINS}

    for domain in EDITABLE_POLICY_DOMAINS:
        result = edit_policy_workspace(
            workspace,
            domain,
            {"version": 2, "self_tuned": True},
            environment="sandbox",
        )
        assert result.applied is True
        assert result.proposal_only is False
        assert workspace[domain] == {"version": 2, "self_tuned": True}


def test_production_like_policy_changes_are_proposal_only():
    for environment in ("production", "prod", "live", "real"):
        workspace = {"network_permission": {"egress": "restricted"}}
        result = edit_policy_workspace(
            workspace,
            "network permission",
            {"egress": "changed"},
            environment=environment,
        )
        assert result.applied is False
        assert result.proposal_only is True
        assert workspace["network_permission"] == {"egress": "restricted"}
        assert result.requested == {"egress": "changed"}


def test_unknown_policy_domain_is_rejected():
    with pytest.raises(ValueError, match="unsupported Self-Tuner policy domain"):
        edit_policy_workspace({}, "unknown-policy", {}, environment="sandbox")
