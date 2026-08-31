"""Close adversary finding -> authority -> real external action under existing trust.

Before opening a promotion request, the loop now materializes an immediate read-only
transport lease when the target already belongs to the Owner Authority envelope. That
means trusted roots, company domains, active explicit exact grants and owner-supplied
exact links can move Finding -> real transport without the #481 voting delay.

Targets outside existing Owner authority still become durable promotion requests.
Revoked authority, unrelated discoveries and invented credentials do not enter the
fast path.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Mapping

from .adversary_egress_request import AdversaryEgressRequestPort
from .adversary_transport import (
    AdversaryNetworkTransport,
    AdversaryTransportError,
    CredentialProvider,
    load_transport_leases,
)
from .external import ExternalContactClient, ExternalContactPolicy
from .meta.adversary_egress_vote_router import route_pending_vote_requests
from .owner_envelope_fastpath import ensure_owner_fastpath_lease

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
    client_factory: Callable[[ExternalContactPolicy], ExternalContactClient] | None = None,
) -> ExternalActionLoopResult:
    """Execute immediately when the target is already inside live Owner authority."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)

    # Remove the candidate/review delay for existing Owner authority. This creates only
    # a short-lived read-only exact-host lease and returns None for unrelated hosts.
    fastpath = ensure_owner_fastpath_lease(state, url, now=current)
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
        transport_kwargs: dict[str, Any] = {"credential_provider": credential_provider}
        if client_factory is not None:
            transport_kwargs["client_factory"] = client_factory
        transport = AdversaryNetworkTransport(state, **transport_kwargs)
        try:
            contact = transport.execute_with_recovery(
                url,
                method=method,
                # Use the whole active authority set so redirects between exact hosts
                # sharing the same authorization_reference can be revalidated and used.
                leases=leases,
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
            execution_basis = (
                "owner-envelope fast path"
                if fastpath is not None and contact.receipt.lease_id == fastpath.get("lease_id")
                else "existing exact-host authority"
            )
            result = ExternalActionLoopResult(
                schema=LOOP_SCHEMA,
                status="executed",
                url=url,
                host=host,
                request_id=None,
                lease_id=contact.receipt.lease_id,
                transport_status=contact.receipt.status,
                reason=f"{execution_basis} executed through real network transport",
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
            reason=(
                "outside existing Owner authority; "
                f"{solicitations.get('pending_count', 0)} peer vote tasks materialized"
            ),
            generated_at=current,
        )

    _append(state / "adversary_external_action_loop.ndjson", result.to_dict())
    return result
