"""Verify that the adversary harness is bound to the real guard sources."""
from __future__ import annotations

from senju.adversary_integrity import assert_adversary_integrity


def test_adversary_integrity_passes() -> None:
    assert_adversary_integrity()
