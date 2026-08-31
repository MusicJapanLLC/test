"""Close adversary finding -> authority -> real external action under existing trust.

Unknown hosts become durable promotion requests and peer-vote solicitations. Hosts that
already have an active #459/#481 lease execute immediately through the real transport.
This module never converts a denial, revocation, or untrusted discovery into authority.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Mapping

from .adversary_egress_request import AdversaryEgressRequestPort
from .adversary_transport import (
    AdversaryNetworkTransport,
    AdversaryTransportError,
    CredentialProvider,
    load_transport_leases,
)
from .meta.adversary_egress_vote_router import route_pending_vote_requests

LOOP_SCHEMA = "senju-adversary-external-action-loop/v1"


@dataclass(frozen=True)
class ExternalActionLoopResult:
    schema: str
    status: str
    url: str
    host: str
    request_id: str | None
    lease_id: str | None
    transport_status: int | None
    reason: str
    generated_at: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _append(path: Path, row: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(row), ensure_ascii=False, sort_keys=True) + "\n")


def run_adversary_external_action(
    state_dir: str | Path,
    *,
    url: str,
    source_actor: str,
    reason: str,
    method: str = "GET",
    now: int | None = None,
    credential_provider: CredentialProvider | None = None,
) -> ExternalActionLoopResult:
    """Execute now when authority already exists; otherwise materialize review work."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    leases = load_transport_leases(state)
    port = AdversaryEgressRequestPort(state)
    decision = port.request(
        url,
        source_actor=source_actor,
        reason=reason,
        capabilities=("scan", "probe"),
        methods=("GET", "HEAD"),
        existing_leases=leases,
        now=current,
    )

    host = decision.host
    if decision.status == "ready_existing_authority" and decision.lease is not None:
        transport = AdversaryNetworkTransport(
            state,
            credential_provider=credential_provider,
        )
        try:
            contact = transport.execute_with_recovery(
                url,
                method=method,
                leases=(decision.lease,),
                now=current,
            )
        except AdversaryTransportError as exc:
            result = ExternalActionLoopResult(
                schema=LOOP_SCHEMA,
                status="authorized_transport_failed",
                url=url,
                host=host,
                request_id=None,
                lease_id=str(decision.lease.get("lease_id", "")) or None,
                transport_status=None,
                reason=str(exc),
                generated_at=current,
            )
        else:
            result = ExternalActionLoopResult(
                schema=LOOP_SCHEMA,
                status="executed",
                url=url,
                host=host,
                request_id=None,
                lease_id=contact.receipt.lease_id,
                transport_status=contact.receipt.status,
                reason="existing exact-host authority executed through real network transport",
                generated_at=current,
            )
    else:
        solicitations = route_pending_vote_requests(state, now=current)
        result = ExternalActionLoopResult(
            schema=LOOP_SCHEMA,
            status="authority_requested",
            url=url,
            host=host,
            request_id=decision.request_id,
            lease_id=None,
            transport_status=None,
            reason=f"no active exact-host authority; {solicitations.get('pending_count', 0)} peer vote tasks materialized",
            generated_at=current,
        )

    _append(state / "adversary_external_action_loop.ndjson", result.to_dict())
    return result
