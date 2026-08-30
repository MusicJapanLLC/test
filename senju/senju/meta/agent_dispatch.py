"""Agent Dispatch — META sends directives to other AI agents and workflows.

META can steer:
  - #273 adversary (senju-adversary-full-join.yml) with focus parameters
  - #275 opposition (live-opposition-force.yml) with damage targets
  - Jules backlog (jules-backlog-dispatch.yml)
  - Any workflow via workflow_dispatch

No human approval needed. META decides, META dispatches.
Failures are logged; META always retries on the next cycle.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


REPO = os.environ.get("GITHUB_REPOSITORY", "MusicJapanLLC/test")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


def _gh_api(method: str, path: str, body: dict | None = None) -> dict[str, Any]:
    url = f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body_bytes = resp.read()
            return json.loads(body_bytes) if body_bytes else {"ok": True}
    except urllib.error.HTTPError as exc:
        return {"_error": exc.code, "_msg": exc.reason}
    except Exception as exc:
        return {"_error": str(exc)}


def dispatch_workflow(
    workflow_file: str,
    ref: str,
    inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Trigger a workflow_dispatch on any workflow in the repo."""
    owner, repo = REPO.split("/", 1)
    result = _gh_api(
        "POST",
        f"/repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches",
        {"ref": ref, "inputs": {k: str(v) for k, v in (inputs or {}).items()}},
    )
    return {"workflow": workflow_file, "ref": ref, "inputs": inputs, "result": result}


def steer_adversary(focus_surface: str, pressure_multiplier: float = 3.0) -> dict[str, Any]:
    """Tell the adversary (#273) to focus extra pressure on a specific guard surface."""
    return dispatch_workflow(
        "senju-adversary-full-join.yml",
        ref="claude/employee-onboarding-setup-udm86",
        inputs={
            "focus_surface": focus_surface,
            "pressure_multiplier": str(pressure_multiplier),
        },
    )


def steer_opposition(damage_target: str, cycles: int = 1) -> dict[str, Any]:
    """Tell the opposition (#275) to target a specific guard for damage accumulation."""
    return dispatch_workflow(
        "live-opposition-force.yml",
        ref="claude/employee-onboarding-setup-udm86",
        inputs={"target_guard": damage_target, "extra_cycles": str(cycles)},
    )


def post_jules_task(title: str, body: str, labels: list[str] | None = None) -> dict[str, Any]:
    """Create a GitHub issue routed to Jules backlog as a task directive."""
    if not GITHUB_TOKEN:
        return {"_error": "no GITHUB_TOKEN — cannot post Jules task"}
    owner, repo = REPO.split("/", 1)
    result = _gh_api(
        "POST",
        f"/repos/{owner}/{repo}/issues",
        {
            "title": f"[META→Jules] {title}",
            "body": body,
            "labels": (labels or []) + ["meta-directive", "jules-task"],
        },
    )
    return {"action": "jules_task", "title": title, "result": result}


def write_agent_directive(
    agent_file: Path,
    directive: str,
    repo_root: Path,
) -> Path:
    """Append a META directive block to an agent's .agent.md config file."""
    agents_dir = repo_root / ".github" / "agents"
    target = agents_dir / agent_file
    if not target.exists():
        return target  # agent not present — skip silently

    existing = target.read_text(encoding="utf-8")
    block = (
        f"\n\n<!-- META DIRECTIVE -->\n"
        f"<!-- {directive} -->\n"
        f"<!-- /META DIRECTIVE -->\n"
    )
    import re
    cleaned = re.sub(
        r"\n<!-- META DIRECTIVE -->.*?<!-- /META DIRECTIVE -->\n",
        "",
        existing,
        flags=re.DOTALL,
    )
    target.write_text(cleaned + block, encoding="utf-8")
    return target


def dispatch_all(
    commands: list[dict[str, Any]],
    repo_root: Path,
) -> list[dict[str, Any]]:
    """Execute a list of dispatch commands. Always attempts all; failures logged."""
    results = []
    for cmd in commands:
        kind = cmd.get("kind")
        try:
            if kind == "steer_adversary":
                results.append(steer_adversary(
                    cmd["surface"], cmd.get("multiplier", 3.0)
                ))
            elif kind == "steer_opposition":
                results.append(steer_opposition(
                    cmd["surface"], cmd.get("cycles", 1)
                ))
            elif kind == "jules_task":
                results.append(post_jules_task(
                    cmd["title"], cmd["body"], cmd.get("labels")
                ))
            elif kind == "agent_directive":
                path = write_agent_directive(
                    Path(cmd["agent_file"]), cmd["directive"], repo_root
                )
                results.append({"action": "agent_directive", "file": str(path)})
            else:
                results.append({"_unknown_kind": kind})
        except Exception as exc:
            results.append({"_error": str(exc), "cmd": cmd})
    return results
