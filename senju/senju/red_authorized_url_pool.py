"""Build a rotating validation URL pool from already-authorized RED targets.

This module expands breadth *inside* existing exact-host Authorization. It never
turns a negotiation candidate into transport authority. The pool uses only HTTPS
URLs on authorized hosts and prioritizes URLs that RED actually observed before.

The pool is deliberately capped and read-oriented; it is a validation scheduler,
not a stress/load generator.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from pathlib import Path
from typing import Any, Mapping, Sequence

SCHEMA = "senju-red-authorized-url-pool/v1"
DEFAULT_POOL_SIZE = 100
STANDARD_PATHS = (
    "/",
    "/.well-known/security.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/manifest.json",
    "/health",
    "/status",
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if "://" in text:
        try:
            text = urllib.parse.urlsplit(text).hostname or ""
        except ValueError:
            return ""
    host = text.lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@* ") or "." not in host:
        return ""
    return host


def _clean_https_url(value: Any, allowed_hosts: set[str]) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = urllib.parse.urlsplit(text)
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        return None
    host = _host(parsed.hostname)
    if not host or host not in allowed_hosts:
        return None
    path = parsed.path or "/"
    return urllib.parse.urlunsplit(("https", host, path, parsed.query, ""))


def _observed_urls(report_paths: Sequence[str | Path], allowed_hosts: set[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in report_paths:
        report = _load(Path(raw), {})
        if not isinstance(report, Mapping):
            continue
        contacts = report.get("contacts", [])
        if not isinstance(contacts, list):
            continue
        for item in contacts:
            if not isinstance(item, Mapping):
                continue
            for candidate in (item.get("final_url"), item.get("url")):
                clean = _clean_https_url(candidate, allowed_hosts)
                if clean and clean not in seen:
                    seen.add(clean)
                    out.append(clean)
            links = item.get("discovered_links", [])
            if isinstance(links, list):
                for candidate in links:
                    clean = _clean_https_url(candidate, allowed_hosts)
                    if clean and clean not in seen:
                        seen.add(clean)
                        out.append(clean)
    return out


def build_authorized_url_pool(
    target_queue: str | Path,
    *,
    red_reports: Sequence[str | Path] = (),
    pool_size: int = DEFAULT_POOL_SIZE,
    rotation: int = 0,
    window_size: int = 24,
    now: int | None = None,
) -> dict[str, Any]:
    queue = _load(Path(target_queue), {})
    targets = queue.get("targets", []) if isinstance(queue, Mapping) else []
    target_rows = [row for row in targets if isinstance(row, Mapping)] if isinstance(targets, list) else []
    allowed_hosts = {_host(row.get("host")) for row in target_rows}
    allowed_hosts.discard("")

    desired = max(1, min(int(pool_size), 500))
    window = max(1, min(int(window_size), 40))
    seen: set[str] = set()
    urls: list[dict[str, Any]] = []

    def add(url: str, source: str, host: str, *, shared: bool) -> None:
        if len(urls) >= desired or url in seen:
            return
        seen.add(url)
        urls.append({
            "url": url,
            "host": host,
            "source": source,
            "shared_instance": shared,
            "method": "GET",
            "transport_allowed": True,
        })

    # Highest value: URLs RED already observed inside exact authorized hosts.
    for url in _observed_urls(red_reports, allowed_hosts):
        host = _host(url)
        target = next((row for row in target_rows if _host(row.get("host")) == host), {})
        add(url, "red_observed_same_host", host, shared=bool(target.get("shared_instance", False)))

    # Deterministic breadth: standard read-only paths across every authorized host.
    ordered_targets = sorted(target_rows, key=lambda row: (bool(row.get("shared_instance", False)), _host(row.get("host"))))
    for path in STANDARD_PATHS:
        for row in ordered_targets:
            host = _host(row.get("host"))
            if not host:
                continue
            base = str(row.get("seed_url") or f"https://{host}/")
            try:
                origin = urllib.parse.urlunsplit(("https", host, "/", "", ""))
                url = urllib.parse.urljoin(origin, path)
            except ValueError:
                continue
            clean = _clean_https_url(url, allowed_hosts)
            if clean:
                add(clean, "authorized_standard_path", host, shared=bool(row.get("shared_instance", False)))
            if len(urls) >= desired:
                break
        if len(urls) >= desired:
            break

    # If fewer than the requested count exist, keep the pool truthful rather than
    # fabricating new hosts or query permutations solely to hit a number.
    total = len(urls)
    start = 0 if total == 0 else (max(0, int(rotation)) * window) % total
    selected = []
    if total:
        for offset in range(min(window, total)):
            selected.append(urls[(start + offset) % total])

    generated = int(time.time()) if now is None else int(now)
    return {
        "schema": SCHEMA,
        "generated_at": generated,
        "authorized_host_count": len(allowed_hosts),
        "requested_pool_size": desired,
        "url_count": total,
        "pool_full": total >= desired,
        "rotation": int(rotation),
        "window_size": window,
        "urls": urls,
        "selected_urls": selected,
        "unknown_host_transport": False,
        "authorization_required_before_pool_entry": True,
    }


def write_authorized_url_pool(
    target_queue: str | Path,
    out: str | Path,
    *,
    red_reports: Sequence[str | Path] = (),
    pool_size: int = DEFAULT_POOL_SIZE,
    rotation: int = 0,
    window_size: int = 24,
) -> dict[str, Any]:
    result = build_authorized_url_pool(
        target_queue,
        red_reports=red_reports,
        pool_size=pool_size,
        rotation=rotation,
        window_size=window_size,
    )
    _write(Path(out), result)
    return result
