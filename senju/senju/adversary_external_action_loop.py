"""Close adversary finding -> authority -> real external action under existing trust.

Before opening a promotion request, the loop materializes an immediate read-only
transport lease when the target already belongs to the Owner Authority envelope. It
also wires the autonomy accelerator into the normal path so unresolved findings are
fanned out to all cooperating agents and authorized recovery can explore owner-defined
same-host paths without changing authority lineage.

Targets outside existing Owner authority still become durable promotion requests.
Revoked authority, unrelated discoveries and invented credentials do not enter the
execution fast path.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Mapping

from .adversary_autonomy_accelerator import (
    execute_same_authority_recovery,
    materialize_collaboration_bus,
    materialize_provisional_candidate,
    prepare_credential_acquisition,
)
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
    """Execute immediately inside live Owner authority, otherwise parallelize acquisition."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)

    # Remove candidate/review delay inside the existing Owner envelope only.
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
    credential = prepare_credential_acquisition(state, host=host, now=current)
    if decision.status == "ready_existing_authority" and decision.lease is not None:
        transport_kwargs: dict[str, Any] = {"credential_provider": credential_provider}
        if client_factory is not None:
            transport_kwargs["client_factory"] = client_factory
        transport = AdversaryNetworkTransport(state, **transport_kwargs)
        try:
            if method.upper().strip() == "GET":
                # This extends recovery from GET->HEAD to owner-predeclared recovery_paths,
                # while preserving host + authorization_reference + credential_scope.
                contact = execute_same_authority_recovery(
                    transport,
                    state_dir=state,
                    url=url,
                    now=current,
                )
            else:
                contact = transport.execute_with_recovery(
                    url,
                    method=method,
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
                reason=f"{exc}; credential={credential.get('status', 'unknown')}",
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
                reason=(
                    f"{execution_basis} executed through real network transport; "
                    f"credential={credential.get('status', 'unknown')}"
                ),
                generated_at=current,
            )
    else:
        solicitations = route_pending_vote_requests(state, now=current)
        candidate = materialize_provisional_candidate(
            state,
            url=url,
            source_actor=source_actor,
            reason=reason,
            request_id=decision.request_id,
            now=current,
        )
        collaboration = materialize_collaboration_bus(
            state,
            candidate=candidate,
            now=current,
        )
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
                f"{solicitations.get('pending_count', 0)} authority vote tasks + "
                f"{collaboration.get('task_count', 0)} evidence tasks materialized; "
                f"credential={credential.get('status', 'unknown')}"
            ),
            generated_at=current,
        )

    _append(state / "adversary_external_action_loop.ndjson", result.to_dict())
    return result
