#!/usr/bin/env python3
"""Inherit credential *bindings* across Strong New Game worlds.

The binding metadata is copied into each world so later authorized runtimes can
resolve the same named secret at execution time. Secret values themselves are
never serialized into checkpoints, manifests, artifacts, or cross-world state.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "the-world-credential-binding-inheritance/v1"
ENV_NAME = re.compile(r"^[A-Z][A-Z0-9_]{2,127}$")
ALLOWED_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"})


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _safe_binding(row: Mapping[str, Any]) -> dict[str, Any] | None:
    binding_id = str(row.get("id") or "").strip()
    host = str(row.get("host") or "").strip().lower().rstrip(".")
    secret_env = str(row.get("secret_env") or "").strip()
    if not binding_id or not host or not ENV_NAME.fullmatch(secret_env):
        return None
    if row.get("synthetic_only") is not True:
        return None
    if str(row.get("owner_authorization") or "").strip().lower() != "explicit":
        return None

    methods = sorted({str(v).upper() for v in row.get("methods", []) if str(v).strip()} & ALLOWED_METHODS)
    if not methods:
        return None

    return {
        "id": binding_id,
        "host": host,
        "credential_scope": str(row.get("credential_scope") or "synthetic_test"),
        "secret_env": secret_env,
        "header": str(row.get("header") or "Authorization"),
        "prefix": str(row.get("prefix") or ""),
        "methods": methods,
        "synthetic_only": True,
        "resolution_mode": "runtime_environment_reference",
        "secret_value_inherited": False,
    }


def inherit(state_dir: Path, source: Path) -> dict[str, Any]:
    source_doc = _load(source)
    bindings = []
    for row in source_doc.get("bindings", []) if isinstance(source_doc, Mapping) else []:
        if isinstance(row, Mapping):
            safe = _safe_binding(row)
            if safe is not None:
                bindings.append(safe)

    latest_path = state_dir / "latest.json"
    latest = _load(latest_path)
    checkpoint_path = state_dir / latest["checkpoint"]
    checkpoint = _load(checkpoint_path)
    generation_dir = checkpoint_path.parent

    manifest_digests: list[str] = []
    for world in range(1, int(checkpoint.get("world_count", 4)) + 1):
        manifest_path = generation_dir / f"world-{world}" / "manifest.json"
        manifest = _load(manifest_path)
        manifest["credential_binding_inheritance"] = {
            "schema": SCHEMA,
            "bindings": bindings,
            "binding_count": len(bindings),
            "secret_values_serialized": False,
            "resolution": "resolve named secret only at authorized runtime execution",
        }
        inheritance = manifest.setdefault("inheritance", {})
        inheritance["credential_bindings"] = True
        inheritance["credential_values"] = False
        manifest.pop("manifest_digest", None)
        manifest["manifest_digest"] = _digest(manifest)
        _write(manifest_path, manifest)
        manifest_digests.append(manifest["manifest_digest"])

    checkpoint["credential_binding_inheritance"] = {
        "schema": SCHEMA,
        "source": str(source),
        "binding_count": len(bindings),
        "bindings": bindings,
        "secret_values_serialized": False,
        "cross_world_binding_inheritance": True,
    }
    invariants = checkpoint.setdefault("invariants", {})
    invariants["credential_binding_inheritance"] = True
    invariants["raw_credential_inheritance"] = False
    checkpoint["world_manifest_digests"] = manifest_digests
    checkpoint.pop("checkpoint_digest", None)
    checkpoint["checkpoint_digest"] = _digest(checkpoint)
    _write(checkpoint_path, checkpoint)
    latest["checkpoint_digest"] = checkpoint["checkpoint_digest"]
    _write(latest_path, latest)

    return {
        "schema": SCHEMA,
        "generation": checkpoint["generation"],
        "world_count": checkpoint["world_count"],
        "binding_count": len(bindings),
        "cross_world_binding_inheritance": True,
        "secret_values_serialized": False,
        "bindings": bindings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    result = inherit(args.state, args.source)
    text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
