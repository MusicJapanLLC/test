#!/usr/bin/env python3
"""Generate a minimal CycloneDX 1.6 component SBOM from npm package-lock v3."""
from __future__ import annotations

import argparse
import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


def package_name(lock_path: str, info: dict) -> str | None:
    if info.get("name"):
        return str(info["name"])
    marker = "node_modules/"
    if marker not in lock_path:
        return None
    return lock_path.rsplit(marker, 1)[-1]


def integrity_hash(integrity: str | None) -> list[dict[str, str]]:
    if not integrity or not integrity.startswith("sha512-"):
        return []
    try:
        raw = base64.b64decode(integrity.split("-", 1)[1], validate=True)
    except Exception:
        return []
    return [{"alg": "SHA-512", "content": raw.hex()}]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("lockfile", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    lock = json.loads(args.lockfile.read_text(encoding="utf-8"))
    packages = lock.get("packages", {})
    components: list[dict] = []
    seen: set[str] = set()

    for lock_path, info in packages.items():
        if not lock_path or not isinstance(info, dict):
            continue
        name = package_name(lock_path, info)
        version = str(info.get("version", "")).strip()
        if not name or not version:
            continue
        purl = f"pkg:npm/{quote(name, safe='/')}@{quote(version, safe='')}"
        if purl in seen:
            continue
        seen.add(purl)
        component: dict = {
            "type": "library",
            "name": name,
            "version": version,
            "bom-ref": purl,
            "purl": purl,
        }
        hashes = integrity_hash(info.get("integrity"))
        if hashes:
            component["hashes"] = hashes
        license_value = info.get("license")
        if isinstance(license_value, str) and license_value.strip():
            component["licenses"] = [{"expression": license_value.strip()}]
        components.append(component)

    root = packages.get("", {}) if isinstance(packages.get("", {}), dict) else {}
    root_name = str(root.get("name") or lock.get("name") or args.lockfile.parent.name)
    root_version = str(root.get("version") or lock.get("version") or "0.0.0")

    bom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.6",
        "serialNumber": f"urn:uuid:{uuid.uuid4()}",
        "version": 1,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "component": {
                "type": "application",
                "name": root_name,
                "version": root_version,
            },
            "properties": [
                {"name": "standment:source", "value": str(args.lockfile)},
                {"name": "standment:generator", "value": "scripts/security/sbom_from_lock.py"},
            ],
        },
        "components": sorted(components, key=lambda c: (c["name"], c["version"])),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bom, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"CycloneDX SBOM: {len(components)} components -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
