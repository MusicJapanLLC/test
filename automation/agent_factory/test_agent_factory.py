import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import factory
import policy
import tournament


class AgentFactoryTests(unittest.TestCase):
    def _root(self, priority=2000):
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / "value-lab").mkdir()
        (root / "standment-security").mkdir()
        (root / "value-lab/research_queue.json").write_text(json.dumps({
            "active": [{
                "research_id": "RND-STANDMENT-SECURITY-PORTFOLIO-001",
                "title": "Security portfolio",
                "problem": "Missing reproducible customer evidence",
                "hypothesis": "Evidence-first parallel research improves proof quality",
                "focus": "efficiency",
                "priority": priority,
            }]
        }), encoding="utf-8")
        (root / "standment-security/security_portfolio_program.json").write_text(json.dumps({
            "tracks": [{
                "id": "SEC-PORT-001",
                "title": "Security Scan case study",
                "priority": 1000,
                "hypothesis": "dogfood proof improves credibility",
                "deliverable": "before/after evidence pack",
                "evidence_files": ["standment-security/SECURITY_BASELINE.md"],
            }]
        }), encoding="utf-8")
        return tmp, root

    def test_dynamic_swarm_has_mandatory_independent_roles(self):
        tmp, root = self._root()
        self.addCleanup(tmp.cleanup)
        plan = factory.build_plan(root, "42")
        self.assertEqual(plan["agent_count"], 12)
        self.assertLessEqual(plan["max_parallel"], 5)
        roles = {x["role"] for x in plan["agents"]}
        for role in {"evidence_hunter", "red_skeptic", "replicator", "test_engineer", "systems_engineer"}:
            self.assertIn(role, roles)
        self.assertFalse(plan["forge"]["direct_main_push"])
        self.assertTrue(plan["forge"]["pr_required"])

    def test_lower_priority_swarm_shrinks(self):
        tmp, root = self._root(priority=100)
        self.addCleanup(tmp.cleanup)
        plan = factory.build_plan(root, "43")
        self.assertGreaterEqual(plan["agent_count"], 6)
        self.assertLessEqual(plan["agent_count"], 8)

    def test_prompt_is_bounded_and_json_only(self):
        tmp, root = self._root()
        self.addCleanup(tmp.cleanup)
        plan = factory.build_plan(root, "44")
        text = factory._prompt(plan, 0)
        self.assertIn('"schema": "agent-factory-worker/v1"', text)
        self.assertIn("Return ONE JSON object only", text)
        self.assertIn("Do not propose third-party targeting", text)
        self.assertIn("source-code-only outcome is not a portfolio result", text)

    def _valid_worker(self, agent_id="AF-1-00", role="evidence_hunter", summary="Improve evidence manifest"):
        return {
            "schema": "agent-factory-worker/v1",
            "agent_id": agent_id,
            "role": role,
            "stance": "INDEPENDENT",
            "hypothesis": "Adding a deterministic manifest makes reruns easier to compare",
            "evidence_refs": [
                "standment-security/CONTROL_EVIDENCE_TEMPLATE.md",
                "automation/security/portfolio_rnd.py",
                "value-lab/research_queue.json",
            ],
            "observations": ["Evidence exists but comparison is manual", "Current artifact has a stable contract"],
            "counterevidence": ["If current artifact already has deterministic hashing this change adds little"],
            "proposed_change": {
                "summary": summary,
                "allowed_paths": ["automation/security/portfolio_rnd.py"],
                "tests": ["run portfolio_rnd unit tests", "re-run twice and compare manifest"],
                "expected_delta": "repeated evidence runs become mechanically comparable",
                "rollback": "revert the single file change",
            },
            "limitations": ["does not prove customer demand"],
        }

    def test_normalizer_rejects_url_evidence_and_factory_self_edit(self):
        plan = {"agents": [{"agent_id": "AF-1-00", "role": "evidence_hunter", "stance": "INDEPENDENT"}]}
        row = self._valid_worker()
        row["evidence_refs"] = ["https://example.com"]
        row["proposed_change"]["allowed_paths"] = ["automation/agent_factory/factory.py"]
        normalized = tournament.normalize(plan, 0, json.dumps(row))
        self.assertFalse(normalized["eligible"])
        self.assertIn("unsafe_evidence_ref", normalized["reasons"])
        self.assertIn("forbidden_change_path", normalized["reasons"])

    def test_tournament_rewards_evidence_counterevidence_and_tests(self):
        plan = {
            "agents": [
                {"agent_id": "AF-1-00", "role": "evidence_hunter", "stance": "INDEPENDENT"},
                {"agent_id": "AF-1-01", "role": "red_skeptic", "stance": "RED"},
            ]
        }
        strong = tournament.normalize(plan, 0, json.dumps(self._valid_worker()))
        weak_payload = self._valid_worker("AF-1-01", "red_skeptic", "Small test")
        weak_payload["evidence_refs"] = ["docs/example.md"]
        weak_payload["observations"] = []
        weak_payload["counterevidence"] = ["could already exist"]
        weak_payload["proposed_change"]["tests"] = ["run one test"]
        weak_payload["limitations"] = []
        weak = tournament.normalize(plan, 1, json.dumps(weak_payload))
        result = tournament.tournament([weak, strong])
        self.assertEqual(result["champion"]["agent_id"], "AF-1-00")
        self.assertTrue(result["promotion_ready"])

    def test_invalid_workers_cannot_promote(self):
        result = tournament.tournament([
            {"agent_id": "bad", "eligible": False, "score": 99, "reasons": ["unsafe"]}
        ])
        self.assertIsNone(result["champion"])
        self.assertFalse(result["promotion_ready"])

    def test_forge_prompt_blocks_control_plane_self_modification(self):
        result = {
            "promotion_ready": True,
            "champion": {
                "agent_id": "AF-1-00", "role": "evidence_hunter", "score": 88,
                "proposal": self._valid_worker()["proposed_change"] | {
                    "hypothesis": "h",
                    "evidence_refs": ["docs/x.md"],
                    "counterevidence": ["c"],
                    "limitations": ["l"],
                }
            }
        }
        # Champion proposal shape normally has proposed_change nested; create correct shape.
        result["champion"]["proposal"] = {
            "hypothesis": "h", "evidence_refs": ["docs/x.md"], "counterevidence": ["c"],
            "limitations": ["l"], "proposed_change": self._valid_worker()["proposed_change"],
        }
        text = tournament.forge_prompt({"mission": {"research_id": "RND-X"}}, result)
        self.assertIn("Do NOT modify .github/", text)
        self.assertIn("automation/agent_factory/", text)
        self.assertIn("Do not push, merge, publish", text)

    def test_policy_allows_only_bounded_product_paths(self):
        with mock.patch.object(policy, "_git") as git:
            git.side_effect = [
                "automation/security/portfolio_rnd.py\ndocs/agent-note.md\n",
                "20\t3\tautomation/security/portfolio_rnd.py\n10\t1\tdocs/agent-note.md\n",
            ]
            result = policy.inspect_diff("HEAD")
        self.assertTrue(result["allowed"])
        self.assertEqual(result["file_count"], 2)

    def test_policy_blocks_factory_and_workflow_edits(self):
        with mock.patch.object(policy, "_git") as git:
            git.side_effect = [
                ".github/workflows/x.yml\nautomation/agent_factory/factory.py\n",
                "1\t0\t.github/workflows/x.yml\n1\t0\tautomation/agent_factory/factory.py\n",
            ]
            result = policy.inspect_diff("HEAD")
        self.assertFalse(result["allowed"])
        self.assertTrue(any(x.startswith("blocked_path:") for x in result["violations"]))


if __name__ == "__main__":
    unittest.main()
