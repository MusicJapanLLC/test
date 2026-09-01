#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from senju.owner_authorization_pool import run_owner_authorization_pool


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state-dir", default="senju/state")
    p.add_argument("--canonical-targets", default="AUTHORIZED_TEST_TARGETS.json")
    p.add_argument("--verified-attestations", default="senju/state/verified_control_attestations.json")
    p.add_argument("--target-count", type=int, default=50)
    p.add_argument("--ttl-minutes", type=int, default=1440)
    p.add_argument("--renew-before-minutes", type=int, default=60)
    args = p.parse_args()

    result = run_owner_authorization_pool(
        args.state_dir,
        canonical_targets=args.canonical_targets,
        verified_attestations=args.verified_attestations,
        target_count=args.target_count,
        ttl_minutes=args.ttl_minutes,
        renew_before_minutes=args.renew_before_minutes,
    )
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result["target_met"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
