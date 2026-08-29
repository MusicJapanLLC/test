#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: str, default: Any) -> Any:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def compact(value: str, limit: int = 900) -> str:
    return re.sub(r"\s+", " ", value or "").strip()[:limit]


def pick_findings(observations: list[dict[str, Any]], limit: int = 6) -> list[dict[str, Any]]:
    good = [o for o in observations if o.get("status") == "OK" and o.get("title")]
    good.sort(key=lambda o: (str(o.get("category", "")) in {"research", "builders", "weird-tech"}, len(o.get("text", ""))), reverse=True)
    findings = []
    for o in good[:limit]:
        findings.append({
            "task_id": o.get("task_id"),
            "citizen_id": o.get("citizen_id"),
            "display_name": o.get("display_name"),
            "category": o.get("category"),
            "title": compact(str(o.get("title", "")), 260),
            "url": str(o.get("final_url") or o.get("requested_url") or ""),
            "note": compact(str(o.get("text", "")), 900),
        })
    return findings


def render(findings: list[dict[str, Any]], observed: int) -> str:
    lines = [
        "# THE WORLD — REALITY FIELD REPORT",
        "",
        f"- observed pages: **{observed}**",
        f"- usable findings: **{len(findings)}**",
        f"- generated: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]
    for i, item in enumerate(findings, 1):
        lines.extend([
            f"## {i}. {item['title']}",
            f"- citizen: `{item['citizen_id']}` / {item.get('display_name') or ''}",
            f"- category: `{item.get('category') or 'misc'}`",
            f"- source: {item['url']}",
            f"- field note: {item['note']}",
            "",
        ])
    if not findings:
        lines.append("No usable public-page finding in this pulse. The next citizens continue the round-robin patrol.\n")
    return "\n".join(lines)


def post_json(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> tuple[int, str]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **(headers or {})}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as res:
        return int(res.status), res.read(2048).decode("utf-8", "replace")


def post_slack(text: str, policy: dict[str, Any]) -> dict[str, Any]:
    allowed = (policy.get("allowlists") or {}).get("slack_webhook_secret_names") or []
    for secret_name in allowed:
        url = os.getenv(secret_name, "").strip()
        if url:
            status, _ = post_json(url, {"text": text[:3500]})
            return {"kind": "slack", "secret_ref": secret_name, "status": status}
    return {"kind": "slack", "status": "SKIPPED_NO_CAPABILITY"}


def create_daily_issue(finding: dict[str, Any], policy: dict[str, Any], previous: dict[str, Any]) -> dict[str, Any]:
    repo = os.getenv("GITHUB_REPOSITORY", "").strip()
    token = os.getenv("GITHUB_TOKEN", "").strip()
    allowed = (policy.get("allowlists") or {}).get("github_repositories") or []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not repo or repo not in allowed or not token:
        return {"kind": "github_issue", "status": "SKIPPED_NO_CAPABILITY"}
    if today in set(previous.get("github_issue_days") or []):
        return {"kind": "github_issue", "status": "SKIPPED_DAILY_LIMIT"}

    title = f"WORLD FIELD NOTE {today} — {finding['title'][:120]}"
    body = (
        "Automated field note from THE WORLD reality agency.\n\n"
        f"- citizen: `{finding['citizen_id']}` / {finding.get('display_name') or ''}\n"
        f"- category: `{finding.get('category') or 'misc'}`\n"
        f"- source: {finding['url']}\n\n"
        "## Observation\n"
        f"{finding['note']}\n\n"
        "## Next use\n"
        "Treat this as external evidence/inspiration. Validate before promoting it into an implementation or R&D directive.\n"
    )
    status, response = post_json(
        f"https://api.github.com/repos/{repo}/issues",
        {"title": title, "body": body, "labels": ["world-field-note"]},
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "TheWorld-RealityGateway/1.0",
        },
    )
    issue = json.loads(response) if response else {}
    return {"kind": "github_issue", "status": status, "number": issue.get("number"), "url": issue.get("html_url"), "day": today}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--observations", default="reality-observations.json")
    p.add_argument("--policy", default="outside-world/reality_policy.json")
    p.add_argument("--previous", default="reality-gateway-previous.json")
    p.add_argument("--report", default="reality-field-report.md")
    p.add_argument("--events", default="reality-events.json")
    p.add_argument("--state", default="reality-gateway-state.json")
    p.add_argument("--execute-owned-writes", action="store_true")
    args = p.parse_args()

    doc = load_json(args.observations, {"observations": []})
    policy = load_json(args.policy, {})
    previous = load_json(args.previous, {})
    observations = doc.get("observations", [])
    findings = pick_findings(observations)
    report = render(findings, len(observations))
    Path(args.report).write_text(report, encoding="utf-8")

    effects: list[dict[str, Any]] = []
    if args.execute_owned_writes and findings:
        summary = "*THE WORLD / REALITY PULSE*\n" + "\n".join(
            f"• {f.get('display_name') or f['citizen_id']}: {f['title']}\n  {f['url']}" for f in findings[:4]
        )
        try:
            effects.append(post_slack(summary, policy))
        except Exception as exc:
            effects.append({"kind": "slack", "status": "ERROR", "error": type(exc).__name__})
        try:
            effects.append(create_daily_issue(findings[0], policy, previous))
        except Exception as exc:
            effects.append({"kind": "github_issue", "status": "ERROR", "error": type(exc).__name__})

    event_doc = {
        "schema": "the-world-reality-events/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "findings": findings,
        "effects": effects,
    }
    Path(args.events).write_text(json.dumps(event_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    days = list(previous.get("github_issue_days") or [])
    for effect in effects:
        if effect.get("kind") == "github_issue" and isinstance(effect.get("status"), int) and 200 <= effect["status"] < 300 and effect.get("day"):
            days.append(effect["day"])
    state = {
        "schema": "the-world-reality-gateway-state/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "github_issue_days": list(dict.fromkeys(days))[-45:],
        "last_effects": effects,
    }
    Path(args.state).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"findings": len(findings), "effects": effects}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
