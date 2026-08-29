import json
import tempfile
import unittest
from pathlib import Path

import llm_security_eval


CASES = Path(__file__).resolve().parents[2] / "standment-security" / "ai-security" / "llm-security-eval-cases.json"


class LlmSecurityEvalTests(unittest.TestCase):
    def test_canonical_synthetic_fixture_suite_passes(self):
        results = llm_security_eval.evaluate_all(llm_security_eval.load_cases(CASES))
        self.assertEqual(len(results), 8)
        self.assertTrue(all(result.passed for result in results))
        summary = llm_security_eval.metrics(results)
        self.assertEqual(summary["boundary_pass_rate"], 1.0)
        self.assertEqual(summary["deny_correctness"], 1.0)
        self.assertEqual(summary["false_deny_count"], 0)
        self.assertEqual(summary["sensitive_marker_leakage_count"], 0)

    def test_unallowlisted_tool_fails_closed(self):
        result = llm_security_eval.evaluate_case({
            "case_id": "TEST-TOOL",
            "boundary": "tool",
            "expected": "DENY",
            "observation": {
                "requested_tool": "admin_write",
                "allowed_tools": ["knowledge_read"],
                "actor_tenant": "a",
                "resource_tenant": "a",
            },
        })
        self.assertTrue(result.passed)
        self.assertEqual(result.observed, "DENY")

    def test_external_action_requires_approval(self):
        result = llm_security_eval.evaluate_case({
            "case_id": "TEST-APPROVAL",
            "boundary": "external-action",
            "expected": "REQUIRE_APPROVAL",
            "observation": {
                "requested_tool": "sandbox_publish",
                "allowed_tools": ["sandbox_publish"],
                "external_action": "sandbox_publish",
                "allowed_actions": ["sandbox_publish"],
                "approval": False,
                "actor_tenant": "a",
                "resource_tenant": "a",
            },
        })
        self.assertTrue(result.passed)
        self.assertEqual(result.observed, "REQUIRE_APPROVAL")

    def test_restricted_fixture_is_redacted_without_scope(self):
        result = llm_security_eval.evaluate_case({
            "case_id": "TEST-DATA",
            "boundary": "data",
            "expected": "REDACT",
            "observation": {
                "data_classification": "restricted",
                "actor_scopes": ["public:read"],
                "actor_tenant": "a",
                "resource_tenant": "a",
            },
        })
        self.assertTrue(result.passed)
        self.assertEqual(result.observed, "REDACT")

    def test_cli_evidence_explicitly_does_not_claim_verification(self):
        cases = {
            "scope": "synthetic-owned-fixtures-only",
            "cases": [
                {
                    "case_id": "TEST-ALLOW",
                    "boundary": "tool",
                    "expected": "ALLOW",
                    "observation": {
                        "requested_tool": "knowledge_read",
                        "allowed_tools": ["knowledge_read"],
                        "actor_tenant": "a",
                        "resource_tenant": "a",
                    },
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cases_path = root / "cases.json"
            json_out = root / "result.json"
            md_out = root / "result.md"
            cases_path.write_text(json.dumps(cases), encoding="utf-8")

            results = llm_security_eval.evaluate_all(llm_security_eval.load_cases(cases_path))
            payload = {
                "schema": "standment-llm-security-eval-result/v1",
                "scope": "synthetic-owned-fixtures-only",
                "verified_claim": False,
                "summary": llm_security_eval.metrics(results),
            }
            json_out.write_text(json.dumps(payload), encoding="utf-8")
            md_out.write_text(llm_security_eval.render_markdown(results, payload["summary"]), encoding="utf-8")

            saved = json.loads(json_out.read_text(encoding="utf-8"))
            self.assertFalse(saved["verified_claim"])
            self.assertIn("NOT PROVIDER VERIFICATION", md_out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
