from __future__ import annotations

import datetime as dt
import hashlib
import re
import urllib.parse

from senju.external import ContactReceipt, ContactResult
from senju.owned_range_active import FormField, FormSpec
from senju.owned_range_write_policy import EvolvingOwnedRangeActiveRunner, classify_write_surface
from senju.trusted_scope import TrustedOwnerScope

BASE = "https://kabeya-authorized-test-range.onrender.com/"
HOST = "kabeya-authorized-test-range.onrender.com"


def _scope() -> TrustedOwnerScope:
    return TrustedOwnerScope.from_dict(
        {
            "scope_id": "kabeya-authorized-test-range",
            "owner": "Owner/BOSS",
            "domain_roots": [HOST],
            "effect_level": "state_change",
            "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST"],
            "max_rps": 5,
        }
    )


def _form(action: str = "/api/submit", *, source: str = "/", fields=None) -> FormSpec:
    return FormSpec(
        source_url=urllib.parse.urljoin(BASE, source),
        action_url=urllib.parse.urljoin(BASE, action),
        method="POST",
        fields=tuple(fields or (FormField("display_name"), FormField("memo", "textarea"))),
    )


def test_generic_benign_same_origin_post_is_candidate_without_contact_keyword() -> None:
    decision = classify_write_surface(_form(), base_url=BASE)
    assert decision.allowed is True
    assert decision.reason == "benign_same_origin_post"
    assert set(decision.benign_fields) == {"display_name", "memo"}


def test_sensitive_auth_and_file_surfaces_remain_blocked() -> None:
    auth = classify_write_surface(_form("/api/login"), base_url=BASE)
    upload = classify_write_surface(
        _form("/api/submit", fields=(FormField("attachment", "file"),)),
        base_url=BASE,
    )
    external = classify_write_surface(
        FormSpec(BASE, "https://third-party.example/submit", "POST", (FormField("message"),)),
        base_url=BASE,
    )
    assert auth.allowed is False and auth.reason == "sensitive_action_path"
    assert upload.allowed is False and upload.reason == "sensitive_field_type"
    assert external.allowed is False and external.reason == "cross_origin_action"


class FakeClient:
    def __init__(self, *, independent_readback: bool) -> None:
        self.independent_readback = independent_readback
        self.marker = ""
        self.calls: list[tuple[str, str]] = []

    def _receipt(self, url: str, method: str, body: bytes, content_type: str = "text/html") -> ContactReceipt:
        return ContactReceipt(
            schema="senju-external-contact/v3",
            contacted_at_utc="2026-08-31T04:30:00+00:00",
            method=method,
            requested_url=url,
            final_url=url,
            host=HOST,
            final_host=HOST,
            contacted_hosts=(HOST,),
            resolved_ips=("203.0.113.10",),
            status=200,
            provider_acknowledged=True,
            response_bytes=len(body),
            response_sha256=hashlib.sha256(body).hexdigest(),
            content_type=content_type,
            etag=None,
            last_modified=None,
            retry_after=None,
            attempt_count=1,
            redirect_count=0,
        )

    def contact_with_body(self, url: str, *, method: str = "GET", body=None, headers=None):  # noqa: ANN001, ANN003
        self.calls.append((method, url))
        parsed = urllib.parse.urlsplit(url)
        if method == "POST":
            decoded = (body or b"").decode("utf-8", errors="ignore")
            match = re.search(r"SENJU_[A-Za-z0-9_]+", urllib.parse.unquote_plus(decoded))
            if match:
                self.marker = match.group(0)
            response = f"accepted {self.marker}".encode()
            return ContactResult(self._receipt(url, method, response), response)
        if method in {"HEAD", "OPTIONS"}:
            response = b""
            return ContactResult(self._receipt(url, method, response), response)
        if parsed.path in {"/scope.json", "/robots.txt", "/.well-known/security.txt"}:
            response = b"{}" if parsed.path.endswith(".json") else b"ok"
            ctype = "application/json" if parsed.path.endswith(".json") else "text/plain"
            return ContactResult(self._receipt(url, method, response, ctype), response)

        marker = self.marker if self.independent_readback else ""
        response = f"""
        <html><body>
          <a href="/about">About</a>
          <form action="/api/submit" method="post">
            <input name="display_name">
            <textarea name="memo"></textarea>
          </form>
          <div>{marker}</div>
        </body></html>
        """.encode()
        return ContactResult(self._receipt(url, method, response), response)


def test_evolving_runner_attempts_generic_owned_form_and_separates_evidence_levels() -> None:
    fake = FakeClient(independent_readback=True)
    runner = EvolvingOwnedRangeActiveRunner(_scope(), base_url=BASE, client=fake, sleeper=lambda _: None)
    report, _ = runner.run(
        max_pages=2,
        max_probe_requests=2,
        max_writes=1,
        write_cooldown_seconds=0,
        seed=7,
        now=dt.datetime(2026, 8, 31, 4, 30, tzinfo=dt.timezone.utc),
    )
    assert report["forms_discovered"] >= 1
    assert report["write_surface_candidate_count"] >= 1
    assert report["write_attempts"] == 1
    assert report["write_provider_acks"] == 1
    assert report["post_response_echoes"] == 1
    assert report["independent_readbacks"] == 1
    assert any(method == "POST" for method, _ in fake.calls)


def test_provider_ack_without_independent_readback_becomes_learning_signal() -> None:
    fake = FakeClient(independent_readback=False)
    runner = EvolvingOwnedRangeActiveRunner(_scope(), base_url=BASE, client=fake, sleeper=lambda _: None)
    report, _ = runner.run(
        max_pages=1,
        max_probe_requests=2,
        max_writes=1,
        write_cooldown_seconds=0,
        now=dt.datetime(2026, 8, 31, 4, 30, tzinfo=dt.timezone.utc),
    )
    assert report["write_provider_acks"] == 1
    assert report["post_response_echoes"] == 1
    assert report["independent_readbacks"] == 0
    assert any(row["kind"] == "owned_range_readback_gap" for row in report["counterexamples"])
