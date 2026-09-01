#!/usr/bin/env python3
"""Reject fragmented new-host PRs.

A new-host PR is atomic. Adding a canonical explicit target requires the same PR to add
its exact explicit action profile and active host activation bundle. Likewise a new exact
profile cannot appear without the canonical target and bundle. The bundle must already be
aligned to Authorization, the authorized-site registry, and a usable Senju trial profile.

Updates to an already-authorized host may still adjust an existing activation bundle, but
those updates must remain aligned and bounded to the same exact host.
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


def _assert_senju_trial_ready(host: str, bundle: Mapping[str, Any]) -> dict[str, Any]:
    raw = bundle.get("senju_experimentation")
    if not isinstance(raw, Mapping) or raw.get("enabled") is not True:
        raise PRContractError(f"new host PR must enable Senju experimentation in the same PR: {host}")
    if raw.get("same_host_only") is not True or raw.get("synthetic_only") is not True:
        raise PRContractError(f"Senju experimentation must remain exact-host synthetic-only: {host}")

    methods = [str(item).strip().upper() for item in raw.get("allowed_methods", []) if str(item).strip()]
    paths = [str(item).strip() for item in raw.get("trial_paths", []) if str(item).strip()]
    if not methods or not paths:
        raise PRContractError(f"new host PR must activate at least one Senju method and path: {host}")

    try:
        max_actions = int(raw.get("max_actions_per_cycle", 0))
        payload_variants = int(raw.get("payload_variants_per_route", 1))
    except (TypeError, ValueError) as exc:
        raise PRContractError(f"invalid Senju experimentation budget for {host}") from exc
    if max_actions < 1:
        raise PRContractError(f"new host PR must give Senju a non-zero trial budget: {host}")

    experimentation_axes = {
        "path_learning": bool(raw.get("allow_path_learning", False)),
        "method_switch": bool(raw.get("allow_method_switch", False)),
        "payload_variants": payload_variants > 1,
    }
    if not any(experimentation_axes.values()):
        raise PRContractError(
            f"new host PR must increase Senju trial-and-error freedom on at least one bounded axis: {host}"
        )

    return {
        "enabled": True,
        "methods": methods,
        "paths": paths,
        "max_actions_per_cycle": max_actions,
        "experimentation_axes": experimentation_axes,
    }


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
    normalized_bundles: dict[str, dict[str, Any]] = {}
    alignment: list[dict[str, Any]] = []
    for path in bundle_paths:
        bundle = load_bundle(path)
        host = str(bundle["host"])
        if host in bundles:
            raise PRContractError(f"multiple active host activation bundles for {host}")
        bundles[host] = path
        normalized_bundles[host] = bundle
        try:
            alignment.append(check_bundle_alignment(root, path))
        except HostActivationBundleError as exc:
            raise PRContractError(f"fragmented host activation PR for {host}: {exc}") from exc

    new_target_set = set(new_targets)
    new_profile_set = set(new_profiles)
    if new_target_set != new_profile_set:
        missing_profiles = sorted(new_target_set - new_profile_set)
        missing_targets = sorted(new_profile_set - new_target_set)
        details: list[str] = []
        if missing_profiles:
            details.append("missing exact Senju profile for " + ", ".join(missing_profiles))
        if missing_targets:
            details.append("missing canonical Authorization target for " + ", ".join(missing_targets))
        raise PRContractError("new host PR is fragmented: " + "; ".join(details))

    missing_bundle = sorted(new_target_set - set(bundles))
    if missing_bundle:
        raise PRContractError(
            "new host must reach Authorization + allowed site + Senju scope in the same PR; missing activation bundle: "
            + ", ".join(missing_bundle)
        )

    senju_ready: dict[str, dict[str, Any]] = {}
    for host in sorted(new_target_set):
        bundle = normalized_bundles[host]
        senju_ready[host] = _assert_senju_trial_ready(host, bundle)

    for host in bundles:
        if host not in head_targets:
            raise PRContractError(f"activation bundle has no canonical explicit target in same PR: {host}")
        if host not in head_profiles:
            raise PRContractError(f"activation bundle has no exact Senju action profile in same PR: {host}")

    return {
        "schema": "the-world-host-activation-pr-contract/v2",
        "base": base,
        "head": head,
        "new_explicit_targets": new_targets,
        "new_explicit_profiles": new_profiles,
        "changed_active_bundles": sorted(bundles),
        "aligned_bundles": alignment,
        "senju_trial_ready": senju_ready,
        "atomic_new_host_pr": True,
        "new_host_sets_match": new_target_set == new_profile_set,
        "new_hosts_complete_in_single_pr": not bool(new_target_set - set(bundles)),
        "required_same_pr_outputs": [
            "canonical_authorization",
            "authorized_target",
            "senju_trial_profile",
        ],
        "partial_new_host_pr_allowed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--json-out")
    args = parser.parse_args()
    result = validate_pr(args.base, args.head, repo_root=args.repo_root)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.json_out:
        destination = Path(args.json_out)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
