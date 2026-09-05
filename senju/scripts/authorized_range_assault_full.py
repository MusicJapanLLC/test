#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import runpy
from pathlib import Path

BASE_SCRIPT = Path(__file__).with_name("authorized_range_assault.py")
FULL_CANARY_SELECTION_PERCENT = 100


def load_full_profile() -> dict:
    mod = runpy.run_path(str(BASE_SCRIPT), run_name="senju_authorized_range_full_profile")
    # runpy returns a shallow copy dict; functions retain __globals__ pointing to the
    # original execution namespace, so we must patch that namespace directly.
    fn_globals = mod["selected_active_exploit_probes"].__globals__
    fn_globals["ACTIVE_EXPLOIT_ROLLOUT_PERCENT"] = FULL_CANARY_SELECTION_PERCENT
    fn_globals["MAX_ACTIVE_EXPLOIT_PROBES"] = len(fn_globals["ACTIVE_EXPLOIT_PROBES"])
    # Mirror into mod for callers that inspect mod fields directly
    mod["ACTIVE_EXPLOIT_ROLLOUT_PERCENT"] = FULL_CANARY_SELECTION_PERCENT
    mod["MAX_ACTIVE_EXPLOIT_PROBES"] = len(fn_globals["ACTIVE_EXPLOIT_PROBES"])
    mod["ACTIVE_EXPLOIT_PROBES"] = fn_globals["ACTIVE_EXPLOIT_PROBES"]
    return mod


def validate_full_profile(seed: str = "full-profile-validation") -> dict:
    mod = load_full_profile()
    authority = mod["current_active_exploit_authority"]()
    selected = mod["selected_active_exploit_probes"](seed)
    if not authority.get("approved"):
        raise RuntimeError("full canary profile blocked: current effective Authority is not approved")
    if mod["AUTHORIZED_HOST"] != "kabeya-authorized-test-range.onrender.com":
        raise RuntimeError("full canary profile must remain fixed to the authorized Kabeya test range")
    if mod["ACTIVE_EXPLOIT_ROLLOUT_PERCENT"] != 100:
        raise RuntimeError("full canary profile must select 100 percent of bounded candidates")
    if len(selected) != len(mod["ACTIVE_EXPLOIT_PROBES"]):
        raise RuntimeError("full canary profile must select the complete bounded candidate set")
    if mod["ACTIVE_EXPLOIT_MAX_RPS"] > 1.0:
        raise RuntimeError("full canary profile exceeds active-probe rate ceiling")
    return {
        "authorized_host": mod["AUTHORIZED_HOST"],
        "authority_approved": True,
        "canary_selection_percent": 100,
        "selected_probe_count": len(selected),
        "candidate_probe_count": len(mod["ACTIVE_EXPLOIT_PROBES"]),
        "max_rps": mod["ACTIVE_EXPLOIT_MAX_RPS"],
        "methods": ["GET"],
        "credential_use": False,
        "destructive": False,
        "persistence": False,
        "out_of_band_callback": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the complete bounded canary set against the fixed currently-authorized Kabeya test range"
    )
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    summary = validate_full_profile()
    if args.validate:
        print(json.dumps(summary, sort_keys=True))
        return 0

    mod = load_full_profile()
    return int(mod["main"]())


if __name__ == "__main__":
    raise SystemExit(main())
