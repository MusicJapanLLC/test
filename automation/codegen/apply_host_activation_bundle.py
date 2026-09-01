#!/usr/bin/env python3
"""Apply/check a single-PR host activation bundle."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from engine.host_activation_bundle import (
    HostActivationBundleError,
    apply_bundle,
    check_all_bundle_alignment,
    check_bundle_alignment,
    fetch_host_attestation,
    load_bundle,
    validate_attestation,
)


def _load_attestation(path: str | None) -> dict | None:
    if not path:
        return None
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise HostActivationBundleError("attestation file must contain a JSON object")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--bundle")
    parser.add_argument("--attestation-file")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--check-all", action="store_true")
    parser.add_argument("--verify-live", action="store_true")
    args = parser.parse_args()

    if sum(bool(x) for x in (args.apply, args.check, args.check_all)) != 1:
        parser.error("choose exactly one of --apply, --check, or --check-all")
    if args.check_all:
        result = check_all_bundle_alignment(args.repo_root)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if not args.bundle:
        parser.error("--bundle is required for --apply or --check")

    bundle_path = Path(args.bundle)
    if not bundle_path.is_absolute():
        bundle_path = Path(args.repo_root) / bundle_path
    bundle = load_bundle(bundle_path)

    attestation = _load_attestation(args.attestation_file)
    if attestation is not None:
        verified = validate_attestation(bundle, attestation)
    elif args.verify_live or args.apply:
        verified = fetch_host_attestation(bundle)
    else:
        verified = None

    if args.apply:
        result = apply_bundle(
            args.repo_root,
            bundle_path,
            attestation=attestation,
            verify_live=attestation is None,
        )
        result["host_attestation_verified"] = True
    else:
        result = check_bundle_alignment(args.repo_root, bundle_path)
        result["host_attestation_verified"] = verified is not None
        if verified is not None:
            result["attestation_sha256"] = verified["sha256"]

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
