#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

CODE_SUFFIXES = {".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".yml", ".yaml", ".json", ".md"}
REQUIRED = {
    "title",
    "artifact_type",
    "artifact_url",
    "status",
    "what_it_is",
    "why_it_matters",
    "proof",
    "source_system",
    "owner",
    "before_state",
    "after_state",
    "capability_gain",
    "owner_benefit",
    "business_effect",
    "evolution_stage_before",
    "evolution_stage_after",
    "next_target",
    "success_criteria",
}
ALLOWED_STATUS = {"EXPERIMENT", "BUILDING", "VERIFIED"}
NON_ARTIFACT_TYPES = {"code", "source code", "source_code", "pr", "pull request", "pull_request"}
PRIVATE_SHELL_HOSTS = {"mail.google.com"}
PRIVATE_SHELL_PATH_MARKERS = ("/mail/", "/login", "/signin", "/account")
PRIVATE_SHELL_FRAGMENT_MARKERS = ("inbox", "sent", "drafts")
STAGE_LABELS = {
    0: "IDEA",
    1: "INSPECTABLE",
    2: "VERIFIED ONCE",
    3: "REPEATABLE",
    4: "AUTONOMOUS",
    5: "EXTERNAL VALUE",
}


def _private_shell_reason(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower().split(":", 1)[0]
    path = parsed.path.lower()
    fragment = parsed.fragment.lower()
    if host in PRIVATE_SHELL_HOSTS:
        return "artifact_url points to a private inbox/account surface, not a portfolio artifact"
    if any(marker in path for marker in PRIVATE_SHELL_PATH_MARKERS):
        return "artifact_url looks like a login/account shell, not a portfolio artifact"
    if any(marker == fragment or fragment.startswith(marker + "/") for marker in PRIVATE_SHELL_FRAGMENT_MARKERS):
        return "artifact_url points to an inbox-like private shell, not a portfolio artifact"
    return None


def _stage(value: Any) -> int | None:
    try:
        stage = int(value)
    except (TypeError, ValueError):
        return None
    return stage if stage in STAGE_LABELS else None


def validate(event: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = sorted(k for k in REQUIRED if event.get(k) is None or event.get(k) == "")
    if missing:
        errors.append("missing required fields: " + ", ".join(missing))

    status = str(event.get("status", "")).upper()
    if status and status not in ALLOWED_STATUS:
        errors.append("invalid status")

    before_stage = _stage(event.get("evolution_stage_before"))
    after_stage = _stage(event.get("evolution_stage_after"))
    if event.get("evolution_stage_before") is not None and before_stage is None:
        errors.append("evolution_stage_before must be an integer 0-5")
    if event.get("evolution_stage_after") is not None and after_stage is None:
        errors.append("evolution_stage_after must be an integer 0-5")

    metrics = event.get("metrics")
    measurement_next = str(event.get("measurement_next", "")).strip()
    if not metrics and not measurement_next:
        errors.append("provide evidence-backed metrics or measurement_next for an unmeasured benefit")
    if metrics is not None and not isinstance(metrics, list):
        errors.append("metrics must be a list")
    if isinstance(metrics, list):
        for index, metric in enumerate(metrics):
            if not isinstance(metric, dict) or not metric.get("name"):
                errors.append(f"metrics[{index}] must be an object with name")
                continue
            if "before" not in metric or "after" not in metric:
                errors.append(f"metrics[{index}] requires before and after")

    artifact_type = str(event.get("artifact_type", "")).strip().lower()
    if artifact_type in NON_ARTIFACT_TYPES:
        errors.append("source code / pull requests are evidence, not portfolio artifacts")

    url = str(event.get("artifact_url", ""))
    if url:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            errors.append("artifact_url must be http(s)")
        suffix = Path(parsed.path).suffix.lower()
        if suffix in CODE_SUFFIXES:
            errors.append("artifact_url points to a code/text source file; portfolio requires a human-inspectable artifact")
        if "github.com" in parsed.netloc.lower() and "/blob/" in parsed.path:
            errors.append("GitHub blob pages are evidence, not portfolio artifacts")
        shell_reason = _private_shell_reason(url)
        if shell_reason:
            errors.append(shell_reason)

    if status == "VERIFIED" and not event.get("proof"):
        errors.append("VERIFIED requires proof")
    if after_stage == 5 and not event.get("external_value_evidence"):
        errors.append("L5 EXTERNAL VALUE requires external_value_evidence")
    return errors


def _render_metrics(event: dict[str, Any]) -> str:
    metrics = event.get("metrics") or []
    if metrics:
        rows: list[str] = []
        for metric in metrics[:8]:
            name = str(metric.get("name", "metric"))
            before = metric.get("before")
            after = metric.get("after")
            unit = str(metric.get("unit", "")).strip()
            suffix = f" {unit}" if unit else ""
            rows.append(f"• {name}: `{before}{suffix} -> {after}{suffix}`")
        return "\n".join(rows)
    return f"UNMEASURED — next measurement: {event.get('measurement_next', 'not defined')}"


def render(event: dict[str, Any]) -> str:
    before_stage = _stage(event.get("evolution_stage_before"))
    after_stage = _stage(event.get("evolution_stage_after"))
    before_label = STAGE_LABELS.get(before_stage, "UNKNOWN")
    after_label = STAGE_LABELS.get(after_stage, "UNKNOWN")

    lines = [
        f"*PORTFOLIO DELTA｜{event['title']}* — `{str(event['status']).upper()}`",
        f"*Open:* {event['artifact_url']}",
        f"*Evolution:* `L{before_stage} {before_label} -> L{after_stage} {after_label}`",
        "",
        f"*Before*\n{event['before_state']}",
        f"*After*\n{event['after_state']}",
        f"*New capability*\n{event['capability_gain']}",
        f"*Owner / user benefit*\n{event['owner_benefit']}",
        f"*Business effect*\n{event['business_effect']}",
        f"*Measured delta*\n{_render_metrics(event)}",
        f"*Why it matters*\n{event['why_it_matters']}",
        f"*Next evolution*\n{event['next_target']}",
        f"*Success criteria*\n{event['success_criteria']}",
    ]
    if event.get("external_value_evidence"):
        lines.append(f"*External value evidence*\n{event['external_value_evidence']}")
    lines += [
        f"*Proof*\n{event['proof']}",
        f"*What it is:* {event['what_it_is']}",
        f"*Type:* {event['artifact_type']} | *Owner:* {event['owner']} | *Source:* {event['source_system']}",
    ]
    return "\n\n".join(lines)


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
