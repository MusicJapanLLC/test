"""Evolving write-surface policy for Senju's explicitly owned test range.

This module extends the existing owned-range active loop without widening authority.
It keeps the exact same-origin TrustedOwnerScope boundary, but avoids losing benign
POST surfaces merely because their HTML does not contain words such as "contact".

Only low-impact dummy writes are eligible. Login/auth/payment/account/upload/delete
surfaces, password/file inputs, sensitive field names, cross-origin actions and any
non-POST form remain excluded. Provider acknowledgement, POST-response echo and
independent GET readback are recorded separately so no stronger success claim is
made than the evidence supports.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import urllib.parse
from dataclasses import dataclass
from typing import Any, Iterable

from .owned_range_active import (
    FORM_HINTS,
    SENSITIVE_FIELD_HINTS,
    FormSpec,
    OwnedRangeActiveRunner,
    OwnedRangeMemory,
    _body_text,
    _clean_url,
    _form_payload,
    _same_origin,
    _sanitize_row,
)

SENSITIVE_ACTION_HINTS = (
    "login",
    "signin",
    "sign-in",
    "auth",
    "password",
    "reset",
    "payment",
    "checkout",
    "admin",
    "otp",
    "card",
    "billing",
    "upload",
    "delete",
    "account",
    "register",
    "signup",
)

BENIGN_FIELD_HINTS = (
    "message",
    "comment",
    "feedback",
    "body",
    "text",
    "name",
    "email",
    "subject",
    "title",
    "content",
    "note",
    "contact",
    "description",
    "inquiry",
    "detail",
    "company",
    "memo",
)

BENIGN_FIELD_TYPES = frozenset({"text", "email", "textarea", "select", "search", "url", "tel", "number"})
NON_USER_FIELD_TYPES = frozenset({"hidden", "submit", "button", "reset", "image"})


@dataclass(frozen=True)
class WriteSurfaceDecision:
    allowed: bool
    reason: str
    benign_fields: tuple[str, ...] = ()


def _path_context(form: FormSpec) -> str:
    return " ".join(
        [
            urllib.parse.urlsplit(form.source_url).path.lower(),
            urllib.parse.urlsplit(form.action_url).path.lower(),
        ]
    )


def classify_write_surface(form: FormSpec, *, base_url: str) -> WriteSurfaceDecision:
    """Classify one discovered form for a bounded dummy write.

    The exact host/scheme must remain inside the already-established owner scope.
    Generic benign forms are accepted even without a contact-like keyword; dangerous
    or identity/payment/authentication shaped surfaces remain excluded.
    """
    if form.method.upper() != "POST":
        return WriteSurfaceDecision(False, "method_not_post")
    if not _same_origin(form.action_url, base_url):
        return WriteSurfaceDecision(False, "cross_origin_action")

    action_context = _path_context(form)
    if any(hint in action_context for hint in SENSITIVE_ACTION_HINTS):
        return WriteSurfaceDecision(False, "sensitive_action_path")

    types = {field.field_type.lower() for field in form.fields}
    if types & {"password", "file"}:
        return WriteSurfaceDecision(False, "sensitive_field_type")

    names = [field.name.lower() for field in form.fields]
    name_context = " ".join(names)
    if any(hint in name_context for hint in SENSITIVE_FIELD_HINTS):
        return WriteSurfaceDecision(False, "sensitive_field_name")

    user_fields = [field for field in form.fields if field.field_type.lower() not in NON_USER_FIELD_TYPES]
    if not user_fields:
        return WriteSurfaceDecision(False, "no_benign_user_fields")

    full_context = f"{action_context} {name_context}"
    hinted = any(hint in full_context for hint in FORM_HINTS)
    benign: list[str] = []
    for field in user_fields:
        lname = field.name.lower()
        ftype = field.field_type.lower()
        if any(hint in lname for hint in BENIGN_FIELD_HINTS) or ftype in BENIGN_FIELD_TYPES:
            benign.append(field.name)

    if hinted:
        return WriteSurfaceDecision(True, "hinted_owned_form", tuple(sorted(set(benign))))
    if benign:
        return WriteSurfaceDecision(True, "benign_same_origin_post", tuple(sorted(set(benign))))
    return WriteSurfaceDecision(False, "no_benign_user_fields")


def _surface_row(form: FormSpec, decision: WriteSurfaceDecision) -> dict[str, Any]:
    return {
        "form_key": form.key,
        "source_url": form.source_url,
        "action_url": form.action_url,
        "method": form.method,
        "reason": decision.reason,
        "benign_fields": list(decision.benign_fields),
        "fields": [
            {"name": field.name, "type": field.field_type}
            for field in form.fields
        ],
    }


class EvolvingOwnedRangeActiveRunner(OwnedRangeActiveRunner):
    """Owned-range runner with explainable write-surface discovery."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.write_surface_candidates: list[dict[str, Any]] = []
        self.write_surface_skips: list[dict[str, Any]] = []

    def _run_writes(
        self,
        forms: Iterable[FormSpec],
        memory: OwnedRangeMemory,
        *,
        marker: str,
        now: dt.datetime,
        max_writes: int,
        write_cooldown_seconds: int,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        writes: list[dict[str, Any]] = []
        counterexamples: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        attempted = 0

        for form in forms:
            if form.key in seen_keys:
                continue
            seen_keys.add(form.key)

            decision = classify_write_surface(form, base_url=self.base_url)
            surface = _surface_row(form, decision)
            if not decision.allowed:
                self.write_surface_skips.append(surface)
                continue

            self.write_surface_candidates.append(surface)
            if attempted >= max(0, max_writes):
                self.write_surface_skips.append(surface | {"reason": "write_budget_exhausted"})
                continue

            if not memory.can_write(form.key, now=now, cooldown_seconds=write_cooldown_seconds):
                self.write_surface_skips.append(surface | {"reason": "write_cooldown"})
                writes.append(
                    {
                        "form_key": form.key,
                        "source_url": form.source_url,
                        "action_url": form.action_url,
                        "attempted": False,
                        "skip_reason": "write_cooldown",
                        "eligibility_reason": decision.reason,
                    }
                )
                continue

            payload = _form_payload(form, marker)
            body = urllib.parse.urlencode(payload).encode("utf-8")
            post = self._contact(
                "dummy-write",
                "POST",
                form.action_url,
                body=body,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "text/html,application/json,text/plain,*/*",
                    "X-Senju-Authorized-Test": marker,
                },
            )
            attempted += 1
            memory.record_write(form.key, now=now)

            provider_ack = bool(post.get("provider_acknowledged"))
            post_echo = marker in _body_text(post)
            readbacks: list[dict[str, Any]] = []
            independent = False

            candidates: list[str] = []
            final_url = str(post.get("final_url") or "")
            if final_url and _same_origin(final_url, self.base_url):
                candidates.append(_clean_url(final_url))
            if form.source_url not in candidates:
                candidates.append(form.source_url)

            for readback_url in candidates[:2]:
                row = self._contact("write-readback", "GET", readback_url)
                found = marker in _body_text(row)
                independent = independent or found
                readbacks.append(_sanitize_row(row) | {"marker_found": found})

            write = {
                "form_key": form.key,
                "source_url": form.source_url,
                "action_url": form.action_url,
                "attempted": True,
                "eligibility_reason": decision.reason,
                "provider_acknowledged": provider_ack,
                "status": post.get("status"),
                "post_response_echo": post_echo,
                "independent_readback": independent,
                "readbacks": readbacks,
                "field_names": sorted(payload),
            }
            writes.append(write)

            surface_path = urllib.parse.urlsplit(form.action_url).path or "/"
            if not provider_ack:
                counterexamples.append(
                    {
                        "kind": "owned_range_write_reliability",
                        "surface": surface_path,
                        "target": form.action_url,
                        "probe": "dummy_form_write",
                        "reason": "authorized dummy POST was not provider-acknowledged",
                        "authorized_scope": self.scope.scope_id,
                    }
                )
            elif not independent:
                evidence = "post response echoed marker" if post_echo else "POST response did not echo marker"
                counterexamples.append(
                    {
                        "kind": "owned_range_readback_gap",
                        "surface": surface_path,
                        "target": form.action_url,
                        "probe": "dummy_form_write",
                        "reason": f"provider acknowledged write but marker was not independently observable; {evidence}",
                        "authorized_scope": self.scope.scope_id,
                    }
                )

        return writes, counterexamples

    def run(self, *args: Any, **kwargs: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        self.write_surface_candidates = []
        self.write_surface_skips = []
        report, memory = super().run(*args, **kwargs)

        report["write_surface_candidates"] = self.write_surface_candidates
        report["write_surface_candidate_count"] = len(self.write_surface_candidates)
        report["write_surface_skips"] = self.write_surface_skips[:80]
        report["write_surface_skip_count"] = len(self.write_surface_skips)
        report["post_response_echoes"] = sum(1 for row in report.get("writes", []) if row.get("post_response_echo"))

        if int(report.get("forms_discovered") or 0) > 0 and not self.write_surface_candidates:
            reasons: dict[str, int] = {}
            for row in self.write_surface_skips:
                reason = str(row.get("reason") or "unknown")
                reasons[reason] = reasons.get(reason, 0) + 1
            report.setdefault("counterexamples", []).append(
                {
                    "kind": "owned_range_write_reliability",
                    "surface": urllib.parse.urlsplit(self.base_url).path or "/",
                    "target": self.base_url,
                    "probe": "write_surface_discovery",
                    "reason": "forms discovered but no eligible benign same-origin POST surface; skip reasons="
                    + json.dumps(reasons, sort_keys=True),
                    "authorized_scope": self.scope.scope_id,
                }
            )

        report["counterexample_count"] = len(report.get("counterexamples", []))
        supplemental = {
            "previous_digest": report.get("digest"),
            "write_surface_candidates": self.write_surface_candidates,
            "write_surface_skips": self.write_surface_skips,
            "writes": [
                {
                    "action_url": row.get("action_url"),
                    "attempted": row.get("attempted"),
                    "provider_acknowledged": row.get("provider_acknowledged"),
                    "post_response_echo": row.get("post_response_echo"),
                    "independent_readback": row.get("independent_readback"),
                }
                for row in report.get("writes", [])
            ],
            "counterexamples": report.get("counterexamples", []),
        }
        report["digest"] = hashlib.sha256(
            json.dumps(supplemental, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()[:24]
        return report, memory
