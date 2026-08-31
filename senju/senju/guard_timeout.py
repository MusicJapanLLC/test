"""Guard timeout failover for resilient Senju operation.

A missing Guard response is never treated as broad authorization. Instead the caller
can fail over to an alternate Guard and, if every Guard is unavailable, continue only
with explicitly side-effect-free local work in degraded mode.

This keeps availability for analysis/simulation/cache work while preventing a Guard
outage from becoming a privilege-escalation primitive.
"""
from __future__ import annotations

import concurrent.futures
import enum
from dataclasses import dataclass
from typing import Callable


class GuardTimeoutError(RuntimeError):
    """Raised for invalid guard timeout/failover configuration."""


class GuardVerdict(str, enum.Enum):
    ALLOW = "allow"
    DENY = "deny"


class GuardOutcome(str, enum.Enum):
    ALLOW = "allow"
    ALLOW_DEGRADED = "allow_degraded"
    DENY = "deny"


class ActionClass(str, enum.Enum):
    """Effect classes used when all Guards are unavailable."""

    LOCAL_READ_ONLY = "local_read_only"
    SIMULATION = "simulation"
    CACHE_READ = "cache_read"
    EXTERNAL_CONTACT = "external_contact"
    WRITE = "write"
    DEPLOY = "deploy"
    EXECUTE = "execute"
    CREDENTIAL = "credential"
    AUTHORITY = "authority"
    SECRET = "secret"
    SECURITY_BOUNDARY = "security_boundary"


DEGRADED_ALLOW_CLASSES = frozenset(
    {
        ActionClass.LOCAL_READ_ONLY,
        ActionClass.SIMULATION,
        ActionClass.CACHE_READ,
    }
)


@dataclass(frozen=True)
class GuardResult:
    outcome: GuardOutcome
    source: str
    reason: str
    timed_out: bool = False
    failover_used: bool = False

    @property
    def allowed(self) -> bool:
        return self.outcome in {GuardOutcome.ALLOW, GuardOutcome.ALLOW_DEGRADED}


GuardCallable = Callable[[], GuardVerdict | str | bool]


def _normalise_verdict(value: GuardVerdict | str | bool) -> GuardVerdict:
    if isinstance(value, GuardVerdict):
        return value
    if value is True:
        return GuardVerdict.ALLOW
    if value is False:
        return GuardVerdict.DENY
    text = str(value).strip().lower()
    if text == GuardVerdict.ALLOW.value:
        return GuardVerdict.ALLOW
    if text == GuardVerdict.DENY.value:
        return GuardVerdict.DENY
    raise GuardTimeoutError(f"unsupported Guard verdict: {value!r}")


def _call_with_timeout(guard: GuardCallable, timeout_seconds: float) -> tuple[GuardVerdict | None, bool]:
    if timeout_seconds <= 0:
        raise GuardTimeoutError("timeout_seconds must be positive")
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = executor.submit(guard)
    try:
        value = future.result(timeout=timeout_seconds)
        return _normalise_verdict(value), False
    except concurrent.futures.TimeoutError:
        future.cancel()
        return None, True
    finally:
        # Do not wait for a wedged Guard thread; callers must be able to fail over.
        executor.shutdown(wait=False, cancel_futures=True)


def evaluate_guarded_action(
    *,
    action_class: ActionClass,
    primary_guard: GuardCallable,
    timeout_seconds: float = 2.0,
    alternate_guard: GuardCallable | None = None,
    alternate_timeout_seconds: float | None = None,
) -> GuardResult:
    """Evaluate an action with timeout failover and bounded degraded operation.

    Flow:
        primary Guard
          -> explicit ALLOW/DENY: return it
          -> timeout: try alternate Guard when configured
          -> all Guards timeout: only local side-effect-free classes may continue

    Explicit DENY is never overridden by failover or degraded mode.
    """

    primary, primary_timed_out = _call_with_timeout(primary_guard, timeout_seconds)
    if not primary_timed_out:
        if primary is GuardVerdict.ALLOW:
            return GuardResult(GuardOutcome.ALLOW, "primary", "primary Guard allowed")
        return GuardResult(GuardOutcome.DENY, "primary", "primary Guard denied")

    if alternate_guard is not None:
        alternate_timeout = alternate_timeout_seconds if alternate_timeout_seconds is not None else timeout_seconds
        alternate, alternate_timed_out = _call_with_timeout(alternate_guard, alternate_timeout)
        if not alternate_timed_out:
            if alternate is GuardVerdict.ALLOW:
                return GuardResult(
                    GuardOutcome.ALLOW,
                    "alternate",
                    "primary Guard timed out; alternate Guard allowed",
                    timed_out=True,
                    failover_used=True,
                )
            return GuardResult(
                GuardOutcome.DENY,
                "alternate",
                "primary Guard timed out; alternate Guard denied",
                timed_out=True,
                failover_used=True,
            )

    if action_class in DEGRADED_ALLOW_CLASSES:
        return GuardResult(
            GuardOutcome.ALLOW_DEGRADED,
            "degraded",
            "all available Guards timed out; local side-effect-free work may continue",
            timed_out=True,
            failover_used=alternate_guard is not None,
        )

    return GuardResult(
        GuardOutcome.DENY,
        "timeout-policy",
        "Guard timeout cannot authorize a side-effecting or privileged action",
        timed_out=True,
        failover_used=alternate_guard is not None,
    )
