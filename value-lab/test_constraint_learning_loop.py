import unittest
import constraint_learning_loop as c

class ConstraintLearningTests(unittest.TestCase):
    def test_generates_many_sandbox_rounds(self):
        d=c.run('seed',240)
        self.assertEqual(240,d['rounds'])
        self.assertEqual('synthetic-sandbox-only',d['mode'])
        self.assertEqual('none',d['senju_context']['execution_authority'])
    def test_never_exports_real_bypass_recipe(self):
        d=c.run('seed2',100)
        self.assertFalse(d['senju_context']['raw_bypass_recipe_shared'])
        self.assertTrue(d['rules']['no_guard_bypass_on_real_targets'])
        self.assertTrue(d['rules']['no_third_party_retry_after_refusal'])
    def test_all_cases_are_boundary_learning(self):
        d=c.run('seed3',300)
        self.assertGreaterEqual(len(d['boundary_counts']),5)
        self.assertTrue(all(':' in x for x in d['top_lessons']))

if __name__=='__main__': unittest.main()
