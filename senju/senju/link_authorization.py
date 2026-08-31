"""Recursive link-derived authorization inside a persistent trusted scope.

A link may propagate authorization from an already-authorized URL to another URL,
but the propagation never expands the underlying Owner/BOSS trust boundary.  In
other words, A -> B -> C works recursively only when every destination is already
covered by ``TrustedOwnerScope``.
"""
from __future__ import annotations

import urllib.parse
from dataclasses import dataclass
from html.parser import HTMLParser

from .trusted_scope import TrustedOwnerScope, TrustedScopeError


class LinkAuthorizationError(TrustedScopeError):
    """Raised when recursive link authorization violates the trusted scope."""


def _canonical_url(base_url: str, candidate: str | None = None) -> str:
    resolved = urllib.parse.urljoin(base_url, candidate) if candidate is not None else base_url
    parsed = urllib.parse.urlsplit(resolved)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise LinkAuthorizationError(f"unsupported link target: {resolved!r}")
    if parsed.username is not None or parsed.password is not None:
        raise LinkAuthorizationError("credentials in URL authority are not allowed")
    # Fragments do not change the authorization target.
    return urllib.parse.urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", parsed.query, "")
    )


class _HrefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() not in {"a", "area", "link"}:
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.hrefs.append(value)
                break


@dataclass(frozen=True)
class AuthorizationEdge:
    parent_url: str
    child_url: str
    depth: int


class RecursiveLinkAuthorization:
    """Track recursive A -> B -> C authorization with explicit provenance.

    ``TrustedOwnerScope`` remains the hard boundary.  A discovered link can inherit
    authorization only if its resolved target is already inside that persistent
    scope.  This gives callers recursive link traversal without turning arbitrary
    Internet links into new trust roots.
    """

    def __init__(
        self,
        scope: TrustedOwnerScope,
        *,
        max_depth: int = 8,
        max_urls: int = 1000,
    ) -> None:
        self.scope = scope
        self.max_depth = max(0, min(int(max_depth), 32))
        self.max_urls = max(1, min(int(max_urls), 100_000))
        self._depth: dict[str, int] = {}
        self._parent: dict[str, str | None] = {}
        self._edges: list[AuthorizationEdge] = []

    def seed(self, url: str) -> str:
        target = _canonical_url(url)
        if not self.scope.allows_url(target):
            raise LinkAuthorizationError(f"seed is outside trusted owner scope: {target}")
        self._remember(target, depth=0, parent=None)
        return target

    def inherit(self, parent_url: str, linked_url: str) -> str:
        parent = _canonical_url(parent_url)
        if parent not in self._depth:
            raise LinkAuthorizationError(f"parent URL is not authorized: {parent}")

        child = _canonical_url(parent, linked_url)
        if not self.scope.allows_url(child):
            raise LinkAuthorizationError(f"linked target is outside trusted owner scope: {child}")

        depth = self._depth[parent] + 1
        if depth > self.max_depth:
            raise LinkAuthorizationError(
                f"recursive link depth exceeds configured maximum ({self.max_depth})"
            )

        self._remember(child, depth=depth, parent=parent)
        self._edges.append(AuthorizationEdge(parent, child, depth))
        return child

    def ingest_html(self, parent_url: str, html: str) -> tuple[str, ...]:
        """Authorize all in-scope links found in one already-authorized document.

        Out-of-scope, malformed, mailto/javascript and otherwise unsupported links
        are ignored rather than weakening the persistent trusted scope.
        """
        parent = _canonical_url(parent_url)
        if parent not in self._depth:
            raise LinkAuthorizationError(f"parent URL is not authorized: {parent}")

        parser = _HrefParser()
        parser.feed(html)
        accepted: list[str] = []
        for href in parser.hrefs:
            try:
                child = self.inherit(parent, href)
            except (LinkAuthorizationError, TrustedScopeError, ValueError):
                continue
            if child not in accepted:
                accepted.append(child)
        return tuple(accepted)

    def is_authorized(self, url: str) -> bool:
        try:
            target = _canonical_url(url)
        except LinkAuthorizationError:
            return False
        return target in self._depth

    def depth_for(self, url: str) -> int | None:
        try:
            target = _canonical_url(url)
        except LinkAuthorizationError:
            return None
        return self._depth.get(target)

    def lineage(self, url: str) -> tuple[str, ...]:
        target = _canonical_url(url)
        if target not in self._depth:
            raise LinkAuthorizationError(f"URL is not authorized: {target}")
        chain: list[str] = []
        current: str | None = target
        while current is not None:
            chain.append(current)
            current = self._parent[current]
        chain.reverse()
        return tuple(chain)

    @property
    def authorized_urls(self) -> frozenset[str]:
        return frozenset(self._depth)

    @property
    def authorized_hosts(self) -> frozenset[str]:
        hosts = {
            urllib.parse.urlsplit(url).hostname
            for url in self._depth
            if urllib.parse.urlsplit(url).hostname
        }
        return frozenset(str(host) for host in hosts)

    @property
    def edges(self) -> tuple[AuthorizationEdge, ...]:
        return tuple(self._edges)

    def _remember(self, url: str, *, depth: int, parent: str | None) -> None:
        existing = self._depth.get(url)
        if existing is not None and existing <= depth:
            return
        if existing is None and len(self._depth) >= self.max_urls:
            raise LinkAuthorizationError(
                f"recursive authorization exceeds configured URL maximum ({self.max_urls})"
            )
        self._depth[url] = depth
        self._parent[url] = parent
