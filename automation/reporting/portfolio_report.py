#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

CODE_SUFFIXES = {".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".yml", ".yaml", ".json", ".md"}
REQUIRED = {"title", "artifact_type", "artifact_url", "status", "what_it_is", "why_it_matters", "proof", "source_system", "owner"}
ALLOWED_STATUS = {"EXPERIMENT", "BUILDING", "VERIFIED"}


def validate(event: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = sorted(k for k in REQUIRED if not event.get(k))
    if missing:
        errors.append("missing required fields: " + ", ".join(missing))

    status = str(event.get("status", "")).upper()
    if status and status not in ALLOWED_STATUS:
        errors.append("invalid status")

    url = str(event.get("artifact_url", ""))
    if url:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            errors.append("artifact_url must be http(s)")
        suffix = Path(parsed.path).suffix.lower()
        if suffix in CODE_SUFFIXES:
            errors.append("artifact_url points to a code/text source file; portfolio requires a human-inspectable artifact")
        if "github.com" in parsed.netloc and "/blob/" in parsed.path:
            errors.append("GitHub blob pages are evidence, not portfolio artifacts")

    if status == "VERIFIED" and not event.get("proof"):
        errors.append("VERIFIED requires proof")
    return errors


def render(event: dict[str, Any]) -> str:
    return (
        f"*{event['title']}* — `{str(event['status']).upper()}`\n"
        f"{event['what_it_is']}\n\n"
        f"*Why it matters*\n{event['why_it_matters']}\n\n"
        f"*Open artifact*\n{event['artifact_url']}\n\n"
        f"*Proof*\n{event['proof']}\n"
        f"*Type:* {event['artifact_type']} | *Owner:* {event['owner']} | *Source:* {event['source_system']}"
    )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("event", help="Path to portfolio event JSON")
    p.add_argument("--render", default="portfolio-message.md")
    args = p.parse_args()

    event = json.loads(Path(args.event).read_text(encoding="utf-8"))
    errors = validate(event)
    if errors:
        print(json.dumps({"ok": False, "errors": errors}, ensure_ascii=False))
        return 2
    Path(args.render).write_text(render(event) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "render": args.render}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
