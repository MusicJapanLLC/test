from senju.domain_scope import DomainHostSet, DomainScopeError, build_domain_scoped_policy


def test_domain_host_set_accepts_root_and_descendants() -> None:
    hosts = DomainHostSet(["owned.example.com"])

    assert "owned.example.com" in hosts
    assert "api.owned.example.com" in hosts
    assert "deep.api.owned.example.com" in hosts


def test_domain_host_set_rejects_suffix_confusion_and_other_domains() -> None:
    hosts = DomainHostSet(["owned.example.com"])

    assert "evil-owned.example.com" not in hosts
    assert "owned.example.com.attacker.example" not in hosts
    assert "unrelated.example.com" not in hosts


def test_domain_scoped_policy_preserves_method_guard() -> None:
    policy = build_domain_scoped_policy(
        ["owned.example.com"],
        allowed_methods=("GET", "HEAD", "OPTIONS", "POST"),
        follow_redirects=True,
        retries=2,
    )

    assert "api.owned.example.com" in policy.allow_hosts
    assert "POST" in policy.allowed_methods
    assert policy.follow_redirects is True
    assert policy.retries == 2
    assert policy.allow_delete is False


def test_delete_still_requires_explicit_opt_in() -> None:
    try:
        build_domain_scoped_policy(["owned.example.com"], allowed_methods=("GET", "DELETE"))
    except DomainScopeError as exc:
        assert "DELETE" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("DELETE should require explicit opt-in")
