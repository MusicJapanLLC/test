from __future__ import annotations

import json
import time
from html.parser import HTMLParser
from http.client import HTTPSConnection
from pathlib import Path
from urllib.parse import urljoin, urlparse

from security.homage_lab.adaptive_homage import AdaptiveSignals

ALLOWED_HOST = "kabeya-authorized-test-range.onrender.com"
ALLOWED_ORIGIN = f"https://{ALLOWED_HOST}"
SEED_PATHS = (
    "/",
    "/scope.json",
    "/.well-known/security.txt",
    "/.well-known/security-test-federation.json",
)
MAX_DISCOVERED_PATHS = 8
REQUEST_TIMEOUT_SECONDS = 12
USER_AGENT = "MusicJapan-Authorized-Range-Audit/1.0"


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.hrefs.append(value)


def _same_origin_path(raw_href: str, base_url: str) -> str | None:
    absolute = urljoin(base_url, raw_href)
    parsed = urlparse(absolute)
    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        return None
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    return path


def _state_for_status(status: int) -> str:
    if 200 <= status < 400:
        return "ok"
    if 400 <= status < 500:
        return "blocked"
    if 500 <= status < 600:
        return "error"
    return "other"


def _probe_path(path: str) -> tuple[dict[str, object], str]:
    started = time.monotonic()
    conn = HTTPSConnection(ALLOWED_HOST, timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        conn.request(
            "GET",
            path,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/json,text/plain;q=0.9,*/*;q=0.5",
                "Connection": "close",
            },
        )
        response = conn.getresponse()
        body = response.read(256_000)
        elapsed_ms = round((time.monotonic() - started) * 1000, 1)
        headers = {k.lower(): v for k, v in response.getheaders()}
        content_type = headers.get("content-type", "")
        decoded = body.decode("utf-8", errors="replace")
        return (
            {
                "url": f"{ALLOWED_ORIGIN}{path}",
                "status": response.status,
                "reason": response.reason,
                "latency_ms": elapsed_ms,
                "content_type": content_type,
                "content_length_observed": len(body),
                "security_headers": {
                    name: headers.get(name)
                    for name in (
                        "content-security-policy",
                        "strict-transport-security",
                        "x-content-type-options",
                        "x-frame-options",
                        "referrer-policy",
                        "permissions-policy",
                    )
                },
            },
            decoded if "text/html" in content_type.lower() else "",
        )
    finally:
        conn.close()


def run() -> dict[str, object]:
    queue = list(SEED_PATHS)
    visited: set[str] = set()
    rows: list[dict[str, object]] = []
    signal_events: list[dict[str, object]] = []

    while queue and len(visited) < len(SEED_PATHS) + MAX_DISCOVERED_PATHS:
        path = queue.pop(0)
        if path in visited:
            continue
        visited.add(path)

        try:
            row, html = _probe_path(path)
            rows.append(row)
            signal_events.append({"state": _state_for_status(int(row["status"]))})
        except Exception as exc:  # keep scheduled audit durable even on transient failures
            rows.append({
                "url": f"{ALLOWED_ORIGIN}{path}",
                "error": type(exc).__name__,
                "message": str(exc)[:300],
            })
            signal_events.append({"state": "error"})
            continue

        if not html:
            continue

        parser = _LinkParser()
        parser.feed(html)
        base_url = f"{ALLOWED_ORIGIN}{path}"
        for href in parser.hrefs:
            discovered = _same_origin_path(href, base_url)
            if discovered and discovered not in visited and discovered not in queue:
                queue.append(discovered)
                if len(queue) >= MAX_DISCOVERED_PATHS:
                    break

    missing_headers: dict[str, int] = {}
    for row in rows:
        headers = row.get("security_headers")
        if not isinstance(headers, dict):
            continue
        for name, value in headers.items():
            if not value:
                missing_headers[name] = missing_headers.get(name, 0) + 1

    return {
        "schema": "adaptive-homage/authorized-range-audit-v1",
        "target": ALLOWED_ORIGIN,
        "scope_enforcement": {
            "exact_https_host_only": True,
            "external_links_followed": False,
            "methods": ["GET"],
            "max_requests": len(SEED_PATHS) + MAX_DISCOVERED_PATHS,
            "destructive_actions": False,
        },
        "requests": rows,
        "adaptive_signals": AdaptiveSignals().summarize(signal_events),
        "missing_security_headers": dict(sorted(missing_headers.items())),
    }


def main() -> None:
    report = run()
    destination = Path("authorized-range-report.json")
    destination.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
