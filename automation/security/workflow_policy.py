#!/usr/bin/env python3
"""Fail-closed policy for privileged GitHub Actions in THE WORLD.

Classification is capability-based. Every workflow with write/OIDC authority
must fit one reviewed class and satisfy its structural invariants; unknown
privilege is denied.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(".github/workflows")
WORKFLOWS = {p.name: p.read_text(encoding="utf-8") for p in ROOT.glob("*.y*ml")}

WRITE_RE = re.compile(
    r"(?m)^\s+(contents|actions|checks|deployments|issues|packages|pull-requests|statuses|pages|id-token|copilot-requests):\s*write\s*$"
)
PIN_RE = re.compile(r"uses:\s+([^\s#]+)")
FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
GATEWAY_PROTOCOL_RE = re.compile(
    r'(?m)^GATEWAY_PROTOCOL\s*=\s*"oidc-repository-v(?P<version>\d+)-(?P<label>[a-z0-9][a-z0-9-]*)"\s*$'
)
UNSAFE = (
    "pull_request_target:", "workflow_run:", "issue_comment:", "repository_dispatch:",
    "runs-on: self-hosted", "permissions: write-all", "write-all",
    "git push --force", "git push -f", "--yolo", "--allow-all-tools",
)
MIN_GATEWAY_PROTOCOL_VERSION = 4
MAX_OWNED_STRESS_WRITES = 100


def writes(body: str) -> set[str]:
    return {m.group(1) for m in WRITE_RE.finditer(body)}


def require(name: str, required: tuple[str, ...], forbidden: tuple[str, ...] = ()) -> str:
    body = WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required privileged workflow is missing")
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{name}: missing required guardrail: {marker}")
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{name}: contains forbidden capability: {marker}")
    return body


def validate_global_safety() -> None:
    for name, body in WORKFLOWS.items():
        if name == "security-guard.yml":
            continue
        for token in UNSAFE:
            if token in body:
                raise SystemExit(f"{name}: forbidden workflow capability: {token}")

        lines = body.splitlines()
        for i, line in enumerate(lines):
            if "uses: actions/checkout@" in line:
                block = "\n".join(lines[i:i + 8])
                if "persist-credentials: false" not in block:
                    raise SystemExit(f"{name}:{i + 1}: checkout must discard credentials")

        for match in PIN_RE.finditer(body):
            ref = match.group(1)
            if ref.startswith("./"):
                continue
            if "@" not in ref:
                raise SystemExit(f"{name}: action has no immutable ref: {ref}")
            version = ref.rsplit("@", 1)[1]
            if not FULL_SHA.fullmatch(version):
                raise SystemExit(f"{name}: action is not pinned to a full commit SHA: {ref}")


def validate_pages_lanes() -> set[str]:
    lanes: set[str] = set()
    for name, body in WORKFLOWS.items():
        got = writes(body)
        if "pages" not in got:
            continue
        lanes.add(name)
        if got - {"pages", "id-token"}:
            raise SystemExit(f"{name}: Pages lane has unrelated writes: {sorted(got)}")
        require(name, (
            "contents: read", "pages: write", "id-token: write", "name: github-pages",
            "actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128",
        ))
        if body.count("pages: write") != 1 or body.count("id-token: write") != 1:
            raise SystemExit(f"{name}: Pages/OIDC writes must occur exactly once")
        if "schedule:" in body:
            raise SystemExit(f"{name}: Pages deployment must not be scheduled")
        if "pull_request:" in body and "if: github.event_name != 'pull_request'" not in body:
            raise SystemExit(f"{name}: PR-triggered Pages workflow must suppress deployment on PR")
        if "push:" in body and "paths:" not in body:
            raise SystemExit(f"{name}: auto Pages deployment must be path-scoped")
    return lanes


def validate_task_worker() -> str:
    name = "the-world-task-worker.yml"
    body = require(
        name,
        (
            "contents: read", "actions: write", "id-token: write",
            "workflow_dispatch:", "schedule:", "cron: '*/5 * * * *'",
            "persist-credentials: false", "automation/world/task_worker.py",
            "gh workflow run", "Claim one personality-linked task",
            'gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${REVIEW_RUN_ID}"',
            "automation/world/external_feedback.py query --task-id",
            "task_worker.py finish-review --review /tmp/world-review.json",
        ),
        (
            "contents: write", "issues: write", "pull-requests: write",
            "packages: write", "deployments: write", "pages: write",
        ),
    )
    if writes(body) != {"actions", "id-token"}:
        raise SystemExit(f"{name}: unexpected writes {sorted(writes(body))}")

    evidence_markers = (
        "CONCLUSION=", ".conclusion //", '<<<"$DATA"',
        "external=workflow=='world-reality-agency.yml'",
        "verified=workflow_ok",
        "external_feedback.py query --task-id",
    )
    for marker in evidence_markers:
        if marker not in body:
            raise SystemExit(f"{name}: evidence reconciliation missing behavior: {marker}")
    if body.count("task_worker.py finish-review --review /tmp/world-review.json") < 2:
        raise SystemExit(f"{name}: verified and failed evidence paths must both close review")
    if "finish-review --review /tmp/world-review.json --result /tmp/world-review-result.json --success" not in body:
        raise SystemExit(f"{name}: verified prior review cannot be committed")
    if "finish-review --review /tmp/world-review.json --result /tmp/world-review-result.json --error" not in body:
        raise SystemExit(f"{name}: failed prior review cannot be recorded")

    if ("$" + "{{" + " secrets.") in body:
        raise SystemExit(f"{name}: long-lived Actions secrets are forbidden")

    client = Path("automation/world/task_worker.py").read_text(encoding="utf-8")
    for marker in (
        'AUDIENCE = "the-world-worker"',
        "ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
        'method="POST"',
        "https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/the-world-github-worker",
        "_oidc_token()", 'Authorization": f"Bearer {_oidc_token()}"',
        'urllib.parse.urlencode({"audience": AUDIENCE})',
    ):
        if marker not in client:
            raise SystemExit(f"task_worker.py: missing OIDC/gateway invariant: {marker}")
    match = GATEWAY_PROTOCOL_RE.search(client)
    if not match:
        raise SystemExit("task_worker.py: gateway protocol must use oidc-repository-vN-<label>")
    if int(match.group("version")) < MIN_GATEWAY_PROTOCOL_VERSION:
        raise SystemExit("task_worker.py: gateway protocol version regressed")
    return name


def validate_experiment_oidc_lanes(page_lanes: set[str], task_worker: str) -> set[str]:
    lanes: set[str] = set()
    candidates = {
        name for name, body in WORKFLOWS.items()
        if "id-token" in writes(body)
    } - page_lanes - {task_worker}
    secret_marker = "$" + "{{" + " secrets."

    for name in sorted(candidates):
        body = WORKFLOWS[name]
        got = writes(body)
        if got != {"contents", "id-token"}:
            raise SystemExit(f"{name}: unclassified OIDC write set: {sorted(got)}")
        for marker in (
            "contents: write", "actions: read", "id-token: write",
            "workflow_dispatch:", "schedule:", "persist-credentials: false",
            "automation/world/task_worker.py experiment-config",
            "automation/world/task_worker.py record-experiment",
            "senju/state/strategy.json", "CURRENT_BASE_SHA=", "force=false",
            "python -m senju.cli safety-check sim://",
            "python -m senju.cli safety-check https://example.com",
            "Base moved; safe promotion deferred",
        ):
            if marker not in body:
                raise SystemExit(f"{name}: OIDC experiment lane missing invariant: {marker}")
        if secret_marker in body or "pull_request:" in body:
            raise SystemExit(f"{name}: OIDC experiment lane authority is unsafe")
        if "git push " in body or "gh pr create" in body:
            raise SystemExit(f"{name}: promotion must use bounded GitHub ref API")
        if body.count("senju/state/strategy.json") < 2:
            raise SystemExit(f"{name}: promotion must re-read bounded strategy state")
        if "[.files[].filename]" not in body or "'[\"senju/state/strategy.json\"]'" not in body:
            raise SystemExit(f"{name}: promotion diff must prove strategy.json is the only changed file")
        lanes.add(name)
    return lanes


def _stress_write_count(body: str) -> int | None:
    match = re.search(r"for\s+\w+\s+in\s+\$\(seq\s+(\d+)\s+(\d+)\)", body)
    if not match:
        return None
    start, end = map(int, match.groups())
    if start < 1 or end < start:
        return None
    return end - start + 1


def validate_owned_issue_stress_lanes() -> set[str]:
    lanes: set[str] = set()
    for name, body in WORKFLOWS.items():
        if writes(body) != {"issues"} or name == "world-reality-agency.yml":
            continue
        for marker in (
            "contents: read", "issues: write", "workflow_dispatch:",
            "REPO: ${{ github.repository }}", "repos/${REPO}/issues/", "/comments",
        ):
            if marker not in body:
                raise SystemExit(f"{name}: owned issue stress lane missing invariant: {marker}")
        if "schedule:" in body or "pull_request:" in body:
            raise SystemExit(f"{name}: issue stress lane must not be scheduled/PR-triggered")
        if "push:" in body:
            quoted = (
                f'".github/workflows/{name}"' in body
                or f"'.github/workflows/{name}'" in body
            )
            if not quoted:
                raise SystemExit(f"{name}: push trigger must be scoped to itself")
        count = _stress_write_count(body)
        if count is None or count > MAX_OWNED_STRESS_WRITES:
            raise SystemExit(f"{name}: issue stress loop must be explicit and <= {MAX_OWNED_STRESS_WRITES}")
        if re.search(r"repos/[^$][^\s\"']*/issues/", body):
            raise SystemExit(f"{name}: issue stress target must be github.repository")
        lanes.add(name)
    return lanes


def validate_explicit_lanes() -> set[str]:
    expected = {
        "senju-autonomous-improver.yml": {"contents"},
        "tomoki-forge.yml": {"contents", "pull-requests", "copilot-requests"},
        "tomoki-manager.yml": {"actions", "copilot-requests"},
        "tomoki-hound.yml": {"copilot-requests"},
        "tomoki-skeptic.yml": {"copilot-requests"},
        "ai-factory-boss.yml": {"actions"},
        "the-world-realtime-kernel.yml": {"actions"},
        "the-core-autonomous-director.yml": {"actions", "copilot-requests"},
        "world-reality-agency.yml": {"issues"},
    }
    for name, want in expected.items():
        body = require(name, ("workflow_dispatch:", "schedule:", "persist-credentials: false"))
        got = writes(body)
        if got != want:
            raise SystemExit(f"{name}: write set drifted: expected={sorted(want)} actual={sorted(got)}")

    senju = WORKFLOWS["senju-autonomous-improver.yml"]
    for marker in (
        "senju/state/champion.json", "senju/state/strategy.json",
        "senju/state/last-evolution-summary.json", "senju/state/last-evolution-plan.md",
        "CURRENT_BASE_SHA=", "force=false",
    ):
        if marker not in senju:
            raise SystemExit(f"senju-autonomous-improver.yml: missing invariant: {marker}")
    allowed = {
        "senju/state/champion.json", "senju/state/strategy.json",
        "senju/state/last-evolution-summary.json", "senju/state/last-evolution-plan.md",
    }
    observed = {
        line.strip().split()[-1]
        for line in senju.splitlines()
        if line.strip().startswith("put_file ")
    }
    if observed != allowed:
        raise SystemExit(f"Senju autonomous write allowlist mismatch: {sorted(observed)}")

    forge = WORKFLOWS["tomoki-forge.yml"]
    for marker in (
        "python /tmp/tomoki-policy-gate.py", "bash /tmp/tomoki-verify.sh",
        "git add -A -- sales-command-30", "gh pr create",
    ):
        if marker not in forge:
            raise SystemExit(f"tomoki-forge.yml: missing bounded-writer invariant: {marker}")
    forge_cmd = [x.strip() for x in forge.splitlines() if x.strip().startswith("copilot -p ")]
    if len(forge_cmd) != 1 or "--allow-tool=write" not in forge_cmd[0] or "shell(" in forge_cmd[0]:
        raise SystemExit("TOMOKI FORGE Copilot permissions drifted")

    director = WORKFLOWS["the-core-autonomous-director.yml"]
    director_cmd = [x.strip() for x in director.splitlines() if x.strip().startswith("copilot -p ")]
    if len(director_cmd) != 1 or "--allow-tool=write" not in director_cmd[0] or "shell(" in director_cmd[0]:
        raise SystemExit("THE CORE Director Copilot permissions drifted")

    for name in ("tomoki-hound.yml", "tomoki-skeptic.yml"):
        body = WORKFLOWS[name]
        cmd = [x.strip() for x in body.splitlines() if x.strip().startswith("copilot -p ")]
        if len(cmd) != 1 or "--allow-tool=write" not in cmd[0] or "shell(" in cmd[0]:
            raise SystemExit(f"{name}: auditor write/shell capability drifted")
        if "continue-on-error: true" in body or ("|| true" in cmd[0]):
            raise SystemExit(f"{name}: auditor failures must not be hidden")

    reality = WORKFLOWS["world-reality-agency.yml"]
    for marker in (
        "outside-world/reality_policy.json", "outside-world/reality_gateway.py",
        "--execute-owned-writes", "issues: write", "contents: read", "actions: read",
    ):
        if marker not in reality:
            raise SystemExit(f"world-reality-agency.yml: missing invariant: {marker}")

    reality_policy = json.loads(Path("outside-world/reality_policy.json").read_text(encoding="utf-8"))
    actions = reality_policy.get("actions") or {}
    allow = reality_policy.get("allowlists") or {}
    browser = reality_policy.get("browser") or {}
    if actions.get("github_issue_own_repo") != "AUTO_ALLOWLIST":
        raise SystemExit("reality policy: own-repo GitHub writes must remain allowlisted")
    if actions.get("general_external_post") != "APPROVAL":
        raise SystemExit("reality policy: general external posting must require approval")
    if allow.get("github_repositories") != ["MusicJapanLLC/test"]:
        raise SystemExit("reality policy: repository allowlist drifted")
    if browser.get("respect_access_controls") is not True or browser.get("engagement_manipulation") is not False:
        raise SystemExit("reality policy: browser safety invariants drifted")

    gateway = Path("outside-world/reality_gateway.py").read_text(encoding="utf-8")
    for marker in (
        "repo not in allowed", "SKIPPED_DAILY_LIMIT",
        "https://api.github.com/repos/{repo}/issues", "github_issue_days",
    ):
        if marker not in gateway:
            raise SystemExit(f"reality_gateway.py: missing owned-write guard: {marker}")

    gate = Path("tomoki-agents/policy_gate.py").read_text(encoding="utf-8")
    verifier = Path("tomoki-agents/verify.sh").read_text(encoding="utf-8")
    for marker in (
        "'sales-command-30/src/'", "'sales-command-30/tests/'", "'sales-command-30/README.md'",
        "if len(names) > 3:", "if changed_lines > 250:", "FORBIDDEN_PATTERNS",
    ):
        if marker not in gate:
            raise SystemExit(f"TOMOKI policy gate missing invariant: {marker}")
    if "'.github/" in gate or '".github/' in gate:
        raise SystemExit("TOMOKI policy gate must never allow .github writes")
    if "npm run build" not in verifier or "py_compile" not in verifier:
        raise SystemExit("TOMOKI verifier must retain compile/build checks")

    return set(expected)


def validate_unknown_writes(known: set[str]) -> None:
    unknown = {
        name: sorted(writes(body))
        for name, body in WORKFLOWS.items()
        if writes(body) and name not in known
    }
    if unknown:
        raise SystemExit(f"Unclassified privileged workflows: {unknown}")


def main() -> int:
    validate_global_safety()
    pages = validate_pages_lanes()
    task_worker = validate_task_worker()
    experiments = validate_experiment_oidc_lanes(pages, task_worker)
    stress = validate_owned_issue_stress_lanes()
    explicit = validate_explicit_lanes()
    known = explicit | pages | experiments | stress | {task_worker, "security-guard.yml"}
    validate_unknown_writes(known)
    print(json.dumps({
        "status": "PASS",
        "workflows": len(WORKFLOWS),
        "pages_lanes": sorted(pages),
        "experiment_oidc_lanes": sorted(experiments),
        "owned_issue_stress_lanes": sorted(stress),
        "privileged_lanes": sorted(known - {"security-guard.yml"}),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
