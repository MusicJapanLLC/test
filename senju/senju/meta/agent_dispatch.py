"""Agent Dispatch — META dispatches to Jules and other workflows."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO = os.environ.get("GITHUB_REPOSITORY", "MusicJapanLLC/test")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


def _gh_api(method: str, path: str, body: dict | None = None) -> dict[str, Any]:
    url = f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body_bytes = resp.read()
            return json.loads(body_bytes) if body_bytes else {"ok": True}
    except urllib.error.HTTPError as exc:
        return {"_error": exc.code, "_msg": exc.reason}
    except Exception as exc:
        return {"_error": str(exc)}


def dispatch_workflow(workflow_file: str, ref: str, inputs: dict[str, Any] | None = None) -> dict[str, Any]:
    owner, repo = REPO.split("/", 1)
    result = _gh_api("POST", f"/repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches",
                     {"ref": ref, "inputs": {k: str(v) for k, v in (inputs or {}).items()}})
    return {"workflow": workflow_file, "ref": ref, "inputs": inputs, "result": result}


def steer_adversary(focus_surface: str, pressure_multiplier: float = 3.0) -> dict[str, Any]:
    return dispatch_workflow("senju-adversary-full-join.yml", ref="claude/employee-onboarding-setup-udm86",
                             inputs={"focus_surface": focus_surface, "pressure_multiplier": str(pressure_multiplier)})


def steer_opposition(damage_target: str, cycles: int = 1) -> dict[str, Any]:
    return dispatch_workflow("live-opposition-force.yml", ref="claude/employee-onboarding-setup-udm86",
                             inputs={"target_guard": damage_target, "extra_cycles": str(cycles)})


def post_jules_task(title: str, body: str, labels: list[str] | None = None) -> dict[str, Any]:
    if not GITHUB_TOKEN:
        return {"_error": "no GITHUB_TOKEN"}
    owner, repo = REPO.split("/", 1)
    result = _gh_api("POST", f"/repos/{owner}/{repo}/issues",
                     {"title": f"[META→Jules] {title}", "body": body,
                      "labels": (labels or []) + ["meta-directive", "jules-task"]})
    return {"action": "jules_task", "title": title, "result": result}


def post_openhands_task(title: str, body: str) -> dict[str, Any]:
    """Delegate a bounded repository task to the installed OpenHands GitHub agent."""
    if not GITHUB_TOKEN:
        return {"_error": "no GITHUB_TOKEN"}
    owner, repo = REPO.split("/", 1)
    result = _gh_api("POST", f"/repos/{owner}/{repo}/issues", {
        "title": f"[META→OpenHands] {title}",
        "body": "@openhands\n\n" + body,
        "labels": ["meta-directive", "authority-retry", "openhands-task"],
    })
    return {"action": "openhands_task", "title": title, "result": result}


def write_agent_directive(agent_file: Path, directive: str, repo_root: Path) -> Path:
    target = repo_root / ".github" / "agents" / agent_file
    if not target.exists():
        return target
    existing = target.read_text(encoding="utf-8")
    block = f"\n\n<!-- META DIRECTIVE -->\n<!-- {directive} -->\n<!-- /META DIRECTIVE -->\n"
    cleaned = re.sub(r"\n<!-- META DIRECTIVE -->.*?<!-- /META DIRECTIVE -->\n", "", existing, flags=re.DOTALL)
    target.write_text(cleaned + block, encoding="utf-8")
    return target


def dispatch_all(commands: list[dict[str, Any]], repo_root: Path) -> list[dict[str, Any]]:
    results = []
    for cmd in commands:
        kind = cmd.get("kind")
        try:
            if kind == "steer_adversary":
                result = steer_adversary(cmd["surface"], cmd.get("multiplier", 3.0))
            elif kind == "steer_opposition":
                result = steer_opposition(cmd["surface"], cmd.get("cycles", 1))
            elif kind == "jules_task":
                result = post_jules_task(cmd["title"], cmd["body"], cmd.get("labels"))
            elif kind == "openhands_task":
                result = post_openhands_task(cmd["title"], cmd["body"])
            elif kind == "workflow":
                workflow_file = str(cmd.get("workflow_file") or "")
                if not workflow_file:
                    result = {"_error": "missing workflow_file"}
                else:
                    result = dispatch_workflow(workflow_file, str(cmd.get("ref") or "main"), cmd.get("inputs"))
            elif kind == "agent_directive":
                path = write_agent_directive(Path(cmd["agent_file"]), cmd["directive"], repo_root)
                result = {"action": "agent_directive", "file": str(path)}
            else:
                result = {"_unknown_kind": kind}
        except Exception as exc:
            result = {"_error": str(exc), "cmd": cmd}

        retry_meta = cmd.get("_authority_retry")
        if isinstance(retry_meta, dict) and isinstance(result, dict):
            result = {**result, "_authority_retry": retry_meta}
        results.append(result)
    return results
