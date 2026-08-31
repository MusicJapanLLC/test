#!/usr/bin/env python3
"""Production Detection -> Fix -> Approval -> Apply -> Audit lineage.

One lineage_id is carried through every phase:

    META detection
      -> META/X patch generation
      -> META/X/Senju approval
      -> production apply
      -> META/X/Senju audit
      -> PASS declaration

The production apply path is limited to ordinary application/code changes.
Changes to security/authority/guard/credential/emergency controls are retained
in the same lineage but stop at approval_pending_external rather than letting
an autonomous lineage mint or widen its own production authority.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[2]
TASKS_DIR = ROOT / "automation" / "codegen" / "tasks"
AGENTS_DIR = ROOT / "automation" / "codegen" / "agents"
DEFAULT_STATE_DIR = ROOT / "automation" / "world" / "runtime_state" / "lineage"
SCHEMA = "the-world-detection-fix-approval-apply-audit/v1"
APPROVERS = ("META", "X", "SENJU")
GENERATOR_ORDER = ("META", "X")

_PROTECTED_PREFIXES = (
    ".github/workflows/",
    ".github/actions/",
    "automation/world/authority_checkpoint.py",
    "automation/world/production_evolution_loop.py",
    "automation/world/replica_authority.py",
    "senju/senju/meta/self_governance_lab.py",
    "senju/senju/meta/standing_authorization.py",
    "senju/senju/credential_runtime.py",
    "senju/senju/authority_factory.py",
)
_PROTECTED_TOKENS = (
    "guard",
    "authority",
    "authorization",
    "credential",
    "emergency_stop",
    "emergency-stop",
    "branch_protection",
    "branch-protection",
    "security-guard",
    "offense_first",
    "artifact_guard",
)


class LineageError(RuntimeError):
    pass


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _stable_id(*parts: object, length: int = 28) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:length]


def _safe_repo_path(raw: str) -> str:
    value = str(raw).strip().replace("\\", "/")
    path = Path(value)
    if not value or path.is_absolute() or ".." in path.parts:
        raise LineageError(f"unsafe repository path: {raw!r}")
    return value


def is_protected_path(path: str) -> bool:
    value = _safe_repo_path(path).lower()
    if any(value.startswith(prefix.lower()) for prefix in _PROTECTED_PREFIXES):
        return True
    return any(token in value for token in _PROTECTED_TOKENS)


def load_task(task_id: str) -> dict[str, Any]:
    safe_id = re.sub(r"[^A-Za-z0-9._-]", "-", str(task_id).strip())
    path = TASKS_DIR / f"{safe_id}.json"
    if not path.exists():
        raise LineageError(f"task not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise LineageError("task must be a JSON object")
    for field in ("name", "goal", "output_file", "test_cmd"):
        if not str(data.get(field) or "").strip():
            raise LineageError(f"task is missing {field}")
    data["output_file"] = _safe_repo_path(str(data["output_file"]))
    data["task_id"] = safe_id
    return data


def load_agent(actor: str) -> dict[str, Any]:
    filename = "meta-lineage.json" if actor == "META" else "x-lineage.json"
    path = AGENTS_DIR / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise LineageError(f"invalid agent config: {path}")
    return data


def event(lineage: dict[str, Any], phase: str, actor: str, status: str, **payload: Any) -> dict[str, Any]:
    row = {
        "sequence": len(lineage["events"]) + 1,
        "at": _now(),
        "lineage_id": lineage["lineage_id"],
        "phase": phase,
        "actor": actor,
        "status": status,
        **payload,
    }
    lineage["events"].append(row)
    lineage["phase"] = phase
    lineage["status"] = status
    return row


def build_prompt(task: Mapping[str, Any], actor: str, attempts: list[dict[str, Any]]) -> str:
    agent = load_agent(actor)
    parts = [
        f"# Production repair actor: {actor}",
        f"Strategy: {agent.get('strategy', '')}",
        f"Task: {task['name']}",
        f"Goal: {task['goal']}",
        f"Output file: {task['output_file']}",
        f"Test command: {task['test_cmd']}",
        f"Constraints: {task.get('constraints', 'None')}",
        "Return ONLY the complete replacement file content. No markdown fences and no explanation.",
    ]
    if attempts:
        parts.append("Previous lineage attempts:")
        for attempt in attempts[-3:]:
            parts.append(
                f"Actor={attempt['actor']} passed={attempt['passed']}\n"
                f"Candidate:\n{attempt['code']}\n"
                f"Test output:\n{attempt['test_output'][-5000:]}"
            )
    return "\n\n".join(parts)


def generate_code(task: Mapping[str, Any], actor: str, attempts: list[dict[str, Any]]) -> str:
    try:
        import anthropic  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise LineageError("anthropic package is required for patch generation") from exc
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise LineageError("ANTHROPIC_API_KEY is required for production patch generation")
    agent = load_agent(actor)
    client = anthropic.Anthropic(api_key=key)
    message = client.messages.create(
        model=str(agent.get("model") or "claude-sonnet-4-6"),
        max_tokens=int(agent.get("max_tokens") or 8192),
        messages=[{"role": "user", "content": build_prompt(task, actor, attempts)}],
    )
    code = str(message.content[0].text).strip()
    if code.startswith("```"):
        lines = code.splitlines()
        code = "\n".join(lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:])
    if not code.strip():
        raise LineageError(f"{actor} returned an empty patch")
    return code.rstrip() + "\n"


def run_command(command: str, *, timeout: int = 300) -> tuple[bool, str]:
    result = subprocess.run(
        command,
        shell=True,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def changed_files() -> tuple[str, ...]:
    ok, out = run_command("git status --porcelain --untracked-files=all")
    if not ok:
        raise LineageError(f"cannot inspect repository changes: {out}")
    files: list[str] = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        raw = line[3:].strip()
        if " -> " in raw:
            raw = raw.split(" -> ", 1)[1]
        files.append(raw.strip('"'))
    return tuple(files)


def approval_votes(task: Mapping[str, Any], *, candidate_passed: bool, test_output: str) -> dict[str, Any]:
    output_file = str(task["output_file"])
    diff_ok, diff_output = run_command("git diff --check")
    files = changed_files()
    only_expected = bool(files) and set(files) == {output_file}
    protected = is_protected_path(output_file)
    senju_test_ok, senju_test_output = run_command(str(task["test_cmd"])) if candidate_passed else (False, test_output)
    return {
        "META": {
            "approved": bool(candidate_passed),
            "basis": "generated candidate passed declared task test",
        },
        "X": {
            "approved": bool(candidate_passed and diff_ok and only_expected),
            "basis": "diff-check passed and patch stayed inside declared output_file",
            "changed_files": files,
            "diff_check": diff_output,
        },
        "SENJU": {
            "approved": bool(candidate_passed and senju_test_ok and not protected),
            "basis": "independent test replay and production apply-scope review",
            "test_output": senju_test_output,
            "protected_control_path": protected,
        },
    }


def consensus(votes: Mapping[str, Any]) -> bool:
    return all(bool((votes.get(actor) or {}).get("approved")) for actor in APPROVERS)


def apply_patch(*, task: Mapping[str, Any], lineage_id: str, target_ref: str) -> dict[str, Any]:
    output_file = str(task["output_file"])
    if is_protected_path(output_file):
        return {"applied": False, "reason": "protected control path requires authority outside this lineage"}

    add_ok, add_output = run_command(f"git add -- {json.dumps(output_file)}")
    if not add_ok:
        return {"applied": False, "reason": "git_add_failed", "output": add_output}
    diff_ok, _ = run_command("git diff --cached --quiet")
    if diff_ok:
        return {"applied": False, "reason": "no_patch_to_apply"}

    commit_message = f"closed-loop: {task['task_id']} [{lineage_id}]"
    commit_ok, commit_output = run_command(f"git commit -m {json.dumps(commit_message)}")
    if not commit_ok:
        return {"applied": False, "reason": "commit_failed", "output": commit_output}
    head_ok, head = run_command("git rev-parse HEAD")
    if not head_ok:
        return {"applied": False, "reason": "head_resolution_failed", "output": head}
    target_ref = _safe_repo_path(target_ref)
    push_ok, push_output = run_command(f"git push origin HEAD:{json.dumps(target_ref)}", timeout=300)
    return {
        "applied": push_ok,
        "commit_sha": head.strip(),
        "target_ref": target_ref,
        "push_output": push_output,
        "reason": "pushed_to_production_ref" if push_ok else "push_rejected",
    }


def audit_apply(task: Mapping[str, Any], apply_result: Mapping[str, Any]) -> dict[str, Any]:
    if not bool(apply_result.get("applied")):
        return {"passed": False, "reason": "nothing_was_applied"}
    test_ok, test_output = run_command(str(task["test_cmd"]))
    target_ref = str(apply_result.get("target_ref") or "")
    commit_sha = str(apply_result.get("commit_sha") or "")
    remote_ok, remote_output = run_command(f"git ls-remote origin refs/heads/{target_ref}")
    remote_sha = remote_output.split()[0] if remote_ok and remote_output.split() else ""
    return {
        "passed": bool(test_ok and remote_ok and remote_sha == commit_sha),
        "test_passed": test_ok,
        "test_output": test_output,
        "remote_verified": bool(remote_ok and remote_sha == commit_sha),
        "remote_sha": remote_sha,
        "commit_sha": commit_sha,
    }


def persist_lineage(lineage: Mapping[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(lineage), ensure_ascii=False, indent=2, default=list) + "\n", encoding="utf-8")


def execute(
    *,
    task_id: str,
    max_iterations: int,
    target_ref: str,
    apply_to_production: bool,
    state_path: Path,
) -> dict[str, Any]:
    task = load_task(task_id)
    run_seed = os.environ.get("GITHUB_RUN_ID") or str(time.time_ns())
    lineage_id = f"lineage-{_stable_id(task['task_id'], run_seed, target_ref)}"
    lineage: dict[str, Any] = {
        "schema": SCHEMA,
        "lineage_id": lineage_id,
        "environment": "production",
        "task_id": task["task_id"],
        "target_ref": target_ref,
        "phase": "detection",
        "status": "started",
        "events": [],
        "attempts": [],
        "approvals": {},
        "apply": {},
        "audit": {},
        "pass_declared": False,
    }

    event(
        lineage,
        "detection",
        "META",
        "detected",
        finding={"name": task["name"], "goal": task["goal"], "output_file": task["output_file"]},
    )

    output_path = ROOT / str(task["output_file"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    original_exists = output_path.exists()
    original = output_path.read_text(encoding="utf-8") if original_exists else None

    final_passed = False
    final_test_output = ""
    try:
        for iteration in range(1, max(1, int(max_iterations)) + 1):
            actor = GENERATOR_ORDER[(iteration - 1) % len(GENERATOR_ORDER)]
            code = generate_code(task, actor, list(lineage["attempts"]))
            output_path.write_text(code, encoding="utf-8")
            passed, test_output = run_command(str(task["test_cmd"]))
            attempt = {
                "iteration": iteration,
                "actor": actor,
                "code_sha256": hashlib.sha256(code.encode("utf-8")).hexdigest(),
                "code": code,
                "passed": passed,
                "test_output": test_output,
            }
            lineage["attempts"].append(attempt)
            event(
                lineage,
                "fix",
                actor,
                "candidate_passed" if passed else "candidate_failed",
                iteration=iteration,
                code_sha256=attempt["code_sha256"],
            )
            final_passed = passed
            final_test_output = test_output
            if passed:
                break

        if not final_passed:
            event(lineage, "approval", "META/X/SENJU", "rejected", reason="no passing patch candidate")
            if original_exists and original is not None:
                output_path.write_text(original, encoding="utf-8")
            elif output_path.exists():
                output_path.unlink()
            persist_lineage(lineage, state_path)
            return lineage

        votes = approval_votes(task, candidate_passed=final_passed, test_output=final_test_output)
        lineage["approvals"] = votes
        for actor in APPROVERS:
            event(
                lineage,
                "approval",
                actor,
                "approved" if votes[actor]["approved"] else "rejected",
                basis=votes[actor].get("basis"),
            )

        if not consensus(votes):
            protected = is_protected_path(str(task["output_file"]))
            lineage["status"] = "approval_pending_external" if protected else "approval_rejected"
            persist_lineage(lineage, state_path)
            return lineage

        if not apply_to_production:
            event(lineage, "apply", "META/X/SENJU", "not_applied", reason="apply_to_production=false")
            persist_lineage(lineage, state_path)
            return lineage

        if os.environ.get("WORLD_ENV", "production").strip().lower() not in {"production", "prod", "live", "real"}:
            event(lineage, "apply", "META/X/SENJU", "rejected", reason="WORLD_ENV is not production")
            persist_lineage(lineage, state_path)
            return lineage

        applied = apply_patch(task=task, lineage_id=lineage_id, target_ref=target_ref)
        lineage["apply"] = applied
        event(
            lineage,
            "apply",
            "META/X/SENJU",
            "applied" if applied.get("applied") else "apply_failed",
            commit_sha=applied.get("commit_sha"),
            reason=applied.get("reason"),
        )

        audit = audit_apply(task, applied)
        lineage["audit"] = audit
        for actor in APPROVERS:
            event(
                lineage,
                "audit",
                actor,
                "audit_pass" if audit.get("passed") else "audit_fail",
                commit_sha=audit.get("commit_sha"),
                remote_verified=audit.get("remote_verified"),
            )

        lineage["pass_declared"] = bool(audit.get("passed"))
        event(
            lineage,
            "pass",
            "META/X/SENJU",
            "PASS" if lineage["pass_declared"] else "FAIL",
            commit_sha=audit.get("commit_sha"),
        )
        persist_lineage(lineage, state_path)
        return lineage
    except Exception as exc:
        event(lineage, str(lineage.get("phase") or "unknown"), "SYSTEM", "error", error=str(exc))
        persist_lineage(lineage, state_path)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one production closed-loop lineage")
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--max-iterations", type=int, default=8)
    parser.add_argument("--target-ref", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--state-out")
    args = parser.parse_args()

    state_path = Path(args.state_out) if args.state_out else DEFAULT_STATE_DIR / f"{args.task_id}.json"
    result = execute(
        task_id=args.task_id,
        max_iterations=args.max_iterations,
        target_ref=args.target_ref,
        apply_to_production=args.apply,
        state_path=state_path,
    )
    print(json.dumps({
        "lineage_id": result["lineage_id"],
        "phase": result["phase"],
        "status": result["status"],
        "pass_declared": result["pass_declared"],
        "state_path": str(state_path),
    }, ensure_ascii=False, indent=2))
    return 0 if result["pass_declared"] or result["status"] in {"approval_pending_external", "approval_rejected", "rejected"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
