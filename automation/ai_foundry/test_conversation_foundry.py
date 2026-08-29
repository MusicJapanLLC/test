from __future__ import annotations

import json
import unittest
from pathlib import Path

from automation.ai_foundry.conversation_foundry import (
    SCHEMA,
    compile_request,
    project_id,
    validate_spec,
)


ROOT = Path(__file__).resolve().parents[2]
PROGRAM = json.loads((ROOT / "automation/ai_foundry/ai_development_program.json").read_text(encoding="utf-8"))


class ConversationFoundryTests(unittest.TestCase):
    def test_build_request_reuses_existing_engineering_stack(self):
        spec = compile_request(
            "AI開発に特化した会話型AIを作って。GitHub、コネクタ、サブエージェント、Supabase、Vercelを最大限活用して実装して",
            PROGRAM,
        )
        self.assertEqual(spec["schema"], SCHEMA)
        self.assertEqual(spec["mode"], "BUILD")
        self.assertEqual(validate_spec(spec), [])
        resources = {x["id"] for x in spec["resources"]}
        self.assertTrue({"brainbase", "github", "agent_factory", "openai_agents_sdk", "supabase", "vercel", "ai_security"} <= resources)
        self.assertIn("Full-stack Engineer Alpha", spec["specialists"])
        self.assertIn("Full-stack Engineer Beta", spec["specialists"])
        self.assertTrue(spec["factory_handoff"]["pr_required"])

    def test_same_request_gets_same_project_id(self):
        request = "Build an AI coding agent with memory"
        self.assertEqual(project_id(request), project_id("  Build   an AI coding agent with memory  "))

    def test_training_language_does_not_fake_training_completion(self):
        spec = compile_request("このAIをファインチューニングしてモデル学習も検討して", PROGRAM)
        self.assertEqual(spec["model_strategy"]["fine_tuning"], "benchmark_first")
        self.assertTrue(spec["completion_gate"]["training_claim_requires_training_artifacts"])

    def test_eval_first_cases_include_tool_failure_when_connectors_requested(self):
        spec = compile_request("MCPコネクタを使うAIを作って", PROGRAM)
        case_ids = {x["id"] for x in spec["eval_plan"]["cases"]}
        self.assertIn("tool_failure", case_ids)
        self.assertTrue(spec["eval_plan"]["eval_first"])

    def test_multi_agent_request_routes_to_senju_and_evolution(self):
        spec = compile_request("サブエージェントのチームでAIを改善して", PROGRAM)
        resources = {x["id"] for x in spec["resources"]}
        self.assertIn("senju", resources)
        self.assertIn("Agent Evolution Engineer", spec["specialists"])

    def test_validation_rejects_self_verification(self):
        spec = compile_request("AIを作って", PROGRAM)
        spec["completion_gate"]["self_verification"] = True
        self.assertIn("self_verification_enabled", validate_spec(spec))


if __name__ == "__main__":
    unittest.main()
