from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from html import unescape
from typing import Callable, Iterable
from urllib.parse import urlparse

from .adaptive_homage import EvolutionLab


TARGETS = (
    "https://music-japan.com/",
    "https://partners.music-japan.com/",
    "https://secondtake.music-japan.com/",
    "https://baton.music-japan.com/",
)

ALLOWED_HOSTS = frozenset(urlparse(url).hostname for url in TARGETS)
SECURITY_HEADERS = (
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
)


@dataclass(frozen=True)
class Observation:
    url: str
    final_url: str
    status: int
    latency_ms: int
    content_type: str
    bytes_sampled: int
    title: str | None
    canonical: str | None
    has_json_ld: bool
    has_open_graph: bool
    has_noindex: bool
    security_headers: dict[str, bool]
    error: str | None = None


@dataclass(frozen=True)
class EndpointObservation:
    url: str
    status: int
    bytes_sampled: int
    error: str | None = None


class ScopeError(ValueError):
    pass


def _assert_owned_https(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise ScopeError(f"out-of-scope URL: {url}")
    if parsed.username or parsed.password:
        raise ScopeError("credentials in URL are forbidden")


def _extract(pattern: str, body: str) -> str | None:
    match = re.search(pattern, body, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    value = re.sub(r"\s+", " ", unescape(match.group(1))).strip()
    return value[:300] or None


class LiveSiteObserver:
    """Read-only observation of the four owned public production origins."""

    def __init__(self, timeout: float = 12.0, max_bytes: int = 262_144) -> None:
        self.timeout = timeout
        self.max_bytes = max_bytes

    def _request(self, url: str) -> tuple[int, str, dict[str, str], bytes, int]:
        _assert_owned_https(url)
        request = urllib.request.Request(
            url,
            method="GET",
            headers={
                "User-Agent": "MusicJapan-Adaptive-Homage/1.0 (+read-only-resilience)",
                "Accept": "text/html,text/plain,application/xml;q=0.9,*/*;q=0.1",
            },
        )
        started = time.perf_counter()
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            elapsed = round((time.perf_counter() - started) * 1000)
            final_url = response.geturl()
            _assert_owned_https(final_url)
            payload = response.read(self.max_bytes)
            headers = {key.lower(): value for key, value in response.headers.items()}
            return int(response.status), final_url, headers, payload, elapsed

    def observe(self, url: str) -> Observation:
        try:
            status, final_url, headers, payload, elapsed = self._request(url)
            body = payload.decode("utf-8", errors="replace")
            title = _extract(r"<title[^>]*>(.*?)</title>", body)
            canonical = _extract(r"<link[^>]+rel=[\"']canonical[\"'][^>]+href=[\"']([^\"']+)", body)
            if canonical is None:
                canonical = _extract(r"<link[^>]+href=[\"']([^\"']+)[\"'][^>]+rel=[\"']canonical[\"']", body)
            robots = _extract(r"<meta[^>]+name=[\"']robots[\"'][^>]+content=[\"']([^\"']+)", body) or ""
            return Observation(
                url=url,
                final_url=final_url,
                status=status,
                latency_ms=elapsed,
                content_type=headers.get("content-type", ""),
                bytes_sampled=len(payload),
                title=title,
                canonical=canonical,
                has_json_ld="application/ld+json" in body.lower(),
                has_open_graph="property=\"og:" in body.lower() or "property='og:" in body.lower(),
                has_noindex="noindex" in robots.lower(),
                security_headers={name: bool(headers.get(name)) for name in SECURITY_HEADERS},
            )
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ScopeError, OSError) as exc:
            status = int(getattr(exc, "code", 0) or 0)
            return Observation(
                url=url,
                final_url=url,
                status=status,
                latency_ms=0,
                content_type="",
                bytes_sampled=0,
                title=None,
                canonical=None,
                has_json_ld=False,
                has_open_graph=False,
                has_noindex=False,
                security_headers={name: False for name in SECURITY_HEADERS},
                error=f"{type(exc).__name__}: {exc}",
            )

    def observe_endpoint(self, url: str) -> EndpointObservation:
        try:
            status, _final_url, _headers, payload, _elapsed = self._request(url)
            return EndpointObservation(url=url, status=status, bytes_sampled=len(payload))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ScopeError, OSError) as exc:
            return EndpointObservation(
                url=url,
                status=int(getattr(exc, "code", 0) or 0),
                bytes_sampled=0,
                error=f"{type(exc).__name__}: {exc}",
            )


class LiveSignals:
    def summarize(self, observations: Iterable[Observation]) -> dict[str, object]:
        rows = list(observations)
        reachable = sum(200 <= row.status < 400 for row in rows)
        slow = sum(row.latency_ms >= 2500 for row in rows if row.latency_ms)
        missing_canonical = sum(row.canonical is None for row in rows if 200 <= row.status < 400)
        missing_json_ld = sum(not row.has_json_ld for row in rows if 200 <= row.status < 400)
        accidental_noindex = sum(row.has_noindex for row in rows if 200 <= row.status < 400)
        missing_headers = {
            header: sum(not row.security_headers.get(header, False) for row in rows if 200 <= row.status < 400)
            for header in SECURITY_HEADERS
        }
        recommendations: list[str] = []
        if reachable < len(rows):
            recommendations.append("restore unreachable production origin before changing presentation")
        if slow:
            recommendations.append("inspect slow origins and preserve the fastest successful response as baseline")
        if missing_canonical:
            recommendations.append("restore canonical metadata on reachable origins")
        if missing_json_ld:
            recommendations.append("restore structured data on reachable origins where intentionally published")
        if accidental_noindex:
            recommendations.append("review noindex on production roots")
        if any(missing_headers.values()):
            recommendations.append("review missing response security headers without changing application behavior")
        if not recommendations:
            recommendations.append("record current production behavior as the next regression baseline")
        return {
            "reachable": reachable,
            "total": len(rows),
            "slow": slow,
            "missing_canonical": missing_canonical,
            "missing_json_ld": missing_json_ld,
            "noindex_roots": accidental_noindex,
            "missing_security_headers": missing_headers,
            "recommendations": recommendations,
        }


class OwnedTopology:
    LINKS = {
        "music-japan.com": ("partners.music-japan.com", "secondtake.music-japan.com", "baton.music-japan.com"),
        "partners.music-japan.com": ("music-japan.com", "baton.music-japan.com"),
        "secondtake.music-japan.com": ("music-japan.com",),
        "baton.music-japan.com": ("music-japan.com", "partners.music-japan.com"),
    }

    def reachable(self, start: str) -> list[str]:
        if start not in self.LINKS:
            return []
        seen = {start}
        queue = [start]
        while queue:
            current = queue.pop(0)
            for nxt in self.LINKS.get(current, ()):
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
        return sorted(seen)

    def summarize(self) -> dict[str, object]:
        return {
            host: {
                "reachable": self.reachable(host),
                "coverage": round(len(self.reachable(host)) / len(self.LINKS), 3),
            }
            for host in sorted(self.LINKS)
        }


class LiveSiteHomageOrchestrator:
    def __init__(self, observer: LiveSiteObserver | None = None) -> None:
        self.observer = observer or LiveSiteObserver()

    def run(self, targets: Iterable[str] = TARGETS) -> dict[str, object]:
        selected = tuple(targets)
        for target in selected:
            _assert_owned_https(target)

        observations = [self.observer.observe(target) for target in selected]
        endpoint_checks: list[EndpointObservation] = []
        for target in selected:
            parsed = urlparse(target)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            endpoint_checks.append(self.observer.observe_endpoint(f"{origin}/robots.txt"))
            endpoint_checks.append(self.observer.observe_endpoint(f"{origin}/sitemap.xml"))

        evolution = EvolutionLab(population_size=48, generations=20, seed=952954956957958).evolve()
        signals = LiveSignals().summarize(observations)
        return {
            "schema": "live-site-homage/v1",
            "mode": "owned-production-read-only",
            "external_io": True,
            "mutation": False,
            "targets": list(selected),
            "phases": {
                "live_observation": [asdict(item) for item in observations],
                "discovery_endpoints": [asdict(item) for item in endpoint_checks],
                "evolution": evolution,
                "adaptive_signals": signals,
                "topology": OwnedTopology().summarize(),
            },
        }


def main() -> None:
    print(json.dumps(LiveSiteHomageOrchestrator().run(), indent=2, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
