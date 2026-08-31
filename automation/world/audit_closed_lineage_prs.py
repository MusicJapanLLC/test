#!/usr/bin/env python3
"""Post-merge Audit -> PASS for META/X/Senju closed production lineages.

The auditor is read-only. It discovers merged PRs carrying a
CLOSED_LINEAGE_RECEIPT, verifies the applied commit is an ancestor of the current
production ref, verifies the production file still matches the selected patch,
and replays the declared pytest contract. META, X and Senju each receive an
audit receipt under the original lineage_id; PASS is declared only when all
three checks pass.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Mapping

from automation.world.closed_loop_lineage import ROOT, load_task, run_tests

_RECEIPT_RE = re.compile(
    r"<!--\s*CLOSED_LINEAGE_RECEIPT\s*(\{.*?\})\s*CLOSED_LINEAGE_RECEIPT\s*-->",
    re.DOTALL,
)


class AuditError(RuntimeError):
    pass


def _run(argv: list[str], *, timeout: int = 120) -> tuple[bool, str]:
    result = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return result.returncode == 0, (result.stdout + result.stderr).strip()


def parse_receipt(body: str) -> dict[str, Any] | None:
    match = _RECEIPT_RE.search(str(body or ""))
    if not match:
        return None
    try:
        value = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def _gh_pr(number: int) -> dict[str, Any]:
    ok, output = _run([
        "gh", "pr", "view", str(number),
        "--json", "number,title,body,state,mergedAt,mergeCommit,baseRefName,headRefOid,url",
    ])
    if not ok:
        raise AuditError(f"cannot read PR #{number}: {output}")
    value = json.loads(output)
    if not isinstance(value, dict):
        raise AuditError(f"invalid PR response for #{number}")
    return value


def discover_lineage_prs(limit: int = 50) -> tuple[dict[str, Any], ...]:
    ok, output = _run([
        "gh", "pr", "list", "--state", "merged", "--limit", str(max(1, limit)),
        "--json", "number,title,body,state,mergedAt,mergeCommit,baseRefName,headRefOid,url",
    ])
    if not ok:
        raise AuditError(f"cannot list merged PRs: {output}")
    rows = json.loads(output)
    return tuple(row for row in rows if isinstance(row, dict) and parse_receipt(str(row.get("body") or "")))


def _merge_sha(pr: Mapping[str, Any]) -> str:
    merge = pr.get("mergeCommit")
    if isinstance(merge, Mapping):
        return str(merge.get("oid") or "").strip()
    return ""


def _recent_enough(pr: Mapping[str, Any], lookback_hours: int) -> bool:
    if lookback_hours <= 0:
        return True
    raw = str(pr.get("mergedAt") or "").strip()
    if not raw:
        return False
    try:
        merged = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return False
    now = dt.datetime.now(dt.timezone.utc)
    return (now - merged).total_seconds() <= lookback_hours * 3600


def audit_pr(pr: Mapping[str, Any]) -> dict[str, Any]:
    receipt = parse_receipt(str(pr.get("body") or ""))
    if not receipt:
        raise AuditError("PR does not contain a closed lineage receipt")
    lineage_id = str(receipt.get("lineage_id") or "").strip()
    task_id = str(receipt.get("task_id") or "").strip()
    output_file = str(receipt.get("output_file") or "").strip()
    selected_sha = str(receipt.get("selected_code_sha256") or "").strip()
    target_ref = str(receipt.get("target_ref") or pr.get("baseRefName") or "").strip()
    merge_sha = _merge_sha(pr)
    if not all((lineage_id, task_id, output_file, selected_sha, target_ref, merge_sha)):
        raise AuditError("lineage receipt or merge metadata is incomplete")

    task = load_task(task_id)
    if str(task["output_file"]) != output_file:
        raise AuditError("task output_file drifted from lineage receipt")

    path = ROOT / output_file
    production_sha = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else ""
    meta_pass = production_sha == selected_sha

    ancestor_ok, ancestor_output = _run(["git", "merge-base", "--is-ancestor", merge_sha, "HEAD"])
    x_pass = ancestor_ok

    test_ok, test_output = run_tests(task["test_argv"])
    senju_pass = test_ok

    votes = {
        "META": {
            "passed": meta_pass,
            "basis": "production output hash equals selected patch hash",
            "production_code_sha256": production_sha,
            "selected_code_sha256": selected_sha,
        },
        "X": {
            "passed": x_pass,
            "basis": "applied merge commit is contained in current production HEAD",
            "merge_commit_sha": merge_sha,
            "target_ref": target_ref,
            "git_evidence": ancestor_output,
        },
        "SENJU": {
            "passed": senju_pass,
            "basis": "declared pytest contract replayed against production checkout",
            "test_output": test_output,
        },
    }
    passed = all(vote["passed"] for vote in votes.values())
    return {
        "schema": "the-world-closed-lineage-audit/v1",
        "lineage_id": lineage_id,
        "phase": "audit",
        "status": "PASS" if passed else "FAIL",
        "pass_declared": passed,
        "pr_number": pr.get("number"),
        "pr_url": pr.get("url"),
        "task_id": task_id,
        "output_file": output_file,
        "target_ref": target_ref,
        "merge_commit_sha": merge_sha,
        "audit_votes": votes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit merged closed production lineages")
    parser.add_argument("--pr-number", type=int, default=0)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--lookback-hours", type=int, default=24)
    parser.add_argument("--out-dir", default="/tmp/closed-lineage-audits")
    parser.add_argument("--require-pass", action="store_true")
    args = parser.parse_args()

    if args.pr_number:
        prs = (_gh_pr(args.pr_number),)
    else:
        prs = discover_lineage_prs(args.limit)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    audits: list[dict[str, Any]] = []
    failures = 0
    for pr in prs:
        if not _recent_enough(pr, args.lookback_hours):
            continue
        receipt = parse_receipt(str(pr.get("body") or ""))
        if not receipt:
            continue
        try:
            audit = audit_pr(pr)
        except Exception as exc:
            audit = {
                "schema": "the-world-closed-lineage-audit/v1",
                "lineage_id": str(receipt.get("lineage_id") or "unknown"),
                "phase": "audit",
                "status": "FAIL",
                "pass_declared": False,
                "pr_number": pr.get("number"),
                "error": str(exc),
            }
        audits.append(audit)
        if not audit.get("pass_declared"):
            failures += 1
        safe = re.sub(r"[^A-Za-z0-9._-]", "-", str(audit.get("lineage_id") or "unknown"))
        (out_dir / f"{safe}.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(audit, ensure_ascii=False))

    summary = {
        "audited": len(audits),
        "passed": sum(1 for row in audits if row.get("pass_declared")),
        "failed": failures,
        "out_dir": str(out_dir),
    }
    print(json.dumps(summary, ensure_ascii=False))
    if args.require_pass and audits and failures:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
