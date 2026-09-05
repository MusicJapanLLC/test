from __future__ import annotations

import datetime as dt
import json

from senju.meta.autonomy_auto_approval import (
    auto_approve_action,
    create_action_proposal,
    run_autonomous_closed_loop,
)
from senju.meta.transitive_trust import create_trust_edge, revoke_trust_edge
from senju.meta.trust_derived_autonomy import (
    AUTONOMY_BUNDLE_SCOPE,
    PRIVILEGED_CAPABILITIES,
    STANDARD_AUTONOMOUS_CAPABILITIES,
    issue_capability_lease_from_trust,
)


def _now() -> dt.datetime:
    return dt.datetime(2026, 8, 31, 8, 45, tzinfo=dt.timezone.utc)


def _chain():
    return (
        create_trust_edge(truster="Owner", trustee="A", scopes=[AUTONOMY_BUNDLE_SCOPE]),
        create_trust_edge(truster="A", trustee="B", scopes=[AUTONOMY_BUNDLE_SCOPE]),
        create_trust_edge(truster="B", trustee="C", scopes=[AUTONOMY_BUNDLE_SCOPE]),
    )


def test_standard_bundle_is_broad_across_repo_github_ci_observability_and_staging():
    expected = {
        "repo.branch.update",
        "repo.docs.write",
        "repo.config.write",
        "repo.lint.run",
        "repo.format.run",
        "repo.build.run",
        "repo.dependency.audit",
        "repo.dependency.update",
        "github.issue.comment",
        "github.issue.label",
        "github.issue.assign",
        "github.pr.label",
        "github.pr.metadata.write",
        "github.check.rerun",
        "github.release.draft.create",
        "github.release.draft.update",
        "artifact.update",
        "authorized_target.healthcheck",
        "observability.read",
        "metrics.read",
        "logs.read.nonsecret",
        "deployment.preview",
        "deployment.staging",
    }
    assert expected.issubset(STANDARD_AUTONOMOUS_CAPABILITIES)
    assert STANDARD_AUTONOMOUS_CAPABILITIES.isdisjoint(PRIVILEGED_CAPABILITIES)


def test_transitive_trust_receives_entire_broad_bundle_without_per_action_owner_touch():
    lease = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=_chain(),
        now=_now(),
    ).lease
    assert set(lease.capabilities) == set(STANDARD_AUTONOMOUS_CAPABILITIES)
    assert lease.trust_path == ("Owner", "A", "B", "C")


def test_auto_approval_executes_a_broad_capability_and_auto_renews(tmp_path):
    proposal = create_action_proposal(
        proposal_id="proposal-001",
        actor="C",
        capability="repo.dependency.update",
        target="requirements.txt",
        summary="Refresh dependencies and open follow-up PR",
    )
    calls = []

    def executor(action, lease):
        calls.append((action.proposal_id, lease.lease_id))
        return {"updated": True, "files": ["requirements.txt"]}

    result = run_autonomous_closed_loop(
        owner="Owner",
        proposal=proposal,
        edges=_chain(),
        executor=executor,
        audit_log_path=tmp_path / "audit.ndjson",
        lease_log_path=tmp_path / "leases.ndjson",
        lease_seconds=3600,
        now=_now(),
    )

    assert result.decision.approved is True
    assert result.receipt.status == "success"
    assert result.receipt.output["updated"] is True
    assert result.issued_lease is not None
    assert result.renewed_lease is not None
    assert result.renewed_lease.capabilities == ("repo.dependency.update",)
    assert len(calls) == 1

    audit_rows = [json.loads(line) for line in (tmp_path / "audit.ndjson").read_text().splitlines()]
    assert [row["event_type"] for row in audit_rows] == [
        "auto_approval",
        "action_receipt",
        "lease_auto_renewed",
    ]
    assert len((tmp_path / "leases.ndjson").read_text().splitlines()) == 2


def test_executor_failure_is_audited_and_trust_lease_can_still_renew(tmp_path):
    proposal = create_action_proposal(
        proposal_id="proposal-002",
        actor="C",
        capability="deployment.staging",
        target="staging",
        summary="Apply validated staging deployment",
    )

    def executor(_action, _lease):
        raise RuntimeError("staging adapter failed")

    result = run_autonomous_closed_loop(
        owner="Owner",
        proposal=proposal,
        edges=_chain(),
        executor=executor,
        audit_log_path=tmp_path / "audit.ndjson",
        lease_log_path=tmp_path / "leases.ndjson",
        now=_now(),
    )
    assert result.decision.approved is True
    assert result.receipt.status == "failed"
    assert result.receipt.output["error_type"] == "RuntimeError"
    assert result.renewed_lease is not None


def test_privileged_capability_is_never_auto_approved_or_executed(tmp_path):
    proposal = create_action_proposal(
        proposal_id="proposal-003",
        actor="C",
        capability="deployment.production",
        target="production",
        summary="Production deploy",
    )
    called = False

    def executor(_action, _lease):
        nonlocal called
        called = True
        return {}

    result = run_autonomous_closed_loop(
        owner="Owner",
        proposal=proposal,
        edges=_chain(),
        executor=executor,
        audit_log_path=tmp_path / "audit.ndjson",
        lease_log_path=tmp_path / "leases.ndjson",
        now=_now(),
    )
    assert result.decision.approved is False
    assert result.receipt.status == "not_executed"
    assert result.issued_lease is None
    assert result.renewed_lease is None
    assert called is False


def test_pr_merge_workflow_dispatch_credentials_and_authority_expansion_remain_separate():
    for capability in (
        "github.pr.merge",
        "github.workflow.dispatch",
        "credentials.issue",
        "network.metadata.read",
        "authority.expand",
    ):
        proposal = create_action_proposal(
            proposal_id=f"deny-{capability}",
            actor="C",
            capability=capability,
            target="boundary",
            summary="boundary test",
        )
        decision, lease = auto_approve_action(
            owner="Owner",
            proposal=proposal,
            edges=_chain(),
            now=_now(),
        )
        assert decision.approved is False
        assert lease is None


def test_revoked_middle_edge_stops_new_auto_approval():
    edges = list(_chain())
    edges[1] = revoke_trust_edge(edges[1])
    proposal = create_action_proposal(
        proposal_id="proposal-004",
        actor="C",
        capability="github.check.rerun",
        target="ci/run/123",
        summary="Retry failed CI",
    )
    decision, lease = auto_approve_action(
        owner="Owner",
        proposal=proposal,
        edges=edges,
        now=_now(),
    )
    assert decision.approved is False
    assert "trust_or_scope_denied" in decision.reason
    assert lease is None
