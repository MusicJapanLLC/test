#!/usr/bin/env python3
"""Standment WebGL/browser security guard.

Static, deterministic checks intended for CI. The guard blocks only patterns with a
high signal of dangerous runtime code generation or unsafe browser messaging. It
also records review findings for DOM sinks and remote assets without breaking
legacy builds on warnings alone.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

SCANNED_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".html"}
IGNORED_DIRS = {"node_modules", "dist", ".git", "coverage"}


@dataclass
class Finding:
    severity: str
    rule: str
    path: str
    line: int
    evidence: str
    remediation: str


RULES = [
    (
        "HIGH",
        "browser.dynamic-code.eval",
        re.compile(r"\beval\s*\("),
        "Do not execute runtime strings as JavaScript. Replace eval with explicit parsing or dispatch.",
    ),
    (
        "HIGH",
        "browser.dynamic-code.function-constructor",
        re.compile(r"\bnew\s+Function\s*\("),
        "Do not compile user/runtime strings as JavaScript. Use fixed functions or a constrained parser.",
    ),
    (
        "HIGH",
        "browser.document-write",
        re.compile(r"\bdocument\.write(?:ln)?\s*\("),
        "Avoid document.write. Build DOM nodes with safe APIs and textContent.",
    ),
    (
        "HIGH",
        "browser.postmessage.wildcard-target",
        re.compile(r"\.postMessage\s*\([^\n;]+,\s*['\"]\*['\"]\s*\)"),
        "Use an exact trusted targetOrigin and validate message origin/source on receipt.",
    ),
    (
        "MEDIUM",
        "dom.html-injection-sink",
        re.compile(r"\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\("),
        "Ensure data reaching HTML sinks is static/trusted or sanitized. Prefer textContent and DOM APIs.",
    ),
    (
        "MEDIUM",
        "webgl.preserve-drawing-buffer",
        re.compile(r"preserveDrawingBuffer\s*:\s*true"),
        "Keep preserveDrawingBuffer disabled unless required; it increases GPU memory pressure and retained frame data.",
    ),
    (
        "MEDIUM",
        "webgl.remote-asset-literal",
        re.compile(r"(?:TextureLoader|GLTFLoader|FileLoader|ImageLoader)[\s\S]{0,160}?\.load\s*\(\s*['\"]https?://", re.MULTILINE),
        "Host critical 3D assets on an approved origin and enforce CORS/CSP plus size and parser budgets.",
    ),
    (
        "LOW",
        "browser.javascript-url",
        re.compile(r"['\"]javascript:"),
        "Do not construct javascript: URLs. Use event handlers and normal navigation APIs.",
    ),
]


def iter_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SCANNED_SUFFIXES:
            continue
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        yield path


def scan(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_files(root):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for severity, rule, pattern, remediation in RULES:
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                snippet = text.splitlines()[line - 1].strip()[:220] if text.splitlines() else ""
                findings.append(
                    Finding(
                        severity=severity,
                        rule=rule,
                        path=str(path.as_posix()),
                        line=line,
                        evidence=snippet,
                        remediation=remediation,
                    )
                )
    return findings


def write_markdown(path: Path, findings: list[Finding]) -> None:
    counts = {s: sum(f.severity == s for f in findings) for s in ("HIGH", "MEDIUM", "LOW")}
    lines = [
        "# Standment WebGL Security Report",
        "",
        f"- HIGH: {counts['HIGH']}",
        f"- MEDIUM: {counts['MEDIUM']}",
        f"- LOW: {counts['LOW']}",
        "",
    ]
    if not findings:
        lines.append("No findings detected by the static WebGL/browser guard.")
    else:
        for f in findings:
            lines.extend(
                [
                    f"## {f.severity} — `{f.rule}`",
                    f"- Location: `{f.path}:{f.line}`",
                    f"- Evidence: `{f.evidence.replace('`', "'")}`",
                    f"- Remediation: {f.remediation}",
                    "",
                ]
            )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--json", dest="json_path", type=Path, required=True)
    parser.add_argument("--markdown", dest="markdown_path", type=Path, required=True)
    args = parser.parse_args()

    findings = scan(args.root)
    payload = {
        "schema": "standment.webgl-security.v1",
        "root": str(args.root),
        "blocking_severities": ["HIGH"],
        "findings": [asdict(f) for f in findings],
        "summary": {
            severity: sum(f.severity == severity for f in findings)
            for severity in ("HIGH", "MEDIUM", "LOW")
        },
    }
    args.json_path.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_path.parent.mkdir(parents=True, exist_ok=True)
    args.json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(args.markdown_path, findings)

    for f in findings:
        prefix = "error" if f.severity == "HIGH" else "warning"
        print(f"::{prefix} file={f.path},line={f.line}::{f.severity} {f.rule}: {f.remediation}")

    return 1 if any(f.severity == "HIGH" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
