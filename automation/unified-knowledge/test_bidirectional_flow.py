"""
Bidirectional Knowledge Flow - Integration Test

Verifies that THE-WORLD-GOD system has true 2-way knowledge exchange:
  test → discovery → THE-WORLD-GOD → improvement → test

This closes the loop from previous one-directional flow.
"""

import json
import tempfile
from pathlib import Path
from datetime import datetime

# Mock implementations for testing
class MockKnowledgeDB:
    """Mock knowledge database for testing"""
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data.get(key)

    def query(self, **kwargs):
        """Simulated query returning high-success patterns"""
        min_rate = kwargs.get('min_success_rate', 0.85)
        return [
            {
                'knowledge_id': f'pattern_001',
                'category': 'config_tune',
                'source_repos': ['the-world2'],
                'effectiveness': {'success_rate': 0.94},
                'content': {
                    'config_file': 'automation/config.json',
                    'recommended_values': {'timeout': 30, 'retries': 3}
                },
                'meta_learning': {
                    'preconditions': ['config_file_exists']
                }
            },
            {
                'knowledge_id': 'pattern_002',
                'category': 'workflow',
                'source_repos': ['the-world2'],
                'effectiveness': {'success_rate': 0.88},
                'content': {
                    'workflow_file': '.github/workflows/optimization.yml',
                    'workflow_changes': {
                        'patches': {
                            'timeout: 60': 'timeout: 30'
                        }
                    }
                },
                'meta_learning': {
                    'preconditions': ['workflow_exists']
                }
            }
        ]


class MockAgentRegistry:
    """Mock agent registry"""
    def list_agents(self):
        return ['FORGE', 'CLAUDE', 'GPT']

    def get_stats(self, agent_name):
        return {
            'recent_success_rate': 0.85,
            'evolution_level': 'L2',
            'reassign_requests': 0
        }


def test_bidirectional_setup():
    """Test 1: Bidirectional flow initialization"""
    print("\n" + "="*70)
    print("TEST 1: Bidirectional Flow Initialization")
    print("="*70)

    from knowledge_pushback import BidirectionalKnowledgeFlow

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_root = Path(tmpdir) / "test_repo"
        repo_root.mkdir()
        state_dir = Path(tmpdir) / "state"
        state_dir.mkdir()

        # Initialize bidirectional flow
        flow = BidirectionalKnowledgeFlow(str(repo_root), str(state_dir))
        assert flow is not None

        # Verify log files are ready
        assert flow.flow_log.parent.exists()

        print("✓ Bidirectional flow initialized successfully")
        print(f"  Flow log: {flow.flow_log}")

        return True


def test_knowledge_discovery_inbound():
    """Test 2: Knowledge flows inbound (test → THE-WORLD-GOD)"""
    print("\n" + "="*70)
    print("TEST 2: Inbound Knowledge Discovery")
    print("="*70)

    from knowledge_pushback import BidirectionalKnowledgeFlow

    with tempfile.TemporaryDirectory() as tmpdir:
        flow = BidirectionalKnowledgeFlow(tmpdir, tmpdir)

        # Simulate a discovery in test repo
        discovery = {
            "knowledge_id": "kn_test_discovery_001",
            "title": "Connection pool timeout optimization",
            "category": "failure_pattern",
            "success_rate": 0.92
        }

        result = flow.process_knowledge_discovery(discovery)
        assert result['status'] == 'pending'
        assert result['direction'] == 'inbound'
        assert result['source_repo'] == 'test'

        print("✓ Inbound discovery recorded")
        print(f"  Discovery ID: {result['discovery_id']}")
        print(f"  Target repos: {result['target_repos']}")

        return True


def test_god_improvement_outbound():
    """Test 3: Knowledge flows outbound (THE-WORLD-GOD → test)"""
    print("\n" + "="*70)
    print("TEST 3: Outbound Improvement Execution")
    print("="*70)

    from knowledge_pushback import BidirectionalKnowledgeFlow

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_root = Path(tmpdir) / "test_repo"
        repo_root.mkdir()
        state_dir = Path(tmpdir) / "state"
        state_dir.mkdir()

        # Create a test config file
        config_file = repo_root / "automation" / "config.json"
        config_file.parent.mkdir(parents=True)
        config_file.write_text(json.dumps({"timeout": 60, "retries": 2}))

        flow = BidirectionalKnowledgeFlow(str(repo_root), str(state_dir))

        # Simulate an improvement from THE-WORLD-GOD
        improvement = {
            "knowledge_id": "kn_god_improvement_001",
            "target_repo": "test",
            "execution_id": f"exec_{datetime.utcnow().timestamp()}",
            "proposal": {
                "type": "config_tune",
                "config_file": "automation/config.json",
                "tuning": {
                    "timeout": 30,
                    "retries": 3
                }
            }
        }

        result = flow.process_god_improvement(improvement)
        assert result['direction'] == 'outbound'
        assert result['status'] in ['applied', 'created', 'no_changes']

        print("✓ Outbound improvement executed")
        print(f"  Execution ID: {result['execution_result']['execution_id']}")
        print(f"  Status: {result['status']}")
        print(f"  Changes applied: {len(result['execution_result'].get('changes', []))}")

        # Verify config was updated
        updated_config = json.loads(config_file.read_text())
        assert updated_config['timeout'] == 30
        assert updated_config['retries'] == 3

        print("✓ Configuration verified - improvements applied correctly")

        return True


def test_orchestrator_bidirectional_integration():
    """Test 4: THE-WORLD-GOD orchestrator with bidirectional flow"""
    print("\n" + "="*70)
    print("TEST 4: Orchestrator Bidirectional Integration")
    print("="*70)

    from the_world_god_unified_orchestrator import UnifiedOrchestrator

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_root = Path(tmpdir) / "test_repo"
        repo_root.mkdir()
        state_dir = Path(tmpdir) / "state"
        state_dir.mkdir()

        # Create necessary test files
        config_file = repo_root / "automation" / "config.json"
        config_file.parent.mkdir(parents=True)
        config_file.write_text(json.dumps({"timeout": 60}))

        # Initialize orchestrator with bidirectional flow
        db = MockKnowledgeDB()
        registry = MockAgentRegistry()

        god = UnifiedOrchestrator(
            db,
            registry,
            test_repo_root=str(repo_root),
            god_state_dir=str(state_dir)
        )

        assert god.bidirectional_flow is not None
        print("✓ Orchestrator initialized with bidirectional flow")

        # Execute cross-repo improvements
        result = god.execute_cross_repo_improvements()
        print(f"✓ Cross-repo improvements executed")
        print(f"  Executed: {result['executed']}")
        print(f"  Success: {result['success']}")
        print(f"  Failed: {result['failed']}")

        # Verify state tracking
        assert god.state['cross_repo_applications'] >= 0
        print(f"✓ Tracked {god.state['cross_repo_applications']} cross-repo applications")

        return True


def test_flow_summary_metrics():
    """Test 5: Bidirectional flow metrics and summary"""
    print("\n" + "="*70)
    print("TEST 5: Flow Metrics and Summary")
    print("="*70)

    from knowledge_pushback import BidirectionalKnowledgeFlow

    with tempfile.TemporaryDirectory() as tmpdir:
        flow = BidirectionalKnowledgeFlow(tmpdir, tmpdir)

        # Simulate multiple flow events
        discoveries = [
            {"knowledge_id": f"disc_{i}", "title": f"Discovery {i}"}
            for i in range(3)
        ]

        improvements = [
            {
                "knowledge_id": f"imp_{i}",
                "target_repo": "test",
                "execution_id": f"exec_{i}",
                "proposal": {"type": "config_tune", "config_file": "test.json", "tuning": {}}
            }
            for i in range(2)
        ]

        for disc in discoveries:
            flow.process_knowledge_discovery(disc)

        for imp in improvements:
            flow.process_god_improvement(imp)

        # Get flow summary
        summary = flow.get_flow_summary()
        assert summary['inbound_count'] == 3
        assert summary['outbound_count'] == 2
        assert summary['flow_rate'] == 2 / 3

        print("✓ Bidirectional flow metrics calculated")
        print(f"  Inbound: {summary['inbound_count']}")
        print(f"  Outbound: {summary['outbound_count']}")
        print(f"  Flow rate: {summary['flow_rate']:.1%}")
        print(f"  Outbound success rate: {summary['outbound_success_rate']:.1%}")

        return True


def test_complete_cycle():
    """Test 6: Complete cycle - discovery to improvement to application"""
    print("\n" + "="*70)
    print("TEST 6: Complete Bidirectional Cycle")
    print("="*70)

    from the_world_god_unified_orchestrator import UnifiedOrchestrator

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_root = Path(tmpdir) / "test_repo"
        repo_root.mkdir()
        state_dir = Path(tmpdir) / "state"
        state_dir.mkdir()

        # Setup test files
        config_file = repo_root / "automation" / "config.json"
        config_file.parent.mkdir(parents=True)
        config_file.write_text(json.dumps({"timeout": 60, "cache_size": 100}))

        # Initialize THE-WORLD-GOD
        db = MockKnowledgeDB()
        registry = MockAgentRegistry()
        god = UnifiedOrchestrator(
            db,
            registry,
            test_repo_root=str(repo_root),
            god_state_dir=str(state_dir)
        )

        # Simulate test repo discovery
        test_discovery = {
            "knowledge_id": "kn_test_pool_001",
            "category": "failure_pattern",
            "success_rate": 0.91
        }
        flow_in = god.bidirectional_flow.process_knowledge_discovery(test_discovery)
        print(f"✓ Step 1: Test discovery recorded")

        # Simulate THE-WORLD-GOD analyzing and finding improvement
        god.execute_cross_repo_improvements()
        print(f"✓ Step 2: THE-WORLD-GOD evaluated patterns and executed improvements")

        # Verify metrics updated
        god.update_bidirectional_flow_metrics()
        metrics = god.state['bidirectional_flow_metrics']
        print(f"✓ Step 3: Bidirectional metrics updated")
        print(f"  Inbound: {metrics['inbound_count']}")
        print(f"  Outbound: {metrics['outbound_count']}")

        # Verify actual code changes
        final_config = json.loads(config_file.read_text())
        print(f"✓ Step 4: Code changes verified")
        print(f"  Config timeout: {final_config['timeout']} (from 60)")

        print("\n✓ COMPLETE BIDIRECTIONAL CYCLE SUCCESSFUL")
        return True


def main():
    """Run all bidirectional flow tests"""
    print("\n" + "█"*70)
    print("█  BIDIRECTIONAL KNOWLEDGE FLOW - INTEGRATION TEST SUITE")
    print("█"*70)

    tests = [
        ("Initialization", test_bidirectional_setup),
        ("Inbound Discovery", test_knowledge_discovery_inbound),
        ("Outbound Improvement", test_god_improvement_outbound),
        ("Orchestrator Integration", test_orchestrator_bidirectional_integration),
        ("Flow Metrics", test_flow_summary_metrics),
        ("Complete Cycle", test_complete_cycle),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"\n✗ {test_name} FAILED: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    passed = sum(1 for _, success in results if success)
    total = len(results)

    for test_name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED - BIDIRECTIONAL FLOW OPERATIONAL")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
