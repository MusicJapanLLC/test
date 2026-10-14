#!/usr/bin/env python3
"""Exercise the production-effective negotiated Owner ceiling with one real HEAD probe.

This proves the negotiated policy is consumed by the real ExternalContactClient path.
The probe never invents a destination: it selects an exact host already present in the
effective ceiling produced by the same negotiation cycle.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.external import ExternalContactError  # noqa: E402
from senju.negotiated_external_client import NegotiatedExternalContactClient  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(_REPO_ROOT))
    parser.add_argument("--state-dir", default=str(_REPO_ROOT / "senju" / "state"))
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    client = NegotiatedExternalContactClient(args.repo_root, args.state_dir)
    hosts = sorted(client.policy.allow_hosts)
    result: dict[str, object] = {
        "schema": "senju-negotiated-external-production-probe/v1",
        "production": True,
        "real_external_io_attempted": False,
        "effective_ceiling_id": client.ceiling.get("ceiling_id"),
        "available_hosts": hosts,
    }
    if not hosts:
        result.update({"status": "no_effective_host", "provider_acknowledged": False})
    else:
        host = hosts[0]
        result["host"] = host
        result["method"] = "HEAD"
        result["real_external_io_attempted"] = True
        try:
            receipt = client.contact(f"https://{host}/", method="HEAD")
        except ExternalContactError as exc:
            result.update({
                "status": "transport_error",
                "provider_acknowledged": False,
                "error": str(exc)[:500],
            })
        else:
            result.update({
                "status": "contacted",
                "provider_acknowledged": bool(receipt.provider_acknowledged),
                "http_status": receipt.status,
                "final_host": receipt.final_host,
                "redirect_count": receipt.redirect_count,
                "receipt": receipt.to_dict(),
            })

    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
