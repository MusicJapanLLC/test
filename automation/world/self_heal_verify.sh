#!/usr/bin/env bash
set -euo pipefail

mapfile -t changed < <(git diff --name-only)
if [[ ${#changed[@]} -eq 0 ]]; then
  echo 'SELF_HEAL_VERIFY: no changes'
  exit 0
fi

python_files=()
json_files=()
shell_files=()
yaml_files=()
for path in "${changed[@]}"; do
  [[ -f "$path" ]] || continue
  case "$path" in
    *.py) python_files+=("$path") ;;
    *.json) json_files+=("$path") ;;
    *.sh) shell_files+=("$path") ;;
    *.yml|*.yaml) yaml_files+=("$path") ;;
  esac
done

if [[ ${#python_files[@]} -gt 0 ]]; then
  python -m py_compile "${python_files[@]}"
fi

if [[ ${#json_files[@]} -gt 0 ]]; then
  python - "${json_files[@]}" <<'PY'
import json, sys
from pathlib import Path
for name in sys.argv[1:]:
    json.loads(Path(name).read_text(encoding='utf-8'))
    print('JSON OK', name)
PY
fi

for path in "${shell_files[@]}"; do
  bash -n "$path"
done

if [[ ${#yaml_files[@]} -gt 0 ]]; then
  ruby -e 'require "yaml"; ARGV.each { |p| YAML.load_file(p); puts "YAML OK #{p}" }' "${yaml_files[@]}"
fi

# Always verify the watchdog and authority contracts because every repair is
# eventually observed and acted upon by these components.
python -m unittest automation.world.test_realtime_kernel -v

if printf '%s\n' "${changed[@]}" | grep -q '^company-society/'; then
  python -m unittest discover -s company-society -p 'test_*.py' -v
fi

if printf '%s\n' "${changed[@]}" | grep -q '^senju/'; then
  python -m unittest discover -s senju/tests -p 'test_*.py' -v
fi

if printf '%s\n' "${changed[@]}" | grep -q '^automation/world/'; then
  python -m unittest discover -s automation/world -p 'test_*.py' -v
fi

# Re-run local invariant checks that mirror the repository Security Guard for
# the exact classes of changes the repair executor is allowed to make.
if grep -R -nE 'pull_request_target:|workflow_run:|repository_dispatch:|issue_comment:|permissions:[[:space:]]*write-all|runs-on:[[:space:]]*self-hosted' .github/workflows --exclude='security-guard.yml'; then
  echo 'SELF_HEAL_VERIFY: unsafe workflow trigger/permission detected'
  exit 1
fi

if grep -R -nE '(curl|wget).*(\|[[:space:]]*(bash|sh))|(bash|sh|source)[[:space:]]*<\([[:space:]]*(curl|wget)' .github/workflows --exclude='security-guard.yml'; then
  echo 'SELF_HEAL_VERIFY: remote shell execution pattern detected'
  exit 1
fi

echo 'SELF_HEAL_VERIFY: PASS'
