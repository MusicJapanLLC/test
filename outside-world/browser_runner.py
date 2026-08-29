#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def load_json(path: str, default: Any) -> Any:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def host_allowed(url: str, policy: dict[str, Any]) -> bool:
    host = (urlparse(url).hostname or "").lower().rstrip(".")
    if not host:
        return False
    allowed = (policy.get("allowlists") or {}).get("public_browser_hosts") or []
    return any(host == item or host.endswith("." + item) for item in allowed)


async def observe(page: Any, task: dict[str, Any]) -> dict[str, Any]:
    started = datetime.now(timezone.utc).isoformat()
    try:
        response = await page.goto(task["url"], wait_until="domcontentloaded", timeout=20_000)
        await page.wait_for_timeout(800)
        title = await page.title()
        final_url = page.url
        text = await page.locator("body").inner_text(timeout=7_000)
        links = await page.locator("a").evaluate_all(
            "els => els.slice(0, 40).map(a => ({text:(a.innerText||'').trim().slice(0,180), href:a.href||''})).filter(x => x.href)"
        )
        return {
            "task_id": task["task_id"],
            "citizen_id": task["citizen_id"],
            "display_name": task.get("display_name"),
            "role": task.get("role"),
            "group": task.get("group"),
            "category": task.get("category"),
            "target_id": task.get("target_id"),
            "requested_url": task["url"],
            "final_url": final_url,
            "http_status": response.status if response else None,
            "title": title[:300],
            "text": text[:12_000],
            "links": links[:40],
            "started_at": started,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "status": "OK",
        }
    except Exception as exc:
        return {
            "task_id": task.get("task_id"),
            "citizen_id": task.get("citizen_id"),
            "display_name": task.get("display_name"),
            "category": task.get("category"),
            "requested_url": task.get("url"),
            "started_at": started,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "status": "ERROR",
            "error": type(exc).__name__,
        }


async def run(tasks: list[dict[str, Any]], policy: dict[str, Any], limit: int, parallel: int = 4) -> list[dict[str, Any]]:
    from playwright.async_api import async_playwright

    selected = [t for t in tasks if t.get("action") == "public_web_observe" and host_allowed(str(t.get("url", "")), policy)][:limit]
    results: list[dict[str, Any]] = []
    semaphore = asyncio.Semaphore(max(1, parallel))

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="TheWorld-ResearchBrowser/1.1",
            viewport={"width": 1365, "height": 900},
            locale="ja-JP",
        )

        async def route_handler(route: Any) -> None:
            # Research pages are read as documents. Media playback is intentionally skipped.
            if route.request.resource_type in {"media", "font"}:
                await route.abort()
            else:
                await route.continue_()

        await context.route("**/*", route_handler)

        async def worker(task: dict[str, Any]) -> dict[str, Any]:
            async with semaphore:
                page = await context.new_page()
                try:
                    return await observe(page, task)
                finally:
                    await page.close()

        results = await asyncio.gather(*(worker(task) for task in selected))
        await context.close()
        await browser.close()
    return results


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--tasks", default="reality-tasks.json")
    p.add_argument("--policy", default="outside-world/reality_policy.json")
    p.add_argument("--out", default="reality-observations.json")
    p.add_argument("--limit", type=int, default=8)
    p.add_argument("--parallel", type=int, default=4)
    args = p.parse_args()

    task_doc = load_json(args.tasks, {"tasks": []})
    policy = load_json(args.policy, {})
    results = asyncio.run(run(task_doc.get("tasks", []), policy, max(1, args.limit), max(1, args.parallel)))
    out = {
        "schema": "the-world-browser-observations/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(results),
        "observations": results,
    }
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"observed": len(results), "ok": sum(1 for r in results if r.get('status') == 'OK'), "parallel": args.parallel}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
