#!/usr/bin/env python3
"""Inspect built frontend artifacts for accidental exposure and unsafe output."""
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


def finding(severity: str, rule: str, path: Path, detail: str) -> dict[str, str]:
    return {"severity": severity, "rule": rule, "path": path.as_posix(), "detail": detail}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dist", type=Path)
    parser.add_argument("--json", dest="output", type=Path, required=True)
    args = parser.parse_args()

    findings: list[dict[str, str]] = []
    if not args.dist.is_dir():
        findings.append(finding("HIGH", "artifact.dist-missing", args.dist, "Build output directory does not exist"))
    else:
        for path in args.dist.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(args.dist)
            size = path.stat().st_size

            if path.suffix.lower() == ".map":
                findings.append(finding("HIGH", "artifact.source-map", rel, "Source map is present in production output"))

            if path.suffix.lower() in WEBGL_ASSET_SUFFIXES:
                if size > 25 * 1024 * 1024:
                    findings.append(finding("HIGH", "webgl.asset-size", rel, f"3D/GPU asset is {size} bytes (>25 MiB)"))
                elif size > 8 * 1024 * 1024:
                    findings.append(finding("MEDIUM", "webgl.asset-size", rel, f"3D/GPU asset is {size} bytes (>8 MiB); review GPU/memory budget"))

            if path.suffix.lower() not in TEXT_SUFFIXES or size > 8 * 1024 * 1024:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            if "http://" in text and "http://www.w3.org/" not in text:
                findings.append(finding("HIGH", "artifact.mixed-content", rel, "Production artifact contains an http:// resource/reference"))
            if "localhost" in text or "127.0.0.1" in text:
                findings.append(finding("HIGH", "artifact.localhost-reference", rel, "Production artifact contains a localhost reference"))
            if "sourceMappingURL=" in text:
                findings.append(finding("HIGH", "artifact.source-map-reference", rel, "Built asset references a source map"))

            for name, pattern in SECRET_PATTERNS.items():
                if pattern.search(text):
                    findings.append(finding("HIGH", f"artifact.secret.{name}", rel, "Credential-like material found in browser-delivered output"))

    payload = {
        "schema": "standment.artifact-security.v1",
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
