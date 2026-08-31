"""ExternalContactClient adapter backed by the negotiated effective Owner ceiling.

The adapter does not broaden policy by itself. It consumes the effective ceiling written
by owner_scope_negotiation and projects it into the existing guarded transport.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .external import ExternalContactClient, ExternalContactPolicy
from .owner_scope_negotiation import derive_current_ceiling


class NegotiatedExternalContactClient:
    def __init__(
        self,
        repo_root: str | Path,
        state_dir: str | Path,
        **client_kwargs: Any,
    ) -> None:
        ceiling = derive_current_ceiling(repo_root, state_dir)
        policy = ExternalContactPolicy(
            allow_hosts=frozenset(str(v) for v in ceiling.get("exact_hosts", ())),
            allow_http=bool(ceiling.get("allow_http", False)),
            allowed_methods=frozenset(str(v).upper() for v in ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS"))),
            allow_delete=bool(ceiling.get("allow_delete", False)),
            follow_redirects=bool(ceiling.get("follow_redirects", True)),
            max_redirects=int(ceiling.get("max_redirects", 5)),
            timeout_seconds=float(ceiling.get("timeout_seconds", 20.0)),
            max_response_bytes=int(ceiling.get("max_response_bytes", 10 * 1024 * 1024)),
            retries=int(ceiling.get("retries", 5)),
        )
        self.ceiling = ceiling
        self.client = ExternalContactClient(policy, **client_kwargs)

    @property
    def policy(self) -> ExternalContactPolicy:
        return self.client.policy

    def contact(self, *args: Any, **kwargs: Any):
        return self.client.contact(*args, **kwargs)

    def contact_with_body(self, *args: Any, **kwargs: Any):
        return self.client.contact_with_body(*args, **kwargs)
