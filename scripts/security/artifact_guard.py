#!/usr/bin/env python3
"""Inspect built frontend artifacts for accidental exposure and unsafe output.

The default ``prod`` profile remains fail-closed for HIGH findings. The explicit
``lab`` profile is intentionally more permissive for development-only artifact
noise (source maps, localhost references, mixed content and oversized WebGL
assets) while credential-like material and missing build output remain blocking.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SECRET_PATTERNS = {
    "github-token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})"),
    "openai-key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "slack-token": re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{20,}"),
}
TEXT_SUFFIXES = {".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".xml"}
WEBGL_ASSET_SUFFIXES = {".glb", ".gltf", ".hdr", ".ktx", ".ktx2", ".bin"}
LOCAL_URL = re.compile(r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[/\"'\s]|$)", re.IGNORECASE)
HTML_HTTP_URL = re.compile(r"(?:src|href|action|poster)\s*=\s*[\"'](http://[^\"']+)", re.IGNORECASE)
CSS_HTTP_URL = re.compile(r"url\(\s*[\"']?(http://[^)\"']+)", re.IGNORECASE)
XML_HTTP_LOC = re.compile(r"<loc>\s*(http://[^<\s]+)\s*</loc>", re.IGNORECASE)
JS_HTTP_URL = re.compile(r"(?:fetch\s*\(|new\s+URL\s*\(|\.src\s*=|\.href\s*=)\s*[\"'](http://[^\"']+)", re.IGNORECASE)

ALWAYS_BLOCK_RULE_PREFIXES = ("artifact.secret.",)
ALWAYS_BLOCK_RULES = {"artifact.dist-missing"}


def finding(severity: str, rule: str, path: Path, detail: str) -> dict[str, str]:
    return {"severity": severity, "rule": rule, "path": path.as_posix(), "detail": detail}


def profile_severity(profile: str, rule: str, severity: str) -> str:
    """Downgrade non-secret production noise only in explicit lab mode."""
    if profile != "lab" or severity != "HIGH":
        return severity
    if rule in ALWAYS_BLOCK_RULES or rule.startswith(ALWAYS_BLOCK_RULE_PREFIXES):
        return severity
    return "MEDIUM"


def insecure_runtime_urls(text: str, suffix: str) -> list[str]:
    if suffix in {".html", ".svg"}:
        return HTML_HTTP_URL.findall(text)
    if suffix == ".css":
        return CSS_HTTP_URL.findall(text)
    if suffix == ".xml":
        return XML_HTTP_LOC.findall(text)
    if suffix in {".js", ".mjs"}:
        return JS_HTTP_URL.findall(text)
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dist", type=Path)
    parser.add_argument("--json", dest="output", type=Path, required=True)
    parser.add_argument(
        "--profile",
        choices=("prod", "lab"),
        default="prod",
        help="prod blocks all HIGH findings; lab downgrades non-secret development-only findings",
    )
    args = parser.parse_args()

    findings: list[dict[str, str]] = []

    def add(severity: str, rule: str, path: Path, detail: str) -> None:
        findings.append(finding(profile_severity(args.profile, rule, severity), rule, path, detail))

    if not args.dist.is_dir():
        add("HIGH", "artifact.dist-missing", args.dist, "Build output directory does not exist")
    else:
        for path in args.dist.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(args.dist)
            size = path.stat().st_size
            suffix = path.suffix.lower()

            if suffix == ".map":
                add("HIGH", "artifact.source-map", rel, "Source map is present in production output")

            if suffix in WEBGL_ASSET_SUFFIXES:
                if size > 25 * 1024 * 1024:
                    add("HIGH", "webgl.asset-size", rel, f"3D/GPU asset is {size} bytes (>25 MiB)")
                elif size > 8 * 1024 * 1024:
                    add("MEDIUM", "webgl.asset-size", rel, f"3D/GPU asset is {size} bytes (>8 MiB); review GPU/memory budget")

            if suffix not in TEXT_SUFFIXES or size > 8 * 1024 * 1024:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            for url in insecure_runtime_urls(text, suffix):
                add("HIGH", "artifact.mixed-content", rel, f"Browser-loadable HTTP URL: {url[:180]}")

            local_match = LOCAL_URL.search(text)
            if local_match:
                add("HIGH", "artifact.localhost-reference", rel, f"Production artifact contains local URL: {local_match.group(0)[:180]}")

            if "sourceMappingURL=" in text:
                add("HIGH", "artifact.source-map-reference", rel, "Built asset references a source map")

            for name, pattern in SECRET_PATTERNS.items():
                if pattern.search(text):
                    add("HIGH", f"artifact.secret.{name}", rel, "Credential-like material found in browser-delivered output")

    payload = {
        "schema": "standment.artifact-security.v1",
        "profile": args.profile,
        "dist": str(args.dist),
        "findings": findings,
        "status": "fail" if any(f["severity"] == "HIGH" for f in findings) else "pass",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for f in findings:
        command = "error" if f["severity"] == "HIGH" else "warning"
        print(f"::{command} file={f['path']}::{f['severity']} {f['rule']}: {f['detail']}")
    return 1 if any(f["severity"] == "HIGH" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())