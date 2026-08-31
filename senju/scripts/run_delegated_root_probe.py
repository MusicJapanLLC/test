#!/usr/bin/env python3
"""Use a persisted META/X/SENJU delegated root for one bounded live HEAD probe."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.meta.delegated_root_factory import probe_delegated_root  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--root-id", required=True)
    parser.add_argument("--out")
    args = parser.parse_args()

    result = probe_delegated_root(args.state_dir, args.root_id)
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered + "\n", encoding="utf-8")

    receipt = result.get("receipt", {})
    host = str(result.get("host", "")).strip().lower().rstrip(".")
    contacted = {
        str(item).strip().lower().rstrip(".")
        for item in receipt.get("contacted_hosts", ())
        if str(item).strip()
    }
    ok = (
        result["scope_derived_from_root"] is True
        and result["live_external_io"] is True
        and result["method"] == "HEAD"
        and result["credential_scope"] == "none"
        and result["private_network"] is False
        and bool(host)
        and str(receipt.get("method", "")).upper() == "HEAD"
        and str(receipt.get("host", "")).lower().rstrip(".") == host
        and str(receipt.get("final_host", "")).lower().rstrip(".") == host
        and contacted == {host}
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
