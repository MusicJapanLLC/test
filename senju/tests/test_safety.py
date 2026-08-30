"""安全ゲートの検証: これが崩れると全体が崩れるので最重要テスト。"""
import pytest

from senju.safety import ScopeGuard, ScopePolicy, ScopeViolation, default_lab_policy


def test_simulated_targets_allowed():
    g = ScopeGuard(default_lab_policy())
    g.check("sim://web-1")  # 例外が出なければ合格


def test_public_ip_always_rejected():
    g = ScopeGuard(default_lab_policy())
    with pytest.raises(ScopeViolation):
        g.check("8.8.8.8")


def test_public_hostname_always_rejected():
    g = ScopeGuard(ScopePolicy(allow_private_network=True))
    with pytest.raises(ScopeViolation):
        g.check("example.com")
    with pytest.raises(ScopeViolation):
        g.check("victim.co.jp")


def test_private_ip_requires_optin():
    # デフォルトでは非公開IPも拒否（仮想標的のみ許可）。
    g = ScopeGuard(default_lab_policy())
    with pytest.raises(ScopeViolation):
        g.check("10.0.0.5")
    # オプトインすれば許可。
    g2 = ScopeGuard(ScopePolicy(allow_private_network=True))
    g2.check("10.0.0.5")
    g2.check("127.0.0.1")


def test_violations_are_recorded():
    g = ScopeGuard(default_lab_policy())
    for ref in ("8.8.8.8", "evil.example"):
        with pytest.raises(ScopeViolation):
            g.check(ref)
    assert len(g.violations) == 2


def test_labnet_requires_optin():
    g = ScopeGuard(default_lab_policy())
    with pytest.raises(ScopeViolation):
        g.check("labnet:dvwa")
    g2 = ScopeGuard(ScopePolicy(allow_private_network=True))
    g2.check("labnet:dvwa")
