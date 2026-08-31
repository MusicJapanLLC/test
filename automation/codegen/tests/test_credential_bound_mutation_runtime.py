from __future__ import annotations

from types import SimpleNamespace

import pytest

from engine.credential_bound_mutation_runtime import _AcknowledgedMutationClient
from senju.external import ExternalContactError


class ReturningClient:
    def __init__(self, status: int) -> None:
        self.status = status

    def contact_with_body(self, url: str, *, method: str, body: bytes | None, headers: dict | None):
        return SimpleNamespace(
            receipt=SimpleNamespace(
                status=self.status,
                provider_acknowledged=200 <= self.status < 400,
                final_url=url,
            ),
            body=b"synthetic",
        )


class LeakyErrorClient:
    def contact_with_body(self, url: str, *, method: str, body: bytes | None, headers: dict | None):
        raise ExternalContactError("transport reflected Authorization: Bearer super-secret-test-value")


def test_http_4xx_becomes_retryable_transport_failure() -> None:
    client = _AcknowledgedMutationClient(ReturningClient(401))

    with pytest.raises(ExternalContactError) as caught:
        client.contact_with_body(
            "https://kabeya-authorized-test-range.onrender.com/login-lab/synthetic-records/x",
            method="PATCH",
            body=b"{}",
            headers={"Authorization": "Bearer token"},
        )

    assert "HTTP 401" in str(caught.value)


def test_raw_transport_exception_text_is_not_propagated() -> None:
    client = _AcknowledgedMutationClient(LeakyErrorClient())

    with pytest.raises(ExternalContactError) as caught:
        client.contact_with_body(
            "https://kabeya-authorized-test-range.onrender.com/login-lab/synthetic-records/x",
            method="PATCH",
            body=b"{}",
            headers={"Authorization": "Bearer super-secret-test-value"},
        )

    text = str(caught.value)
    assert "super-secret-test-value" not in text
    assert "Authorization" not in text
    assert text == "credential-bound transport failure: ExternalContactError"


def test_acknowledged_response_passes_through() -> None:
    client = _AcknowledgedMutationClient(ReturningClient(204))
    result = client.contact_with_body(
        "https://kabeya-authorized-test-range.onrender.com/login-lab/synthetic-records/x",
        method="PUT",
        body=b"{}",
        headers={"Authorization": "Bearer token"},
    )
    assert result.receipt.status == 204
