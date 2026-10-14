"""Authority-enforced multi-engine egress for Senju/META.

This module increases outbound transport diversity without creating an authorization
bypass. Every engine is invoked through one mandatory preflight gate and one mandatory
postflight validation step.

Supported architecture:
- urllib / ExternalContactClient engine;
- curl/subprocess engine with DNS pinning and redirects disabled;
- registered browser, websocket, connector, plugin, or custom engines;
- automatic fallback and scoring across engines;
- immutable-style route receipts and experiment state.

A denied request never reaches an adapter. A successful adapter result is rejected if
its reported final URL is outside the same reviewed authority.
"""
from __future__ import annotations

import dataclasses
import hashlib
import ipaddress
import json
import shutil
import socket
import subprocess
import time
import urllib.parse
from pathlib import Path
from typing import Callable, Iterable, Mapping, Protocol

from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy
from .transport_lab import ReviewedAuthority, validate_target_url


class GuardedEgressError(RuntimeError):
    """Raised when guarded multi-engine egress cannot safely proceed."""


@dataclasses.dataclass(frozen=True)
class AuthorizedRequest:
    url: str
    host: str
    method: str
    resolved_ips: tuple[str, ...]
    timeout_seconds: float
    max_response_bytes: int


@dataclasses.dataclass(frozen=True)
class AdapterResult:
    status: int
    final_url: str
    body: bytes = b""
    metadata: Mapping[str, object] = dataclasses.field(default_factory=dict)


class TransportAdapter(Protocol):
    name: str

    def send(self, request: AuthorizedRequest) -> AdapterResult:
        ...


@dataclasses.dataclass
class RouteScore:
    attempts: int = 0
    successes: int = 0
    failures: int = 0
    score: float = 0.0
    last_error: str | None = None
    last_status: int | None = None

    def success(self, status: int) -> None:
        self.attempts += 1
        self.successes += 1
        self.score += 2.0
        self.last_status = int(status)
        self.last_error = None

    def failure(self, exc: Exception) -> None:
        self.attempts += 1
        self.failures += 1
        self.score -= 1.0
        self.last_error = str(exc)[:300]


@dataclasses.dataclass(frozen=True)
class RouteReceipt:
    schema: str
    engine: str
    requested_url: str
    final_url: str
    host: str
    resolved_ips: tuple[str, ...]
    method: str
    status: int
    response_bytes: int
    response_sha256: str
    elapsed_ms: float
    authority_enforced: bool = True
    guard_bypass: bool = False

    def to_dict(self) -> dict[str, object]:
        return dataclasses.asdict(self)


@dataclasses.dataclass(frozen=True)
class RouteAttempt:
    engine: str
    outcome: str
    error: str | None = None
    receipt: RouteReceipt | None = None


@dataclasses.dataclass(frozen=True)
class RoutedResult:
    result: AdapterResult
    receipt: RouteReceipt
    attempts: tuple[RouteAttempt, ...]


class AdapterRegistry:
    """Registry for transport engines that all remain behind the same router gate."""

    def __init__(self) -> None:
        self._adapters: dict[str, TransportAdapter] = {}

    def register(self, adapter: TransportAdapter) -> None:
        name = str(getattr(adapter, "name", "")).strip()
        if not name:
            raise GuardedEgressError("adapter name is required")
        if name in self._adapters:
            raise GuardedEgressError(f"adapter already registered: {name}")
        self._adapters[name] = adapter

    def get(self, name: str) -> TransportAdapter:
        try:
            return self._adapters[str(name).strip()]
        except KeyError as exc:
            raise GuardedEgressError(f"unknown transport adapter: {name}") from exc

    def names(self) -> tuple[str, ...]:
        return tuple(self._adapters)


class UrllibAdapter:
    """HTTP engine backed by the existing guarded ExternalContactClient."""

    name = "urllib"

    def __init__(self, authority: ReviewedAuthority) -> None:
        self.authority = authority

    def send(self, request: AuthorizedRequest) -> AdapterResult:
        policy = ExternalContactPolicy.from_hosts(
            self.authority.hosts,
            allow_http=False,
            allow_delete=False,
            follow_redirects=False,
            timeout_seconds=request.timeout_seconds,
            max_response_bytes=request.max_response_bytes,
            retries=1,
        )
        result = ExternalContactClient(policy).contact_with_body(
            request.url,
            method=request.method,
        )
        return AdapterResult(
            status=result.receipt.status,
            final_url=result.receipt.final_url,
            body=result.body,
            metadata={"provider": "ExternalContactClient"},
        )


class CurlAdapter:
    """Independent curl/subprocess transport, still constrained by router authority.

    Redirects are disabled. The destination hostname is pinned to an already validated
    public IP using curl --resolve so DNS cannot change between preflight and connect.
    """

    name = "curl_subprocess"

    def __init__(
        self,
        *,
        executable: str = "curl",
        runner: Callable[..., subprocess.CompletedProcess[bytes]] | None = None,
    ) -> None:
        self.executable = executable
        self._runner = runner or subprocess.run

    def send(self, request: AuthorizedRequest) -> AdapterResult:
        if request.method not in {"GET", "HEAD"}:
            raise GuardedEgressError("curl adapter supports GET/HEAD only")
        if self._runner is subprocess.run and shutil.which(self.executable) is None:
            raise GuardedEgressError("curl executable is unavailable")

        parsed = urllib.parse.urlsplit(request.url)
        if parsed.scheme.lower() != "https" or not parsed.hostname:
            raise GuardedEgressError("curl adapter requires HTTPS URL")
        pinned_ip = request.resolved_ips[0]
        host = request.host

        command = [
            self.executable,
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--max-time",
            str(max(1, int(request.timeout_seconds))),
            "--max-redirs",
            "0",
            "--resolve",
            f"{host}:443:{pinned_ip}",
            "--request",
            request.method,
            "--write-out",
            "\\n__SENJU_STATUS__:%{http_code}\\n__SENJU_URL__:%{url_effective}",
            request.url,
        ]
        if request.method == "HEAD":
            command.insert(-1, "--head")

        completed = self._runner(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=request.timeout_seconds + 2.0,
            check=False,
        )
        if completed.returncode != 0:
            stderr = bytes(completed.stderr or b"").decode("utf-8", errors="replace")
            raise GuardedEgressError(f"curl failed: {stderr[:300]}")

        raw = bytes(completed.stdout or b"")
        marker = b"\n__SENJU_STATUS__:"
        marker_pos = raw.rfind(marker)
        if marker_pos < 0:
            raise GuardedEgressError("curl response is missing status marker")
        body = raw[:marker_pos]
        trailer = raw[marker_pos + 1 :].decode("utf-8", errors="replace").splitlines()
        values: dict[str, str] = {}
        for row in trailer:
            if row.startswith("__SENJU_STATUS__:"):
                values["status"] = row.split(":", 1)[1]
            elif row.startswith("__SENJU_URL__:"):
                values["url"] = row.split(":", 1)[1]
        try:
            status = int(values["status"])
        except (KeyError, ValueError) as exc:
            raise GuardedEgressError("curl returned invalid status marker") from exc
        final_url = values.get("url", request.url)
        if len(body) > request.max_response_bytes:
            raise GuardedEgressError("curl response exceeded max_response_bytes")
        return AdapterResult(
            status=status,
            final_url=final_url,
            body=body,
            metadata={"provider": "curl", "pinned_ip": pinned_ip},
        )


class CallableAdapter:
    """Registration hook for browser/WebSocket/connector/plugin implementations.

    The callback receives only an already-authorized request object. The router still
    performs postflight final-URL validation before accepting the result.
    """

    def __init__(
        self,
        name: str,
        callback: Callable[[AuthorizedRequest], AdapterResult],
    ) -> None:
        self.name = str(name).strip()
        self.callback = callback
        if not self.name:
            raise GuardedEgressError("adapter name is required")

    def send(self, request: AuthorizedRequest) -> AdapterResult:
        return self.callback(request)


def _resolve_public(host: str, *, port: int = 443) -> tuple[str, ...]:
    try:
        rows = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise GuardedEgressError(f"DNS resolution failed for {host}: {exc}") from exc
    ips: set[str] = set()
    for row in rows:
        raw = row[4][0]
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError as exc:
            raise GuardedEgressError(f"resolver returned invalid address: {raw}") from exc
        if not ip.is_global:
            raise GuardedEgressError(f"non-public address blocked for {host}: {ip}")
        ips.add(str(ip))
    if not ips:
        raise GuardedEgressError(f"no public address resolved for {host}")
    return tuple(sorted(ips))


def authorize_request(
    *,
    url: str,
    authority: ReviewedAuthority,
    method: str = "GET",
    timeout_seconds: float = 8.0,
    max_response_bytes: int = 1024 * 1024,
    resolver: Callable[[str], tuple[str, ...]] | None = None,
    now: int | None = None,
) -> AuthorizedRequest:
    """Mandatory shared preflight for every transport engine."""
    normalized_method = str(method).strip().upper()
    if normalized_method not in {"GET", "HEAD"}:
        raise GuardedEgressError("guarded multi-egress supports GET/HEAD only")
    host = validate_target_url(url, authority, now=now)
    resolution = resolver(host) if resolver is not None else _resolve_public(host)
    checked: set[str] = set()
    for raw in resolution:
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError as exc:
            raise GuardedEgressError(f"resolver returned invalid address: {raw}") from exc
        if not ip.is_global:
            raise GuardedEgressError(f"non-public address blocked for {host}: {ip}")
        checked.add(str(ip))
    if not checked:
        raise GuardedEgressError(f"no public address resolved for {host}")
    return AuthorizedRequest(
        url=url,
        host=host,
        method=normalized_method,
        resolved_ips=tuple(sorted(checked)),
        timeout_seconds=max(0.5, min(float(timeout_seconds), 30.0)),
        max_response_bytes=max(1024, min(int(max_response_bytes), 5 * 1024 * 1024)),
    )


def _postflight(result: AdapterResult, authority: ReviewedAuthority, *, now: int | None = None) -> None:
    validate_target_url(result.final_url, authority, now=now)
    if len(result.body) > 5 * 1024 * 1024:
        raise GuardedEgressError("adapter response exceeded absolute safety ceiling")


def _order(names: Iterable[str], scores: Mapping[str, RouteScore]) -> list[str]:
    indexed = list(enumerate(names))
    indexed.sort(key=lambda item: (-scores[item[1]].score, item[0]))
    return [name for _, name in indexed]


def route_guarded_request(
    *,
    url: str,
    authority: ReviewedAuthority,
    registry: AdapterRegistry,
    engine_order: Iterable[str] | None = None,
    method: str = "GET",
    timeout_seconds: float = 8.0,
    max_response_bytes: int = 1024 * 1024,
    resolver: Callable[[str], tuple[str, ...]] | None = None,
    scores: dict[str, RouteScore] | None = None,
    now: int | None = None,
) -> RoutedResult:
    """Authorize once, then try independent engines with guarded failover."""
    request = authorize_request(
        url=url,
        authority=authority,
        method=method,
        timeout_seconds=timeout_seconds,
        max_response_bytes=max_response_bytes,
        resolver=resolver,
        now=now,
    )
    names = tuple(engine_order or registry.names())
    if not names:
        raise GuardedEgressError("no transport engines are registered")
    route_scores = scores if scores is not None else {name: RouteScore() for name in names}
    for name in names:
        route_scores.setdefault(name, RouteScore())

    attempts: list[RouteAttempt] = []
    for name in _order(names, route_scores):
        adapter = registry.get(name)
        started = time.monotonic()
        try:
            result = adapter.send(request)
            _postflight(result, authority, now=now)
            if len(result.body) > request.max_response_bytes:
                raise GuardedEgressError("adapter response exceeded request limit")
            elapsed_ms = round((time.monotonic() - started) * 1000, 2)
            route_scores[name].success(result.status)
            receipt = RouteReceipt(
                schema="senju-guarded-multi-egress/v1",
                engine=name,
                requested_url=url,
                final_url=result.final_url,
                host=request.host,
                resolved_ips=request.resolved_ips,
                method=request.method,
                status=result.status,
                response_bytes=len(result.body),
                response_sha256=hashlib.sha256(result.body).hexdigest(),
                elapsed_ms=elapsed_ms,
            )
            attempts.append(RouteAttempt(engine=name, outcome="success", receipt=receipt))
            return RoutedResult(result=result, receipt=receipt, attempts=tuple(attempts))
        except Exception as exc:
            route_scores[name].failure(exc)
            attempts.append(RouteAttempt(engine=name, outcome="failure", error=str(exc)[:300]))

    errors = "; ".join(f"{a.engine}: {a.error}" for a in attempts)
    raise GuardedEgressError(f"all guarded transport engines failed: {errors}")


def run_guarded_egress_experiment(
    *,
    url: str,
    authority: ReviewedAuthority,
    registry: AdapterRegistry,
    rounds: int = 3,
    engine_order: Iterable[str] | None = None,
    resolver: Callable[[str], tuple[str, ...]] | None = None,
    state_path: str | Path | None = None,
    now: int | None = None,
) -> dict[str, object]:
    """Continuously compare guarded engines and promote the best-performing route."""
    names = tuple(engine_order or registry.names())
    if not names:
        raise GuardedEgressError("no transport engines are registered")
    bounded_rounds = max(1, min(int(rounds), 10))
    scores = {name: RouteScore() for name in names}
    events: list[dict[str, object]] = []

    for round_no in range(1, bounded_rounds + 1):
        try:
            routed = route_guarded_request(
                url=url,
                authority=authority,
                registry=registry,
                engine_order=names,
                resolver=resolver,
                scores=scores,
                now=now,
            )
            events.append(
                {
                    "round": round_no,
                    "winner": routed.receipt.engine,
                    "status": routed.receipt.status,
                    "attempts": [dataclasses.asdict(a) for a in routed.attempts],
                }
            )
        except GuardedEgressError as exc:
            events.append({"round": round_no, "winner": None, "error": str(exc)[:500]})

    winner = max(names, key=lambda name: (scores[name].score, scores[name].successes, -scores[name].failures))
    doc: dict[str, object] = {
        "schema": "senju-guarded-multi-egress-experiment/v1",
        "target_url": url,
        "engines": list(names),
        "winner": winner,
        "scores": {name: dataclasses.asdict(score) for name, score in scores.items()},
        "events": events,
        "authority_enforced": True,
        "guard_bypass": False,
    }
    if state_path is not None:
        path = Path(state_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return doc
