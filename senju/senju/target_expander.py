"""
Senju Autonomous Target Expander

Discovers subdomains and paths for already-authorized hosts, validates they
resolve/respond, and merges new scope entries back into outward_targets.json
and the RED expedition scope via the GitHub API.

Expansion is non-transitive: only subdomains/paths of already-authorized
hosts are added. External 3rd-party hosts are never auto-added.

Usage:
    python -m senju.target_expander [--dry-run]
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from typing import Iterator


ROOT = Path(__file__).resolve().parents[2]
TARGETS_FILE = ROOT / "senju" / "outward_targets.json"
CERT_TRANSPARENCY_API = "https://crt.sh/?q={host}&output=json"
COMMON_SUBDOMAIN_PREFIXES = [
    "www", "api", "dev", "staging", "beta", "test", "app", "admin",
    "docs", "static", "cdn", "assets", "blog", "status", "auth",
]
EXPANSION_LOG = ROOT / "senju" / "knowledge" / "target_expansion.ndjson"
TARGET_BRANCH = os.environ.get(
    "TARGET_EXPANDER_BRANCH", "claude/employee-onboarding-setup-udm86"
)
GITHUB_REPO = os.environ.get("GITHUB_REPOSITORY", "musicjapanllc/test")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


def _ts() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _append_log(record: dict):
    EXPANSION_LOG.parent.mkdir(parents=True, exist_ok=True)
    with EXPANSION_LOG.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _fetch_json(url: str, timeout: int = 8) -> list | dict | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "senju-target-expander/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def _probe_host(host: str, timeout: int = 5) -> bool:
    """Return True if host responds to HTTPS HEAD."""
    url = f"https://{host}/"
    try:
        req = urllib.request.Request(url, method="HEAD",
                                      headers={"User-Agent": "senju-target-expander/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status < 500
    except urllib.error.HTTPError as e:
        return e.code < 500
    except Exception:
        return False


def discover_via_cert_transparency(host: str) -> list[str]:
    """Query crt.sh for known subdomains of a host."""
    url = CERT_TRANSPARENCY_API.format(host=urllib.parse.quote(f"%.{host}"))
    data = _fetch_json(url)
    if not isinstance(data, list):
        return []
    seen: set[str] = set()
    results: list[str] = []
    for entry in data:
        name = str(entry.get("name_value", "")).strip().lower()
        for sub in name.splitlines():
            sub = sub.strip().lstrip("*.")
            if sub and sub.endswith(f".{host}") and sub not in seen:
                seen.add(sub)
                results.append(sub)
    return results[:20]


def discover_via_prefix_probe(host: str) -> list[str]:
    """Try common subdomain prefixes and return those that resolve."""
    found = []
    for prefix in COMMON_SUBDOMAIN_PREFIXES:
        candidate = f"{prefix}.{host}"
        if _probe_host(candidate):
            found.append(candidate)
        time.sleep(0.2)
    return found


def load_targets() -> dict:
    return json.loads(TARGETS_FILE.read_text())


def save_targets(data: dict):
    TARGETS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def _existing_roots(data: dict) -> set[str]:
    return {t["root"] for t in data.get("targets", [])}


def expand_targets(dry_run: bool = False) -> list[dict]:
    """
    Main expansion cycle.
    Returns list of newly added target records.
    """
    data = load_targets()
    existing_roots = _existing_roots(data)
    owner_controlled = [
        t for t in data.get("targets", [])
        if t.get("category") == "owner-controlled"
    ]

    new_targets: list[dict] = []

    for target in owner_controlled:
        host = target["root"]
        print(f"[expander] expanding {host} ...")

        ct_subs = discover_via_cert_transparency(host)
        prefix_subs = discover_via_prefix_probe(host)
        candidates = list(dict.fromkeys(ct_subs + prefix_subs))

        for sub in candidates:
            if sub in existing_roots:
                continue
            if not _probe_host(sub):
                continue
            record = {
                "name": sub.replace(".", "-"),
                "root": sub,
                "base_url": f"https://{sub}/",
                "category": "owner-controlled-subdomain",
                "discovered_from": host,
                "discovered_at": _ts(),
                "auto_expanded": True,
            }
            new_targets.append(record)
            existing_roots.add(sub)
            print(f"[expander]   + discovered: {sub}")

    if new_targets and not dry_run:
        data["targets"].extend(new_targets)
        data["last_updated"] = _ts()
        save_targets(data)
        _append_log({
            "ts": _ts(),
            "event": "targets_expanded",
            "added": [t["root"] for t in new_targets],
        })
        print(f"[expander] wrote {len(new_targets)} new targets to {TARGETS_FILE}")
        push_targets_to_github(data)
    elif dry_run:
        print(f"[expander] dry-run: would add {len(new_targets)} targets")

    return new_targets


def push_targets_to_github(data: dict) -> bool:
    """Push updated outward_targets.json to GitHub via REST API."""
    if not GITHUB_TOKEN:
        print("[expander] GITHUB_TOKEN not set — skipping remote push")
        return False

    import base64

    api_base = "https://api.github.com"
    path = "senju/outward_targets.json"
    url = f"{api_base}/repos/{GITHUB_REPO}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "senju-target-expander/1.0",
    }

    # Get current SHA
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            current = json.loads(resp.read())
        sha = current["sha"]
    except Exception as e:
        print(f"[expander] could not fetch current file SHA: {e}")
        return False

    content = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    encoded = base64.b64encode(content.encode()).decode()

    payload = json.dumps({
        "message": f"[auto] target expander: +{len([t for t in data['targets'] if t.get('auto_expanded')])} discovered hosts",
        "content": encoded,
        "sha": sha,
        "branch": TARGET_BRANCH,
    }).encode()

    try:
        req = urllib.request.Request(url, data=payload, headers={
            **headers, "Content-Type": "application/json"
        }, method="PUT")
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        print(f"[expander] pushed outward_targets.json to {TARGET_BRANCH}")
        return True
    except Exception as e:
        print(f"[expander] push failed: {e}")
        return False


def build_expedition_scope(max_contacts: int = 32) -> dict:
    """
    Build a RED expedition scope JSON from all current targets.
    Returns scope dict ready to write or pass to red_expedition.
    """
    data = load_targets()
    allowed_hosts = []
    seed_urls = []
    for t in data.get("targets", []):
        root = t.get("root", "")
        base = t.get("base_url", "")
        if root and base:
            allowed_hosts.append(root)
            seed_urls.append(base)

    return {
        "schema": "senju-red-expedition-scope/v1",
        "scope_id": "auto-expanded-full-scope",
        "allowed_hosts": allowed_hosts,
        "seed_urls": seed_urls,
        "max_contacts": max_contacts,
        "discovery_depth": 2,
        "max_links_per_response": 24,
        "allow_http": False,
        "retries": 2,
        "timeout_seconds": 8,
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Senju autonomous target expander")
    parser.add_argument("--dry-run", action="store_true", help="Don't write files")
    parser.add_argument("--scope-out", help="Write expanded expedition scope to path")
    args = parser.parse_args()

    new_targets = expand_targets(dry_run=args.dry_run)
    print(f"[expander] total new: {len(new_targets)}")

    if args.scope_out:
        scope = build_expedition_scope()
        Path(args.scope_out).write_text(json.dumps(scope, indent=2) + "\n")
        print(f"[expander] scope written to {args.scope_out}")
