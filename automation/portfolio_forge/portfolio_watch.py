#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib import request, error


@dataclass
class Check:
    name: str
    url: str
    ok: bool
    status: int | None
    latency_ms: int | None
    bytes_read: int
    error: str | None
    score: int


def fetch(name: str, url: str, timeout: float = 15.0) -> Check:
    started = time.perf_counter()
    req = request.Request(
        url,
        headers={
            "User-Agent": "THE-WORLD-Portfolio-Forge/1.0",
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
        method="GET",
    )
    try:
        with request.urlopen(req, timeout=timeout) as res:
            body = res.read(512_000)
            latency_ms = int((time.perf_counter() - started) * 1000)
            status = int(getattr(res, "status", 200))
            ok = 200 <= status < 400 and len(body) > 200
            score = 100
            if not ok:
                score = 0
            elif latency_ms > 5000:
                score -= 35
            elif latency_ms > 2500:
                score -= 20
            elif latency_ms > 1200:
                score -= 10
            if len(body) < 1500:
                score -= 10
            return Check(name, url, ok, status, latency_ms, len(body), None, max(score, 0))
    except error.HTTPError as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return Check(name, url, False, int(exc.code), latency_ms, 0, f"HTTPError:{exc.code}", 0)
    except Exception as exc:  # network evidence only; do not expose sensitive internals
        latency_ms = int((time.perf_counter() - started) * 1000)
        return Check(name, url, False, None, latency_ms, 0, type(exc).__name__, 0)


def priority(check: Check) -> str:
    if not check.ok:
        return "P0 production health"
    if check.score < 70:
        return "P2 reliability/performance"
    if check.score < 90:
        return "P6 performance/UX"
    return "HEALTHY"


def build_report(checks: list[Check]) -> dict:
    avg = round(sum(c.score for c in checks) / len(checks), 1) if checks else 0.0
    failures = [c for c in checks if not c.ok]
    weakest = min(checks, key=lambda c: c.score) if checks else None
    return {
        "schema": "the-world.portfolio-watch.v1",
        "generated_at_epoch": int(time.time()),
        "portfolio_score": avg,
        "healthy": len(checks) - len(failures),
        "failed": len(failures),
        "checks": [asdict(c) | {"priority": priority(c)} for c in checks],
        "next_focus": (
            {
                "name": weakest.name,
                "url": weakest.url,
                "priority": priority(weakest),
                "reason": (
                    weakest.error
                    or f"score={weakest.score}, latency_ms={weakest.latency_ms}, bytes={weakest.bytes_read}"
                ),
            }
            if weakest
            else None
        ),
        "material_delta": bool(failures or (weakest and weakest.score < 90)),
    }


def markdown(report: dict) -> str:
    lines = [
        "# THE WORLD Portfolio Forge — Live Evidence",
        "",
        f"- portfolio score: **{report['portfolio_score']} / 100**",
        f"- healthy: **{report['healthy']}**",
        f"- failed: **{report['failed']}**",
        "",
        "## Live checks",
    ]
    for c in report["checks"]:
        icon = "✅" if c["ok"] else "❌"
        lines.append(
            f"- {icon} **{c['name']}** — status={c['status']} / latency={c['latency_ms']}ms / score={c['score']} / {c['priority']}"
        )
    nf = report.get("next_focus")
    if nf:
        lines += [
            "",
            "## Next highest-value focus",
            f"- product: **{nf['name']}**",
            f"- priority: **{nf['priority']}**",
            f"- reason: `{nf['reason']}`",
            f"- live: {nf['url']}",
        ]
    lines += [
        "",
        "> This probe is evidence-only. A healthy GET is not proof that every AI action works; downstream Forge/agent runs must verify core actions before claiming improvement.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", default="portfolio-watch.json")
    p.add_argument("--markdown", default="portfolio-watch.md")
    args = p.parse_args()

    targets = [
        ("Music Japan AI", "https://test-musicjapanllc.vercel.app/?utm_source=github-portfolio-forge"),
        ("Standment Personal AI Core", "https://standment-personal-ai-core-se1c3z.v2.appdeploy.ai/"),
    ]
    checks = [fetch(name, url) for name, url in targets]
    report = build_report(checks)
    Path(args.json).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.markdown).write_text(markdown(report), encoding="utf-8")
    print(markdown(report))
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
