"""Guarded outbound HTTP contact for Senju.

This module is intentionally separate from Senju's attack/target framework.
It gives Senju a small, auditable way to contact explicitly approved public
HTTP(S) endpoints without turning public hosts into attack targets.

Properties:
- public host must be explicitly allowlisted;
- HTTPS is required unless the caller explicitly opts into HTTP;
- DNS results must all be globally routable (no loopback/private/link-local,
  metadata, multicast, reserved, or unspecified addresses);
- only GET/HEAD/POST are supported;
- redirects are not followed automatically;
- request/response sizes and timeouts are bounded;
- every contact returns a machine-readable receipt.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import ipaddress
import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Mapping


class ExternalContactError(RuntimeError):
    """Fail-closed error raised before or during an external contact."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Return the provider's redirect response instead of following it."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


@dataclass(frozen=True)
class ExternalContactPolicy:
    """Policy for a single Senju outbound-contact lane."""

    allow_hosts: frozenset[str] = field(default_factory=frozenset)
    allow_http: bool = False
    allowed_methods: frozenset[str] = field(
        default_factory=lambda: frozenset({"GET", "HEAD", "POST"})
    )
    timeout_seconds: float = 5.0
    max_request_bytes: int = 16 * 1024
    max_response_bytes: int = 64 * 1024

    @classmethod
    def from_hosts(
        cls,
        hosts: Iterable[str],
        *,
        allow_http: bool = False,
        timeout_seconds: float = 5.0,
    ) -> "ExternalContactPolicy":
        normalized = frozenset(_normalize_host(h) for h in hosts if h and h.strip())
        return cls(
            allow_hosts=normalized,
            allow_http=allow_http,
            timeout_seconds=max(0.5, min(float(timeout_seconds), 10.0)),
        )


@dataclass(frozen=True)
class ContactReceipt:
    schema: str
    contacted_at_utc: str
    method: str
    url: str
    host: str
    resolved_ips: tuple[str, ...]
    status: int
    provider_acknowledged: bool
    response_bytes: int
    response_sha256: str
    content_type: str | None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)

    def write(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _normalize_host(host: str) -> str:
    value = host.strip().rstrip(".").lower()
    if not value or any(c in value for c in "/?#@"):
        raise ExternalContactError(f"invalid allowlisted host: {host!r}")
    try:
        return value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ExternalContactError(f"invalid host: {host!r}") from exc


def _parse_url(url: str, policy: ExternalContactPolicy) -> tuple[str, int]:
    parsed = urllib.parse.urlsplit(url)
    scheme = parsed.scheme.lower()
    if scheme not in {"https", "http"}:
        raise ExternalContactError("only http/https external contact is supported")
    if scheme == "http" and not policy.allow_http:
        raise ExternalContactError("plain HTTP is disabled; use HTTPS or explicitly allow HTTP")
    if parsed.username is not None or parsed.password is not None:
        raise ExternalContactError("credentials in URL authority are not allowed")
    if not parsed.hostname:
        raise ExternalContactError("URL has no hostname")
    host = _normalize_host(parsed.hostname)
    if host not in policy.allow_hosts:
        raise ExternalContactError(f"host is not explicitly allowlisted: {host}")
    port = parsed.port or (443 if scheme == "https" else 80)
    return host, port


def _resolve_public(host: str, port: int) -> tuple[str, ...]:
    try:
        rows = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ExternalContactError(f"DNS resolution failed for {host}: {exc}") from exc

    ips: set[str] = set()
    for row in rows:
        raw = row[4][0]
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError as exc:
            raise ExternalContactError(f"resolver returned invalid address for {host}: {raw}") from exc
        # is_global excludes RFC1918, loopback, link-local, multicast, reserved,
        # unspecified, documentation-only and the common cloud metadata ranges.
        if not ip.is_global:
            raise ExternalContactError(f"non-public address blocked for {host}: {ip}")
        ips.add(str(ip))
    if not ips:
        raise ExternalContactError(f"DNS resolution returned no usable address for {host}")
    return tuple(sorted(ips))


def _safe_headers(headers: Mapping[str, str] | None) -> dict[str, str]:
    out = {"User-Agent": "Senju-External-Contact/1.0"}
    for key, value in (headers or {}).items():
        if not key or any(c in key for c in "\r\n:"):
            raise ExternalContactError(f"invalid header name: {key!r}")
        if "\r" in value or "\n" in value:
            raise ExternalContactError(f"invalid header value for {key}")
        out[key] = value
    return out


class ExternalContactClient:
    """Perform bounded, allowlisted outbound HTTP contact and emit a receipt."""

    def __init__(
        self,
        policy: ExternalContactPolicy,
        *,
        resolver: Callable[[str, int], tuple[str, ...]] | None = None,
        opener: Callable[..., object] | None = None,
    ) -> None:
        self.policy = policy
        self._resolver = resolver or _resolve_public
        if opener is None:
            built = urllib.request.build_opener(_NoRedirect())
            self._open = built.open
        else:
            self._open = opener

    def contact(
        self,
        url: str,
        *,
        method: str = "GET",
        body: bytes | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> ContactReceipt:
        method = method.upper().strip()
        if method not in self.policy.allowed_methods:
            raise ExternalContactError(f"method is not allowed: {method}")
        if body is not None and method not in {"POST"}:
            raise ExternalContactError("request body is supported only for POST")
        payload = body or b""
        if len(payload) > self.policy.max_request_bytes:
            raise ExternalContactError(
                f"request body exceeds {self.policy.max_request_bytes} bytes"
            )

        host, port = _parse_url(url, self.policy)
        resolved = tuple(self._resolver(host, port))
        if not resolved:
            raise ExternalContactError(f"no public address resolved for {host}")
        # Custom resolvers used by embedders/tests must still obey the same public-IP gate.
        for raw in resolved:
            try:
                ip = ipaddress.ip_address(raw)
            except ValueError as exc:
                raise ExternalContactError(f"resolver returned invalid address: {raw}") from exc
            if not ip.is_global:
                raise ExternalContactError(f"non-public address blocked for {host}: {ip}")

        req = urllib.request.Request(
            url,
            data=(payload if method == "POST" else None),
            headers=_safe_headers(headers),
            method=method,
        )

        try:
            response = self._open(req, timeout=self.policy.timeout_seconds)
            status = int(response.status)
            content_type = response.headers.get("Content-Type") if response.headers else None
            data = b"" if method == "HEAD" else response.read(self.policy.max_response_bytes + 1)
            try:
                response.close()
            except Exception:
                pass
        except urllib.error.HTTPError as exc:
            # A real HTTP response is still externally verifiable contact. Preserve it
            # as a non-acknowledged receipt rather than disguising it as transport loss.
            status = int(exc.code)
            content_type = exc.headers.get("Content-Type") if exc.headers else None
            data = exc.read(self.policy.max_response_bytes + 1)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ExternalContactError(f"external contact failed: {exc}") from exc

        if len(data) > self.policy.max_response_bytes:
            raise ExternalContactError(
                f"response exceeds {self.policy.max_response_bytes} byte safety limit"
            )

        now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        return ContactReceipt(
            schema="senju-external-contact/v1",
            contacted_at_utc=now,
            method=method,
            url=url,
            host=host,
            resolved_ips=tuple(sorted(set(resolved))),
            status=status,
            provider_acknowledged=200 <= status < 400,
            response_bytes=len(data),
            response_sha256=hashlib.sha256(data).hexdigest(),
            content_type=content_type,
        )
