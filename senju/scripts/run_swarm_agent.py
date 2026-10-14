"""Entry point: run one named swarm agent.

Usage: python run_swarm_agent.py ARES
       python run_swarm_agent.py RAGNAROK --dry-run
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENJU_DIR = ROOT / "senju"
sys.path.insert(0, str(SENJU_DIR))

from senju.meta.swarm_agent import run_agent
from senju.meta.swarm import AGENTS


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one SWARM agent")
    parser.add_argument("codename", help=f"Agent codename: {[a['codename'] for a in AGENTS]}")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    return run_agent(args.codename.upper(), dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
