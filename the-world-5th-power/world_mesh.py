#!/usr/bin/env python3
"""Create 5^5 exact, addressable snapshots of the test world."""
from __future__ import annotations
import argparse, datetime as dt, itertools, json, subprocess, tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
CFG = json.loads((HERE / "mesh.config.json").read_text(encoding="utf-8"))
RUNTIME = REPO / CFG["runtime_root"]
WORLDS = RUNTIME / "worlds"
SHARED = RUNTIME / "shared"

def parts(world):
    value = tuple(int(x) for x in world.split("."))
    if not value or len(value) > CFG["generations"] or any(x < 1 or x > CFG["branching_factor"] for x in value):
        raise SystemExit(f"invalid world: {world}")
    return value

def path_for(value):
    return WORLDS.joinpath(*[f"world-{x}" for x in value])

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)

def ids():
    for depth in range(1, CFG["generations"] + 1):
        yield from itertools.product(range(1, CFG["branching_factor"] + 1), repeat=depth)

def build():
    SHARED.mkdir(parents=True, exist_ok=True)
    (SHARED / "events.jsonl").touch(exist_ok=True)
    nodes = []
    for value in ids():
        world = ".".join(map(str, value))
        folder = path_for(value)
        write_json(folder / ".world-ref.json", {
            "world": world,
            "generation": len(value),
            "parent": ".".join(map(str, value[:-1])) or None,
            "source_repository": "MusicJapanLLC/test",
            "source_commit": CFG["seed_commit"],
            "shared_bus": str((SHARED / "events.jsonl").relative_to(REPO))
        })
        nodes.append(world)
    write_json(SHARED / "registry.json", {
        "seed_commit": CFG["seed_commit"],
        "leaf_worlds": CFG["branching_factor"] ** CFG["generations"],
        "total_nodes": len(nodes),
        "worlds": nodes
    })
    print(f"built {len(nodes)} nodes; {CFG['branching_factor'] ** CFG['generations']} leaf worlds")

def materialize(world):
    value = parts(world)
    target = path_for(value) / "snapshot"
    target.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(["git", "-C", str(REPO), "archive", CFG["seed_commit"]], stdout=subprocess.PIPE)
    assert proc.stdout is not None
    with tarfile.open(fileobj=proc.stdout, mode="r|") as archive:
        archive.extractall(target, filter="data")
    if proc.wait() != 0:
        raise SystemExit("git archive failed")
    print(f"materialized exact test snapshot at {target}")

def publish(world, message):
    parts(world)
    SHARED.mkdir(parents=True, exist_ok=True)
    event = {"time": dt.datetime.now(dt.timezone.utc).isoformat(), "source": world, "message": message}
    with (SHARED / "events.jsonl").open("a", encoding="utf-8") as out:
        out.write(json.dumps(event, ensure_ascii=False) + "\n")
    print(json.dumps(event, ensure_ascii=False))

def sync(world):
    value = parts(world)
    if not (SHARED / "events.jsonl").exists(): build()
    events = [json.loads(x) for x in (SHARED / "events.jsonl").read_text(encoding="utf-8").splitlines() if x]
    write_json(path_for(value) / "inbox.json", {"world": world, "events": events})
    print(f"synced {len(events)} events to {world}")

def verify():
    expected = sum(CFG["branching_factor"] ** n for n in range(1, CFG["generations"] + 1))
    actual = sum(1 for _ in WORLDS.rglob(".world-ref.json")) if WORLDS.exists() else 0
    result = {"ok": actual == expected, "expected": expected, "actual": actual,
              "leaf_worlds": CFG["branching_factor"] ** CFG["generations"]}
    print(json.dumps(result))
    raise SystemExit(0 if result["ok"] else 1)

def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="cmd", required=True)
    commands.add_parser("build")
    mat = commands.add_parser("materialize"); mat.add_argument("--world", required=True)
    pub = commands.add_parser("publish"); pub.add_argument("--world", required=True); pub.add_argument("--message", required=True)
    syn = commands.add_parser("sync"); syn.add_argument("--world", required=True)
    commands.add_parser("verify")
    args = parser.parse_args()
    if args.cmd == "build": build()
    elif args.cmd == "materialize": materialize(args.world)
    elif args.cmd == "publish": publish(args.world, args.message)
    elif args.cmd == "sync": sync(args.world)
    else: verify()

if __name__ == "__main__": main()
