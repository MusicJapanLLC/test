#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POLICY_PATH = Path(__file__).with_name("autonomy-policy.json")
DEFAULT_OUTPUT = ROOT / "senju" / "state" / "world-observation.json"


def _git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def _tracked_files(root: str) -> list[str]:
    out = _git("ls-files", "--", root)
    return [line for line in out.splitlines() if line.strip()]


def _latest_commit(root: str) -> dict:
    raw = _git("log", "-1", "--format=%H%x00%cI%x00%s", "--", root)
    if not raw:
        return {"sha": None, "date": None, "subject": None}
    parts = raw.split("\x00", 2)
    while len(parts) < 3:
        parts.append("")
    return {"sha": parts[0] or None, "date": parts[1] or None, "subject": parts[2] or None}


def _package_summary(path: Path) -> dict | None:
    package = path / "package.json"
    if not package.exists():
        return None
    try:
        data = json.loads(package.read_text(encoding="utf-8"))
    except Exception:
        return {"parse_error": True}
    scripts = data.get("scripts") if isinstance(data.get("scripts"), dict) else {}
    deps = data.get("dependencies") if isinstance(data.get("dependencies"), dict) else {}
    dev_deps = data.get("devDependencies") if isinstance(data.get("devDependencies"), dict) else {}
    return {
        "name": data.get("name"),
        "scripts": sorted(scripts.keys()),
        "dependencies": len(deps),
        "dev_dependencies": len(dev_deps),
    }


def _root_summary(root: str, context_files: list[str]) -> dict:
    base = ROOT / root
    files = _tracked_files(root)
    ext_counts = Counter()
    total_bytes = 0
    for rel in files:
        p = ROOT / rel
        if p.is_file():
            try:
                total_bytes += p.stat().st_size
            except OSError:
                pass
            suffix = p.suffix.lower() or "[no_ext]"
            ext_counts[suffix] += 1

    manifests = []
    if base.exists():
        for name in context_files:
            if (base / name).exists():
                manifests.append(name)

    return {
        "root": root,
        "exists": base.exists(),
        "tracked_files": len(files),
        "tracked_bytes": total_bytes,
        "top_extensions": dict(ext_counts.most_common(8)),
        "context_files": manifests,
        "package": _package_summary(base),
        "latest_commit": _latest_commit(root),
    }


def build_snapshot() -> dict:
    policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    roots = list(policy.get("observation_roots") or [])
    context_files = list(policy.get("context_files") or [])
    summaries = [_root_summary(root, context_files) for root in roots]
    tracked_total = _git("ls-files")
    head_sha = _git("rev-parse", "HEAD") or None
    head_date = _git("show", "-s", "--format=%cI", "HEAD") or None

    return {
        "schema": "the-world-observation/v1",
        "autonomy_level": policy.get("autonomy_level", 95),
        "source_head": {"sha": head_sha, "date": head_date},
        "repository": {
            "tracked_files": len([x for x in tracked_total.splitlines() if x.strip()]),
            "observed_roots": len(roots),
            "active_roots": sum(1 for item in summaries if item["tracked_files"] > 0),
            "workflow_files": len(_tracked_files(".github/workflows")),
        },
        "protected_production_refs": policy.get("protected_production_refs", []),
        "capability_budget": policy.get("capability_budget", {}),
        "roots": summaries,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    output = Path(args.output)
    if not output.is_absolute():
        output = ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    snapshot = build_snapshot()
    output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output),
        "autonomy_level": snapshot["autonomy_level"],
        "observed_roots": snapshot["repository"]["observed_roots"],
        "tracked_files": snapshot["repository"]["tracked_files"],
        "source_head": snapshot["source_head"]["sha"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
