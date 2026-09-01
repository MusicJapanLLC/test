"""
X Self-Dev Engine — autonomous code improvement cycle.

Reads own engine source -> LLM generates JSON patch ->
validate (py_compile + test) -> push via GitHub API -> log.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ENGINE_DIR = Path(__file__).parent
STATE_DIR = Path(__file__).parents[1] / "meta_state"
SENJU_KNOWLEDGE = ROOT / "senju" / "knowledge" / "codegen_patterns.ndjson"
SELF_DEV_LOG = STATE_DIR / "self_dev_log.ndjson"
TARGET_BRANCH = os.environ.get("SELF_DEV_BRANCH", "claude/employee-onboarding-setup-udm86")
GITHUB_REPO = os.environ.get("GITHUB_REPOSITORY", "musicjapanllc/test")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
MAX_FILE_CHARS = 6000


def _ts() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _append(path: Path, record: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_engine_source() -> dict[str, str]:
    sources = {}
    for f in ENGINE_DIR.glob("*.py"):
        text = f.read_text(errors="replace")
        sources[f.name] = text[:MAX_FILE_CHARS]
    return sources


def generate_improvement(client, sources: dict[str, str], focus: str = "") -> dict:
    source_dump = "\n\n".join(
        f"# {name}\n{code}" for name, code in list(sources.items())[:4]
    )
    focus_hint = f"\n\nFocus area: {focus}" if focus else ""
    prompt = (
        "You are improving a Python AI code-generation engine. "
        "Analyze these source files and propose ONE concrete improvement.\n\n"
        f"{source_dump}{focus_hint}\n\n"
        "Respond with ONLY valid JSON (no markdown) with keys:\n"
        "  file: filename to edit (must be one of the listed files)\n"
        "  old_code: exact substring to replace (5-30 lines)\n"
        "  new_code: replacement code\n"
        "  rationale: one sentence why this improves performance\n"
        "  test_cmd: python one-liner to validate (must return 0)\n"
        "The improvement must be safe, testable, and non-breaking."
    )
    raw = client.complete(prompt, max_tokens=2048)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def apply_patch(patch: dict) -> tuple[bool, str]:
    file_path = ENGINE_DIR / patch["file"]
    if not file_path.exists():
        return False, f"file not found: {patch['file']}"
    original = file_path.read_text()
    old = patch.get("old_code", "")
    new = patch.get("new_code", "")
    if old not in original:
        return False, "old_code not found in file"
    updated = original.replace(old, new, 1)
    file_path.write_text(updated)
    return True, updated


def validate_patch(file_name: str, test_cmd: str) -> tuple[bool, str]:
    file_path = ENGINE_DIR / file_name
    try:
        import py_compile
        py_compile.compile(str(file_path), doraise=True)
    except Exception as e:
        return False, f"compile error: {e}"
    if test_cmd:
        result = subprocess.run(
            [sys.executable, "-c", test_cmd],
            capture_output=True, text=True, timeout=30,
            cwd=str(ENGINE_DIR.parent)
        )
        if result.returncode != 0:
            return False, f"test failed: {result.stderr[:300]}"
    return True, "ok"


def push_improvement_to_github(file_name: str, new_content: str, description: str) -> bool:
    if not GITHUB_TOKEN:
        return False
    api_base = "https://api.github.com"
    rel_path = f"automation/codegen/engine/{file_name}"
    url = f"{api_base}/repos/{GITHUB_REPO}/contents/{rel_path}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "x-self-dev/1.0",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            current = json.loads(resp.read())
        sha = current["sha"]
    except Exception as e:
        print(f"[self-dev] SHA fetch failed: {e}")
        return False
    payload = json.dumps({
        "message": f"[self-dev] {description}",
        "content": base64.b64encode(new_content.encode()).decode(),
        "sha": sha,
        "branch": TARGET_BRANCH,
    }).encode()
    try:
        req = urllib.request.Request(url, data=payload, headers={
            **headers, "Content-Type": "application/json"
        }, method="PUT")
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        return True
    except Exception as e:
        print(f"[self-dev] push failed: {e}")
        return False


def run_self_dev_cycle(client=None, focus: str = "") -> dict:
    from .model_client import get_client
    if client is None:
        client = get_client()

    sources = read_engine_source()
    result = {"ts": _ts(), "applied": False, "pushed": False}

    try:
        patch = generate_improvement(client, sources, focus)
        result["file"] = patch.get("file", "")
        result["rationale"] = patch.get("rationale", "")
    except Exception as e:
        result["error"] = f"generate: {e}"
        _append(SELF_DEV_LOG, result)
        return result

    ok, content_or_err = apply_patch(patch)
    if not ok:
        result["error"] = f"apply: {content_or_err}"
        _append(SELF_DEV_LOG, result)
        return result

    valid, msg = validate_patch(patch["file"], patch.get("test_cmd", ""))
    if not valid:
        # Roll back
        (ENGINE_DIR / patch["file"]).write_text(sources[patch["file"]])
        result["error"] = f"validate: {msg}"
        _append(SELF_DEV_LOG, result)
        return result

    result["applied"] = True
    pushed = push_improvement_to_github(
        patch["file"], content_or_err, patch.get("rationale", "self-dev patch")
    )
    result["pushed"] = pushed

    _append(SELF_DEV_LOG, result)
    if pushed:
        _append(SENJU_KNOWLEDGE, {
            **result,
            "source": "X_self_dev",
            "event": "engine_improvement",
            "domain": "self_modification",
            "task_name": f"self_dev_{patch['file']}",
            "code": patch.get("new_code", "")[:500],
        })
    return result
