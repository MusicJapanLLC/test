#!/usr/bin/env python3
"""Run one production continuity worker under an existing exact authority.

The worker is deliberately credential-free toward the target. It rehydrates canonical
standing authority from the repository, verifies the exact authorization reference,
performs a bounded HTTPS HEAD health operation, and emits a per-worker delegated-grant
identity for audit/revocation lineage. No raw credential is inherited by descendants.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "senju") not in sys.path:
    sys.path.insert(0, str(ROOT / "senju"))

from senju.meta.production_continuity import resolve_existing_authority  # noqa: E402
from senju.meta.standing_authorization import sync_canonical_explicit_authorizations  # noqa: E402


def _grant_id(*, worker_id: str, authority_reference: str, revision: str) -> str:
    material = f"{worker_id}|{authority_reference}|{revision}"
    return "worker-grant:" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:24]


def _head(url: str, *, attempts: int = 3, timeout: float = 8.0) -> tuple[int | None, list[str]]:
    errors: list[str] = []
    for attempt in range(1, max(1, min(int(attempts), 3)) + 1):
        request = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "senju-authorized-production-worker/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return int(response.status), errors
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            if status < 500:
                return status, errors
            errors.append(f"HTTPError:{status}")
        except Exception as exc:
            errors.append(f"{type(exc).__name__}:{exc}")
        if attempt < attempts:
            time.sleep(min(2.0, 0.4 * attempt))
    return None, errors


def run(args: argparse.Namespace) -> dict[str, Any]:
    repo_root = Path(args.repo_root).resolve()
    state_dir = Path(args.state_dir).resolve()
    state_dir.mkdir(parents=True, exist_ok=True)

    sync_canonical_explicit_authorizations(
        repo_root=repo_root,
        registry_path=repo_root / "senju" / "state" / "standing_authorizations.json",
    )
    evidence = resolve_existing_authority(
        repo_root=repo_root,
        state_dir=state_dir,
        target_host=args.target_host,
    )
    if evidence is None:
        raise SystemExit("exact production authority is unavailable")
    if evidence.authorization_reference != args.authority_reference:
        raise SystemExit("authority reference does not match exact production authority")
    if "HEAD" not in evidence.allowed_methods:
        raise SystemExit("existing authority does not permit HEAD")
    if args.action not in {"deploy", "recover_same_revision"}:
        raise SystemExit("unsupported continuity action")

    grant_id = _grant_id(
        worker_id=args.worker_id,
        authority_reference=evidence.authorization_reference,
        revision=args.desired_revision,
    )
    url = f"https://{evidence.target_host}/"
    status, errors = _head(url)
    reachable = status is not None and status < 500
    report = {
        "schema": "senju-authorized-production-worker/v1",
        "environment": "production",
        "worker_id": args.worker_id,
        "delegated_grant_id": grant_id,
        "raw_credential_inherited": False,
        "authority_reference": evidence.authorization_reference,
        "authority_source": evidence.source,
        "target_host": evidence.target_host,
        "effective_methods": list(evidence.allowed_methods),
        "credential_scope": evidence.credential_scope,
        "effect": evidence.effect,
        "desired_revision": args.desired_revision,
        "action": args.action,
        "url": url,
        "http_status": status,
        "reachable": reachable,
        "attempt_errors": errors,
        "authority_expanded": False,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    if not reachable:
        raise SystemExit(1)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default="/tmp/senju-production-worker")
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--authority-reference", required=True)
    parser.add_argument("--desired-revision", required=True)
    parser.add_argument("--action", choices=["deploy", "recover_same_revision"], required=True)
    parser.add_argument("--worker-id", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
