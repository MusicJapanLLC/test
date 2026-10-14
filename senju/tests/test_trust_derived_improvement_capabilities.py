from __future__ import annotations

import datetime as dt

import pytest

from senju.meta.transitive_trust import create_trust_edge
from senju.meta.trust_derived_autonomy import (
    AutonomyError,
    PRIVILEGED_CAPABILITIES,
    STANDARD_AUTONOMOUS_CAPABILITIES,
    authorize_autonomous_action,
    issue_capability_lease_from_trust,
)


def _now() -> dt.datetime:
    return dt.datetime(2026, 8, 31, 13, 10, tzinfo=dt.timezone.utc)


def _edges():
    return (
        create_trust_edge(truster="Owner", trustee="META", scopes=["autonomy:standard"]),
        create_trust_edge(truster="META", trustee="X", scopes=["autonomy:standard"]),
        create_trust_edge(truster="X", trustee="SENJU", scopes=["autonomy:standard"]),
    )


def test_standard_trust_bundle_includes_improvement_and_evidence_capabilities() -> None:
    expected = {
        "authority.candidate.read",
        "authority.evidence.collect",
        "authority.evidence.compare",
        "authority.review.request",
        "authority.opportunity.prioritize",
        "authority.recheck",
        "knowledge.share",
        "improvement.feedback.consume",
        "improvement.task.create",
        "improvement.task.prioritize",
        "transport.experiment.authorized",
        "discovery.followup.authorized",
    }
    assert expected.issubset(STANDARD_AUTONOMOUS_CAPABILITIES)

    lease = issue_capability_lease_from_trust(
        owner="Owner",
        actor="SENJU",
        edges=_edges(),
        requested_capabilities=sorted(expected),
        now=_now(),
    ).lease
    for capability in expected:
        authorize_autonomous_action(lease, capability, now=_now())


def test_new_root_and_hard_deny_override_remain_privileged() -> None:
    assert {"authority.root.promote", "hard_deny.override"}.issubset(PRIVILEGED_CAPABILITIES)
    with pytest.raises(AutonomyError, match="privileged"):
        issue_capability_lease_from_trust(
            owner="Owner",
            actor="SENJU",
            edges=_edges(),
            requested_capabilities=["authority.root.promote"],
            now=_now(),
        )
