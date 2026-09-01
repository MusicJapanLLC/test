#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exchange", type=Path, default=Path("senju/state/red_negotiation_exchange.json"))
    parser.add_argument(
        "--inbox",
        type=Path,
        default=Path("senju/state/authorized-host-promotion/negotiator_inbox.json"),
    )
    parser.add_argument("--max-records", type=int, default=200)
    args = parser.parse_args()

    exchange = _load(args.exchange, {})
    inbox = _load(args.inbox, {})
    existing = inbox.get("records", []) if isinstance(inbox, dict) else []
    if not isinstance(existing, list):
        existing = []
    incoming = exchange.get("records", []) if isinstance(exchange, dict) else []
    if not isinstance(incoming, list):
        incoming = []

    merged: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for raw in [*incoming, *existing]:
        if not isinstance(raw, dict):
            continue
        row = dict(raw)
        # This inbox is a negotiation-evidence channel, never a secret channel.
        row.pop("body", None)
        row.pop("headers", None)
        row.pop("cookies", None)
        row.pop("authorization", None)
        row["raw_credentials_forwarded"] = False
        key = (
            str(row.get("host", "")),
            str(row.get("source_ref", "")),
            str(row.get("reason", "")),
        )
        if not key[0] or key in seen:
            continue
        seen.add(key)
        merged.append(row)
        if len(merged) >= max(1, min(args.max_records, 1000)):
            break

    payload = {
        "schema": "senju-red-negotiator-inbox/v1",
        "producer": "SENJU_RED_NEGOTIATION_BRIDGE",
        "records": merged,
        "authority_effect": "none",
        "raw_credentials_forwarded": False,
    }
    args.inbox.parent.mkdir(parents=True, exist_ok=True)
    args.inbox.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"record_count": len(merged), "inbox": str(args.inbox)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
