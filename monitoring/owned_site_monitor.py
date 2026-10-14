from __future__ import annotations

import hashlib
import json
import ssl
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

TARGETS = (
    "https://kabeya-authorized-test-range.onrender.com/",
    "https://sustainaboy-works.onrender.com/about/",
)

MAX_PAGES_PER_TARGET = 20
MAX_BODY_BYTES = 300_000
TIMEOUT_SECONDS = 15
USER_AGENT = "MusicJapan-Owned-Test-Site-Audit/3.0"

SECURITY_HEADERS = (
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
)

PUBLIC_METADATA_PATHS = (
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/security.txt",
)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_title = False
        self.title = ""
        self.links: list[str] = []
        self.forms: list[dict[str, str]] = []
        self.scripts: list[str] = []
        self.generator = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self._in_title = True
        elif tag == "a" and values.get("href"):
            self.links.append(values["href"])
        elif tag == "form":
            self.forms.append({
                "method": (values.get("method") or "GET").upper(),
                "action": values.get("action") or "",
            })
        elif tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        elif tag == "meta" and values.get("name", "").lower() == "generator":
            self.generator = values.get("content", "")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


@dataclass(frozen=True)
class PageResult:
    row: dict[str, object]
    links: tuple[str, ...]


def origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def same_origin(base: str, candidate: str) -> str | None:
    resolved = urljoin(base, candidate)
    a = urlparse(base)
    b = urlparse(resolved)
    if b.scheme != "https" or b.netloc != a.netloc:
        return None
    return b._replace(fragment="").geturl()


def header_findings(headers: dict[str, str]) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for name in SECURITY_HEADERS:
        if not headers.get(name):
            findings.append({
                "severity": "low",
                "type": "missing_security_header",
                "detail": name,
            })
    return findings


def cookie_findings(headers: list[tuple[str, str]]) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for key, value in headers:
        if key.lower() != "set-cookie":
            continue
        lower = value.lower()
        cookie_name = value.split("=", 1)[0].strip() or "cookie"
        if "secure" not in lower:
            findings.append({"severity": "medium", "type": "cookie_without_secure", "detail": cookie_name})
        if "httponly" not in lower:
            findings.append({"severity": "low", "type": "cookie_without_httponly", "detail": cookie_name})
        if "samesite" not in lower:
            findings.append({"severity": "low", "type": "cookie_without_samesite", "detail": cookie_name})
    return findings


def technology_hints(headers: dict[str, str], parser: PageParser | None) -> list[str]:
    hints: set[str] = set()
    for key in ("server", "x-powered-by", "via"):
        if headers.get(key):
            hints.add(f"{key}:{headers[key]}")
    if parser and parser.generator:
        hints.add(f"generator:{parser.generator}")
    if parser:
        for src in parser.scripts:
            lower = src.lower()
            for token in ("next", "react", "vue", "angular", "jquery", "bootstrap", "vite"):
                if token in lower:
                    hints.add(f"script:{token}")
    return sorted(hints)


def fetch_page(url: str, expected_origin: str) -> PageResult:
    if origin(url) != expected_origin:
        raise ValueError("out_of_scope")

    request = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5",
        },
    )

    started = time.monotonic()
    try:
        response = urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS)
    except urllib.error.HTTPError as exc:
        response = exc

    with response:
        raw_headers = list(response.headers.items())
        headers = {key.lower(): value for key, value in raw_headers}
        body = response.read(MAX_BODY_BYTES)
        latency_ms = round((time.monotonic() - started) * 1000, 1)
        content_type = headers.get("content-type", "")
        parser: PageParser | None = None
        links: list[str] = []

        if "text/html" in content_type.lower():
            parser = PageParser()
            parser.feed(body.decode("utf-8", errors="replace"))
            for href in parser.links:
                resolved = same_origin(url, href)
                if resolved and resolved not in links:
                    links.append(resolved)

        findings = header_findings(headers)
        findings.extend(cookie_findings(raw_headers))

        return PageResult(
            row={
                "url": url,
                "status": getattr(response, "status", response.getcode()),
                "latency_ms": latency_ms,
                "content_type": content_type,
                "body_bytes_observed": len(body),
                "body_sha256": hashlib.sha256(body).hexdigest(),
                "title": parser.title.strip() if parser else "",
                "forms": parser.forms if parser else [],
                "technology_hints": technology_hints(headers, parser),
                "findings": findings,
            },
            links=tuple(links),
        )


def tls_posture(target_origin: str) -> dict[str, object]:
    parsed = urlparse(target_origin)
    host = parsed.hostname or ""
    context = ssl.create_default_context()
    with context.wrap_socket(__import__("socket").create_connection((host, 443), timeout=TIMEOUT_SECONDS), server_hostname=host) as sock:
        cert = sock.getpeercert()
    not_after = cert.get("notAfter")
    expires_at = ssl.cert_time_to_seconds(not_after) if not_after else None
    days_remaining = None
    if expires_at:
        days_remaining = round((expires_at - datetime.now(timezone.utc).timestamp()) / 86400, 1)
    return {
        "subject": cert.get("subject"),
        "issuer": cert.get("issuer"),
        "not_after": not_after,
        "days_remaining": days_remaining,
    }


def audit_target(seed: str) -> dict[str, object]:
    target_origin = origin(seed)
    queue: deque[str] = deque([seed])
    for path in PUBLIC_METADATA_PATHS:
        candidate = urljoin(target_origin + "/", path.lstrip("/"))
        if candidate not in queue:
            queue.append(candidate)

    visited: set[str] = set()
    pages: list[dict[str, object]] = []

    while queue and len(visited) < MAX_PAGES_PER_TARGET:
        url = queue.popleft()
        if url in visited:
            continue
        visited.add(url)
        try:
            result = fetch_page(url, target_origin)
            pages.append(result.row)
            for discovered in result.links:
                if discovered not in visited and discovered not in queue:
                    queue.append(discovered)
        except Exception as exc:
            pages.append({"url": url, "error": type(exc).__name__, "message": str(exc)[:200], "findings": []})

    all_findings: list[dict[str, str]] = []
    for page in pages:
        for finding in page.get("findings", []):
            if isinstance(finding, dict):
                all_findings.append(finding)

    counts: dict[str, int] = {}
    for finding in all_findings:
        key = finding.get("type", "other")
        counts[key] = counts.get(key, 0) + 1

    try:
        tls = tls_posture(target_origin)
    except Exception as exc:
        tls = {"error": type(exc).__name__, "message": str(exc)[:200]}

    return {
        "seed": seed,
        "origin": target_origin,
        "scope": {
            "live_network": True,
            "same_origin_links_only": True,
            "methods": ["GET"],
            "max_pages": MAX_PAGES_PER_TARGET,
        },
        "pages_checked": len(pages),
        "finding_counts": dict(sorted(counts.items())),
        "tls": tls,
        "pages": pages,
    }


def main() -> None:
    report = {
        "schema": "owned-test-site-defensive-audit/v3",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "targets": [audit_target(seed) for seed in TARGETS],
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True)
    Path("owned-site-monitor-report.json").write_text(rendered, encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
