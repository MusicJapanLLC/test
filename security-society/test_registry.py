import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("registry.py")
spec = importlib.util.spec_from_file_location("security_society_registry", MODULE_PATH)
registry = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(registry)


class RosterTests(unittest.TestCase):
    def test_exactly_100_unique_agents(self):
        roster = registry.build_roster()
        self.assertEqual(100, len(roster))
        self.assertEqual(100, len({a.agent_id for a in roster}))
        registry.validate_roster(roster)

    def test_ten_agents_per_guild(self):
        roster = registry.build_roster()
        for guild in registry.GUILDS:
            self.assertEqual(10, sum(a.guild == guild for a in roster))


class DelegationTests(unittest.TestCase):
    def setUp(self):
        self.parent = registry.ParentGrant(
            parent_id="SEC-APPSEC-01",
            capabilities=frozenset({"secure_code_review", "sast_triage"}),
            network_scope="simulated-only",
            max_ttl_minutes=240,
            covenant_profile="THE-COVENANT",
        )

    def test_happy_path_is_narrower_than_parent(self):
        request = registry.SubagentRequest(
            child_id="SEC-APPSEC-01-C01",
            purpose="review a proposed remediation",
            capabilities=frozenset({"secure_code_review"}),
            ttl_minutes=60,
        )
        event = registry.registration_event(self.parent, request)
        self.assertEqual("SECURITY_SUBAGENT_REGISTERED", event["event_type"])
        self.assertTrue(str(event["dedupe_key"]).startswith("security-society:"))
        self.assertEqual(
            ["WORKER", "MANAGER", "TOMOKI", "BOSS", "CEO"],
            event["reporting_route"],
        )

    def test_capability_escalation_is_denied(self):
        request = registry.SubagentRequest(
            child_id="bad-cap",
            purpose="expand permissions",
            capabilities=frozenset({"secure_code_review", "incident_triage"}),
        )
        with self.assertRaises(registry.DelegationViolation):
            registry.validate_delegation(self.parent, request)

    def test_external_network_scope_is_denied(self):
        request = registry.SubagentRequest(
            child_id="bad-net",
            purpose="external activity",
            capabilities=frozenset({"secure_code_review"}),
            network_scope="external",
        )
        with self.assertRaises(registry.DelegationViolation):
            registry.validate_delegation(self.parent, request)

    def test_secrets_and_production_write_are_not_self_service(self):
        for kwargs in ({"needs_secrets": True}, {"needs_production_write": True}):
            request = registry.SubagentRequest(
                child_id="privileged-child",
                purpose="should fail closed",
                capabilities=frozenset({"secure_code_review"}),
                **kwargs,
            )
            with self.assertRaises(registry.DelegationViolation):
                registry.validate_delegation(self.parent, request)

    def test_private_lab_waits_for_issue_42(self):
        lab_parent = registry.ParentGrant(
            parent_id="SEC-SIM-01",
            capabilities=frozenset({"scenario_design"}),
            network_scope="private-lab",
        )
        request = registry.SubagentRequest(
            child_id="SEC-SIM-01-C01",
            purpose="authorized lab scenario",
            capabilities=frozenset({"scenario_design"}),
            network_scope="private-lab",
        )
        with self.assertRaises(registry.DelegationViolation):
            registry.validate_delegation(lab_parent, request, issue_42_remediated=False)

        registry.validate_delegation(lab_parent, request, issue_42_remediated=True)

    def test_ttl_cannot_exceed_parent(self):
        request = registry.SubagentRequest(
            child_id="too-long",
            purpose="oversized ttl",
            capabilities=frozenset({"secure_code_review"}),
            ttl_minutes=241,
        )
        with self.assertRaises(registry.DelegationViolation):
            registry.validate_delegation(self.parent, request)


if __name__ == "__main__":
    unittest.main()
