"""
Self-development loop: X reads its own engine source, generates improvements,
validates them, pushes to GitHub, and shares findings with Senju.

Cycle:
  1. Read engine/*.py
  2. LLM generates JSON patch {file, old_code, new_code, rationale, test_cmd}
  3. Apply patch (str.replace)
  4. Validate: py_compile + optional test subprocess
  5. Push via GitHub API
  6. Log to SELF_DEV_LOG and SENJU_KNOWLEDGE
"""

import base64
import json
import os
import py_compile
import subprocess
import time
from pathlib import Path

from .model_client import get_client, strip_fences

ROOT = Path(__file__).resolve().parents[3]
ENGINE_DIR = Path(__file__).parent
STATE_DIR = Path(__file__).parents[1] / "meta_state"
SENJU_KNOWLEDGE = ROOT / "senju" / "knowledge" / "codegen_patterns.ndjson"
SELF_DEV_LOG = STATE_DIR / "self_dev_log.ndjson"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = os.environ.get("GITHUB_REPOSITORY", "MusicJapanLLC/test")
TARGET_BRANCH = os.environ.get("SELF_DEV_BRANCH", "claude/employee-onboarding-setup-udm86")

PATCH_PROMPT = """You are a self-improving code generation engine.

Review these Python source files and identify ONE concrete improvement:
- Fix a bug or error-handling gap
- Improve robustness or retry logic
- Reduce code duplication
- Improve a prompt for better LLM output quality

FOCUS HINT (prioritize if non-empty): {focus}

Source files:
{sources}

Output ONLY a JSON object, no explanation:
{{
  "file": "filename.py (just the basename, no path)",
  "old_code": "exact string to find and replace (must appear verbatim in the file)",
  "new_code": "replacement string",
  "rationale": "one sentence",
  "test_cmd": "pytest command to validate, or empty string"
}}

Rules:
- old_code MUST be a verbatim substring of the file content shown
- Keep the patch minimal; do not rewrite entire functions unless necessary
- If no improvement is needed, return {{"file": "", "old_code": "", "new_code": "", "rationale": "no change needed", "test_cmd": ""}}
"""


def read_engine_source() -> dict[str, str]:
    sources = {}
    for f in sorted(ENGINE_DIR.glob("*.py")):
        if f.name.startswith("__"):
            continue
        try:
            sources[f.name] = f.read_text()
        except Exception:
            pass
    return sources


def generate_improvement(client, sources: dict[str, str], focus: str = "") -> dict:
    snippets = "\n\n".join(
        f"### {name} ###\n{content[:3000]}" for name, content in sources.items()
    )
    prompt = PATCH_PROMPT.format(focus=focus or "(none)", sources=snippets)
    raw = strip_fences(client.complete(prompt, max_tokens=2048))
    try:
        return json.loads(raw)
    except Exception:
        return {"file": "", "old_code": "", "new_code": "", "rationale": f"parse error: {raw[:200]}", "test_cmd": ""}


def apply_patch(patch: dict) -> tuple[bool, str]:
    fname = patch.get("file", "")
    old_code = patch.get("old_code", "")
    new_code = patch.get("new_code", "")

    if not fname or not old_code:
        return False, "empty patch"

    target = ENGINE_DIR / fname
    if not target.exists():
        return False, f"file not found: {fname}"

    content = target.read_text()
    if old_code not in content:
        return False, f"old_code not found verbatim in {fname}"

    new_content = content.replace(old_code, new_code, 1)
    target.write_text(new_content)
    return True, new_content


def validate_patch(file_path: Path, test_cmd: str) -> tuple[bool, str]:
    try:
        py_compile.compile(str(file_path), doraise=True)
    except py_compile.PyCompileError as e:
        return False, f"compile error: {e}"

    if test_cmd:
        try:
            result = subprocess.run(
                test_cmd, shell=True, capture_output=True, text=True,
                timeout=60, cwd=str(ROOT)
            )
            if result.returncode != 0:
                return False, f"test failed:\n{result.stdout[-500:]}\n{result.stderr[-500:]}"
        except subprocess.TimeoutExpired:
            return False, "test timeout"
        except Exception as e:
            return False, f"test error: {e}"

    return True, "ok"


def push_improvement_to_github(file_name: str, new_content: str, description: str) -> bool:
    if not GITHUB_TOKEN:
        return False

    import urllib.request
    import urllib.error

    path = f"automation/codegen/engine/{file_name}"
    api_url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(api_url, headers={**headers, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            current = json.loads(resp.read())
            sha = current.get("sha", "")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            sha = ""
        else:
            return False

    payload = json.dumps({
        "message": f"self-dev: {description} [skip ci]",
        "content": base64.b64encode(new_content.encode()).decode(),
        "branch": TARGET_BRANCH,
        **({
            "sha": sha} if sha else {}),
    }).encode()

    req = urllib.request.Request(api_url, data=payload, headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(req):
            return True
    except Exception:
        return False


def _append_ndjson(path: Path, record: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def run_self_dev_cycle(client=None, focus: str = "") -> dict:
    if client is None:
        client = get_client()

    sources = read_engine_source()
    patch = generate_improvement(client, sources, focus)

    result = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "focus": focus,
        "file": patch.get("file", ""),
        "rationale": patch.get("rationale", ""),
        "applied": False,
        "validated": False,
        "pushed": False,
        "error": "",
    }

    if not patch.get("file"):
        result["error"] = patch.get("rationale", "no patch generated")
        _append_ndjson(SELF_DEV_LOG, result)
        return result

    applied, content_or_err = apply_patch(patch)
    result["applied"] = applied
    if not applied:
        result["error"] = content_or_err
        _append_ndjson(SELF_DEV_LOG, result)
        return result

    new_content = content_or_err
    target_path = ENGINE_DIR / patch["file"]
    valid, val_msg = validate_patch(target_path, patch.get("test_cmd", ""))
    result["validated"] = valid

    if not valid:
        original = sources.get(patch["file"], "")
        if original:
            target_path.write_text(original)
        result["error"] = val_msg
        _append_ndjson(SELF_DEV_LOG, result)
        return result

    pushed = push_improvement_to_github(patch["file"], new_content, patch["rationale"])
    result["pushed"] = pushed

    _append_ndjson(SELF_DEV_LOG, result)
    _append_ndjson(SENJU_KNOWLEDGE, {
        "source": "self_dev",
        "ts": result["ts"],
        "file": patch["file"],
        "rationale": patch["rationale"],
        "pushed": pushed,
    })

    print(f"[self-dev] {patch['file']}: {patch['rationale']} | valid={valid} pushed={pushed}")
    return result
