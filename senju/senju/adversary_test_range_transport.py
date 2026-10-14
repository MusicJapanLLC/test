"""Real network transport for adversary testing against the explicit owner test range.

This module intentionally keeps authority and transport separate:

* only explicitly configured HTTPS test-range hosts are reachable;
* untrusted discoveries never become authority by being discovered;
* credentials and credential-bearing headers are rejected;
* redirects are revalidated before every hop;
* private, loopback, link-local, multicast, reserved, and unspecified IPs are blocked;
* mutating requests are limited to exact action definitions already present in the
  owner-controlled discovery policy;
* recovery may retry transport details, but it cannot change host, credential scope,
  or authority scope.

The result is a real transport that gives adversary agents useful closed-loop feedback
without turning a finding into an unreviewed authority expansion.
"""
from __future__ import annotations

import http.client
import ipaddress
import json
import socket
import ssl
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

DEFAULT_POLICY_PATH = (
    Path(__file__).resolve().parents[2]
    / "automation"
    / "codegen"
    / "meta_state"
    / "discovery_policy.json"
)
READ_ONLY_METHODS = frozenset({"GET", "HEAD"})
CREDENTIAL_HEADERS = frozenset(
    {
        "authorization",
        "cookie",
        "proxy-authorization",
        "x-api-key",
        "api-key",
    }
)
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
MAX_RESPONSE_BYTES = 256 * 1024


class AdversaryTransportError(RuntimeError):
    """Raised when the bounded transport contract is violated."""


@dataclass(frozen=True)
class TransportResult:
    url: str
    method: str
    status: int
    headers: Mapping[str, str]
    body: bytes
    redirects: int


@dataclass(frozen=True)
class DefinedAction:
    action_id: str
    method: str
    path: str
    content_type: str | None
    body: bytes | None


class AuthorizedTestRangeTransport:
    """HTTPS transport bounded to owner-explicit action profiles."""

    def __init__(
        self,
        *,
        allowed_hosts: set[str],
        actions: Mapping[str, DefinedAction],
        timeout_seconds: float = 10.0,
        max_redirects: int = 3,
    ) -> None:
        normalized_hosts = {self._normalize_host(host) for host in allowed_hosts}
        if not normalized_hosts:
            raise AdversaryTransportError("at least one explicit test-range host is required")
        self.allowed_hosts = frozenset(normalized_hosts)
        self.actions = dict(actions)
        self.timeout_seconds = max(0.5, float(timeout_seconds))
        self.max_redirects = max(0, min(int(max_redirects), 5))

    @classmethod
    def from_discovery_policy(
        cls,
        path: str | Path = DEFAULT_POLICY_PATH,
        *,
        timeout_seconds: float = 10.0,
        max_redirects: int = 3,
    ) -> "AuthorizedTestRangeTransport":
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        profiles = raw.get("action_profiles", {})
        trusted_roots = {
            cls._normalize_host_static(host)
            for host in raw.get("trusted_roots", [])
            if str(host).strip()
        }
        actions: dict[str, DefinedAction] = {}
        allowed_hosts: set[str] = set()

        for host, profile in profiles.items():
            normalized = cls._normalize_host_static(host)
            if normalized not in trusted_roots:
                continue
            if str(profile.get("owner_authorization", "")).strip().lower() != "explicit":
                continue
            allowed_hosts.add(normalized)
            external_actions = profile.get("external_actions", {})
            for entries in external_actions.values():
                if not isinstance(entries, list):
                    continue
                for item in entries:
                    if not isinstance(item, dict):
                        continue
                    action_id = str(item.get("id", "")).strip()
                    method = str(item.get("method", "")).strip().upper()
                    path_value = str(item.get("path", "")).strip()
                    if not action_id or not method or not path_value.startswith("/"):
                        continue
                    body_value = item.get("body")
                    body = None if body_value is None else str(body_value).encode("utf-8")
                    actions[action_id] = DefinedAction(
                        action_id=action_id,
                        method=method,
                        path=path_value,
                        content_type=(
                            str(item.get("content_type")).strip()
                            if item.get("content_type") is not None
                            else None
                        ),
                        body=body,
                    )

        return cls(
            allowed_hosts=allowed_hosts,
            actions=actions,
            timeout_seconds=timeout_seconds,
            max_redirects=max_redirects,
        )

    @staticmethod
    def _normalize_host_static(raw: object) -> str:
        value = str(raw).strip().lower().rstrip(".")
        if not value or "*" in value or any(ch in value for ch in "/?#@"):
            raise AdversaryTransportError(f"invalid exact host: {raw!r}")
        try:
            return value.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise AdversaryTransportError(f"invalid exact host: {raw!r}") from exc

    def _normalize_host(self, raw: object) -> str:
        return self._normalize_host_static(raw)

    @staticmethod
    def _ip_is_forbidden(raw_ip: str) -> bool:
        ip = ipaddress.ip_address(raw_ip)
        return any(
            (
                ip.is_private,
                ip.is_loopback,
                ip.is_link_local,
                ip.is_multicast,
                ip.is_reserved,
                ip.is_unspecified,
            )
        )

    def _validate_dns(self, host: str) -> None:
        try:
            infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise AdversaryTransportError(f"DNS resolution failed for {host}") from exc
        ips = {str(info[4][0]) for info in infos if info and info[4]}
        if not ips:
            raise AdversaryTransportError(f"DNS resolution returned no addresses for {host}")
        forbidden = sorted(ip for ip in ips if self._ip_is_forbidden(ip))
        if forbidden:
            raise AdversaryTransportError(
                f"resolved address is outside public test-range egress policy: {forbidden[0]}"
            )

    def _validate_url(self, raw_url: str) -> tuple[str, str, str]:
        try:
            parsed = urllib.parse.urlsplit(str(raw_url).strip())
            port = parsed.port
        except ValueError as exc:
            raise AdversaryTransportError("invalid target URL") from exc
        if parsed.scheme.lower() != "https" or not parsed.hostname:
            raise AdversaryTransportError("test-range transport requires HTTPS")
        if parsed.username is not None or parsed.password is not None:
            raise AdversaryTransportError("credentials in target URLs are forbidden")
        if port not in (None, 443):
            raise AdversaryTransportError("non-default HTTPS ports are not permitted")
        host = self._normalize_host(parsed.hostname)
        if host not in self.allowed_hosts:
            raise AdversaryTransportError(f"host is outside explicit test range: {host}")
        self._validate_dns(host)
        path = urllib.parse.urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
        normalized = urllib.parse.urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))
        return normalized, host, path

    @staticmethod
    def _validate_headers(headers: Mapping[str, str] | None) -> dict[str, str]:
        clean: dict[str, str] = {}
        for key, value in (headers or {}).items():
            name = str(key).strip()
            if not name:
                continue
            if name.lower() in CREDENTIAL_HEADERS:
                raise AdversaryTransportError(f"credential-bearing header is forbidden: {name}")
            clean[name] = str(value)
        return clean

    def probe(
        self,
        url: str,
        *,
        method: str = "GET",
        headers: Mapping[str, str] | None = None,
    ) -> TransportResult:
        normalized_method = str(method).strip().upper()
        if normalized_method not in READ_ONLY_METHODS:
            raise AdversaryTransportError("probe is limited to GET/HEAD")
        clean_headers = self._validate_headers(headers)
        return self._request_with_redirects(
            url,
            method=normalized_method,
            headers=clean_headers,
            body=None,
        )

    def execute_action(
        self,
        host: str,
        action_id: str,
        *,
        headers: Mapping[str, str] | None = None,
    ) -> TransportResult:
        normalized_host = self._normalize_host(host)
        if normalized_host not in self.allowed_hosts:
            raise AdversaryTransportError(f"host is outside explicit test range: {normalized_host}")
        action = self.actions.get(str(action_id).strip())
        if action is None:
            raise AdversaryTransportError(f"unknown owner-defined action: {action_id}")
        clean_headers = self._validate_headers(headers)
        if action.content_type:
            clean_headers.setdefault("Content-Type", action.content_type)
        url = f"https://{normalized_host}{action.path}"
        return self._request_with_redirects(
            url,
            method=action.method,
            headers=clean_headers,
            body=action.body,
        )

    def recovery_probe(self, url: str) -> TransportResult:
        """Retry a failed observation without changing authority.

        Recovery is intentionally limited to GET -> HEAD on the same validated URL.
        It may not change host, port, credential scope, headers carrying credentials,
        or action scope.
        """
        try:
            return self.probe(url, method="GET")
        except (AdversaryTransportError, OSError, TimeoutError):
            return self.probe(url, method="HEAD")

    def _request_with_redirects(
        self,
        url: str,
        *,
        method: str,
        headers: Mapping[str, str],
        body: bytes | None,
    ) -> TransportResult:
        current_url = url
        current_method = method
        current_body = body
        for redirect_count in range(self.max_redirects + 1):
            normalized, host, path = self._validate_url(current_url)
            status, response_headers, response_body = self._single_request(
                host=host,
                path=path,
                method=current_method,
                headers=headers,
                body=current_body,
            )
            if status not in REDIRECT_STATUSES:
                return TransportResult(
                    url=normalized,
                    method=current_method,
                    status=status,
                    headers=response_headers,
                    body=response_body,
                    redirects=redirect_count,
                )
            if redirect_count >= self.max_redirects:
                raise AdversaryTransportError("redirect limit exceeded")
            location = response_headers.get("location") or response_headers.get("Location")
            if not location:
                raise AdversaryTransportError("redirect response is missing Location")
            next_url = urllib.parse.urljoin(normalized, location)
            # Revalidation occurs at the top of the next iteration before any I/O.
            if status == 303:
                current_method = "GET"
                current_body = None
            current_url = next_url
        raise AssertionError("unreachable redirect loop")

    def _single_request(
        self,
        *,
        host: str,
        path: str,
        method: str,
        headers: Mapping[str, str],
        body: bytes | None,
    ) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPSConnection(
            host,
            443,
            timeout=self.timeout_seconds,
            context=ssl.create_default_context(),
        )
        try:
            connection.request(method, path, body=body, headers=dict(headers))
            response = connection.getresponse()
            response_headers = {str(k): str(v) for k, v in response.getheaders()}
            response_body = response.read(MAX_RESPONSE_BYTES + 1)
            if len(response_body) > MAX_RESPONSE_BYTES:
                raise AdversaryTransportError("response exceeds bounded capture size")
            return int(response.status), response_headers, response_body
        finally:
            connection.close()
