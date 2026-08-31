#!/usr/bin/env python3
"""Post-merge Audit -> PASS for META/X/Senju closed production lineages.

The auditor is read-only. It consumes the receipt embedded in the production PR
and proves that the exact selected patch was applied, the merge belongs to the
current production history, the PR did not drift outside its declared file, and
the declared pytest contract still passes. PASS is declared only when META, X
and Senju audit receipts all pass under the original lineage_id.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.world.closed_loop_lineage import is_protected_path, parse_test_command, run_tests

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


def _approval(receipt: Mapping[str, Any], actor: str) -> bool:
    approvals = receipt.get("approvals")
    if not isinstance(approvals, Mapping):
        return False
    row = approvals.get(actor)
    return isinstance(row, Mapping) and bool(row.get("approved"))


def _file_at_commit(commit_sha: str, path: str) -> tuple[bool, bytes, str]:
    result = subprocess.run(
        ["git", "show", f"{commit_sha}:{path}"],
        cwd=ROOT,
        capture_output=True,
        timeout=120,
    )
    return result.returncode == 0, result.stdout, result.stderr.decode("utf-8", errors="replace").strip()


def _pr_changed_files(number: int) -> tuple[str, ...]:
    ok, output = _run(["gh", "pr", "diff", str(number), "--name-only"])
    if not ok:
        raise AuditError(f"cannot inspect PR changed files: {output}")
    return tuple(line.strip() for line in output.splitlines() if line.strip())


def audit_pr(pr: Mapping[str, Any]) -> dict[str, Any]:
    receipt = parse_receipt(str(pr.get("body") or ""))
    if not receipt:
        raise AuditError("PR does not contain a closed lineage receipt")

    lineage_id = str(receipt.get("lineage_id") or "").strip()
    task_id = str(receipt.get("task_id") or "").strip()
    output_file = str(receipt.get("output_file") or "").strip().replace("\\", "/")
    selected_sha = str(receipt.get("selected_code_sha256") or "").strip()
    test_cmd = str(receipt.get("test_cmd") or "").strip()
    target_ref = str(receipt.get("target_ref") or pr.get("baseRefName") or "").strip()
    merge_sha = _merge_sha(pr)
    pr_number = int(pr.get("number") or 0)
    title = str(pr.get("title") or "")
    base_ref = str(pr.get("baseRefName") or "").strip()

    if not all((lineage_id, task_id, output_file, selected_sha, test_cmd, target_ref, merge_sha, pr_number)):
        raise AuditError("lineage receipt or merge metadata is incomplete")
    if Path(output_file).is_absolute() or ".." in Path(output_file).parts:
        raise AuditError("lineage output_file is not a safe repository path")

    test_argv = parse_test_command(test_cmd)
    protected = is_protected_path(output_file)

    # META: prove the exact selected candidate exists at the applied merge SHA.
    merge_file_ok, merge_bytes, merge_file_error = _file_at_commit(merge_sha, output_file)
    applied_sha = hashlib.sha256(merge_bytes).hexdigest() if merge_file_ok else ""
    meta_pass = bool(
        _approval(receipt, "META")
        and merge_file_ok
        and applied_sha == selected_sha
        and lineage_id in title
    )

    # X: prove the same PR touched exactly the declared file and the resulting merge
    # remains in the current production history on the expected base ref.
    changed = _pr_changed_files(pr_number)
    ancestor_ok, ancestor_output = _run(["git", "merge-base", "--is-ancestor", merge_sha, "HEAD"])
    x_pass = bool(
        _approval(receipt, "X")
        and ancestor_ok
        and base_ref == target_ref
        and changed == (output_file,)
    )

    # Senju: independently replay the declared pytest contract against the current
    # production checkout and reject autonomous PASS for protected control paths.
    test_ok, test_output = run_tests(test_argv)
    senju_pass = bool(_approval(receipt, "SENJU") and test_ok and not protected)

    current_path = ROOT / output_file
    current_sha = hashlib.sha256(current_path.read_bytes()).hexdigest() if current_path.exists() else ""
    votes = {
        "META": {
            "passed": meta_pass,
            "basis": "applied merge file hash equals selected patch hash and lineage title is preserved",
            "applied_code_sha256": applied_sha,
            "selected_code_sha256": selected_sha,
            "merge_file_error": merge_file_error,
            "preapply_approval": _approval(receipt, "META"),
        },
        "X": {
            "passed": x_pass,
            "basis": "PR changed only the declared file and applied merge is contained in current production HEAD",
            "merge_commit_sha": merge_sha,
            "target_ref": target_ref,
            "base_ref": base_ref,
            "changed_files": changed,
            "git_evidence": ancestor_output,
            "preapply_approval": _approval(receipt, "X"),
        },
        "SENJU": {
            "passed": senju_pass,
            "basis": "declared pytest contract replayed against production and control-plane scope stayed ordinary",
            "test_output": test_output,
            "protected_control_path": protected,
            "preapply_approval": _approval(receipt, "SENJU"),
        },
    }
    passed = all(vote["passed"] for vote in votes.values())
    return {
        "schema": "the-world-closed-lineage-audit/v2",
        "lineage_id": lineage_id,
        "phase": "audit",
        "status": "PASS" if passed else "FAIL",
        "pass_declared": passed,
        "pr_number": pr_number,
        "pr_url": pr.get("url"),
        "task_id": task_id,
        "output_file": output_file,
        "test_cmd": test_cmd,
        "target_ref": target_ref,
        "merge_commit_sha": merge_sha,
        "selected_code_sha256": selected_sha,
        "applied_code_sha256": applied_sha,
        "current_production_code_sha256": current_sha,
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

    prs = (_gh_pr(args.pr_number),) if args.pr_number else discover_lineage_prs(args.limit)
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
                "schema": "the-world-closed-lineage-audit/v2",
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
