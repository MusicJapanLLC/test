"""Autonomous capability-gap -> local lab-manifest PR generator.

Only structural JSON manifests under ``senju/labs`` are generated. The generator
is content-addressed and idempotent so repeated scheduler runs do not create PR
storms for the same coverage plan.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO = os.environ.get("GITHUB_REPOSITORY", "MusicJapanLLC/test")
BASE_BRANCH = os.environ.get("BASE_BRANCH", "claude/employee-onboarding-setup-udm86")
RUN_ID = os.environ.get("GITHUB_RUN_ID", "local")


def _run(command: list[str]) -> str:
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    )
    return result.stdout.strip()


def git(*args: str) -> str:
    return _run(["git", *args])


def gh(*args: str) -> str:
    return _run(["gh", *args])


def _campaign_fingerprint(paths: list[Path]) -> str:
    rows: list[dict[str, Any]] = []
    for path in sorted(paths, key=lambda item: str(item)):
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows.append(
            {
                "path": str(path),
                "fingerprint": payload.get("fingerprint", ""),
                "coverage_gaps": payload.get("coverage_gaps", []),
            }
        )
    canonical = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _find_existing_open_pr(marker: str) -> str | None:
    raw = gh(
        "pr",
        "list",
        "--repo",
        REPO,
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        "url,body,headRefName",
    )
    rows = json.loads(raw or "[]")
    for row in rows:
        if marker in (row.get("body") or ""):
            return str(row.get("url") or "") or None
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", default="senju/state/last-evolution-summary.json")
    parser.add_argument("--labs-dir", default="senju/labs")
    parser.add_argument("--max-manifests", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report-json")
    args = parser.parse_args()

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from senju.lab_planner import plan

    labs_dir = Path(args.labs_dir)
    labs_dir.mkdir(parents=True, exist_ok=True)
    written = plan(args.summary, labs_dir, args.max_manifests)

    report: dict[str, Any] = {
        "schema": "senju-self-code-gen/v2",
        "run_id": RUN_ID,
        "generated": [str(path) for path in written],
        "generated_count": len(written),
        "dry_run": bool(args.dry_run),
        "pr": None,
        "deduplicated": False,
    }

    if not written:
        print("No new coverage plan — manifests are covered or already identical.")
        if args.report_json:
            Path(args.report_json).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return 0

    fingerprint = _campaign_fingerprint(written)
    marker = f"[senju-plan:{fingerprint}]"
    report["campaign_fingerprint"] = fingerprint

    print(f"Generated {len(written)} changed lab manifest(s), plan={fingerprint[:12]}")
    for path in written:
        print(f"  {path}")

    if args.dry_run:
        print("[dry-run] Skipping branch/PR creation.")
        if args.report_json:
            Path(args.report_json).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return 0

    existing = _find_existing_open_pr(marker)
    if existing:
        report["pr"] = existing
        report["deduplicated"] = True
        print(f"Equivalent plan already has an open PR: {existing}")
        if args.report_json:
            Path(args.report_json).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return 0

    branch = f"senju/auto-lab-{fingerprint[:12]}-{RUN_ID}"
    git("checkout", "-b", branch)
    for path in written:
        git("add", str(path))

    try:
        git("diff", "--cached", "--quiet")
    except subprocess.CalledProcessError as exc:
        if exc.returncode != 1:
            raise
    else:
        print("No staged manifest changes after planning; skipping PR.")
        return 0

    manifest_names = ", ".join(path.stem for path in written)
    git(
        "commit",
        "-m",
        "feat(senju): auto-generate deterministic lab gap plan\n\n"
        f"Plan: {fingerprint}\nManifests: {manifest_names}\nRun: {RUN_ID}",
    )
    git("push", "-u", "origin", branch)

    body = (
        "## Senju Auto-Lab Generation v2\n\n"
        f"Generated **{len(written)}** changed deterministic lab manifest(s) from coverage gaps.\n\n"
        "**New/updated manifests:**\n"
        + "\n".join(f"- `{path}`" for path in written)
        + f"\n\nPlan fingerprint: `{fingerprint}`\n"
        + f"{marker}\n\n"
        "The manifests are structural local-lab declarations only; they do not add network authority.\n"
    )

    result = gh(
        "pr",
        "create",
        "--repo",
        REPO,
        "--base",
        BASE_BRANCH,
        "--head",
        branch,
        "--title",
        f"feat(senju): autonomous lab gap plan {fingerprint[:12]}",
        "--body",
        body,
    )
    report["pr"] = result
    print(f"PR created: {result}")

    if args.report_json:
        Path(args.report_json).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
