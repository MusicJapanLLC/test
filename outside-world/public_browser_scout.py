#!/usr/bin/env python3
"""Public-browser executor for THE WORLD.

Uses a locally available Chrome/Chromium binary to open public pages in a real
headless browser, extracts public links/titles, and assigns observed evidence to
THE WORLD citizens. No authentication, posting, form submission, or credential
material is used.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

SOURCES = [
    {
        "id": "PUBLIC_WEB",
        "url": "https://news.ycombinator.com/",
        "selector": "span.titleline > a",
        "limit": 20,
    },
    {
        "id": "PUBLIC_GITHUB",
        "url": "https://github.com/trending",
        "selector": "article.Box-row h2 a",
        "limit": 20,
    },
    {
        "id": "PUBLIC_YOUTUBE",
        "url": "https://www.youtube.com/results?search_query=AI+agent+engineering+research",
        "selector": "a#video-title",
        "limit": 20,
    },
]


def find_browser() -> str:
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            return path
    raise RuntimeError("No Chrome/Chromium executable found on runner")


def dump_dom(browser: str, url: str, timeout: int = 35) -> str:
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-first-run",
        "--virtual-time-budget=7000",
        "--dump-dom",
        url,
    ]
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"browser exited {proc.returncode}: {proc.stderr[-500:]}")
    if not proc.stdout.strip():
        raise RuntimeError("browser returned an empty DOM")
    return proc.stdout


def extract(source: dict, dom: str) -> list[dict]:
    soup = BeautifulSoup(dom, "html.parser")
    rows: list[dict] = []
    seen: set[str] = set()
    for a in soup.select(source["selector"]):
        text = " ".join(a.get_text(" ", strip=True).split())
        href = (a.get("href") or "").strip()
        if not text or not href:
            continue
        url = urljoin(source["url"], href)
        if not url.startswith(("http://", "https://")) or url in seen:
            continue
        seen.add(url)
        rows.append({"source_id": source["id"], "title": text[:300], "url": url})
        if len(rows) >= int(source.get("limit", 20)):
            break
    return rows


def preferred_source(lane: str) -> str:
    if lane == "PUBLIC_GITHUB":
        return "PUBLIC_GITHUB"
    if lane == "PUBLIC_YOUTUBE":
        return "PUBLIC_YOUTUBE"
    return "PUBLIC_WEB"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--plan", default="outside-world-presence-plan.json")
    p.add_argument("--json", default="outside-world-browser-evidence.json")
    p.add_argument("--report", default="outside-world-browser-report.md")
    args = p.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    browser = find_browser()
    observed_at = datetime.now(timezone.utc).isoformat()
    observations: list[dict] = []
    source_status: list[dict] = []

    for source in SOURCES:
        try:
            dom = dump_dom(browser, source["url"])
            rows = extract(source, dom)
            observations.extend(rows)
            source_status.append({"source_id": source["id"], "ok": bool(rows), "count": len(rows)})
        except Exception as exc:
            source_status.append({"source_id": source["id"], "ok": False, "count": 0, "error": str(exc)[:500]})

    by_source: dict[str, list[dict]] = {}
    for row in observations:
        by_source.setdefault(row["source_id"], []).append(row)

    assignments: list[dict] = []
    fallback = observations
    for index, mission in enumerate(plan.get("missions") or []):
        pool = by_source.get(preferred_source(str(mission.get("lane")))) or fallback
        evidence = pool[index % len(pool)] if pool else None
        assignments.append({
            "mission_id": mission.get("mission_id"),
            "citizen_id": mission.get("citizen_id"),
            "lane": mission.get("lane"),
            "observed_at": observed_at,
            "evidence": evidence,
            "status": "OBSERVED" if evidence else "NO_PUBLIC_EVIDENCE",
        })

    result = {
        "schema": "the-world-public-browser-evidence/v1",
        "generated_at": observed_at,
        "browser": Path(browser).name,
        "source_status": source_status,
        "observations": observations,
        "assignments": assignments,
        "citizens_assigned": len(assignments),
        "citizens_with_evidence": sum(1 for x in assignments if x["evidence"]),
    }
    Path(args.json).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# THE WORLD — Public Browser Scout",
        "",
        f"- Browser: `{result['browser']}`",
        f"- Citizens assigned: **{result['citizens_assigned']}**",
        f"- Citizens with observed evidence: **{result['citizens_with_evidence']}**",
        f"- Unique public observations: **{len(observations)}**",
        "",
        "## Sources",
    ]
    for s in source_status:
        state = "OK" if s["ok"] else "FAILED"
        lines.append(f"- {s['source_id']}: {state} ({s['count']})")
        if s.get("error"):
            lines.append(f"  - {s['error']}")
    lines += ["", "## Sample evidence"]
    for row in observations[:12]:
        lines.append(f"- [{row['source_id']}] {row['title']} — {row['url']}")
    Path(args.report).write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({
        "browser": result["browser"],
        "observations": len(observations),
        "citizens_assigned": result["citizens_assigned"],
        "citizens_with_evidence": result["citizens_with_evidence"],
        "source_status": source_status,
    }, ensure_ascii=False))
    if not observations:
        raise RuntimeError("No public browser evidence collected from any source")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
