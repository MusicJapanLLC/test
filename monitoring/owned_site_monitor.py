from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from html.parser import HTMLParser

URLS = (
    "https://kabeya-authorized-test-range.onrender.com/",
    "https://sustainaboy-works.onrender.com/about/",
)


class TitleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_title = False
        self.title = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def check(url: str) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "MusicJapan-Owned-Site-Monitor/1.0"},
        method="GET",
    )
    started = time.monotonic()
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read(256_000)
        elapsed_ms = round((time.monotonic() - started) * 1000, 1)
        text = body.decode("utf-8", errors="replace")
        parser = TitleParser()
        parser.feed(text)
        headers = {k.lower(): v for k, v in response.headers.items()}
        return {
            "url": url,
            "status": response.status,
            "latency_ms": elapsed_ms,
            "title": parser.title.strip(),
            "body_sha256": hashlib.sha256(body).hexdigest(),
            "content_type": headers.get("content-type"),
            "headers": {
                "content-security-policy": headers.get("content-security-policy"),
                "strict-transport-security": headers.get("strict-transport-security"),
                "x-content-type-options": headers.get("x-content-type-options"),
                "x-frame-options": headers.get("x-frame-options"),
                "referrer-policy": headers.get("referrer-policy"),
            },
        }


def main() -> None:
    results: list[dict[str, object]] = []
    for url in URLS:
        try:
            results.append(check(url))
        except Exception as exc:
            results.append({"url": url, "error": type(exc).__name__, "message": str(exc)[:300]})
    print(json.dumps({"schema": "owned-site-monitor/v1", "results": results}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
