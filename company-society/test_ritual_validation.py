import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("ritual_validation", HERE / "ritual_validation.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class RitualValidationTests(unittest.TestCase):
    def test_empty_confession_is_rejected(self):
        errors = MODULE.validate_record("confession", "FORGE", "   ")
        self.assertTrue(any("details" in error for error in errors))

    def test_unknown_ritual_is_rejected(self):
        errors = MODULE.validate_record("teleport", "HOUND", "Observed an unexpected state transition")
        self.assertTrue(any("unsupported" in error for error in errors))

    def test_agent_newline_is_rejected(self):
        errors = MODULE.validate_record("rest", "FORGE\nBOSS", "Retry loop is exhausted; preserve handoff state")
        self.assertTrue(any("newline" in error for error in errors))

    def test_valid_confession_passes(self):
        errors = MODULE.validate_record(
            "confession",
            "SKEPTIC",
            "Reported a claim before independent verification; retracted and reran checks.",
        )
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
