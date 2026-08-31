from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

from engine.discovery_event_bus import publish_discovery_event

SCHEMA = "the-world-owner-authority-seed/v1"


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def seed_explicit_owner_authority(state_dir: str | Path, repo_root: str | Path) -> dict[str, Any]:
    state = Path(state_dir)
    root = Path(repo_root)
    state.mkdir(parents=True, exist_ok=True)

    source_policy = root / "automation" / "codegen" / "meta_state" / "discovery_policy.json"
    runtime_policy = state / "discovery_policy.json"
    shutil.copyfile(source_policy, runtime_policy)

    targets = _load(root / "AUTHORIZED_TEST_TARGETS.json")
    seeded: list[dict[str, str]] = []
    skipped = 0
    for raw in targets.get("targets", []):
        if not isinstance(raw, dict):
            continue
        # Seed only explicit authority roots themselves. Linked/external destinations are
        # never converted into roots here, even if other discovery evidence references them.
        if raw.get("owner_authorization") != "explicit" or raw.get("authorization_authority_root") is not True:
            skipped += 1
            continue
        base_url = str(raw.get("base_url", "")).strip()
        if not base_url.startswith("https://"):
            skipped += 1
            continue
        event = publish_discovery_event(
            state,
            actor="META/OWNER-SEED",
            url=base_url,
            source="explicit_owner_authority_seed",
            interesting=True,
            metadata={
                "owner_authorization": "explicit",
                "authorization_authority_root": True,
                "target_id": str(raw.get("id", "")),
                "synthetic_test_surface": True,
            },
        )
        seeded.append({"url": str(event["url"]), "host": str(event["host"])})

    payload = {
        "schema": SCHEMA,
        "production": True,
        "runtime_policy_synced": True,
        "seed_count": len(seeded),
        "seeds": seeded,
        "skipped_non_root_targets": skipped,
        "new_trust_roots_created": False,
        "authority_source": "AUTHORIZED_TEST_TARGETS explicit authority roots only",
    }
    (state / "the_world_owner_authority_seed.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed explicit owner authority roots into The World discovery loop")
    parser.add_argument("--state", required=True)
    parser.add_argument("--repo-root", required=True)
    args = parser.parse_args()
    payload = seed_explicit_owner_authority(args.state, args.repo_root)
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if payload["seed_count"] >= 1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
