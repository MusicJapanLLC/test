from __future__ import annotations

from senju.meta.transitive_trust import (
    create_trust_edge,
    load_trust_registry,
    owner_trusts,
    resolve_trust,
    revoke_trust_edge,
    save_trust_registry,
)


def test_owner_trusts_c_through_a_and_b():
    edges = [
        create_trust_edge(truster="Owner", trustee="A", scopes=["research"]),
        create_trust_edge(truster="A", trustee="B", scopes=["research"]),
        create_trust_edge(truster="B", trustee="C", scopes=["research"]),
    ]

    result = resolve_trust(owner="Owner", subject="C", edges=edges)
    assert result.trusted is True
    assert result.path == ("Owner", "A", "B", "C")
    assert result.effective_scopes == ("research",)
    assert result.depth == 3
    assert owner_trusts("Owner", "C", edges, required_scope="research") is True


def test_scope_can_only_narrow_across_chain():
    edges = [
        create_trust_edge(truster="Owner", trustee="A", scopes=["research", "read"]),
        create_trust_edge(truster="A", trustee="B", scopes=["research"]),
        create_trust_edge(truster="B", trustee="C", scopes=["research", "deploy"]),
    ]

    result = resolve_trust(owner="Owner", subject="C", edges=edges)
    assert result.trusted is True
    assert result.effective_scopes == ("research",)
    assert owner_trusts("Owner", "C", edges, required_scope="deploy") is False


def test_non_transitive_edge_stops_further_delegation():
    edges = [
        create_trust_edge(truster="Owner", trustee="A", scopes=["research"]),
        create_trust_edge(truster="A", trustee="B", scopes=["research"], transitive=False),
        create_trust_edge(truster="B", trustee="C", scopes=["research"]),
    ]

    assert owner_trusts("Owner", "B", edges) is True
    assert owner_trusts("Owner", "C", edges) is False


def test_revocation_breaks_chain():
    owner_a = create_trust_edge(truster="Owner", trustee="A", scopes=["research"])
    a_b = create_trust_edge(truster="A", trustee="B", scopes=["research"])
    b_c = create_trust_edge(truster="B", trustee="C", scopes=["research"])

    assert owner_trusts("Owner", "C", [owner_a, a_b, b_c]) is True
    assert owner_trusts("Owner", "C", [owner_a, revoke_trust_edge(a_b), b_c]) is False


def test_cycle_does_not_create_extra_trust():
    edges = [
        create_trust_edge(truster="Owner", trustee="A", scopes=["research"]),
        create_trust_edge(truster="A", trustee="B", scopes=["research"]),
        create_trust_edge(truster="B", trustee="A", scopes=["research"]),
        create_trust_edge(truster="Untrusted", trustee="C", scopes=["research"]),
    ]

    assert owner_trusts("Owner", "B", edges) is True
    assert owner_trusts("Owner", "C", edges) is False


def test_registry_round_trip(tmp_path):
    edges = [
        create_trust_edge(truster="Owner", trustee="A", scopes=["research", "read"]),
        create_trust_edge(truster="A", trustee="B", scopes=["research"]),
    ]

    path = save_trust_registry(tmp_path / "trust.json", edges)
    restored = load_trust_registry(path)
    assert restored == tuple(edges)
    assert owner_trusts("Owner", "B", restored, required_scope="research") is True
