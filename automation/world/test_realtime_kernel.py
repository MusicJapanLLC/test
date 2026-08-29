import unittest
from datetime import datetime, timedelta, timezone

from automation.world.realtime_kernel import classify_run
from automation.world.core_director import validate_plan

NOW = datetime(2026, 8, 29, 12, 0, tzinfo=timezone.utc)

class RealtimeKernelTests(unittest.TestCase):
    def test_classifies_running_failed_stale_and_healthy(self):
        base={"id":1,"run_attempt":1}
        running={**base,"status":"in_progress","created_at":NOW.isoformat()}
        failed={**base,"status":"completed","conclusion":"failure","updated_at":NOW.isoformat()}
        stale={**base,"status":"completed","conclusion":"success","updated_at":(NOW-timedelta(minutes=61)).isoformat()}
        healthy={**base,"status":"completed","conclusion":"success","updated_at":(NOW-timedelta(minutes=5)).isoformat()}
        self.assertEqual(classify_run(running,60,NOW),"RUNNING")
        self.assertEqual(classify_run(failed,60,NOW),"FAILED")
        self.assertEqual(classify_run(stale,60,NOW),"STALE")
        self.assertEqual(classify_run(healthy,60,NOW),"HEALTHY")

    def test_director_rejects_fresh_and_non_allowlisted_actions(self):
        rt={"workers":[{"workflow":"safe.yml","stale_minutes":60,"director_min_interval_minutes":30}]}
        snap={"workers":[{"workflow":"safe.yml","state":"HEALTHY","age_minutes":10,"run_id":1}]}
        plan={"actions":[{"action":"dispatch","workflow":"safe.yml","reason":"too fresh"},{"action":"dispatch","workflow":"evil.yml","reason":"not allowlisted"}]}
        self.assertEqual(validate_plan(plan,snap,rt),[])

    def test_director_accepts_stale_allowlisted_dispatch_once(self):
        rt={"workers":[{"workflow":"safe.yml","stale_minutes":60,"director_min_interval_minutes":30}]}
        snap={"workers":[{"workflow":"safe.yml","state":"STALE","age_minutes":80,"run_id":1}]}
        plan={"actions":[{"action":"dispatch","workflow":"safe.yml","reason":"restart"},{"action":"dispatch","workflow":"safe.yml","reason":"duplicate"}]}
        accepted=validate_plan(plan,snap,rt)
        self.assertEqual(len(accepted),1)
        self.assertEqual(accepted[0]["workflow"],"safe.yml")

if __name__ == "__main__":
    unittest.main()
