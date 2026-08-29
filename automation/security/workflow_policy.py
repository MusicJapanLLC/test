#!/usr/bin/env python3
"""Fail-closed policy for GitHub Actions and autonomous control-plane workflows.

The policy classifies privileged workflows by capability, validates bounded lanes,
and rejects any new write/OIDC lane until it has an explicit policy. Keeping this
logic outside YAML makes the security gate reviewable and testable without fragile
inline scripts.
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


def validate_task_worker(page_lanes: set[str]) -> None:
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

    oidc_lanes = {name for name, text in WORKFLOWS.items() if 'id-token' in writes(text)}
    explicit_oidc = {'the-world-task-worker.yml', 'senju-mass-shadow-learning.yml'}
    unexpected = oidc_lanes - page_lanes - explicit_oidc
    if unexpected:
        raise SystemExit(f'Unexpected OIDC write lanes: {sorted(unexpected)}')

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


def validate_explicit_lanes() -> set[str]:
    expected = {
        'senju-autonomous-improver.yml': {'contents'},
        'senju-mass-shadow-learning.yml': {'contents', 'id-token'},
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

    mass_shadow = WORKFLOWS['senju-mass-shadow-learning.yml']
    for item in (
        'contents: write', 'actions: read', 'id-token: write',
        'python -m senju.cli safety-check sim://mass-shadow',
        'if python -m senju.cli safety-check https://example.com; then exit 1; fi',
        '--policy-key SENJU_MASS_SHADOW',
        'assert int(report[\'trial_multiplier_target\']) <= 100',
        "forbidden=('target','network','credential','secret','permission')",
        'CHANGED="$(gh api "repos/$REPO/compare/$BASE_SHA...$HEAD_SHA" --jq \'[.files[].filename]\')"',
        'if [[ "$CHANGED" != \'["senju/state/strategy.json"]\' ]]; then',
        'if [[ "$CURRENT_BASE_SHA" != "$BASE_SHA" ]]; then',
        '-F force=false',
    ):
        if item not in mass_shadow:
            raise SystemExit(f'senju-mass-shadow-learning.yml: missing bounded mass-shadow invariant: {item}')
    if ('$' + '{{' + ' secrets.') in mass_shadow:
        raise SystemExit('senju-mass-shadow-learning.yml: long-lived Actions secrets are forbidden')

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


def validate_unknown_writes(page_lanes: set[str], explicit: set[str]) -> None:
    known = explicit | page_lanes | {'the-world-task-worker.yml', 'security-guard.yml'}
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
    validate_task_worker(page_lanes)
    explicit = validate_explicit_lanes()
    validate_unknown_writes(page_lanes, explicit)
    print(json.dumps({
        'status': 'PASS',
        'workflows': len(WORKFLOWS),
        'pages_lanes': sorted(page_lanes),
        'privileged_lanes': sorted(explicit | {'the-world-task-worker.yml'}),
    }, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
