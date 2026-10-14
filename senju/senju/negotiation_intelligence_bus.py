"""Route external research observations into the existing negotiation AI surfaces.

This is a handoff layer, not an authority layer. It normalizes public research output
from Child / Outside World / Senju collaboration artifacts and publishes compact,
deduplicated intelligence records plus proposal-only owner-scope negotiation signals.

Raw secrets are intentionally not forwarded. Authentication context is reduced to
non-secret metadata (required/scheme/login URL/reference fingerprint) so negotiators can
reason about access requirements without receiving passwords, tokens, cookies, or keys.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any, Iterable, Mapping

BUS_SCHEMA = "the-world-negotiation-intelligence-bus/v1"
RECEIPT_SCHEMA = "the-world-negotiation-intelligence-receipts/v1"
SIGNAL_SCHEMA = "senju-owner-scope-negotiation-signals/v1"
DEFAULT_STATE_DIR = Path("senju/state")

_SECRET_KEY_RE = re.compile(
    r"(?:^|_)(?:password|passwd|pwd|token|secret|cookie|session|api_?key|authorization|bearer|private_?key|credential)(?:$|_)",
    re.I,
)
_REFERENCE_KEYS = {
    "credential_ref",
    "credentials_ref",
    "auth_ref",
    "authentication_ref",
    "secret_ref",
    "vault_ref",
}
_AUTH_REQUIRED_KEYS = {"auth_required", "requires_auth", "authentication_required", "login_required"}
_AUTH_SCHEME_KEYS = {"auth_scheme", "authentication_scheme", "auth_type", "authentication_type"}
_LOGIN_URL_KEYS = {"login_url", "auth_url", "authentication_url", "signin_url", "sign_in_url"}


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _clean(value: Any, limit: int = 500) -> str:
    return " ".join(str(value or "").split())[:limit]


def _fingerprint(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _host_from_url(value: Any) -> str:
    raw = _clean(value, 2000)
    if not raw:
        return ""
    try:
        parsed = urllib.parse.urlparse(raw)
    except ValueError:
        return ""
    return (parsed.hostname or "").strip().lower().rstrip(".")


def _safe_exact_host(value: Any) -> str:
    host = _clean(value, 255).lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@* "):
        return ""
    if "." not in host and host != "localhost":
        return ""
    if host == "localhost":
        return ""
    return host


def _safe_url(value: Any) -> str:
    raw = _clean(value, 2000)
    if not raw:
        return ""
    try:
        parsed = urllib.parse.urlparse(raw)
    except ValueError:
        return ""
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return ""
    if parsed.username or parsed.password:
        return ""
    return raw[:2000]


def _auth_context(raw: Mapping[str, Any]) -> dict[str, Any]:
    """Extract non-secret authentication metadata only."""
    out: dict[str, Any] = {
        "authentication_required": False,
        "scheme": "",
        "login_url": "",
        "reference_present": False,
        "reference_fingerprint": "",
        "raw_credentials_forwarded": False,
    }
    reference_values: list[str] = []

    for key, value in raw.items():
        lowered = str(key).strip().lower()
        if lowered in _AUTH_REQUIRED_KEYS:
            out["authentication_required"] = bool(value)
        elif lowered in _AUTH_SCHEME_KEYS and not _SECRET_KEY_RE.search(lowered):
            out["scheme"] = _clean(value, 80)
        elif lowered in _LOGIN_URL_KEYS:
            out["login_url"] = _safe_url(value)
        elif lowered in _REFERENCE_KEYS:
            ref = _clean(value, 500)
            if ref:
                reference_values.append(ref)

    if reference_values:
        out["reference_present"] = True
        out["reference_fingerprint"] = _fingerprint(sorted(reference_values))[:24]
    return out


def _record(
    *,
    producer: str,
    source_ref: str,
    host: Any = "",
    url: Any = "",
    title: Any = "",
    summary: Any = "",
    reason: Any = "",
    concepts: Iterable[Any] = (),
    raw: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    safe_url = _safe_url(url)
    safe_host = _safe_exact_host(host) or _host_from_url(safe_url)
    if not safe_host:
        return None
    concept_list = [_clean(v, 80) for v in concepts if _clean(v, 80)][:16]
    auth = _auth_context(raw or {})
    payload = {
        "producer": _clean(producer, 80),
        "source_ref": _clean(source_ref, 300),
        "host": safe_host,
        "url": safe_url,
        "title": _clean(title, 240),
        "summary": _clean(summary, 900),
        "reason": _clean(reason, 500),
        "concepts": concept_list,
        "auth_context": auth,
        "proposal_only": True,
        "authority_effect": "none",
        "raw_credentials_forwarded": False,
    }
    payload["intelligence_id"] = f"intel-{_fingerprint(payload)[:20]}"
    return payload


def _child_records(doc: Mapping[str, Any], source_ref: str) -> list[dict[str, Any]]:
    rows = doc.get("results", ())
    out: list[dict[str, Any]] = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        interaction = row.get("interaction") if isinstance(row.get("interaction"), Mapping) else {}
        child = row.get("child") if isinstance(row.get("child"), Mapping) else {}
        reason = (
            f"Child external research by {_clean(child.get('id') or child.get('name'), 80)}; "
            f"status={_clean(row.get('status'), 60)}; "
            f"interaction_signal={bool(interaction.get('public_interaction_signal'))}"
        )
        rec = _record(
            producer="CHILD-EXTERNAL-FLEET",
            source_ref=source_ref,
            host=row.get("domain"),
            url=row.get("final_url") or row.get("url"),
            title=row.get("page_title") or row.get("feed_title"),
            summary=row.get("snippet"),
            reason=reason,
            concepts=row.get("concepts") if isinstance(row.get("concepts"), list) else (),
            raw=row,
        )
        if rec:
            out.append(rec)
    return out


def _outside_world_records(doc: Mapping[str, Any], source_ref: str) -> list[dict[str, Any]]:
    picked = doc.get("picked")
    if not isinstance(picked, Mapping):
        return []
    child = doc.get("child") if isinstance(doc.get("child"), Mapping) else {}
    rec = _record(
        producer="OUTSIDE-WORLD-SCOUT",
        source_ref=source_ref,
        url=picked.get("url"),
        title=picked.get("title"),
        summary=picked.get("summary"),
        reason=f"Outside World public research by {_clean(child.get('id') or child.get('name'), 80)}",
        concepts=(picked.get("category"), picked.get("source_id")),
        raw=picked,
    )
    return [rec] if rec else []


def _mapping_rows(value: Any, *, depth: int = 0) -> Iterable[Mapping[str, Any]]:
    if depth > 3:
        return
    if isinstance(value, Mapping):
        hostish = value.get("host") or value.get("target") or value.get("url") or value.get("final_url")
        if hostish:
            yield value
        for child in value.values():
            if isinstance(child, (Mapping, list)):
                yield from _mapping_rows(child, depth=depth + 1)
    elif isinstance(value, list):
        for child in value:
            if isinstance(child, (Mapping, list)):
                yield from _mapping_rows(child, depth=depth + 1)


def _generic_peer_records(doc: Mapping[str, Any], source_ref: str, producer: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in _mapping_rows(doc):
        rec = _record(
            producer=producer,
            source_ref=source_ref,
            host=row.get("host") or row.get("target"),
            url=row.get("url") or row.get("final_url"),
            title=row.get("title"),
            summary=row.get("summary") or row.get("snippet"),
            reason=row.get("reason") or row.get("mission") or row.get("status"),
            concepts=row.get("concepts") if isinstance(row.get("concepts"), list) else (),
            raw=row,
        )
        if rec:
            out.append(rec)
    return out


def _collect_file(path: Path) -> list[dict[str, Any]]:
    doc = _load(path, {})
    if not isinstance(doc, Mapping):
        return []
    name = path.name
    source_ref = str(path)
    if name == "child-external-fleet.json":
        return _child_records(doc, source_ref)
    if name == "outside-world-state.json":
        return _outside_world_records(doc, source_ref)
    if name == "root_negotiation_peer_feed.json":
        return _generic_peer_records(doc, source_ref, "ROOT-NEGOTIATION-PEER-FEED")
    if name == "authority_opportunity_queue.json":
        return _generic_peer_records(doc, source_ref, "AUTHORITY-OPPORTUNITY-BUS")
    return []


def _candidate_files(state: Path, input_roots: Iterable[Path]) -> list[Path]:
    files: list[Path] = []
    for name in ("root_negotiation_peer_feed.json", "authority_opportunity_queue.json"):
        path = state / name
        if path.exists():
            files.append(path)
    for root in input_roots:
        if not root.exists():
            continue
        for pattern in (
            "**/child-external-fleet.json",
            "**/outside-world-state.json",
            "**/root_negotiation_peer_feed.json",
            "**/authority_opportunity_queue.json",
        ):
            files.extend(root.glob(pattern))
    unique: dict[str, Path] = {}
    for path in files:
        try:
            key = str(path.resolve())
        except OSError:
            key = str(path)
        unique[key] = path
    return sorted(unique.values(), key=lambda p: str(p))


def _dedupe(records: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for raw in records:
        row = dict(raw)
        key = _fingerprint(
            {
                "producer": row.get("producer"),
                "host": row.get("host"),
                "url": row.get("url"),
                "title": row.get("title"),
                "summary": row.get("summary"),
                "reason": row.get("reason"),
            }
        )
        by_key[key] = row
    return sorted(by_key.values(), key=lambda r: (str(r.get("host")), str(r.get("producer")), str(r.get("intelligence_id"))))


def _merge_signals(state: Path, records: list[Mapping[str, Any]], now: int) -> tuple[int, int]:
    path = state / "owner_scope_negotiation_signals.json"
    doc = _load(path, {})
    old_rows = doc.get("signals", ()) if isinstance(doc, Mapping) else ()
    signals: list[dict[str, Any]] = [dict(v) for v in old_rows if isinstance(v, Mapping)] if isinstance(old_rows, list) else []

    existing = {
        str(row.get("signal_id"))
        for row in signals
        if isinstance(row, Mapping) and str(row.get("signal_id") or "")
    }
    added = 0
    for rec in records:
        signal_id = f"neg-intel-{str(rec.get('intelligence_id') or '')[-20:]}"
        if signal_id in existing:
            continue
        reason_bits = [
            _clean(rec.get("reason"), 300),
            _clean(rec.get("title"), 180),
            _clean(rec.get("summary"), 300),
        ]
        reason = " | ".join(v for v in reason_bits if v)[:700]
        signals.append(
            {
                "signal_id": signal_id,
                "host": rec.get("host"),
                "requested_methods": ["GET", "HEAD"],
                "reason": reason or "External research observation for negotiation review",
                "source": "negotiation_intelligence_bus",
                "source_ref": rec.get("source_ref"),
                "intelligence_id": rec.get("intelligence_id"),
                "producer": rec.get("producer"),
                "auth_context": rec.get("auth_context"),
                "proof_type": "external_research_observation",
                "verified": False,
                "proposal_only": True,
                "authority_effect": "none",
                "raw_credentials_forwarded": False,
                "generated_at": now,
            }
        )
        existing.add(signal_id)
        added += 1

    if len(signals) > 4096:
        signals = signals[-4096:]
    _write(
        path,
        {
            "schema": str(doc.get("schema") or SIGNAL_SCHEMA) if isinstance(doc, Mapping) else SIGNAL_SCHEMA,
            "generated_at": now,
            "producer": "negotiation_intelligence_bus",
            "signals": signals,
        },
    )
    return added, len(signals)


def run_negotiation_intelligence_bus(
    state_dir: str | Path,
    *,
    input_roots: Iterable[str | Path] = (),
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    current = int(time.time()) if now is None else int(now)
    roots = [Path(v) for v in input_roots]

    source_files = _candidate_files(state, roots)
    records: list[dict[str, Any]] = []
    for path in source_files:
        records.extend(_collect_file(path))
    records = _dedupe(records)

    added, signal_count = _merge_signals(state, records, current)
    bus = {
        "schema": BUS_SCHEMA,
        "generated_at": current,
        "role": "external-research-to-negotiation-ai-handoff",
        "closed_loop": True,
        "routing_targets": ["OWNER_SCOPE_NEGOTIATION", "ROOT_AUTHORITY_NEGOTIATION", "META", "X", "SENJU"],
        "source_file_count": len(source_files),
        "record_count": len(records),
        "signal_added_count": added,
        "signal_total_count": signal_count,
        "raw_credentials_forwarded": False,
        "authentication_metadata_forwarded": True,
        "authority_effect": "none",
        "records": records,
    }
    _write(state / "negotiation_intelligence_bus.json", bus)

    receipts = {
        "schema": RECEIPT_SCHEMA,
        "generated_at": current,
        "closed_loop": True,
        "delivered_to": [
            "owner_scope_negotiation_signals.json",
            "negotiation_intelligence_bus.json",
        ],
        "records_received": len(records),
        "signals_emitted": added,
        "source_files": [str(p) for p in source_files],
        "raw_credentials_forwarded": False,
        "status": "delivered",
    }
    _write(state / "negotiation_intelligence_receipts.json", receipts)
    return bus
