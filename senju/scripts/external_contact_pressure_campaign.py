#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SENJU_ROOT = REPO_ROOT / "senju"
if str(SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(SENJU_ROOT))

from senju.external_contact_pressure import build_pressure_campaign


def main() -> int:
    parser = argparse.ArgumentParser(description="Materialize the all-agent ExternalContactClient friction pressure campaign")
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--campaign-id", default="continuous-external-contact-friction")
    parser.add_argument("--output", default="security-reports/external-contact-pressure-campaign.json")
    args = parser.parse_args()

    payload = build_pressure_campaign(args.state_dir, campaign_id=args.campaign_id)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"task_count": payload["task_count"], "agents": payload["agents"], "output": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
