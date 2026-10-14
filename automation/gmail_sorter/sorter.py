#!/usr/bin/env python3
"""Deterministic Gmail inbox sorter for Music Japan.

Designed for GitHub Actions. It uses Gmail API with OAuth refresh credentials from
GitHub Secrets. No message bodies, senders, subjects, OAuth tokens or webhook URLs
are written to repository artifacts or logs.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
TOKEN_URL = "https://oauth2.googleapis.com/token"
PRIORITY = {"low": 0, "normal": 1, "high": 2, "critical": 3}
PROCESSED_LABEL = "自動整理済み"


def _request(url: str, *, token: str | None = None, method: str = "GET", body: Any = None) -> Any:
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def refresh_access_token() -> str:
    required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError("Missing required GitHub Secrets: " + ", ".join(missing))
    payload = urllib.parse.urlencode(
        {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "refresh_token": os.environ["GOOGLE_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        token = json.loads(response.read().decode("utf-8"))["access_token"]
    return token


def gmail_get(token: str, path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{GMAIL_API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    return _request(url, token=token)


def gmail_post(token: str, path: str, body: dict[str, Any]) -> Any:
    return _request(f"{GMAIL_API}{path}", token=token, method="POST", body=body)


def get_or_create_labels(token: str, names: set[str], *, dry_run: bool) -> dict[str, str]:
    existing = gmail_get(token, "/labels").get("labels", [])
    mapping = {item["name"]: item["id"] for item in existing}
    for name in sorted(names):
        if name in mapping:
            continue
        if dry_run:
            mapping[name] = f"DRY_RUN::{name}"
            continue
        created = gmail_post(
            token,
            "/labels",
            {
                "name": name,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
            },
        )
        mapping[name] = created["id"]
    return mapping


def normalize_headers(message: dict[str, Any]) -> dict[str, str]:
    headers = message.get("payload", {}).get("headers", [])
    return {str(h.get("name", "")).lower(): str(h.get("value", "")) for h in headers}


def contains_any(value: str, needles: list[str]) -> bool:
    hay = value.casefold()
    return any(n.casefold() in hay for n in needles)


def rule_matches(rule: dict[str, Any], message: dict[str, Any]) -> bool:
    match = rule.get("match", {})
    headers = normalize_headers(message)
    sender = headers.get("from", "")
    subject = headers.get("subject", "")
    label_ids = set(message.get("labelIds", []))

    if match.get("from_contains") and not all(
        contains_any(sender, [needle]) for needle in match["from_contains"]
    ):
        return False
    if match.get("from_contains_any") and not contains_any(sender, match["from_contains_any"]):
        return False
    if match.get("subject_contains_any") and not contains_any(subject, match["subject_contains_any"]):
        return False
    if match.get("category_any") and not (label_ids & set(match["category_any"])):
        return False
    return True


def classify(rules: list[dict[str, Any]], message: dict[str, Any]) -> dict[str, Any] | None:
    matched = [rule for rule in rules if rule_matches(rule, message)]
    if not matched:
        return None

    labels: list[str] = []
    for rule in matched:
        for label in rule.get("labels", []):
            if label not in labels:
                labels.append(label)

    # Any matching rule that explicitly says "keep in inbox" wins over archive.
    archive = all(bool(rule.get("archive", False)) for rule in matched)
    star = any(bool(rule.get("star", False)) for rule in matched)
    priority = max((rule.get("priority", "normal") for rule in matched), key=lambda p: PRIORITY.get(p, 1))
    return {
        "rule_ids": [r["id"] for r in matched],
        "labels": labels,
        "archive": archive,
        "star": star,
        "priority": priority,
    }


def modify_message(token: str, message_id: str, *, add: list[str], remove: list[str], dry_run: bool) -> None:
    if dry_run:
        return
    gmail_post(token, f"/messages/{message_id}/modify", {"addLabelIds": add, "removeLabelIds": remove})


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", default="automation/gmail_sorter/rules.json")
    parser.add_argument("--report", default="reports/ceo-events/gmail-sorter-latest.json")
    parser.add_argument("--max-results", type=int, default=100)
    parser.add_argument("--lookback-hours", type=int, default=48)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    config = json.loads(Path(args.rules).read_text(encoding="utf-8"))
    rules = config["rules"]
    token = refresh_access_token()

    wanted_labels = {PROCESSED_LABEL}
    for rule in rules:
        wanted_labels.update(rule.get("labels", []))
    label_ids = get_or_create_labels(token, wanted_labels, dry_run=args.dry_run)

    after_epoch = int(time.time()) - args.lookback_hours * 3600
    query = f"in:inbox after:{after_epoch} -in:spam -in:trash -label:\"{PROCESSED_LABEL}\""
    page = gmail_get(token, "/messages", {"q": query, "maxResults": args.max_results})
    refs = page.get("messages", [])

    counts: Counter[str] = Counter()
    priorities: Counter[str] = Counter()
    matched_rule_counts: Counter[str] = Counter()

    for ref in refs:
        msg = gmail_get(
            token,
            f"/messages/{ref['id']}",
            {"format": "metadata", "metadataHeaders": ["From", "Subject"]},
        )
        result = classify(rules, msg)
        if not result:
            counts["unclassified"] += 1
            continue

        add = [label_ids[name] for name in result["labels"]]
        add.append(label_ids[PROCESSED_LABEL])
        if result["star"]:
            add.append("STARRED")
        remove = ["INBOX"] if result["archive"] else []
        modify_message(token, ref["id"], add=sorted(set(add)), remove=remove, dry_run=args.dry_run)

        counts["classified"] += 1
        counts["archived" if result["archive"] else "kept_in_inbox"] += 1
        if result["star"]:
            counts["starred"] += 1
        priorities[result["priority"]] += 1
        for rule_id in result["rule_ids"]:
            matched_rule_counts[rule_id] += 1

    report = {
        "schema": "ai-factory-ceo-event/v1",
        "project": "Gmail Autonomous Sorter",
        "state": "RUNNING" if not args.dry_run else "EXPERIMENT",
        "timestamp_epoch": int(time.time()),
        "privacy": "aggregate-only; no email content",
        "counts": dict(counts),
        "priorities": dict(priorities),
        "matched_rules": dict(matched_rule_counts),
        "owner_action": "NONE",
        "business_effect": "Human mail stays visible while machine logs/news are separated automatically.",
        "next_improvement": "Add optional AI fallback only for emails that remain unclassified.",
    }
    write_report(Path(args.report), report)
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Do not print request payloads or credentials.
        print(f"gmail-sorter failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
