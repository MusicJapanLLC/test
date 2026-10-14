#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import random
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def stable_index(seed: str, modulo: int, salt: str) -> int:
    h = hashlib.sha256(f"{seed}:{salt}".encode()).hexdigest()
    return int(h[:12], 16) % modulo


def load_registry(path: str) -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    kids = data.get("assigned_children", [])
    if len(kids) != 50 or len(set(kids)) != 50:
        raise ValueError("exactly 50 unique child workstations are required")
    return data


def detect_resources() -> dict:
    mem_gb = None
    try:
        for line in Path('/proc/meminfo').read_text().splitlines():
            if line.startswith('MemTotal:'):
                mem_kb = int(line.split()[1])
                mem_gb = round(mem_kb / 1024 / 1024, 2)
                break
    except Exception:
        pass

    cpu_count = os.cpu_count()
    gpu = {"available": False, "name": None, "vram_gb": None}
    if shutil.which('nvidia-smi'):
        try:
            out = subprocess.check_output(
                ['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
                text=True,
                timeout=5,
            ).strip().splitlines()
            if out:
                name, mib = [x.strip() for x in out[0].split(',', 1)]
                gpu = {"available": True, "name": name, "vram_gb": round(float(mib) / 1024, 2)}
        except Exception:
            pass

    return {
        "ram_gb": mem_gb,
        "cpu_count": cpu_count,
        "gpu": gpu,
        "platform": platform.platform(),
        "python": platform.python_version(),
    }


def experiment_maze(work: Path, rng: random.Random) -> dict:
    w, h = 31, 17
    grid = [['#'] * w for _ in range(h)]
    stack = [(1, 1)]
    grid[1][1] = ' '
    dirs = [(2,0),(-2,0),(0,2),(0,-2)]
    while stack:
        x, y = stack[-1]
        opts = []
        for dx, dy in dirs:
            nx, ny = x + dx, y + dy
            if 1 <= nx < w-1 and 1 <= ny < h-1 and grid[ny][nx] == '#':
                opts.append((nx, ny, dx, dy))
        if not opts:
            stack.pop(); continue
        nx, ny, dx, dy = rng.choice(opts)
        grid[y + dy//2][x + dx//2] = ' '
        grid[ny][nx] = ' '
        stack.append((nx, ny))
    text = '\n'.join(''.join(row) for row in grid)
    (work/'maze.txt').write_text(text+'\n', encoding='utf-8')
    return {"experiment": "procedural_maze", "artifact": "maze.txt", "metric": {"cells": w*h}}


def experiment_primes(work: Path, rng: random.Random) -> dict:
    limit = rng.randint(4000, 9000)
    sieve = bytearray(b'\x01') * (limit + 1)
    sieve[:2] = b'\x00\x00'
    for p in range(2, int(limit ** 0.5) + 1):
        if sieve[p]:
            sieve[p*p:limit+1:p] = b'\x00' * (((limit-p*p)//p)+1)
    primes = [i for i, yes in enumerate(sieve) if yes]
    (work/'primes.json').write_text(json.dumps(primes), encoding='utf-8')
    return {"experiment": "prime_hunt", "artifact": "primes.json", "metric": {"limit": limit, "count": len(primes)}}


def experiment_language(work: Path, rng: random.Random) -> dict:
    nouns = ['moon','robot','moss','comet','piano','jelly','circuit','ocean']
    verbs = ['dreams','folds','listens','glows','wanders','debugs','dances','remembers']
    adjs = ['tiny','electric','sleepy','impossible','quiet','neon','curious','crooked']
    lines = [f"{rng.choice(adjs)} {rng.choice(nouns)} {rng.choice(verbs)}" for _ in range(32)]
    (work/'tiny_language.txt').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    return {"experiment": "tiny_language", "artifact": "tiny_language.txt", "metric": {"sentences": len(lines)}}


def experiment_code(work: Path, rng: random.Random) -> dict:
    n = rng.randint(12, 24)
    code = '''def collatz(n):\n    out=[]\n    while n != 1:\n        out.append(n)\n        n = n//2 if n%2==0 else 3*n+1\n    return out+[1]\n\nfor i in range(2, LIMIT+1):\n    c=collatz(i)\n    print(i, len(c), max(c))\n'''.replace('LIMIT', str(n))
    (work/'toy.py').write_text(code, encoding='utf-8')
    out = subprocess.check_output(['python', str(work/'toy.py')], text=True, timeout=10)
    (work/'toy-output.txt').write_text(out, encoding='utf-8')
    return {"experiment": "write_and_run_code", "artifact": "toy.py", "metric": {"inputs": n-1}}


EXPERIMENTS = [experiment_maze, experiment_primes, experiment_language, experiment_code]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--registry', default='company-society/child_workstations.json')
    ap.add_argument('--seed', default='')
    ap.add_argument('--status', default='child-workstation-status.json')
    args = ap.parse_args()

    registry = load_registry(args.registry)
    seed = args.seed or os.getenv('GITHUB_RUN_ID') or datetime.now(timezone.utc).isoformat()
    kids = registry['assigned_children']
    child = kids[stable_index(seed, len(kids), 'child')]
    rng = random.Random(int(hashlib.sha256(seed.encode()).hexdigest()[:16], 16))

    root = Path(tempfile.mkdtemp(prefix=f'the-world-{child.lower()}-'))
    private = root/'private-scratch'
    publish = root/'publish'
    private.mkdir(parents=True)
    publish.mkdir(parents=True)

    exp = EXPERIMENTS[stable_index(seed, len(EXPERIMENTS), 'experiment')]
    result = exp(private, rng)
    actual = detect_resources()
    target = registry['target_profile']

    status = {
        "schema": "child-workstation-run/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "child": child,
        "workstation_class": registry['workstation_class'],
        "target": {"ram_gb": target['ram_gb'], "vram_gb": target['vram_gb']},
        "actual_runtime": actual,
        "private_scratch_path": "REDACTED_FROM_REPORTING",
        "private_scratch_uploaded": False,
        "routine_content_inspection": False,
        "experiment_health": {"completed": True, "type": result['experiment']},
        "published_by_child": False,
        "note": "scratch contents intentionally remain local to the ephemeral workstation unless the child explicitly publishes an artifact",
    }
    Path(args.status).write_text(json.dumps(status, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({"child": child, "experiment": result['experiment'], "ram_gb_actual": actual['ram_gb'], "gpu": actual['gpu']}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
