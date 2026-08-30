from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ACCOUNTABILITY = ROOT / "company-society/ECONOMIC_ACCOUNTABILITY.md"
ECONOMY = ROOT / "company-society/ECONOMY.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class EconomicAccountabilityContractTests(unittest.TestCase):
    def test_runtime_accountability_contract_is_named(self):
        text = read(ACCOUNTABILITY)
        for marker in [
            "public.world_accountability_cases",
            "public.world_reconcile_reward_integrity(uuid)",
            "trg_world_reward_integrity",
            "public.world_ledger",
            "public.world_event_outbox",
        ]:
            self.assertIn(marker, text)

    def test_protected_states_are_not_punished(self):
        text = read(ACCOUNTABILITY)
        for marker in [
            "ordinary failure",
            "SANCTUARY / managed rest",
            "confession of uncertainty or error",
            "SKEPTIC dissent or disagreement",
            "setting a Covenant pledge to 0%",
            "being outperformed in a competition",
        ]:
            self.assertIn(marker, text)
        self.assertIn("They do not create fines.", text)

    def test_restitution_is_bounded_and_reversible(self):
        text = read(ACCOUNTABILITY)
        self.assertIn("at most the exact unearned performance reward", text)
        self.assertIn("never create a negative balance", text)
        self.assertIn("never claw back ordinary salary", text)
        self.assertIn("restore only what was actually restituted", text)
        self.assertIn("This is restitution, not retaliation.", text)

    def test_competition_does_not_create_loss_penalties(self):
        text = read(ACCOUNTABILITY)
        self.assertIn("Competition losses do not incur fines.", text)
        self.assertIn("currently registered employee", text)
        self.assertIn("independently verified and not disqualified", text)

    def test_faith_cannot_buy_authority_or_acquittal(self):
        text = read(ACCOUNTABILITY)
        self.assertIn("buy an acquittal", text)
        self.assertIn("buy security or managerial authority", text)
        self.assertIn("0% pledge", text)

    def test_base_economy_keeps_core_guardrails(self):
        text = read(ECONOMY)
        for marker in [
            "Evidence creates income.",
            "Wealth can buy opportunity, not authority.",
            "Non-payment is not misconduct.",
            "The ledger is append-only.",
            "No negative balances.",
            "Rest is not poverty punishment.",
        ]:
            self.assertIn(marker, text)


if __name__ == "__main__":
    unittest.main()
