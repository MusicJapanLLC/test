#!/usr/bin/env python3
import re
import subprocess
import sys

ALLOWED_PREFIXES = (
    'sales-command-30/src/',
    'sales-command-30/tests/',
)
ALLOWED_EXACT = {
    'sales-command-30/README.md',
    'sales-command-30/PRODUCT.md',
    'sales-command-30/SALES.md',
    'sales-command-30/OPS.md',
}
FORBIDDEN_PATTERNS = [
    r'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY',
    r'(?i)service[_-]?role',
    r'(?i)password\s*[:=]\s*["\'][^"\']+',
    r'(?i)api[_-]?key\s*[:=]\s*["\'][^"\']+',
    r'(?i)secret\s*[:=]\s*["\'][^"\']+',
    r'curl\s+[^\n]*\|\s*(ba)?sh',
    r'rm\s+-rf\s+/',
    r'chmod\s+777',
]


def run(*args: str) -> str:
    return subprocess.check_output(args, text=True).strip()


def main() -> int:
    names = [x for x in run('git', 'diff', '--name-only').splitlines() if x]
    if not names:
        print('NO_CHANGE')
        return 2
    if len(names) > 3:
        print(f'REJECT: too many files changed ({len(names)} > 3)')
        return 1
    for path in names:
        if not (path in ALLOWED_EXACT or path.startswith(ALLOWED_PREFIXES)):
            print(f'REJECT: path outside autonomous low-risk allowlist: {path}')
            return 1

    changed_lines = 0
    for line in run('git', 'diff', '--numstat').splitlines():
        parts = line.split('\t')
        if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
            changed_lines += int(parts[0]) + int(parts[1])
    if changed_lines > 250:
        print(f'REJECT: diff too large ({changed_lines} lines > 250)')
        return 1

    diff = run('git', 'diff', '--unified=0')
    additions = '\n'.join(
        line[1:] for line in diff.splitlines()
        if line.startswith('+') and not line.startswith('+++')
    )
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, additions):
            print(f'REJECT: forbidden high-risk pattern matched: {pattern}')
            return 1

    print(f'PASS: {len(names)} file(s), {changed_lines} changed lines, low-risk allowlist only')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
