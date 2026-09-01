#!/usr/bin/env python3
"""Build the SENJU RED authorized frontier and optionally exercise live read probes."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from senju.adversary_transport import AdversaryNetworkTransport, AdversaryTransportError
from senju.red_authorized_frontier import build_red_authorized_frontier


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _load_leases(state_dir: Path) -> list[dict[str, Any]]:
    try:
        doc = json.loads((state_dir / "red_authorized_transport_leases.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return []
    rows = doc.get("leases", []) if isinstance(doc, dict) else []
    return [dict(row) for row in rows if isinstance(row, dict)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("senju/state"))
    parser.add_argument("--canonical-targets", type=Path, default=Path("AUTHORIZED_TEST_TARGETS.json"))
    parser.add_argument("--max-hosts", type=int, default=128)
    parser.add_argument("--live-sample", type=int, default=0)
    parser.add_argument("--out", type=Path, default=Path("/tmp/red-authorized-frontier.json"))
    args = parser.parse_args()

    result = build_red_authorized_frontier(
        args.state_dir,
        canonical_targets=args.canonical_targets,
        max_hosts=args.max_hosts,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")

    sample = max(0, min(int(args.live_sample), 32))
    receipts: list[dict[str, Any]] = []
    leases = _load_leases(args.state_dir)
    if sample and leases:
        transport = AdversaryNetworkTransport(args.state_dir)
        targets = list(result.get("targets", []))[:sample]
        for target in targets:
            host = str(target.get("host") or "")
            url = str(target.get("base_url") or f"https://{host}/")
            methods = {str(v).upper() for v in target.get("allowed_methods", [])}
            if "HEAD" in methods:
                method = "HEAD"
            elif "GET" in methods:
                method = "GET"
            else:
                continue
            try:
                outcome = transport.execute(url, method=method, leases=leases)
                receipts.append(
                    {
                        "host": host,
                        "url": url,
                        "method": method,
                        "ok": True,
                        "status": outcome.receipt.status,
                        "lease_id": outcome.receipt.lease_id,
                        "authorization_reference": outcome.receipt.authorization_reference,
                        "response_bytes": outcome.receipt.response_bytes,
                    }
                )
            except AdversaryTransportError as exc:
                receipts.append(
                    {
                        "host": host,
                        "url": url,
                        "method": method,
                        "ok": False,
                        "error": str(exc),
                    }
                )

    live_doc = {
        "schema": "senju-red-authorized-live-sample/v1",
        "requested_sample": sample,
        "attempted_count": len(receipts),
        "success_count": sum(1 for row in receipts if row.get("ok") is True),
        "failure_count": sum(1 for row in receipts if row.get("ok") is not True),
        "receipts": receipts,
        "execution_boundary": "existing exact-host Authority; GET/HEAD only",
    }
    _write(args.state_dir / "red_authorized_live_sample.json", live_doc)
    print(json.dumps({**result, "live_sample": live_doc}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
