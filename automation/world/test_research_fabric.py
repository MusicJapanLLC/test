import unittest

from research_fabric import SPECS, build_batch


class ResearchFabricTests(unittest.TestCase):
    def _config(self):
        programs=[]
        for i,(key,_) in enumerate(SPECS.items()):
            programs.append({
                'program_key':key,'priority':100-i,'due':True,'trial_budget':120,
                'exploration_rate':0.35,'replication_bias':0.4,
            })
        return {
            'programs':programs,
            'recent_findings':[],
            'open_replications':[],
            'resident_snapshot':{
                'active_count':8,
                'sample':[
                    {'resident_key':'r1','identity_class':'official_employee'},
                    {'resident_key':'r2','identity_class':'security_society'},
                    {'resident_key':'r3','identity_class':'fictional_child_persona'},
                    {'resident_key':'r4','identity_class':'automation_resident'},
                    {'resident_key':'r5','identity_class':'official_employee'},
                ],
            },
            'experiment_snapshot':{'runs':4,'trials':12000},
            'economy_snapshot':{'wallet_count':171},
        }

    def test_all_due_labs_execute(self):
        batch=build_batch(self._config(),12345,max_programs=8)
        self.assertEqual(batch['program_count'],8)
        self.assertTrue(batch['closed_model'])
        self.assertGreater(batch['trial_count'],8*120)

    def test_cycles_are_bounded_and_have_evidence(self):
        batch=build_batch(self._config(),777,max_programs=8)
        for cycle in batch['cycles']:
            self.assertIn(cycle['program_key'],SPECS)
            self.assertGreaterEqual(cycle['trial_count'],120)
            self.assertGreaterEqual(cycle['novelty'],0)
            self.assertLessEqual(cycle['novelty'],1)
            self.assertGreaterEqual(cycle['confidence'],0)
            self.assertLessEqual(cycle['confidence'],1)
            self.assertGreaterEqual(cycle['reproducibility'],0)
            self.assertLessEqual(cycle['reproducibility'],1)
            self.assertTrue(cycle['artifact']['closed_model'])
            self.assertEqual(len(cycle['findings']),2)
            self.assertGreaterEqual(len(cycle['selected_resident_keys']),1)

    def test_not_due_programs_do_not_run(self):
        cfg=self._config()
        for p in cfg['programs']:
            p['due']=False
        batch=build_batch(cfg,99,max_programs=8)
        self.assertEqual(batch['program_count'],0)
        self.assertEqual(batch['trial_count'],0)

    def test_deterministic_for_same_snapshot_and_run(self):
        a=build_batch(self._config(),424242,max_programs=3)
        b=build_batch(self._config(),424242,max_programs=3)
        self.assertEqual(a,b)


if __name__ == '__main__':
    unittest.main()
