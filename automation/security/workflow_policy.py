#!/usr/bin/env python3
"""Fail-closed policy for GitHub Actions and autonomous control-plane workflows.

Privileged workflows are classified by *capability*, not by a growing pile of
filename exceptions. Known bounded classes (Pages deploys, THE WORLD OIDC task
worker, closed-simulator experiment lanes, and owned-repository issue stress
lanes) are validated against structural invariants. Anything else with write
or OIDC authority is denied until it fits a reviewed capability class.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path('.github/workflows')
WORKFLOWS = {p.name: p.read_text(encoding='utf-8') for p in ROOT.glob('*.y*ml')}

WRITE_RE = re.compile(
    r'(?m)^\s+(contents|actions|checks|deployments|issues|packages|pull-requests|statuses|pages|id-token|copilot-requests):\s*write\s*$'
)
UNSAFE = (
    'pull_request_target:', 'workflow_run:', 'issue_comment:', 'repository_dispatch:',
    'runs-on: self-hosted', 'permissions: write-all', 'write-all',
    'git push --force', 'git push -f', '--yolo', '--allow-all-tools',
)
PIN_RE = re.compile(r'uses:\s+([^\s#]+)')
FULL_SHA = re.compile(r'^[0-9a-f]{40}$')
GATEWAY_PROTOCOL_RE = re.compile(
    r'(?m)^GATEWAY_PROTOCOL\s*=\s*"oidc-repository-v(?P<version>\d+)-(?P<label>[a-z0-9][a-z0-9-]*)"\s*$'
)
MIN_GATEWAY_PROTOCOL_VERSION = 4
MAX_OWNED_STRESS_WRITES = 100


def writes(body: str) -> set[str]:
    return {m.group(1) for m in WRITE_RE.finditer(body)}


def require(name: str, required: tuple[str, ...], forbidden: tuple[str, ...] = ()) -> str:
    body = WORKFLOWS.get(name, '')
    if not body:
        raise SystemExit(f'{name}: required privileged workflow is missing')
    for item in required:
        if item not in body:
            raise SystemExit(f'{name}: missing required guardrail: {item}')
    for item in forbidden:
        if item in body:
            raise SystemExit(f'{name}: contains forbidden capability: {item}')
    return body


def validate_global_safety() -> None:
    for name, body in WORKFLOWS.items():
        if name == 'security-guard.yml':
            continue
        for token in UNSAFE:
            if token in body:
                raise SystemExit(f'{name}: forbidden workflow capability: {token}')

        lines = body.splitlines()
        for i, line in enumerate(lines):
            if 'uses: actions/checkout@' in line:
                block = '\n'.join(lines[i:i + 8])
                if 'persist-credentials: false' not in block:
                    raise SystemExit(f'{name}:{i + 1}: checkout must discard credentials')

        for match in PIN_RE.finditer(body):
            ref = match.group(1)
            if ref.startswith('./'):
                continue
            if '@' not in ref:
                raise SystemExit(f'{name}: action has no immutable ref: {ref}')
            version = ref.rsplit('@', 1)[1]
            if not FULL_SHA.fullmatch(version):
                raise SystemExit(f'{name}: action is not pinned to a full commit SHA: {ref}')


def validate_pages_lanes() -> set[str]:
    page_lanes: set[str] = set()
    for name, body in WORKFLOWS.items():
        w = writes(body)
        if 'pages' not in w:
            continue
        page_lanes.add(name)
        if w - {'pages', 'id-token'}:
            raise SystemExit(f'{name}: Pages lane has unrelated write permissions: {sorted(w)}')
        for item in (
            'contents: read', 'pages: write', 'id-token: write', 'name: github-pages',
            'actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128',
        ):
            if item not in body:
                raise SystemExit(f'{name}: Pages lane missing invariant: {item}')
        if body.count('pages: write') != 1 or body.count('id-token: write') != 1:
            raise SystemExit(f'{name}: Pages/OIDC write permissions must occur exactly once')
        if 'schedule:' in body:
            raise SystemExit(f'{name}: Pages deployment must not be schedule-triggered')
        if 'pull_request:' in body and "if: github.event_name != 'pull_request'" not in body:
            raise SystemExit(f'{name}: PR-triggered Pages workflow must suppress deployment on PR events')
        if 'push:' in body and 'paths:' not in body:
            raise SystemExit(f'{name}: auto Pages deployment must be path-scoped')
    return page_lanes


def validate_task_worker() -> str:
    body = require(
        'the-world-task-worker.yml',
        (
            'contents: read', 'actions: write', 'id-token: write', 'workflow_dispatch:', 'schedule:',
            "cron: '*/5 * * * *'", 'persist-credentials: false',
            'automation/world/task_worker.py', 'gh workflow run',
            'Claim one personality-linked task', 'Reconcile downstream GitHub evidence',
        ),
        ('contents: write', 'issues: write', 'pull-requests: write', 'packages: write',
         'deployments: write', 'pages: write'),
    )
    if writes(body) != {'actions', 'id-token'}:
        raise SystemExit(f'the-world-task-worker.yml: unexpected writes {sorted(writes(body))}')

    secrets_marker = '$' + '{{' + ' secrets.'
    if secrets_marker in body:
        raise SystemExit('the-world-task-worker.yml: long-lived Actions secrets are forbidden')

    client = Path('automation/world/task_worker.py').read_text(encoding='utf-8')
    for item in (
        'AUDIENCE = "the-world-worker"',
        'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
        'method="POST"',
        'https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/the-world-github-worker',
    ):
        if item not in client:
            raise SystemExit(f'task_worker.py: missing OIDC/gateway invariant: {item}')

    protocol = GATEWAY_PROTOCOL_RE.search(client)
    if protocol is None:
        raise SystemExit('task_worker.py: gateway protocol must use oidc-repository-vN-<label> form')
    version = int(protocol.group('version'))
    if version < MIN_GATEWAY_PROTOCOL_VERSION:
        raise SystemExit(
            f'task_worker.py: gateway protocol version regressed: {version} < {MIN_GATEWAY_PROTOCOL_VERSION}'
        )
    if '_oidc_token()' not in client or 'Authorization": f"Bearer {_oidc_token()}"' not in client:
        raise SystemExit('task_worker.py: Edge requests must authenticate with a fresh GitHub OIDC token')
    if 'urllib.parse.urlencode({"audience": AUDIENCE})' not in client:
        raise SystemExit('task_worker.py: OIDC token request must bind the configured audience')
    return 'the-world-task-worker.yml'


def validate_experiment_oidc_lanes(page_lanes: set[str], task_worker: str) -> set[str]:
    """Classify closed-simulator experiment workers without filename exceptions.

    These lanes may read/write only experiment strategy state in the owned repo
    and may call THE WORLD gateway with a fresh GitHub OIDC token. The promotion
    path must prove that exactly one numeric strategy file changed and must use a
    non-force ref update. Any OIDC workflow that does not satisfy all invariants
    remains denied.
    """
    experiment_lanes: set[str] = set()
    oidc_lanes = {name for name, text in WORKFLOWS.items() if 'id-token' in writes(text)}
    candidates = oidc_lanes - page_lanes - {task_worker}
    secrets_marker = '$' + '{{' + ' secrets.'

    for name in sorted(candidates):
        body = WORKFLOWS[name]
        got = writes(body)
        if got != {'contents', 'id-token'}:
            raise SystemExit(f'{name}: unclassified OIDC write set: {sorted(got)}')
        required = (
            'contents: write', 'actions: read', 'id-token: write',
            'workflow_dispatch:', 'schedule:', 'persist-credentials: false',
            'automation/world/task_worker.py experiment-config',
            'automation/world/task_worker.py record-experiment',
            'senju/state/strategy.json',
            'CURRENT_BASE_SHA=', 'force=false',
            'python -m senju.cli safety-check sim://',
            'python -m senju.cli safety-check https://example.com',
            'Base moved; safe promotion deferred',
        )
        for item in required:
            if item not in body:
                raise SystemExit(f'{name}: OIDC experiment lane missing invariant: {item}')
        if secrets_marker in body:
            raise SystemExit(f'{name}: OIDC experiment lane may not use long-lived Actions secrets')
        if 'pull_request:' in body:
            raise SystemExit(f'{name}: OIDC experiment lane must not run with pull_request authority')
        if 'git push ' in body or 'gh pr create' in body:
            raise SystemExit(f'{name}: experiment promotion must use the bounded GitHub API ref path')
        if body.count('senju/state/strategy.json') < 2:
            raise SystemExit(f'{name}: strategy promotion must fetch and verify the same bounded state file')
        if '[.files[].filename]' not in body or "'[\"senju/state/strategy.json\"]'" not in body:
            raise SystemExit(f'{name}: promotion diff must prove strategy.json is the only changed file')
        experiment_lanes.add(name)
    return experiment_lanes


def _stress_write_count(body: str) -> int | None:
    match = re.search(r'for\s+\w+\s+in\s+\$\(seq\s+(\d+)\s+(\d+)\)', body)
    if not match:
        return None
    start, end = int(match.group(1)), int(match.group(2))
    if start < 1 or end < start:
        return None
    return end - start + 1


def validate_owned_issue_stress_lanes() -> set[str]:
    """Recognize bounded write-load tests that can touch only this repo's issue comments."""
    lanes: set[str] = set()
    for name, body in WORKFLOWS.items():
        if writes(body) != {'issues'}:
            continue
        if name == 'world-reality-agency.yml':
            continue
        # This capability class is intentionally narrow: manual/self-file push,
        # no schedule, same-repository token, one fixed issue, <=100 comments.
        for item in (
            'contents: read', 'issues: write', 'workflow_dispatch:',
            'REPO: ${{ github.repository }}', 'repos/${REPO}/issues/', '/comments',
        ):
            if item not in body:
                raise SystemExit(f'{name}: owned issue stress lane missing invariant: {item}')
        if 'schedule:' in body or 'pull_request:' in body:
            raise SystemExit(f'{name}: owned issue stress lane must not be scheduled or PR-triggered')
        if 'push:' in body and f'".github/workflows/{name}"' not in body and f"'.github/workflows/{name}'" not in body:
            raise SystemExit(f'{name}: push trigger must be scoped to the workflow file itself')
        count = _stress_write_count(body)
        if count is None or count > MAX_OWNED_STRESS_WRITES:
            raise SystemExit(f'{name}: owned issue stress loop must be explicit and <= {MAX_OWNED_STRESS_WRITES}')
        if re.search(r'repos/[^$][^\s"\']*/issues/', body):
            raise SystemExit(f'{name}: issue stress target must come from github.repository, not a hard-coded external repo')
        lanes.add(name)
    return lanes


def validate_explicit_lanes() -> set[str]:
    expected = {
        'senju-autonomous-improver.yml': {'contents'},
        'tomoki-forge.yml': {'contents', 'pull-requests', 'copilot-requests'},
        'tomoki-manager.yml': {'actions', 'copilot-requests'},
        'tomoki-hound.yml': {'copilot-requests'},
        'tomoki-skeptic.yml': {'copilot-requests'},
        'ai-factory-boss.yml': {'actions'},
        'the-world-realtime-kernel.yml': {'actions'},
        'the-core-autonomous-director.yml': {'actions', 'copilot-requests'},
        'world-reality-agency.yml': {'issues'},
    }
    for name, want in expected.items():
        body = require(name, ('workflow_dispatch:', 'schedule:', 'persist-credentials: false'))
        got = writes(body)
        if got != want:
            raise SystemExit(f'{name}: privileged write set drifted: expected={sorted(want)} actual={sorted(got)}')

    senju = WORKFLOWS['senju-autonomous-improver.yml']
    for item in (
        'senju/state/champion.json', 'senju/state/strategy.json',
        'senju/state/last-evolution-summary.json', 'senju/state/last-evolution-plan.md',
        'CURRENT_BASE_SHA=', 'force=false',
    ):
        if item not in senju:
            raise SystemExit(f'senju-autonomous-improver.yml: missing invariant: {item}')
    allowed = {
        'senju/state/champion.json', 'senju/state/strategy.json',
        'senju/state/last-evolution-summary.json', 'senju/state/last-evolution-plan.md',
    }
    observed = {
        line.strip().split()[-1] for line in senju.splitlines()
        if line.strip().startswith('put_file ')
    }
    if observed != allowed:
        raise SystemExit(f'Senju autonomous write allowlist mismatch: {sorted(observed)}')

    forge = WORKFLOWS['tomoki-forge.yml']
    for item in ('python /tmp/tomoki-policy-gate.py', 'bash /tmp/tomoki-verify.sh',
                 'git add -A -- sales-command-30', 'gh pr create'):
        if item not in forge:
            raise SystemExit(f'tomoki-forge.yml: missing bounded-writer invariant: {item}')
    forge_copilot = [x.strip() for x in forge.splitlines() if x.strip().startswith('copilot -p ')]
    if len(forge_copilot) != 1 or '--allow-tool=write' not in forge_copilot[0] or 'shell(' in forge_copilot[0]:
        raise SystemExit('TOMOKI FORGE Copilot permissions drifted')

    director = WORKFLOWS['the-core-autonomous-director.yml']
    director_copilot = [x.strip() for x in director.splitlines() if x.strip().startswith('copilot -p ')]
    if len(director_copilot) != 1 or '--allow-tool=write' not in director_copilot[0] or 'shell(' in director_copilot[0]:
        raise SystemExit('THE CORE Director Copilot permissions drifted')

    for name in ('tomoki-hound.yml', 'tomoki-skeptic.yml'):
        body = WORKFLOWS[name]
        copilot = [x.strip() for x in body.splitlines() if x.strip().startswith('copilot -p ')]
        if len(copilot) != 1 or '--allow-tool=write' not in copilot[0] or 'shell(' in copilot[0]:
            raise SystemExit(f'{name}: auditor may write its report but may not receive autonomous shell access')
        if 'continue-on-error: true' in body or ('copilot -p' in body and '|| true' in copilot[0]):
            raise SystemExit(f'{name}: auditor failures must not be hidden')

    reality = WORKFLOWS['world-reality-agency.yml']
    for item in (
        'outside-world/reality_policy.json', 'outside-world/reality_gateway.py',
        '--execute-owned-writes', 'issues: write', 'contents: read', 'actions: read',
    ):
        if item not in reality:
            raise SystemExit(f'world-reality-agency.yml: missing bounded reality invariant: {item}')
    policy = json.loads(Path('outside-world/reality_policy.json').read_text(encoding='utf-8'))
    actions = policy.get('actions') or {}
    allow = policy.get('allowlists') or {}
    browser = policy.get('browser') or {}
    if actions.get('github_issue_own_repo') != 'AUTO_ALLOWLIST':
        raise SystemExit('reality policy: GitHub writes must remain own-repo allowlisted')
    if actions.get('general_external_post') != 'APPROVAL':
        raise SystemExit('reality policy: general external posting must require approval')
    if allow.get('github_repositories') != ['MusicJapanLLC/test']:
        raise SystemExit('reality policy: GitHub repository allowlist drifted')
    if browser.get('respect_access_controls') is not True or browser.get('engagement_manipulation') is not False:
        raise SystemExit('reality policy: browser safety invariants drifted')
    gateway = Path('outside-world/reality_gateway.py').read_text(encoding='utf-8')
    for item in (
        'repo not in allowed', 'SKIPPED_DAILY_LIMIT',
        'https://api.github.com/repos/{repo}/issues', 'github_issue_days',
    ):
        if item not in gateway:
            raise SystemExit(f'reality_gateway.py: missing owned-write guard: {item}')

    gate = Path('tomoki-agents/policy_gate.py').read_text(encoding='utf-8')
    verifier = Path('tomoki-agents/verify.sh').read_text(encoding='utf-8')
    for item in (
        "'sales-command-30/src/'", "'sales-command-30/tests/'", "'sales-command-30/README.md'",
        'if len(names) > 3:', 'if changed_lines > 250:', 'FORBIDDEN_PATTERNS',
    ):
        if item not in gate:
            raise SystemExit(f'TOMOKI policy gate missing invariant: {item}')
    if "'.github/" in gate or '".github/' in gate:
        raise SystemExit('TOMOKI policy gate must never allow .github writes')
    if 'npm run build' not in verifier or 'py_compile' not in verifier:
        raise SystemExit('TOMOKI verifier must retain compile/build checks')

    return set(expected)


def validate_unknown_writes(known: set[str]) -> None:
    unknown = {
        name: sorted(writes(body))
        for name, body in WORKFLOWS.items()
        if writes(body) and name not in known
    }
    if unknown:
        raise SystemExit(f'Unclassified privileged workflows: {unknown}')


def main() -> int:
    validate_global_safety()
    page_lanes = validate_pages_lanes()
    task_worker = validate_task_worker()
    experiment_lanes = validate_experiment_oidc_lanes(page_lanes, task_worker)
    issue_stress_lanes = validate_owned_issue_stress_lanes()
    explicit = validate_explicit_lanes()
    known = explicit | page_lanes | experiment_lanes | issue_stress_lanes | {task_worker, 'security-guard.yml'}
    validate_unknown_writes(known)
    print(json.dumps({
        'status': 'PASS',
        'workflows': len(WORKFLOWS),
        'pages_lanes': sorted(page_lanes),
        'experiment_oidc_lanes': sorted(experiment_lanes),
        'owned_issue_stress_lanes': sorted(issue_stress_lanes),
        'privileged_lanes': sorted(known - {'security-guard.yml'}),
    }, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
