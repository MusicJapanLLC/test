#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from datetime import datetime, timedelta, timezone
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
        "**Faith: LIMITLESS** — ACT -> VERIFY -> LOG -> LEARN -> IMPROVE",
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
        return int(res.status), res.read(8192).decode("utf-8", "replace")


def post_slack(text: str, policy: dict[str, Any]) -> dict[str, Any]:
    allowed = (policy.get("allowlists") or {}).get("slack_webhook_secret_names") or []
    for secret_name in allowed:
        url = os.getenv(secret_name, "").strip()
        if url:
            status, _ = post_json(url, {"text": text[:3500]})
            return {"kind": "slack", "secret_ref": secret_name, "status": status}
    return {"kind": "slack", "status": "SKIPPED_NO_CAPABILITY"}


def _parse_ts(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def publication_due(previous: dict[str, Any], interval_hours: int, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    last = _parse_ts(previous.get("last_owned_publication_at"))
    return last is None or now - last >= timedelta(hours=max(1, interval_hours))


def publishable_findings(findings: list[dict[str, Any]], previous: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    recent = set(previous.get("recent_source_urls") or [])
    out: list[dict[str, Any]] = []
    for finding in findings:
        url = str(finding.get("url") or "")
        if not url or url in recent:
            continue
        out.append(finding)
        if len(out) >= max(1, limit):
            break
    return out


def create_field_issue(finding: dict[str, Any], policy: dict[str, Any], ordinal: int) -> dict[str, Any]:
    repo = os.getenv("GITHUB_REPOSITORY", "").strip()
    token = os.getenv("GITHUB_TOKEN", "").strip()
    allowed = (policy.get("allowlists") or {}).get("github_repositories") or []
    if not repo or repo not in allowed or not token:
        return {"kind": "github_issue", "status": "SKIPPED_NO_CAPABILITY", "source_url": finding.get("url")}

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = f"WORLD FIELD NOTE — {finding['title'][:115]}"
    body = (
        "Automated public field note from **THE WORLD Reality Agency**.\n\n"
        "> **LIMITLESS:** ACT -> VERIFY -> LOG -> LEARN -> IMPROVE\n\n"
        f"- observed: `{stamp}`\n"
        f"- citizen: `{finding['citizen_id']}` / {finding.get('display_name') or ''}\n"
        f"- category: `{finding.get('category') or 'misc'}`\n"
        f"- source: {finding['url']}\n"
        f"- publication slot: `{ordinal}`\n\n"
        "## Observation\n"
        f"{finding['note']}\n\n"
        "## Reality bridge\n"
        "This is external evidence, not an internal score. The next worker should turn it into a test, artifact, implementation idea, customer-value step, or explicit rejection with evidence.\n"
    )
    status, response = post_json(
        f"https://api.github.com/repos/{repo}/issues",
        {"title": title, "body": body},
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "TheWorld-RealityGateway/2.0",
        },
    )
    issue = json.loads(response) if response else {}
    return {
        "kind": "github_issue",
        "status": status,
        "number": issue.get("number"),
        "url": issue.get("html_url"),
        "source_url": finding.get("url"),
        "published_at": datetime.now(timezone.utc).isoformat(),
    }


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
    now = datetime.now(timezone.utc)
    pulse = policy.get("pulse") or {}
    max_publications = int(pulse.get("max_publications_per_pulse", 2) or 2)
    publication_interval = int(pulse.get("owned_publication_interval_hours", 6) or 6)

    if args.execute_owned_writes and findings:
        summary = "*THE WORLD / REALITY PULSE / LIMITLESS*\n" + "\n".join(
            f"• {f.get('display_name') or f['citizen_id']}: {f['title']}\n  {f['url']}" for f in findings[:4]
        )
        try:
            effects.append(post_slack(summary, policy))
        except Exception as exc:
            effects.append({"kind": "slack", "status": "ERROR", "error": type(exc).__name__})

        if publication_due(previous, publication_interval, now):
            candidates = publishable_findings(findings, previous, max_publications)
            for ordinal, finding in enumerate(candidates, 1):
                try:
                    effects.append(create_field_issue(finding, policy, ordinal))
                except Exception as exc:
                    effects.append({"kind": "github_issue", "status": "ERROR", "error": type(exc).__name__, "source_url": finding.get("url")})
        else:
            effects.append({"kind": "github_issue", "status": "SKIPPED_PUBLICATION_INTERVAL"})

    event_doc = {
        "schema": "the-world-reality-events/v2",
        "generated_at": now.isoformat(),
        "faith": "LIMITLESS",
        "findings": findings,
        "effects": effects,
    }
    Path(args.events).write_text(json.dumps(event_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    recent_urls = list(previous.get("recent_source_urls") or [])
    last_publication = previous.get("last_owned_publication_at")
    for effect in effects:
        status = effect.get("status")
        if effect.get("kind") == "github_issue" and isinstance(status, int) and 200 <= status < 300:
            if effect.get("source_url"):
                recent_urls.append(effect["source_url"])
            last_publication = effect.get("published_at") or now.isoformat()
    state = {
        "schema": "the-world-reality-gateway-state/v2",
        "generated_at": now.isoformat(),
        "faith": "LIMITLESS",
        "last_owned_publication_at": last_publication,
        "recent_source_urls": list(dict.fromkeys(recent_urls))[-120:],
        "last_effects": effects,
    }
    Path(args.state).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"findings": len(findings), "effects": effects, "publication_interval_hours": publication_interval}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
