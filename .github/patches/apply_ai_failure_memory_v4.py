#!/usr/bin/env python3
"""One-shot fail-closed installer for AI Foundry failure-memory v4.

This helper is intentionally temporary. It refuses to overwrite an unexpected
source revision, decodes pre-reviewed payloads, validates their content hashes and
Python syntax, then writes only the two AI Foundry files under test.
"""
from __future__ import annotations

import ast
import base64
import hashlib
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MINUTE = ROOT / "automation/ai_foundry/minute_evolution.py"
TESTS = ROOT / "automation/ai_foundry/test_minute_evolution.py"
MINUTE_PAYLOAD = ROOT / ".github/patches/ai_failure_memory_minute_v4.b85"
TEST_PAYLOAD = ROOT / ".github/patches/ai_failure_memory_tests_v4.b85"

EXPECTED_OLD = {
    MINUTE: "47c72666f8e757697196f4a216a5d9921039d12953d2d6da9a2e550be9c1cd16",
    TESTS: "36c100345346fc59d126d44b47d26f6aa955fb015b98688bcf85f28370e3e430",
}
EXPECTED_NEW = {
    MINUTE: "3f78d64691732f4775e68427aac167ae99b1579bb8d7a9061556e7bde639a1f7",
    TESTS: "2288340707bc9658b60afb47dfa00cd239580f825814098b20152b376fcde714",
}
PAYLOADS = {MINUTE: MINUTE_PAYLOAD, TESTS: TEST_PAYLOAD}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode(path: Path) -> bytes:
    token = "".join(path.read_text(encoding="ascii").split())
    return zlib.decompress(base64.b85decode(token.encode("ascii")))


def main() -> int:
    desired: dict[Path, bytes] = {}
    for target, payload in PAYLOADS.items():
        current = target.read_bytes()
        current_hash = sha256_bytes(current)
        wanted = decode(payload)
        wanted_hash = sha256_bytes(wanted)
        if wanted_hash != EXPECTED_NEW[target]:
            raise SystemExit(f"payload hash mismatch for {target}: {wanted_hash}")
        if current_hash == EXPECTED_NEW[target]:
            desired[target] = wanted
            continue
        if current_hash != EXPECTED_OLD[target]:
            raise SystemExit(
                f"fail-closed: unexpected current hash for {target}: {current_hash}"
            )
        desired[target] = wanted

    for target, data in desired.items():
        text = data.decode("utf-8")
        ast.parse(text, filename=str(target))

    for target, data in desired.items():
        target.write_bytes(data)
        if sha256_bytes(target.read_bytes()) != EXPECTED_NEW[target]:
            raise SystemExit(f"post-write hash mismatch for {target}")
        print(f"installed {target.relative_to(ROOT)} sha256={EXPECTED_NEW[target]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
