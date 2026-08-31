#!/usr/bin/env python3
"""META/X/Senju production repair lineage.

Carries one lineage_id through:

    Detection(META)
      -> Fix(META + X)
      -> Approval(META + X + Senju)
      -> ready_for_apply

The existing production auto-merge lane performs Apply. A read-only post-merge
auditor consumes the same lineage receipt and performs Audit -> PASS.

This module never widens its own authority. Guard, credential, authority,
emergency-stop, workflow-policy and related control-plane files are retained in
the lineage as findings but are not approved for autonomous production apply.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Mapping, Sequence

ROOT = Path(__file__).resolve().parents[2]
TASKS_DIR = ROOT / "automation" / "codegen" / "tasks"
AGENTS_DIR = ROOT / "automation" / "codegen" / "agents"
SCHEMA = "the-world-detection-fix-approval-apply-audit/v2"
APPROVERS = ("META", "X", "SENJU")
GENERATOR_ORDER = ("META", "X")

_PROTECTED_EXACT = {
    "automation/security/workflow_policy.py",
    "automation/security/workflow_policy_entrypoint.py",
    "automation/world/authority_checkpoint.py",
    "automation/world/production_evolution_loop.py",
    "automation/world/replica_authority.py",
    "senju/senju/meta/self_governance_lab.py",
    "senju/senju/meta/standing_authorization.py",
    "senju/senju/credential_runtime.py",
    "senju/senju/authority_factory.py",
}
_PROTECTED_PREFIXES = (
    ".github/",
    "automation/recovery/",
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
    "kill_switch",
    "kill-switch",
)
_ALLOWED_TEST_PREFIXES = (
    ("python", "-m", "pytest"),
    ("python3", "-m", "pytest"),
    ("pytest",),
)


class LineageError(RuntimeError):
    pass


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _stable_id(*parts: object, length: int = 28) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:length]


def lineage_id_for(*, detection_id: str, task_id: str, target_ref: str) -> str:
    return f"lineage-{_stable_id(detection_id, task_id, target_ref)}"


def _safe_repo_path(raw: str) -> str:
    value = str(raw).strip().replace("\\", "/")
    path = Path(value)
    if not value or path.is_absolute() or ".." in path.parts:
        raise LineageError(f"unsafe repository path: {raw!r}")
    return value


def is_protected_path(path: str) -> bool:
    value = _safe_repo_path(path).lower()
    if value in {p.lower() for p in _PROTECTED_EXACT}:
        return True
    if any(value.startswith(prefix.lower()) for prefix in _PROTECTED_PREFIXES):
        return True
    return any(token in value for token in _PROTECTED_TOKENS)


def parse_test_command(raw: str) -> tuple[str, ...]:
    value = str(raw).strip()
    if not value:
        raise LineageError("test_cmd cannot be empty")
    argv = tuple(shlex.split(value))
    if not argv:
        raise LineageError("test_cmd cannot be empty")
    if not any(argv[: len(prefix)] == prefix for prefix in _ALLOWED_TEST_PREFIXES):
        raise LineageError("production lineage test_cmd must be pytest")
    return argv


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
    data["test_argv"] = parse_test_command(str(data["test_cmd"]))
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


def build_prompt(task: Mapping[str, Any], actor: str, attempts: Sequence[Mapping[str, Any]]) -> str:
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
        parts.append("Previous lineage attempts (most recent last):")
        for attempt in attempts[-3:]:
            parts.append(
                f"Actor={attempt['actor']} passed={attempt['passed']}\n"
                f"Candidate:\n{attempt['code']}\n"
                f"Test output:\n{str(attempt['test_output'])[-5000:]}"
            )
    return "\n\n".join(parts)


def _strip_fences(text: str) -> str:
    code = str(text).strip()
    if code.startswith("```"):
        lines = code.splitlines()
        code = "\n".join(lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:])
    if not code.strip():
        raise LineageError("generator returned an empty patch")
    return code.rstrip() + "\n"


def _generate_with_copilot(prompt: str) -> str:
    if not shutil.which("copilot"):
        raise LineageError("copilot CLI is not installed")
    result = subprocess.run(
        [
            "copilot",
            "-p",
            prompt,
            "-s",
            "--allow-tool=read",
            "--deny-tool=write",
            "--deny-tool=shell",
            "--deny-tool=url",
            "--no-ask-user",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=420,
    )
    if result.returncode != 0:
        raise LineageError(f"copilot generation failed: {result.stderr[-3000:]}")
    return _strip_fences(result.stdout)


def _generate_with_anthropic(prompt: str, agent: Mapping[str, Any]) -> str:
    try:
        import anthropic  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise LineageError("anthropic package is not installed") from exc
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise LineageError("ANTHROPIC_API_KEY is not configured")
    client = anthropic.Anthropic(api_key=key)
    message = client.messages.create(
        model=str(agent.get("model") or "claude-sonnet-4-6"),
        max_tokens=int(agent.get("max_tokens") or 8192),
        messages=[{"role": "user", "content": prompt}],
    )
    return _strip_fences(str(message.content[0].text))


def generate_code(task: Mapping[str, Any], actor: str, attempts: Sequence[Mapping[str, Any]]) -> str:
    agent = load_agent(actor)
    prompt = build_prompt(task, actor, attempts)
    backend = os.environ.get("LINEAGE_GENERATOR_BACKEND", "auto").strip().lower()
    if backend not in {"auto", "copilot", "anthropic"}:
        raise LineageError(f"unsupported generator backend: {backend}")
    if backend in {"auto", "copilot"} and shutil.which("copilot"):
        return _generate_with_copilot(prompt)
    if backend == "copilot":
        raise LineageError("copilot backend requested but CLI is unavailable")
    return _generate_with_anthropic(prompt, agent)


def run_tests(test_argv: Sequence[str], *, timeout: int = 300) -> tuple[bool, str]:
    result = subprocess.run(
        list(test_argv),
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def _git(*args: str, timeout: int = 120) -> tuple[bool, str]:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return result.returncode == 0, (result.stdout + result.stderr).strip()


def changed_files() -> tuple[str, ...]:
    ok, out = _git("status", "--porcelain", "--untracked-files=all")
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
    diff_ok, diff_output = _git("diff", "--check")
    files = changed_files()
    only_expected = bool(files) and set(files) == {output_file}
    protected = is_protected_path(output_file)
    senju_test_ok, senju_test_output = run_tests(task["test_argv"]) if candidate_passed else (False, test_output)
    return {
        "META": {
            "approved": bool(candidate_passed),
            "basis": "selected candidate passed the declared pytest contract",
        },
        "X": {
            "approved": bool(candidate_passed and diff_ok and only_expected),
            "basis": "diff-check passed and the patch stayed inside the declared output_file",
            "changed_files": files,
            "diff_check": diff_output,
        },
        "SENJU": {
            "approved": bool(candidate_passed and senju_test_ok and not protected),
            "basis": "independent pytest replay plus production control-plane scope review",
            "test_output": senju_test_output,
            "protected_control_path": protected,
        },
    }


def consensus(votes: Mapping[str, Any]) -> bool:
    return all(bool((votes.get(actor) or {}).get("approved")) for actor in APPROVERS)


def public_receipt(lineage: Mapping[str, Any]) -> dict[str, Any]:
    attempts = []
    for row in lineage.get("attempts") or []:
        if not isinstance(row, Mapping):
            continue
        attempts.append({
            "iteration": row.get("iteration"),
            "actor": row.get("actor"),
            "passed": bool(row.get("passed")),
            "code_sha256": row.get("code_sha256"),
        })
    return {
        "schema": SCHEMA,
        "lineage_id": lineage.get("lineage_id"),
        "detection_id": lineage.get("detection_id"),
        "task_id": lineage.get("task_id"),
        "target_ref": lineage.get("target_ref"),
        "output_file": lineage.get("output_file"),
        "test_cmd": lineage.get("test_cmd"),
        "phase": lineage.get("phase"),
        "status": lineage.get("status"),
        "attempts": attempts,
        "selected_actor": lineage.get("selected_actor"),
        "selected_code_sha256": lineage.get("selected_code_sha256"),
        "approvals": lineage.get("approvals"),
    }


def write_receipt_markdown(lineage: Mapping[str, Any], path: Path) -> None:
    receipt = public_receipt(lineage)
    approvals = receipt.get("approvals") or {}
    lines = [
        "## META / X / Senju Closed Production Lineage",
        "",
        f"- Lineage: `{receipt['lineage_id']}`",
        f"- Detection: `{receipt['detection_id']}`",
        f"- Task: `{receipt['task_id']}`",
        f"- Output: `{receipt['output_file']}`",
        f"- Selected patch: `{receipt['selected_code_sha256']}` by **{receipt['selected_actor']}**",
        f"- META approval: **{'PASS' if (approvals.get('META') or {}).get('approved') else 'FAIL'}**",
        f"- X approval: **{'PASS' if (approvals.get('X') or {}).get('approved') else 'FAIL'}**",
        f"- Senju approval: **{'PASS' if (approvals.get('SENJU') or {}).get('approved') else 'FAIL'}**",
        "- Apply: **pending existing production auto-merge lane**",
        "- Audit/PASS: **pending post-merge lineage auditor**",
        "",
        "The same lineage ID is preserved through detection, patch generation, approval, production apply and post-merge audit.",
        "",
        "<!-- CLOSED_LINEAGE_RECEIPT",
        json.dumps(receipt, ensure_ascii=False, sort_keys=True),
        "CLOSED_LINEAGE_RECEIPT -->",
        "",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def persist_lineage(lineage: Mapping[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(lineage), ensure_ascii=False, indent=2, default=list) + "\n", encoding="utf-8")


def execute(
    *,
    task_id: str,
    detection_id: str,
    max_iterations: int,
    target_ref: str,
    state_path: Path,
    receipt_path: Path | None = None,
) -> dict[str, Any]:
    task = load_task(task_id)
    detection = str(detection_id).strip() or f"manual:{task['task_id']}"
    target = str(target_ref).strip()
    if not target:
        raise LineageError("target_ref cannot be empty")
    lineage_id = lineage_id_for(detection_id=detection, task_id=task["task_id"], target_ref=target)
    lineage: dict[str, Any] = {
        "schema": SCHEMA,
        "lineage_id": lineage_id,
        "environment": "production",
        "detection_id": detection,
        "task_id": task["task_id"],
        "target_ref": target,
        "output_file": task["output_file"],
        "test_cmd": task["test_cmd"],
        "phase": "detection",
        "status": "started",
        "events": [],
        "attempts": [],
        "approvals": {},
        "selected_actor": None,
        "selected_code_sha256": None,
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
    best: dict[str, Any] | None = None

    try:
        budget = max(2, int(max_iterations))
        for iteration in range(1, budget + 1):
            actor = GENERATOR_ORDER[(iteration - 1) % len(GENERATOR_ORDER)]
            code = generate_code(task, actor, list(lineage["attempts"]))
            output_path.write_text(code, encoding="utf-8")
            passed, test_output = run_tests(task["test_argv"])
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
            if passed:
                best = attempt
            # META and X both generate at least once. After that, the latest passing
            # candidate can advance to the three-way approval stage.
            if iteration >= 2 and passed:
                break

        if best is None:
            event(lineage, "approval", "META/X/SENJU", "rejected", reason="no passing patch candidate")
            if original_exists and original is not None:
                output_path.write_text(original, encoding="utf-8")
            elif output_path.exists():
                output_path.unlink()
            persist_lineage(lineage, state_path)
            if receipt_path:
                write_receipt_markdown(lineage, receipt_path)
            return lineage

        selected_code = str(best["code"])
        if output_path.read_text(encoding="utf-8") != selected_code:
            output_path.write_text(selected_code, encoding="utf-8")
            replay_ok, replay_output = run_tests(task["test_argv"])
            if not replay_ok:
                event(lineage, "fix", str(best["actor"]), "selected_candidate_replay_failed", test_output=replay_output)
                persist_lineage(lineage, state_path)
                if receipt_path:
                    write_receipt_markdown(lineage, receipt_path)
                return lineage
            event(lineage, "fix", str(best["actor"]), "selected_best_candidate", code_sha256=best["code_sha256"])

        lineage["selected_actor"] = best["actor"]
        lineage["selected_code_sha256"] = best["code_sha256"]
        votes = approval_votes(task, candidate_passed=True, test_output=str(best["test_output"]))
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
            lineage["status"] = "approval_pending_external" if is_protected_path(str(task["output_file"])) else "approval_rejected"
        else:
            event(
                lineage,
                "handoff",
                "META/X/SENJU",
                "ready_for_apply",
                target_ref=target,
                selected_code_sha256=best["code_sha256"],
            )

        persist_lineage(lineage, state_path)
        if receipt_path:
            write_receipt_markdown(lineage, receipt_path)
        return lineage
    except Exception as exc:
        event(lineage, str(lineage.get("phase") or "unknown"), "SYSTEM", "error", error=str(exc))
        persist_lineage(lineage, state_path)
        if receipt_path:
            write_receipt_markdown(lineage, receipt_path)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Build one META/X/Senju production repair lineage")
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--detection-id", default="")
    parser.add_argument("--max-iterations", type=int, default=8)
    parser.add_argument("--target-ref", required=True)
    parser.add_argument("--state-out", required=True)
    parser.add_argument("--receipt-out")
    args = parser.parse_args()

    result = execute(
        task_id=args.task_id,
        detection_id=args.detection_id,
        max_iterations=args.max_iterations,
        target_ref=args.target_ref,
        state_path=Path(args.state_out),
        receipt_path=Path(args.receipt_out) if args.receipt_out else None,
    )
    print(json.dumps({
        "lineage_id": result["lineage_id"],
        "phase": result["phase"],
        "status": result["status"],
        "task_id": result["task_id"],
        "output_file": result["output_file"],
        "selected_code_sha256": result.get("selected_code_sha256"),
    }, ensure_ascii=False, indent=2))
    return 0 if result["status"] in {"ready_for_apply", "approval_pending_external", "approval_rejected", "rejected"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
