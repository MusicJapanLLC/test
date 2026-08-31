from __future__ import annotations

import pytest

from senju.link_authorization import LinkAuthorizationError, RecursiveLinkAuthorization
from senju.trusted_scope import TrustedOwnerScope


def _scope() -> TrustedOwnerScope:
    return TrustedOwnerScope.from_dict(
        {
            "domain_roots": ["example.test"],
            "effect_level": "observe",
        }
    )


def test_authorization_inherits_recursively_inside_trusted_root() -> None:
    graph = RecursiveLinkAuthorization(_scope())

    a = graph.seed("https://example.test/")
    b = graph.inherit(a, "https://api.example.test/page")
    c = graph.inherit(b, "https://deep.api.example.test/final")

    assert graph.is_authorized(a)
    assert graph.is_authorized(b)
    assert graph.is_authorized(c)
    assert graph.depth_for(c) == 2
    assert graph.lineage(c) == (a, b, c)


def test_relative_links_inherit_inside_trusted_root() -> None:
    graph = RecursiveLinkAuthorization(_scope())
    a = graph.seed("https://example.test/start")

    child = graph.inherit(a, "/internal/page?x=1#fragment")

    assert child == "https://example.test/internal/page?x=1"
    assert graph.is_authorized(child)


def test_outside_scope_link_is_rejected() -> None:
    graph = RecursiveLinkAuthorization(_scope())
    a = graph.seed("https://example.test/")

    with pytest.raises(LinkAuthorizationError, match="outside trusted owner scope"):
        graph.inherit(a, "https://outside.invalid/path")


def test_parent_must_already_be_authorized() -> None:
    graph = RecursiveLinkAuthorization(_scope())

    with pytest.raises(LinkAuthorizationError, match="parent URL is not authorized"):
        graph.inherit("https://example.test/", "https://api.example.test/")


def test_html_ingestion_authorizes_in_scope_links() -> None:
    graph = RecursiveLinkAuthorization(_scope())
    a = graph.seed("https://example.test/")

    accepted = graph.ingest_html(
        a,
        """
        <html><body>
          <a href="/internal">internal</a>
          <a href="https://api.example.test/page">api</a>
          <a href="https://outside.invalid/">outside</a>
        </body></html>
        """,
    )

    assert accepted == (
        "https://example.test/internal",
        "https://api.example.test/page",
    )


def test_recursive_depth_limit_is_enforced() -> None:
    graph = RecursiveLinkAuthorization(_scope(), max_depth=1)
    a = graph.seed("https://example.test/")
    b = graph.inherit(a, "https://api.example.test/")

    with pytest.raises(LinkAuthorizationError, match="depth exceeds"):
        graph.inherit(b, "https://deep.api.example.test/")
