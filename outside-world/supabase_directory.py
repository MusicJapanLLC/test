#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def fetch_rows(url: str, key: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({
        "select": "resident_key,display_name,role,unit,identity_class,personality,active,source_updated_at",
        "active": "eq.true",
        "order": "resident_key.asc",
        "limit": "1000",
    })
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/world_reality_directory?{query}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "TheWorld-RealityAgency/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("Supabase directory did not return a list")
    return data


def to_snapshot(rows: list[dict[str, Any]]) -> dict[str, Any]:
    citizens = []
    for row in rows:
        cid = str(row.get("resident_key") or "").strip()
        if not cid:
            continue
        citizens.append({
            "citizen_id": cid,
            "display_name": row.get("display_name") or cid,
            "source_id": "SUPABASE_WORLD_RESIDENTS",
            "source_path": "public.world_reality_directory",
            "population_class": row.get("identity_class") or "world_resident",
            "group": row.get("unit") or "GENERAL",
            "role": row.get("role") or "resident",
            "runtime_id": None,
            "economy_account_key": None,
            "personality": row.get("personality") or {},
            "social_profile": {},
            "source_updated_at": row.get("source_updated_at"),
        })
    return {
        "schema": "the-world-citizen-snapshot/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "population": len(citizens),
        "source_counts": {"SUPABASE_WORLD_RESIDENTS": len(citizens)},
        "citizens": citizens,
        "relationship_seeds": [],
        "invariants": {
            "source_registries_keep_ownership": True,
            "supabase_is_canonical_identity_source": True,
        },
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=os.getenv("SUPABASE_URL", ""))
    p.add_argument("--key", default=os.getenv("SUPABASE_PUBLISHABLE_KEY", ""))
    p.add_argument("--out", default="world-citizens.json")
    p.add_argument("--require-min", type=int, default=1)
    args = p.parse_args()

    if not args.url or not args.key:
        raise SystemExit("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing")
    rows = fetch_rows(args.url, args.key)
    snapshot = to_snapshot(rows)
    if snapshot["population"] < args.require_min:
        raise SystemExit(f"canonical population too small: {snapshot['population']} < {args.require_min}")
    Path(args.out).write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"population": snapshot["population"], "source": "Supabase/public.world_reality_directory"}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
