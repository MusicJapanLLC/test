#!/usr/bin/env python3
"""Git-native 5^5 world mesh: exact leaf mirrors and bottom-up aggregate commits."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, subprocess, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
DEFAULT_RUNTIME = HERE / "git-runtime"

def run(*args, cwd=None, capture=False, env=None):
    result = subprocess.run(args, cwd=cwd, text=True, check=True,
                            stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                            stderr=subprocess.PIPE if capture else None, env=env)
    return result.stdout.strip() if capture else ""

def refs(repo):
    out = run("git", "--git-dir", str(repo), "for-each-ref",
              "--format=%(refname) %(objectname)", "refs/heads", "refs/tags", capture=True)
    return dict(line.split(" ", 1) for line in out.splitlines() if line)

def leaf_path(runtime, digits):
    return runtime / "leaves" / Path(*[f"world-{x}" for x in digits]) / "repo.git"

def parent_path(runtime, level, index):
    return runtime / "parents" / f"level-{level}" / f"group-{index:0{max(1, level)}d}.git"

def ensure_seed(runtime):
    seed = runtime / "objects" / "test-seed.git"
    seed.parent.mkdir(parents=True, exist_ok=True)
    if not seed.exists():
        run("git", "clone", "--mirror", str(SOURCE), str(seed))
    else:
        run("git", "--git-dir", str(seed), "fetch", "--prune", str(SOURCE),
            "+refs/heads/*:refs/heads/*", "+refs/tags/*:refs/tags/*")
    return seed

def digits_for(number, branching, generations):
    values = []
    for power in reversed(range(generations)):
        values.append((number // (branching ** power)) % branching + 1)
    return tuple(values)

def ensure_leaf(seed, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        run("git", "clone", "--mirror", "--shared", str(seed), str(target))
    else:
        run("git", "--git-dir", str(target), "fetch", "--prune", str(seed),
            "+refs/heads/*:refs/heads/*", "+refs/tags/*:refs/tags/*")
    run("git", "--git-dir", str(target), "symbolic-ref", "HEAD",
        run("git", "--git-dir", str(seed), "symbolic-ref", "HEAD", capture=True))

def aggregate(repo, children, level, group):
    repo.parent.mkdir(parents=True, exist_ok=True)
    if not repo.exists(): run("git", "init", "--bare", str(repo))
    child_data = []
    for position, child in enumerate(children, 1):
        child_refs = refs(child)
        head = run("git", "--git-dir", str(child), "symbolic-ref", "-q", "HEAD", capture=True)
        child_data.append({"position": position, "repository": str(child),
                           "head": head, "refs": child_refs})
        for ref, sha in child_refs.items():
            safe_ref = ref.removeprefix("refs/")
            run("git", "--git-dir", str(repo), "update-ref",
                f"refs/children/{position}/{safe_ref}", sha)
    payload = json.dumps({"level": level, "group": group, "children": child_data},
                         ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    blob = run("git", "--git-dir", str(repo), "hash-object", "-w", "--stdin",
               capture=True, env=None) if False else None
    proc = subprocess.run(["git", "--git-dir", str(repo), "hash-object", "-w", "--stdin"],
                          input=payload, text=True, check=True, stdout=subprocess.PIPE)
    blob = proc.stdout.strip()
    tree_input = f"100644 blob {blob}\tworld-state.json\n"
    proc = subprocess.run(["git", "--git-dir", str(repo), "mktree"], input=tree_input,
                          text=True, check=True, stdout=subprocess.PIPE)
    tree = proc.stdout.strip()
    old = run("git", "--git-dir", str(repo), "rev-parse", "--verify",
              "refs/heads/aggregate", capture=True) if subprocess.run(
              ["git", "--git-dir", str(repo), "rev-parse", "--verify", "refs/heads/aggregate"],
              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0 else ""
    if old:
        old_tree = run("git", "--git-dir", str(repo), "show", "-s", "--format=%T", old, capture=True)
        if old_tree == tree: return old
    env = os.environ.copy()
    env.update({"GIT_AUTHOR_NAME":"World Mesh","GIT_AUTHOR_EMAIL":"mesh@localhost",
                "GIT_COMMITTER_NAME":"World Mesh","GIT_COMMITTER_EMAIL":"mesh@localhost"})
    cmd = ["git", "--git-dir", str(repo), "commit-tree", tree, "-m", f"Aggregate level {level} group {group}"]
    if old: cmd.extend(["-p", old])
    commit = subprocess.run(cmd, text=True, check=True, stdout=subprocess.PIPE, env=env).stdout.strip()
    run("git", "--git-dir", str(repo), "update-ref", "refs/heads/aggregate", commit)
    run("git", "--git-dir", str(repo), "symbolic-ref", "HEAD", "refs/heads/aggregate")
    return commit

def reconcile(runtime, branching, generations):
    seed = ensure_seed(runtime)
    leaves = []
    total = branching ** generations
    for index in range(total):
        target = leaf_path(runtime, digits_for(index, branching, generations))
        ensure_leaf(seed, target); leaves.append(target)
    current = leaves
    level = 1
    while len(current) > 1:
        next_level = []
        for group, start in enumerate(range(0, len(current), branching), 1):
            parent = parent_path(runtime, level, group)
            aggregate(parent, current[start:start + branching], level, group)
            next_level.append(parent)
        current = next_level; level += 1
    registry = {"branching_factor": branching, "generations": generations,
                "leaf_repositories": len(leaves), "aggregate_repositories": sum(
                branching ** n for n in range(generations)), "total_git_nodes":
                sum(branching ** n for n in range(generations + 1)),
                "root_repository": str(current[0]), "seed_refs": refs(seed)}
    (runtime / "registry.json").write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(registry))

def verify(runtime, branching, generations):
    seed = runtime / "objects" / "test-seed.git"
    expected = refs(seed)
    bad = []
    for index in range(branching ** generations):
        world = leaf_path(runtime, digits_for(index, branching, generations))
        if not world.exists() or refs(world) != expected: bad.append(str(world))
    root = parent_path(runtime, generations, 1)
    result = {"ok": not bad and root.exists(), "leaf_count": branching ** generations,
              "mismatched_leaves": len(bad), "root": str(root)}
    print(json.dumps(result)); raise SystemExit(0 if result["ok"] else 1)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["reconcile","verify"])
    p.add_argument("--runtime", type=Path, default=DEFAULT_RUNTIME)
    p.add_argument("--branching", type=int, default=5)
    p.add_argument("--generations", type=int, default=5)
    a = p.parse_args()
    if a.command == "reconcile": reconcile(a.runtime, a.branching, a.generations)
    else: verify(a.runtime, a.branching, a.generations)

if __name__ == "__main__": main()
