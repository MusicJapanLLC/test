#!/usr/bin/env python3
"""Validation for THE CHAPEL manual ritual records.

The goal is to prevent empty or malformed confession/rest/conflict records from
being treated as meaningful company memory. Validation is intentionally small,
deterministic, and side-effect free.
"""
from __future__ import annotations

import argparse
import re

ALLOWED_TYPES = {"confession", "rest", "conflict", "gratitude"}
MAX_AGENT_LEN = 80
MAX_DETAILS_LEN = 8000
MIN_DETAILS_LEN = 12


def validate_record(kind: str, agent: str, details: str) -> list[str]:
    errors: list[str] = []
    kind = (kind or "").strip().lower()
    agent = (agent or "").strip()
    details = (details or "").strip()

    if kind not in ALLOWED_TYPES:
        errors.append(f"unsupported event_type: {kind or '<empty>'}")

    if not agent:
        errors.append("agent is required")
    elif len(agent) > MAX_AGENT_LEN:
        errors.append(f"agent exceeds {MAX_AGENT_LEN} characters")
    elif re.search(r"[\r\n\x00]", agent):
        errors.append("agent contains forbidden control/newline characters")

    if len(details) < MIN_DETAILS_LEN:
        errors.append(f"details must contain at least {MIN_DETAILS_LEN} non-whitespace characters")
    if len(details) > MAX_DETAILS_LEN:
        errors.append(f"details exceeds {MAX_DETAILS_LEN} characters")
    if "\x00" in details:
        errors.append("details contains NUL")

    return errors


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--kind", required=True)
    p.add_argument("--agent", required=True)
    p.add_argument("--details", required=True)
    args = p.parse_args()

    errors = validate_record(args.kind, args.agent, args.details)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 2
    print("ritual_record=VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
