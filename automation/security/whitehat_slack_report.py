#!/usr/bin/env python3
"""Render and optionally deliver the Standment white-hat portfolio delta report."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib import error, request


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def render(plan: dict, worker: dict, bridge: dict) -> str:
    proposed = worker.get("proposed_change") or {}
    track = plan.get("security_track") or {}
    evidence = ", ".join(worker.get("evidence_refs") or []) or "NONE"
    tests = " / ".join(proposed.get("tests") or []) or "NOT DEFINED"
    created = "NEW CANDIDATE" if bridge.get("created") else "EXISTING CANDIDATE REUSED"
    return f"""*STANDMENT SECURITY｜WHITE-HAT PORTFOLIO REPORT*

*WHAT CHANGED*
{created}: `{bridge.get('candidate_path')}`
White-hat candidate index: `{bridge.get('index_path')}`

*WHY IT MATTERS*
Adversarial R&D is forced into a portfolio contract: authorization -> safe reproduction -> remediation -> independent retest -> residual risk -> buyer-readable evidence.

*PORTFOLIO DELTA*
Track: `{track.get('id')}` — {track.get('title')}
Fingerprint: `{bridge.get('fingerprint')}`
Stage: `WHITEHAT_CANDIDATE / NOT VERIFIED`

*WHITE-HAT FINDING / HYPOTHESIS*
{worker.get('hypothesis')}

*RETEST STATUS*
NOT RUN by this bridge. Required tests: {tests}

*EVIDENCE REFERENCES*
{evidence}

*REAL-WORLD VALUE*
Standment can turn an internal security claim into evidence a buyer/operator can inspect: what boundary was challenged, what failed, how it is remediated, how the fix is retested, and what remains uncertain.

*TRUTH / LIMITATION*
No automatic VERIFIED promotion. This cycle is bounded to owned/explicitly-authorized scope and does not treat internal score, code existence, or agent confidence as customer proof.

*NEXT MOVE*
Execute the smallest authorized lab experiment for the selected track, preserve before/after evidence, then feed the verified delta into the main Portfolio Auto-Builder.
"""


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--plan", required=True)
    p.add_argument("--worker", required=True)
    p.add_argument("--bridge", required=True)
    p.add_argument("--out", default="reports/standment-security-rnd/whitehat-slack.md")
    args = p.parse_args()

    text = render(load(Path(args.plan)), load(Path(args.worker)), load(Path(args.bridge)))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(text)

    webhook = (os.getenv("PORTFOLIO_SLACK_WEBHOOK_URL", "").strip()
               or os.getenv("RND_SLACK_WEBHOOK_URL", "").strip())
    if not webhook:
        print("BLOCKED_NO_CAPABILITY: portfolio/R&D Slack webhook is not configured; GitHub evidence remains preserved.")
        return 0

    payload = json.dumps({"text": text[:30000]}, ensure_ascii=False).encode("utf-8")
    req = request.Request(webhook, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=15) as res:
            if not 200 <= res.status < 300:
                raise RuntimeError(f"HTTP {res.status}")
    except (error.URLError, RuntimeError) as exc:
        print(f"Slack delivery failed: {type(exc).__name__}")
        return 1
    print("White-hat portfolio report delivered to Slack.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
