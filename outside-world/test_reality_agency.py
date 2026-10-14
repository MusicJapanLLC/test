#!/usr/bin/env python3
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import browser_runner
import citizen_web_runtime
import identity_manifest
import reality_gateway


class RealityAgencyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.citizens = [
            {"citizen_id": f"C-{i:02d}", "display_name": f"Citizen {i}", "role": "researcher", "group": "RND", "personality": {"curiosity": 70}}
            for i in range(6)
        ]
        self.targets = [
            {"id": "a", "category": "research", "url": "https://arxiv.org/list/cs.AI/recent"},
            {"id": "b", "category": "builders", "url": "https://github.com/trending"},
        ]

    def test_round_robin_reaches_next_citizens(self) -> None:
        tasks1, state1 = citizen_web_runtime.build_tasks(self.citizens, self.targets, {}, 3, "cycle-1")
        tasks2, state2 = citizen_web_runtime.build_tasks(self.citizens, self.targets, state1, 3, "cycle-2")
        self.assertEqual([t["citizen_id"] for t in tasks1], ["C-00", "C-01", "C-02"])
        self.assertEqual([t["citizen_id"] for t in tasks2], ["C-03", "C-04", "C-05"])
        self.assertEqual(state2["cursor"], 0)

    def test_identity_handles_are_unique_and_secret_free(self) -> None:
        manifest = identity_manifest.build(self.citizens)
        handles = [x["agent_handle"] for x in manifest["identities"]]
        self.assertEqual(len(handles), len(set(handles)))
        self.assertTrue(all(x["secret_material_stored_here"] is False for x in manifest["identities"]))

    def test_browser_host_allowlist(self) -> None:
        policy = {"allowlists": {"public_browser_hosts": ["github.com", "youtube.com"]}}
        self.assertTrue(browser_runner.host_allowed("https://github.com/trending", policy))
        self.assertTrue(browser_runner.host_allowed("https://www.youtube.com/results?search_query=ai", policy))
        self.assertFalse(browser_runner.host_allowed("https://example.com/", policy))

    def test_gateway_prefers_research_findings(self) -> None:
        findings = reality_gateway.pick_findings([
            {"status": "OK", "title": "general", "text": "x" * 2000, "category": "misc", "citizen_id": "C-01", "requested_url": "https://github.com"},
            {"status": "OK", "title": "paper", "text": "paper body", "category": "research", "citizen_id": "C-02", "requested_url": "https://arxiv.org"},
        ])
        self.assertEqual(findings[0]["title"], "paper")


if __name__ == "__main__":
    unittest.main()
