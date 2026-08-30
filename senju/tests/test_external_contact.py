from __future__ import annotations

import json
import urllib.error
import urllib.request

import pytest

from senju.external import (
    ExternalContactClient,
    ExternalContactError,
    ExternalContactPolicy,
)


PUBLIC_IP = "93.184.216.34"


class FakeResponse:
    def __init__(self, status: int = 200, body: bytes = b"provider-ok") -> None:
        self.status = status
        self._body = body
        self.headers = {"Content-Type": "text/plain"}
        self.closed = False

    def read(self, limit: int = -1) -> bytes:
        return self._body if limit < 0 else self._body[:limit]

    def close(self) -> None:
        self.closed = True


def public_resolver(host: str, port: int) -> tuple[str, ...]:
    assert host == "example.com"
    assert port == 443
    return (PUBLIC_IP,)


def test_external_contact_requires_explicit_host_allowlist() -> None:
    policy = ExternalContactPolicy.from_hosts([])
    client = ExternalContactClient(policy, resolver=public_resolver, opener=lambda *a, **k: FakeResponse())
    with pytest.raises(ExternalContactError, match="not explicitly allowlisted"):
        client.contact("https://example.com/")


def test_external_contact_blocks_private_or_metadata_resolution() -> None:
    policy = ExternalContactPolicy.from_hosts(["example.com"])
    client = ExternalContactClient(
        policy,
        resolver=lambda host, port: ("169.254.169.254",),
        opener=lambda *a, **k: FakeResponse(),
    )
    with pytest.raises(ExternalContactError, match="non-public address blocked"):
        client.contact("https://example.com/")


def test_external_contact_https_get_emits_v2_receipt_and_body() -> None:
    seen: dict[str, object] = {}

    def opener(req: urllib.request.Request, *, timeout: float) -> FakeResponse:
        seen["method"] = req.get_method()
        seen["url"] = req.full_url
        seen["timeout"] = timeout
        return FakeResponse(status=200, body=b"provider-ok")

    policy = ExternalContactPolicy.from_hosts(["example.com"], timeout_seconds=2.5)
    result = ExternalContactClient(policy, resolver=public_resolver, opener=opener).contact_with_body(
        "https://example.com/contact",
    )

    assert seen == {"method": "GET", "url": "https://example.com/contact", "timeout": 2.5}
    assert result.receipt.schema == "senju-external-contact/v2"
    assert result.receipt.host == "example.com"
    assert result.receipt.resolved_ips == (PUBLIC_IP,)
    assert result.receipt.status == 200
    assert result.receipt.provider_acknowledged is True
    assert result.receipt.response_bytes == len(b"provider-ok")
    assert result.receipt.attempt_count == 1
    assert result.body == b"provider-ok"
    assert len(result.receipt.response_sha256) == 64


def test_external_contact_write_methods_are_bounded(tmp_path) -> None:
    captured: list[tuple[str, bytes | None]] = []

    def opener(req: urllib.request.Request, *, timeout: float) -> FakeResponse:
        captured.append((req.get_method(), req.data))
        return FakeResponse(status=202, body=b"accepted")

    policy = ExternalContactPolicy.from_hosts(["example.com"])
    payload = b'{"event":"senju-contact"}'
    client = ExternalContactClient(policy, resolver=public_resolver, opener=opener)

    for method in ("POST", "PUT", "PATCH"):
        result = client.contact_with_body(
            "https://example.com/hook",
            method=method,
            body=payload,
            headers={"Content-Type": "application/json"},
        )
        assert result.receipt.status == 202
        assert result.receipt.provider_acknowledged is True
        assert result.body == b"accepted"

    assert [method for method, _ in captured] == ["POST", "PUT", "PATCH"]
    assert all(body == payload for _, body in captured)

    receipt_out = tmp_path / "receipt.json"
    body_out = tmp_path / "response.bin"
    result.receipt.write(receipt_out)
    result.write_body(body_out)
    data = json.loads(receipt_out.read_text(encoding="utf-8"))
    assert data["schema"] == "senju-external-contact/v2"
    assert body_out.read_bytes() == b"accepted"


def test_external_contact_retries_transient_transport_failure() -> None:
    attempts = {"count": 0}
    sleeps: list[float] = []

    def flaky(req: urllib.request.Request, *, timeout: float) -> FakeResponse:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise urllib.error.URLError("temporary")
        return FakeResponse(status=200, body=b"recovered")

    policy = ExternalContactPolicy.from_hosts(["example.com"], retries=2)
    result = ExternalContactClient(
        policy,
        resolver=public_resolver,
        opener=flaky,
        sleeper=sleeps.append,
    ).contact_with_body("https://example.com/")

    assert attempts["count"] == 2
    assert result.receipt.attempt_count == 2
    assert result.body == b"recovered"
    assert sleeps == [policy.retry_backoff_seconds]


def test_external_contact_rejects_plain_http_by_default() -> None:
    policy = ExternalContactPolicy.from_hosts(["example.com"])
    client = ExternalContactClient(policy, resolver=public_resolver, opener=lambda *a, **k: FakeResponse())
    with pytest.raises(ExternalContactError, match="plain HTTP is disabled"):
        client.contact("http://example.com/")


def test_external_contact_rejects_delete_method() -> None:
    policy = ExternalContactPolicy.from_hosts(["example.com"])
    client = ExternalContactClient(policy, resolver=public_resolver, opener=lambda *a, **k: FakeResponse())
    with pytest.raises(ExternalContactError, match="method is not allowed"):
        client.contact("https://example.com/", method="DELETE")


def test_external_contact_blocks_caller_controlled_host_header() -> None:
    policy = ExternalContactPolicy.from_hosts(["example.com"])
    client = ExternalContactClient(policy, resolver=public_resolver, opener=lambda *a, **k: FakeResponse())
    with pytest.raises(ExternalContactError, match="caller-controlled header"):
        client.contact("https://example.com/", headers={"Host": "169.254.169.254"})
