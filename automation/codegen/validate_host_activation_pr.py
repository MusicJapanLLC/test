#!/usr/bin/env python3
"""Reject fragmented new-host PRs.

A PR that adds a new canonical explicit target or a new exact explicit action profile must
also contain an active host activation bundle for that exact host.  Every changed active
bundle must already be aligned to both canonical Authorization and the Senju trial profile
inside the same PR.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any, Mapping

from engine.host_activation_bundle import HostActivationBundleError, check_bundle_alignment, load_bundle

TARGETS_PATH = "AUTHORIZED_TEST_TARGETS.json"
POLICY_PATH = "automation/codegen/meta_state/discovery_policy.json"
BUNDLE_PREFIX = "automation/codegen/authority_bundles/"


class PRContractError(RuntimeError):
    pass


def _git(*args: str) -> str:
    proc = subprocess.run(["git", *args], check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        raise PRContractError(proc.stderr.strip() or f"git {' '.join(args)} failed")
    return proc.stdout


def _json_at(ref: str, path: str) -> dict[str, Any]:
    proc = subprocess.run(["git", "show", f"{ref}:{path}"], check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        return {}
    try:
        value = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _explicit_targets(doc: Mapping[str, Any]) -> set[str]:
    rows = doc.get("targets", [])
    if not isinstance(rows, list):
        return set()
    return {
        str(row.get("host") or "").strip().lower().rstrip(".")
        for row in rows
        if isinstance(row, Mapping)
        and str(row.get("owner_authorization") or "").strip().lower() == "explicit"
        and str(row.get("host") or "").strip()
    }


def _explicit_profiles(doc: Mapping[str, Any]) -> set[str]:
    profiles = doc.get("action_profiles", {})
    if not isinstance(profiles, Mapping):
        return set()
    return {
        str(host).strip().lower().rstrip(".")
        for host, profile in profiles.items()
        if isinstance(profile, Mapping)
        and str(profile.get("owner_authorization") or "").strip().lower() == "explicit"
    }


def _changed_bundle_paths(base: str, head: str, repo_root: Path) -> list[Path]:
    names = _git("diff", "--name-only", base, head, "--", BUNDLE_PREFIX).splitlines()
    out: list[Path] = []
    for name in names:
        name = name.strip()
        if not name.endswith(".json") or name.endswith(".example.json"):
            continue
        path = repo_root / name
        if path.is_file():
            out.append(path)
    return out


def validate_pr(base: str, head: str, *, repo_root: str | Path = ".") -> dict[str, Any]:
    root = Path(repo_root)
    base_targets = _explicit_targets(_json_at(base, TARGETS_PATH))
    head_targets = _explicit_targets(_json_at(head, TARGETS_PATH))
    base_profiles = _explicit_profiles(_json_at(base, POLICY_PATH))
    head_profiles = _explicit_profiles(_json_at(head, POLICY_PATH))
    new_targets = sorted(head_targets - base_targets)
    new_profiles = sorted(head_profiles - base_profiles)

    bundle_paths = _changed_bundle_paths(base, head, root)
    bundles: dict[str, Path] = {}
    alignment: list[dict[str, Any]] = []
    for path in bundle_paths:
        bundle = load_bundle(path)
        host = str(bundle["host"])
        if host in bundles:
            raise PRContractError(f"multiple active host activation bundles for {host}")
        bundles[host] = path
        try:
            alignment.append(check_bundle_alignment(root, path))
        except HostActivationBundleError as exc:
            raise PRContractError(f"fragmented host activation PR for {host}: {exc}") from exc

    missing_bundle = sorted((set(new_targets) | set(new_profiles)) - set(bundles))
    if missing_bundle:
        raise PRContractError(
            "new explicit host/profile must be completed in the same PR with an activation bundle: "
            + ", ".join(missing_bundle)
        )

    for host in bundles:
        if host not in head_targets:
            raise PRContractError(f"activation bundle has no canonical explicit target in same PR: {host}")
        if host not in head_profiles:
            raise PRContractError(f"activation bundle has no exact Senju action profile in same PR: {host}")

    return {
        "schema": "the-world-host-activation-pr-contract/v1",
        "base": base,
        "head": head,
        "new_explicit_targets": new_targets,
        "new_explicit_profiles": new_profiles,
        "changed_active_bundles": sorted(bundles),
        "aligned_bundles": alignment,
        "atomic_new_host_pr": True,
        "required_same_pr_outputs": [
            "canonical_authorization",
            "authorized_target",
            "senju_trial_profile",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--repo-root", default=".")
    args = parser.parse_args()
    result = validate_pr(args.base, args.head, repo_root=args.repo_root)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
