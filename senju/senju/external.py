"""Guarded outbound HTTP contact for Senju.

This module is intentionally separate from Senju's Arena target framework.
It gives Senju an auditable transport for explicitly approved public HTTP(S)
endpoints without turning public hosts into attack targets.

Capabilities:
- exact public-host allowlist;
- HTTPS by default;
- GET/HEAD/POST/PUT/PATCH;
- bounded request and response bodies;
- response-body capture for downstream agents;
- bounded transport retries;
- DNS validation blocks loopback/private/link-local/metadata/reserved addresses;
- redirects are not followed automatically;
- every contact emits a machine-readable receipt.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import ipaddress
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Mapping


class ExternalContactError(RuntimeError):
    """Fail-closed error raised before or during an external contact."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Return provider redirect responses instead of following them."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


@dataclass(frozen=True)
class ExternalContactPolicy:
    """Policy for a Senju outbound-contact lane."""

    allow_hosts: frozenset[str] = field(default_factory=frozenset)
    allow_http: bool = False
    allowed_methods: frozenset[str] = field(
        default_factory=lambda: frozenset({"GET", "HEAD", "POST", "PUT", "PATCH"})
    )
    timeout_seconds: float = 5.0
    max_request_bytes: int = 64 * 1024
    max_response_bytes: int = 512 * 1024
    retries: int = 1
    retry_backoff_seconds: float = 0.25

    @classmethod
    def from_hosts(
        cls,
        hosts: Iterable[str],
        *,
        allow_http: bool = False,
        timeout_seconds: float = 5.0,
        max_response_bytes: int = 512 * 1024,
        retries: int = 1,
    ) -> "ExternalContactPolicy":
        normalized = frozenset(_normalize_host(h) for h in hosts if h and h.strip())
        return cls(
            allow_hosts=normalized,
            allow_http=allow_http,
            timeout_seconds=max(0.5, min(float(timeout_seconds), 20.0)),
            max_response_bytes=max(1024, min(int(max_response_bytes), 1024 * 1024)),
            retries=max(0, min(int(retries), 3)),
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
    attempt_count: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)

    def write(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@dataclass(frozen=True)
class ContactResult:
    """Receipt plus the bounded provider response body."""

    receipt: ContactReceipt
    body: bytes

    def write_body(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(self.body)


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
    try:
        port = parsed.port or (443 if scheme == "https" else 80)
    except ValueError as exc:
        raise ExternalContactError("invalid URL port") from exc
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
        if not ip.is_global:
            raise ExternalContactError(f"non-public address blocked for {host}: {ip}")
        ips.add(str(ip))
    if not ips:
        raise ExternalContactError(f"DNS resolution returned no usable address for {host}")
    return tuple(sorted(ips))


def _safe_headers(headers: Mapping[str, str] | None) -> dict[str, str]:
    out = {"User-Agent": "Senju-External-Contact/2.0"}
    forbidden = {"host", "content-length", "transfer-encoding", "connection"}
    for key, value in (headers or {}).items():
        if not key or any(c in key for c in "\r\n:"):
            raise ExternalContactError(f"invalid header name: {key!r}")
        if key.lower() in forbidden:
            raise ExternalContactError(f"caller-controlled header is not allowed: {key}")
        if "\r" in value or "\n" in value:
            raise ExternalContactError(f"invalid header value for {key}")
        out[key] = value
    return out


def _validate_resolved(host: str, resolved: Iterable[str]) -> tuple[str, ...]:
    checked: set[str] = set()
    for raw in resolved:
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError as exc:
            raise ExternalContactError(f"resolver returned invalid address: {raw}") from exc
        if not ip.is_global:
            raise ExternalContactError(f"non-public address blocked for {host}: {ip}")
        checked.add(str(ip))
    if not checked:
        raise ExternalContactError(f"no public address resolved for {host}")
    return tuple(sorted(checked))


class ExternalContactClient:
    """Perform bounded, allowlisted outbound HTTP contact and emit evidence."""

    def __init__(
        self,
        policy: ExternalContactPolicy,
        *,
        resolver: Callable[[str, int], tuple[str, ...]] | None = None,
        opener: Callable[..., object] | None = None,
        sleeper: Callable[[float], None] | None = None,
    ) -> None:
        self.policy = policy
        self._resolver = resolver or _resolve_public
        if opener is None:
            built = urllib.request.build_opener(_NoRedirect())
            self._open = built.open
        else:
            self._open = opener
        self._sleep = sleeper or time.sleep

    def contact(
        self,
        url: str,
        *,
        method: str = "GET",
        body: bytes | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> ContactReceipt:
        """Compatibility API: perform contact and return only the receipt."""
        return self.contact_with_body(url, method=method, body=body, headers=headers).receipt

    def contact_with_body(
        self,
        url: str,
        *,
        method: str = "GET",
        body: bytes | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> ContactResult:
        """Perform contact and return both receipt and bounded response bytes."""
        method = method.upper().strip()
        if method not in self.policy.allowed_methods:
            raise ExternalContactError(f"method is not allowed: {method}")
        if body is not None and method not in {"POST", "PUT", "PATCH"}:
            raise ExternalContactError("request body is supported only for POST/PUT/PATCH")
        payload = body or b""
        if len(payload) > self.policy.max_request_bytes:
            raise ExternalContactError(
                f"request body exceeds {self.policy.max_request_bytes} bytes"
            )

        host, port = _parse_url(url, self.policy)
        resolved = _validate_resolved(host, self._resolver(host, port))
        req = urllib.request.Request(
            url,
            data=(payload if method in {"POST", "PUT", "PATCH"} else None),
            headers=_safe_headers(headers),
            method=method,
        )

        last_error: Exception | None = None
        attempts = self.policy.retries + 1
        for attempt in range(1, attempts + 1):
            try:
                response = self._open(req, timeout=self.policy.timeout_seconds)
                status = int(response.status)
                content_type = response.headers.get("Content-Type") if response.headers else None
                data = b"" if method == "HEAD" else response.read(self.policy.max_response_bytes + 1)
                try:
                    response.close()
                except Exception:
                    pass
                break
            except urllib.error.HTTPError as exc:
                # HTTP errors are real provider responses, not transport loss.
                status = int(exc.code)
                content_type = exc.headers.get("Content-Type") if exc.headers else None
                data = exc.read(self.policy.max_response_bytes + 1)
                break
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = exc
                if attempt >= attempts:
                    raise ExternalContactError(
                        f"external contact failed after {attempt} attempt(s): {exc}"
                    ) from exc
                self._sleep(self.policy.retry_backoff_seconds * attempt)
        else:  # pragma: no cover - loop exits via break or raise
            raise ExternalContactError(f"external contact failed: {last_error}")

        if len(data) > self.policy.max_response_bytes:
            raise ExternalContactError(
                f"response exceeds {self.policy.max_response_bytes} byte safety limit"
            )

        now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        receipt = ContactReceipt(
            schema="senju-external-contact/v2",
            contacted_at_utc=now,
            method=method,
            url=url,
            host=host,
            resolved_ips=resolved,
            status=status,
            provider_acknowledged=200 <= status < 400,
            response_bytes=len(data),
            response_sha256=hashlib.sha256(data).hexdigest(),
            content_type=content_type,
            attempt_count=attempt,
        )
        return ContactResult(receipt=receipt, body=data)
