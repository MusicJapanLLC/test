from __future__ import annotations

import json
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


def test_external_contact_https_get_emits_provider_receipt() -> None:
    seen: dict[str, object] = {}

    def opener(req: urllib.request.Request, *, timeout: float) -> FakeResponse:
        seen["method"] = req.get_method()
        seen["url"] = req.full_url
        seen["timeout"] = timeout
        return FakeResponse(status=200, body=b"provider-ok")

    policy = ExternalContactPolicy.from_hosts(["example.com"], timeout_seconds=2.5)
    receipt = ExternalContactClient(policy, resolver=public_resolver, opener=opener).contact(
        "https://example.com/contact",
    )

    assert seen == {"method": "GET", "url": "https://example.com/contact", "timeout": 2.5}
    assert receipt.schema == "senju-external-contact/v1"
    assert receipt.host == "example.com"
    assert receipt.resolved_ips == (PUBLIC_IP,)
    assert receipt.status == 200
    assert receipt.provider_acknowledged is True
    assert receipt.response_bytes == len(b"provider-ok")
    assert len(receipt.response_sha256) == 64


def test_external_contact_post_is_bounded_and_json_receipt_is_writable(tmp_path) -> None:
    captured: dict[str, object] = {}

    def opener(req: urllib.request.Request, *, timeout: float) -> FakeResponse:
        captured["method"] = req.get_method()
        captured["body"] = req.data
        captured["content_type"] = req.headers.get("Content-type")
        return FakeResponse(status=202, body=b"accepted")

    policy = ExternalContactPolicy.from_hosts(["example.com"])
    payload = b'{"event":"senju-contact"}'
    receipt = ExternalContactClient(policy, resolver=public_resolver, opener=opener).contact(
        "https://example.com/hook",
        method="POST",
        body=payload,
        headers={"Content-Type": "application/json"},
    )

    assert captured["method"] == "POST"
    assert captured["body"] == payload
    assert captured["content_type"] == "application/json"
    assert receipt.status == 202
    assert receipt.provider_acknowledged is True

    out = tmp_path / "receipt.json"
    receipt.write(out)
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["schema"] == "senju-external-contact/v1"
    assert data["provider_acknowledged"] is True


def test_external_contact_rejects_plain_http_by_default() -> None:
    policy = ExternalContactPolicy.from_hosts(["example.com"])
    client = ExternalContactClient(policy, resolver=public_resolver, opener=lambda *a, **k: FakeResponse())
    with pytest.raises(ExternalContactError, match="plain HTTP is disabled"):
        client.contact("http://example.com/")


def test_external_contact_rejects_unbounded_method() -> None:
    policy = ExternalContactPolicy.from_hosts(["example.com"])
    client = ExternalContactClient(policy, resolver=public_resolver, opener=lambda *a, **k: FakeResponse())
    with pytest.raises(ExternalContactError, match="method is not allowed"):
        client.contact("https://example.com/", method="DELETE")
