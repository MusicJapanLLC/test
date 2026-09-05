"""Production delegated-root minting driven by META/X/SENJU consensus.

This module creates a *real* reusable authority root inside an already-active Owner
standing authorization.  It does not invent unrelated Internet authority.  The owner
standing record is the ceiling; META -> X -> SENJU then create a recursive authority
chain and the final SENJU profile is persisted as the delegated root for later minting.

Flow:
    Owner standing authority
      -> live META/X/SENJU council receipt (3/3)
      -> META child
      -> X child
      -> SENJU delegated root
      -> persistent AuthorityRegistry
      -> later descendants may be minted from that delegated root
      -> delegated root may drive bounded live HEAD contact to its exact authorized host
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Mapping

from senju.authority_factory import (
    AuthorityMintError,
    AuthorityMintRequest,
    AuthorityProfile,
    AuthorityRegistry,
    mint_child,
)
from senju.external import ExternalContactClient

SCHEMA = "senju-ai-council-delegated-root/v1"
LEDGER_SCHEMA = "senju-ai-council-delegated-root-ledger/v1"
PROBE_SCHEMA = "senju-ai-council-delegated-root-probe/v1"
REQUIRED_APPROVERS = ("META", "X", "SENJU")
READ_ONLY_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class DelegatedRootError(RuntimeError):
    """Raised when a delegated root cannot be safely minted or used."""


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _norm_host(value: Any) -> str:
    host = str(value or "").strip().lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@"):
        raise DelegatedRootError("invalid target host")
    return host


def _trusted_approvers(council: Mapping[str, Any]) -> tuple[str, ...]:
    ai = council.get("ai_council", {}) if isinstance(council, Mapping) else {}
    rows = ai.get("trusted_approvals", ()) if isinstance(ai, Mapping) else ()
    names: set[str] = set()
    for raw in rows if isinstance(rows, (list, tuple)) else ():
        if isinstance(raw, Mapping):
            value = str(raw.get("approver", "")).strip().upper()
            if value:
                names.add(value)
    return tuple(sorted(names))


def _verify_council(council: Mapping[str, Any], *, host: str) -> tuple[str, ...]:
    if str(council.get("target", "")).strip().lower() != host:
        raise DelegatedRootError("council receipt target does not match delegated-root target")
    decision = council.get("authority_decision", {})
    ai = council.get("ai_council", {})
    invariants = council.get("invariants", {})
    if not isinstance(decision, Mapping) or decision.get("allowed") is not True:
        raise DelegatedRootError("live authority council did not allow the target")
    if not isinstance(ai, Mapping) or str(ai.get("effect", "")).lower() != "allow":
        raise DelegatedRootError("AI council vote is not ALLOW")
    if isinstance(invariants, Mapping):
        if invariants.get("hard_deny_override") is True or invariants.get("revocation_override") is True:
            raise DelegatedRootError("council receipt attempted a global-stop override")
    approvals = _trusted_approvers(council)
    missing = [name for name in REQUIRED_APPROVERS if name not in approvals]
    if missing:
        raise DelegatedRootError(f"unanimous META/X/SENJU approval required; missing={missing}")
    return approvals


def _standing_record(repo_root: Path, *, host: str) -> Mapping[str, Any]:
    doc = _load_json(repo_root / "senju" / "state" / "standing_authorizations.json", {})
    rows = doc.get("records", ()) if isinstance(doc, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        exact_hosts = {str(item).strip().lower().rstrip(".") for item in raw.get("exact_hosts", ())}
        if host not in exact_hosts:
            continue
        if raw.get("revoked") is True:
            raise DelegatedRootError("standing authority is revoked")
        if raw.get("destructive") is True:
            raise DelegatedRootError("destructive standing authority cannot seed delegated root")
        if str(raw.get("credential_scope", "none")) != "none":
            raise DelegatedRootError("credential-bearing standing authority is not eligible")
        return raw
    raise DelegatedRootError("target is not covered by an active exact Owner standing authority")


def _owner_parent(record: Mapping[str, Any], *, host: str, depth: int = 8) -> AuthorityProfile:
    methods = frozenset(str(item).strip().upper() for item in record.get("allowed_methods", ())) & READ_ONLY_METHODS
    if not methods:
        raise DelegatedRootError("Owner standing authority has no delegated read-only methods")
    return AuthorityProfile(
        profile_id=f"owner-root:{record.get('authorization_reference', host)}",
        issuer="SYSTEM",
        purpose=f"Owner standing root for {host}",
        parent_id=None,
        generation=0,
        created_at_utc=str(record.get("created_at_utc", "owner-standing")),
        can_delegate=True,
        delegation_depth_remaining=max(4, int(depth)),
        allow_hosts=frozenset({host}),
        allowed_methods=methods,
        allow_http=False,
        follow_redirects=False,
        allow_delete=False,
        rate_limit_per_minute=12,
        timeout_seconds=8.0,
        max_request_bytes=0,
        max_response_bytes=512 * 1024,
        retries=1,
        credential_scope="none",
        allow_private_network=False,
        private_hosts=frozenset(),
        private_cidrs=(),
        fingerprint="owner-standing-root",
    )


def _root_key(record: Mapping[str, Any], *, host: str) -> str:
    body = {
        "authorization_reference": record.get("authorization_reference"),
        "host": host,
        "methods": sorted(str(item).upper() for item in record.get("allowed_methods", ())),
        "council": list(REQUIRED_APPROVERS),
    }
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def run_delegated_root_factory(
    repo_root: str | Path,
    state_dir: str | Path,
    council_receipt: Mapping[str, Any],
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)

    host = _norm_host(council_receipt.get("target"))
    approvals = _verify_council(council_receipt, host=host)
    standing = _standing_record(repo, host=host)
    key = _root_key(standing, host=host)

    registry_path = state / "delegated_authorities.json"
    ledger_path = state / "delegated_root_ledger.json"
    registry = AuthorityRegistry.load(registry_path)
    ledger = _load_json(ledger_path, {"schema": LEDGER_SCHEMA, "roots": {}})
    if not isinstance(ledger, dict):
        ledger = {"schema": LEDGER_SCHEMA, "roots": {}}
    roots = ledger.setdefault("roots", {})
    if not isinstance(roots, dict):
        roots = {}
        ledger["roots"] = roots

    existing = roots.get(key)
    created = False
    if isinstance(existing, Mapping) and existing.get("root_profile_id") in registry.profiles:
        root = registry.get(str(existing["root_profile_id"]))
        chain_ids = list(existing.get("chain_profile_ids", ()))
    else:
        parent = _owner_parent(standing, host=host)
        common = dict(
            purpose=f"AI council delegated authority for {host}",
            allow_hosts=frozenset({host}),
            allowed_methods=parent.allowed_methods,
            credential_scope="none",
            allow_private_network=False,
            can_delegate=True,
        )
        meta = mint_child(parent, AuthorityMintRequest(**common), issuer="META")
        x = mint_child(meta, AuthorityMintRequest(**common), issuer="X")
        root = mint_child(x, AuthorityMintRequest(**common), issuer="Senju")
        for profile in (meta, x, root):
            registry.profiles[profile.profile_id] = profile
        registry.save()
        chain_ids = [meta.profile_id, x.profile_id, root.profile_id]
        roots[key] = {
            "root_profile_id": root.profile_id,
            "chain_profile_ids": chain_ids,
            "host": host,
            "owner_authorization_reference": standing.get("authorization_reference"),
            "council_approvers": list(approvals),
        }
        _write_json(ledger_path, ledger)
        created = True

    # Prove the final profile is not ceremonial: use it as a parent for another real
    # AuthorityProfile in memory. Persisting the proof child is intentionally avoided so
    # scheduled runs stay idempotent; later workers may mint their own descendants.
    proof_child = mint_child(
        root,
        AuthorityMintRequest(
            purpose="delegated-root usability proof",
            allow_hosts=root.allow_hosts,
            allowed_methods=frozenset({"HEAD"}) if "HEAD" in root.allowed_methods else root.allowed_methods,
            credential_scope="none",
            allow_private_network=False,
            can_delegate=False,
        ),
        issuer="META",
    )
    external_scope = root.to_external_scope()

    result = {
        "schema": SCHEMA,
        "production": True,
        "host": host,
        "owner_authorization_reference": standing.get("authorization_reference"),
        "council_required": list(REQUIRED_APPROVERS),
        "council_approvers": list(approvals),
        "council_unanimous": all(name in approvals for name in REQUIRED_APPROVERS),
        "new_delegated_root_created": created,
        "real_authority": True,
        "root_profile_id": root.profile_id,
        "root_parent_id": root.parent_id,
        "root_generation": root.generation,
        "root_can_delegate": root.can_delegate,
        "root_delegation_depth_remaining": root.delegation_depth_remaining,
        "root_hosts": sorted(root.allow_hosts),
        "root_methods": sorted(root.allowed_methods),
        "root_credential_scope": root.credential_scope,
        "root_private_network": root.allow_private_network,
        "chain_profile_ids": chain_ids,
        "usable_as_parent": proof_child.parent_id == root.profile_id,
        "proof_child_profile_id": proof_child.profile_id,
        "external_scope_id": external_scope.scope_id,
        "scope_expanded_beyond_owner": False,
        "unrelated_external_root_created": False,
        "registry_path": str(registry_path),
    }
    _write_json(state / "delegated_root_factory_result.json", result)
    return result


def probe_delegated_root(
    state_dir: str | Path,
    root_profile_id: str,
    *,
    client_factory: Callable[[Any], Any] = ExternalContactClient,
) -> dict[str, Any]:
    """Use a persisted delegated root to perform one bounded live HEAD request.

    The probe deliberately proves *use*, not scope expansion. It accepts only a
    credential-free public root with exactly one host and HEAD already present in the
    root's method set. The root is converted to ExternalAuthorityScope and then to the
    existing guarded ExternalContactClient policy. No credential, write method, private
    address, redirect broadening, or new host is introduced here.
    """

    state = Path(state_dir)
    registry = AuthorityRegistry.load(state / "delegated_authorities.json")
    try:
        root = registry.get(str(root_profile_id))
    except AuthorityMintError as exc:
        raise DelegatedRootError(str(exc)) from exc

    if root.credential_scope != "none":
        raise DelegatedRootError("live delegated-root probe requires credential_scope=none")
    if root.allow_private_network:
        raise DelegatedRootError("live delegated-root probe cannot use private-network authority")
    if "HEAD" not in root.allowed_methods:
        raise DelegatedRootError("delegated root does not authorize HEAD")
    if len(root.allow_hosts) != 1:
        raise DelegatedRootError("live delegated-root probe requires exactly one authorized host")

    host = next(iter(root.allow_hosts))
    scope = root.to_external_scope()
    if scope.scope_id != root.profile_id or scope.allow_hosts != root.allow_hosts:
        raise DelegatedRootError("external scope is not an exact projection of the delegated root")

    client = client_factory(scope.to_policy())
    receipt = client.contact(f"https://{host}/", method="HEAD")
    receipt_dict = receipt.to_dict()
    final_host = _norm_host(receipt_dict.get("final_host"))
    status = int(receipt_dict.get("status", 0) or 0)
    if final_host not in root.allow_hosts:
        raise DelegatedRootError("live probe escaped delegated-root host authority")
    if not (100 <= status <= 599):
        raise DelegatedRootError("live probe did not receive a valid HTTP response status")

    result = {
        "schema": PROBE_SCHEMA,
        "production": True,
        "root_profile_id": root.profile_id,
        "root_fingerprint": root.fingerprint,
        "external_scope_id": scope.scope_id,
        "scope_derived_from_root": True,
        "host": host,
        "method": "HEAD",
        "credential_scope": root.credential_scope,
        "private_network": root.allow_private_network,
        "live_external_io": True,
        "provider_acknowledged": bool(receipt_dict.get("provider_acknowledged")),
        "status": status,
        "receipt": receipt_dict,
    }
    _write_json(state / "delegated_root_external_probe.json", result)
    return result
