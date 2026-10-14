from __future__ import annotations

from pathlib import Path

from senju.adversary_egress_request import AdversaryEgressRequestPort
from senju.meta.adversary_egress_vote_router import route_pending_vote_requests


def test_request_routes_one_pending_vote_task_per_agent(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    decision = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="external validation candidate",
        now=1_000,
    )
    routed = route_pending_vote_requests(tmp_path, now=1_001)
    assert routed["pending_count"] == 4
    tasks = routed["tasks"]
    assert {task["agent"] for task in tasks} == {"META", "X", "SENJU", "CHILD"}
    assert {task["request_id"] for task in tasks} == {decision.request_id}
    assert all(task["status"] == "pending" for task in tasks)


def test_vote_marks_only_that_agents_solicitation_completed(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    decision = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="external validation candidate",
        now=1_000,
    )
    port.vote(decision.request_id, agent="META", effect="allow", reason="approved advisory", now=1_001)
    routed = route_pending_vote_requests(tmp_path, now=1_002)
    by_agent = {task["agent"]: task for task in routed["tasks"]}
    assert by_agent["META"]["status"] == "completed"
    assert by_agent["X"]["status"] == "pending"
    assert routed["pending_count"] == 3


def test_expired_requests_are_not_solicited(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="external validation candidate",
        request_ttl_seconds=300,
        now=1_000,
    )
    routed = route_pending_vote_requests(tmp_path, now=1_301)
    assert routed["task_count"] == 0
    assert routed["pending_count"] == 0
