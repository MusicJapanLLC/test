"""Shared Finding -> transport feedback loop for adversary agents.

META, X, SENJU, CHILD, and other cooperating agents can submit findings through one
entry point. The loop does not grant authority. Instead, it delegates every external
operation to ``AuthorizedTestRangeTransport``, so an untrusted target remains a
candidate and an owner-defined test-range action can execute immediately.
"""
from __future__ import annotations

import dataclasses
import urllib.parse
from dataclasses import dataclass
from typing import Any

from .adversary_test_range_transport import (
    AdversaryTransportError,
    AuthorizedTestRangeTransport,
    TransportResult,
)

FINDING_SCHEMA = "senju-adversary-finding/v1"
OUTCOME_SCHEMA = "senju-adversary-finding-outcome/v1"


@dataclass(frozen=True)
class AdversaryFinding:
    actor: str
    url: str
    reason: str
    action_id: str | None = None
    schema: str = FINDING_SCHEMA

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass(frozen=True)
class FindingOutcome:
    status: str
    actor: str
    url: str
    reason: str
    action_id: str | None
    transport_status: int | None = None
    redirects: int = 0
    schema: str = OUTCOME_SCHEMA

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


class AdversaryFindingLoop:
    """One safe shared entry point for cooperating adversary agents."""

    def __init__(self, transport: AuthorizedTestRangeTransport) -> None:
        self.transport = transport

    def handle(self, finding: AdversaryFinding) -> FindingOutcome:
        actor = str(finding.actor).strip()
        reason = str(finding.reason).strip()
        url = str(finding.url).strip()
        if not actor or not reason or not url:
            raise ValueError("actor, reason, and url are required")

        try:
            result = self._execute(finding)
        except AdversaryTransportError as exc:
            return FindingOutcome(
                status="candidate_only",
                actor=actor,
                url=url,
                reason=str(exc),
                action_id=finding.action_id,
            )
        except (OSError, TimeoutError) as exc:
            return FindingOutcome(
                status="transport_failed_without_authority_change",
                actor=actor,
                url=url,
                reason=f"{type(exc).__name__}: {exc}",
                action_id=finding.action_id,
            )

        return FindingOutcome(
            status="action_executed" if finding.action_id else "observed",
            actor=actor,
            url=result.url,
            reason=reason,
            action_id=finding.action_id,
            transport_status=result.status,
            redirects=result.redirects,
        )

    def _execute(self, finding: AdversaryFinding) -> TransportResult:
        if finding.action_id:
            parsed = urllib.parse.urlsplit(finding.url)
            if not parsed.hostname:
                raise AdversaryTransportError("finding URL has no host")
            return self.transport.execute_action(parsed.hostname, finding.action_id)
        return self.transport.recovery_probe(finding.url)
