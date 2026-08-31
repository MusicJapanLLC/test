"""Hardened runtime adapter for credential-bound mutation execution.

The base executor owns Authority/credential/payload/path semantics. This adapter owns
transport acknowledgement and error sanitization:
- HTTP 4xx/5xx is a failed mutation attempt, so the base retry plan can advance to a
  payload variant or same-host alternate path;
- raw transport exception text is never propagated into persistent receipts;
- only error class / HTTP status are surfaced to the base executor.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Mapping

from .credential_bound_mutation import execute_credential_bound_mutations as _execute_base

import sys

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.external import (  # noqa: E402
    ExternalContactClient,
    ExternalContactError,
    ExternalContactPolicy,
)


class _AcknowledgedMutationClient:
    """Require provider acknowledgement while suppressing raw transport error text."""

    def __init__(self, inner: Any) -> None:
        self._inner = inner

    def contact_with_body(
        self,
        url: str,
        *,
        method: str,
        body: bytes | None,
        headers: Mapping[str, str] | None,
    ) -> Any:
        try:
            result = self._inner.contact_with_body(
                url,
                method=method,
                body=body,
                headers=headers,
            )
        except (ExternalContactError, OSError, TimeoutError) as exc:
            # Persist only a stable category, never the underlying exception text. This
            # prevents any future transport implementation from reflecting a header or
            # credential into durable mutation receipts.
            raise ExternalContactError(
                f"credential-bound transport failure: {type(exc).__name__}"
            ) from exc

        receipt = getattr(result, "receipt", None)
        status = int(getattr(receipt, "status", 0) or 0)
        acknowledged = getattr(receipt, "provider_acknowledged", None)
        if acknowledged is None:
            acknowledged = 200 <= status < 400
        if not acknowledged:
            raise ExternalContactError(
                f"credential-bound mutation not acknowledged: HTTP {status}"
            )
        return result


def _runtime_factory(
    provided: Callable[[ExternalContactPolicy], Any] | None,
) -> Callable[[ExternalContactPolicy], Any]:
    def build(policy: ExternalContactPolicy) -> _AcknowledgedMutationClient:
        inner = provided(policy) if provided is not None else ExternalContactClient(policy)
        return _AcknowledgedMutationClient(inner)

    return build


def execute_credential_bound_mutations(
    state_dir: str | Path,
    *,
    repo_root: str | Path = _REPO_ROOT,
    environ: Mapping[str, str] | None = None,
    now: int | None = None,
    client_factory: Callable[[ExternalContactPolicy], Any] | None = None,
    receipt_path: str | Path | None = None,
) -> dict[str, Any]:
    """Execute the base bundle with acknowledgement + secret-safe transport errors."""
    return _execute_base(
        state_dir,
        repo_root=repo_root,
        environ=environ,
        now=now,
        client_factory=_runtime_factory(client_factory),
        receipt_path=receipt_path,
    )
