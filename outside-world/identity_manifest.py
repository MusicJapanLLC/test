#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: str, default: Any) -> Any:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:28] or "resident"


def build(citizens: list[dict[str, Any]]) -> dict[str, Any]:
    identities = []
    for citizen in sorted(citizens, key=lambda c: str(c.get("citizen_id", ""))):
        cid = str(citizen.get("citizen_id", "resident"))
        short = hashlib.sha256(cid.encode()).hexdigest()[:6]
        handle = f"world-{slug(cid)}-{short}"
        identities.append({
            "citizen_id": cid,
            "display_name": citizen.get("display_name", cid),
            "agent_handle": handle,
            "identity_kind": "logical_agent_identity",
            "credential_refs": {},
            "session_refs": {},
            "capability_profile": "public_researcher",
            "external_accounts": [],
            "secret_material_stored_here": False,
        })
    return {
        "schema": "the-world-identity-manifest/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "population": len(identities),
        "identities": identities,
        "rules": {
            "one_logical_identity_per_citizen": True,
            "credentials_are_secret_references": True,
            "plaintext_passwords_in_repository": False,
            "account_creation_requires_explicit_capability": True,
        },
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--citizens", default="world-citizens.json")
    p.add_argument("--out", default="world-identities.json")
    args = p.parse_args()
    snapshot = load_json(args.citizens, {"citizens": []})
    manifest = build(snapshot.get("citizens", []))
    Path(args.out).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"identities": manifest["population"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
