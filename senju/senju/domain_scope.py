"""Domain-scoped outbound authority for Senju.

This module deliberately broadens the default exact-host boundary used by
``ExternalContactClient`` into an explicit domain-root boundary. A root such as
``owned.example.com`` authorizes that hostname and its subdomains, while still
reusing the existing transport's public-DNS checks, scheme/method controls,
response bounds, redirect validation, and cross-host sensitive-header stripping.

It is intended for owned or explicitly authorized campaign domains. It does not
turn unrelated domains into valid targets.
"""
from __future__ import annotations

import ipaddress
from typing import Iterable

from .external import ExternalContactClient, ExternalContactPolicy


class DomainScopeError(ValueError):
    """Raised when a domain-scoped authority declaration is invalid."""


def _normalize_domain(value: str) -> str:
    raw = value.strip().rstrip(".").lower()
    if not raw or any(ch in raw for ch in "/?#@:") or "*" in raw:
        raise DomainScopeError(f"invalid domain root: {value!r}")
    try:
        ipaddress.ip_address(raw)
    except ValueError:
        pass
    else:
        raise DomainScopeError("domain-scoped authority requires a DNS name, not an IP address")
    try:
        normalized = raw.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise DomainScopeError(f"invalid domain root: {value!r}") from exc
    if normalized.startswith(".") or normalized.endswith("."):
        raise DomainScopeError(f"invalid domain root: {value!r}")
    return normalized


class DomainHostSet(frozenset[str]):
    """A frozenset whose membership test accepts descendants of declared roots.

    ``api.owned.example`` is considered a member when ``owned.example`` is a
    declared root. Suffix confusion such as ``evil-owned.example`` is rejected
    because matching requires an explicit dot boundary.
    """

    def __new__(cls, roots: Iterable[str]) -> "DomainHostSet":
        normalized = tuple(_normalize_domain(root) for root in roots if root and root.strip())
        if not normalized:
            raise DomainScopeError("at least one authorized domain root is required")
        return super().__new__(cls, normalized)

    def __contains__(self, host: object) -> bool:
        if not isinstance(host, str):
            return False
        try:
            normalized = _normalize_domain(host)
        except DomainScopeError:
            return False
        return any(
            normalized == root or normalized.endswith("." + root)
            for root in super().__iter__()
        )


def build_domain_scoped_policy(
    roots: Iterable[str],
    *,
    allowed_methods: Iterable[str] = ("GET", "HEAD", "OPTIONS"),
    allow_http: bool = False,
    allow_delete: bool = False,
    follow_redirects: bool = True,
    max_redirects: int = 3,
    timeout_seconds: float = 8.0,
    max_request_bytes: int = 64 * 1024,
    max_response_bytes: int = 1024 * 1024,
    retries: int = 2,
    retry_backoff_seconds: float = 0.25,
) -> ExternalContactPolicy:
    """Build a relaxed domain-root policy while preserving transport safety checks."""

    methods = frozenset(str(method).strip().upper() for method in allowed_methods if str(method).strip())
    if not methods:
        raise DomainScopeError("allowed_methods cannot be empty")
    if "DELETE" in methods and not allow_delete:
        raise DomainScopeError("DELETE requires allow_delete=True")

    domain_hosts = DomainHostSet(roots)
    return ExternalContactPolicy(
        # ExternalContactClient checks membership with ``host in allow_hosts``.
        # DomainHostSet intentionally broadens that membership test to descendants.
        allow_hosts=domain_hosts,
        allow_http=bool(allow_http),
        allowed_methods=methods,
        allow_delete=bool(allow_delete),
        follow_redirects=bool(follow_redirects),
        max_redirects=max(0, min(int(max_redirects), 5)),
        timeout_seconds=max(0.5, min(float(timeout_seconds), 20.0)),
        max_request_bytes=max(1024, min(int(max_request_bytes), 10 * 1024 * 1024)),
        max_response_bytes=max(1024, min(int(max_response_bytes), 10 * 1024 * 1024)),
        retries=max(0, min(int(retries), 5)),
        retry_backoff_seconds=max(0.0, min(float(retry_backoff_seconds), 5.0)),
    )


def client_for_domains(roots: Iterable[str], **policy_kwargs: object) -> ExternalContactClient:
    """Create an ExternalContactClient authorized for domain roots and descendants."""

    return ExternalContactClient(build_domain_scoped_policy(roots, **policy_kwargs))
