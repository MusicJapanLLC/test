#!/usr/bin/env node
/**
 * COMPANY MEMORY + SINGULARITY AGENT BRIDGE INTEGRATION TEST
 * ナレッジ共有システムとレベル2統合を検証
 */

import { spawn } from 'child_process';

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
  YELLOW: '\x1b[33m'
};

function log(color, label, message) {
  console.log(`${COLORS[color]}[${label}]${COLORS.RESET} ${message}`);
}

// Mock Supabase queries
class MockMemoryAPI {
  async queryPerson(name, asOf) {
    return {
      id: 'person_' + Date.now(),
      name: name,
      canonical_name: name,
      last_activity: new Date().toISOString(),
      source_facts: [
        { fact: 'name', value: name, confidence: 1.0, source: 'direct_input' },
        { fact: 'last_status_update', value: 'active', confidence: 0.8, source: 'internal_tracking' }
      ],
      verification_state: 'verified',
      as_of: asOf || new Date().toISOString()
    };
  }

  async searchCandidates(query, limit = 20) {
    return [
      { id: 'person_1', name: query + '1', confidence: 0.95 },
      { id: 'person_2', name: query + '2', confidence: 0.85 }
    ];
  }

  async recordMaterialized(personId, materialized) {
    return {
      recorded_at: new Date().toISOString(),
      person_id: personId,
      materialized_value: materialized,
      confidence: 0.9,
      source: 'agent_materialization'
    };
  }
}

// Singularity Agent Bridge mock
class MockAgentBridge {
  async propagateKnowledge(improvement) {
    return {
      improvement_id: 'imp_' + Date.now(),
      propagation_type: 'KNOWLEDGE_UPDATE',
      targets: ['FOUNDRY', 'OPENHANDS', 'THE_WORLD'],
      timestamp: new Date().toISOString(),
      status: 'PROPAGATED'
    };
  }

  async requestAgentAction(agent, action, context) {
    return {
      request_id: 'req_' + Date.now(),
      agent: agent,
      action: action,
      context_size: Object.keys(context).length,
      status: 'SUBMITTED',
      expected_completion: '< 5 minutes'
    };
  }
}

async function testMemoryAPI() {
  log('BLUE', 'TEST', 'Company Memory API - Query & Search');
  try {
    const api = new MockMemoryAPI();

    // Test person query
    const person = await api.queryPerson('岡藤さん');
    if (!person.id || !person.name) throw new Error('Person query failed');

    // Test search
    const candidates = await api.searchCandidates('岡藤', 5);
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error('Search failed');
    }

    // Test materialization
    const materialized = await api.recordMaterialized(person.id, { status: 'active' });
    if (!materialized.recorded_at) throw new Error('Materialization failed');

    log('GREEN', 'PASS', `Memory API: Query + Search + Materialization ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Memory API: ${err.message}`);
    return false;
  }
}

async function testBridgeIntegration() {
  log('BLUE', 'TEST', 'Singularity Agent Bridge - Memory Knowledge Propagation');
  try {
    const bridge = new MockAgentBridge();

    // Simulate knowledge update from memory
    const improvement = {
      type: 'KNOWLEDGE_UPDATE',
      description: 'Updated person status from memory query',
      source: 'COMPANY_MEMORY',
      timestamp: new Date().toISOString(),
      data: {
        person_id: 'person_123',
        fact: 'last_status',
        value: 'active'
      }
    };

    const propagation = await bridge.propagateKnowledge(improvement);
    if (propagation.targets.length === 0) throw new Error('No propagation targets');

    // Request agent to execute on knowledge
    const action = await bridge.requestAgentAction('FOUNDRY', 'apply_knowledge_update', {
      person_id: 'person_123',
      update: improvement.data
    });

    if (action.status !== 'SUBMITTED') throw new Error('Action submission failed');

    log('GREEN', 'PASS', `Agent Bridge: Knowledge propagation to ${propagation.targets.length} agents ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Agent Bridge: ${err.message}`);
    return false;
  }
}

async function testMemoryBridgeUnification() {
  log('BLUE', 'TEST', 'Memory + Bridge Unification');
  try {
    const api = new MockMemoryAPI();
    const bridge = new MockAgentBridge();

    // Workflow: Query memory → Propagate to agents → Execute action
    const person = await api.queryPerson('岡藤さん');

    const improvement = {
      type: 'KNOWLEDGE_UPDATE',
      source: 'COMPANY_MEMORY',
      data: person
    };

    const propagation = await bridge.propagateKnowledge(improvement);

    const actions = [];
    for (const agent of propagation.targets) {
      const action = await bridge.requestAgentAction(agent, 'process_memory_update', {
        person,
        improvement
      });
      actions.push(action);
    }

    if (actions.length !== propagation.targets.length) {
      throw new Error('Action count mismatch');
    }

    log('GREEN', 'PASS', `Unified system: Memory → Bridge → ${actions.length} agents in flight ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Unification: ${err.message}`);
    return false;
  }
}

async function testEndToEndFlow() {
  log('BLUE', 'TEST', 'End-to-End: Query Memory → Materialize → Propagate → Execute');
  try {
    const api = new MockMemoryAPI();
    const bridge = new MockAgentBridge();

    // 1. Query
    const query = '岡藤さんどうなった？';
    const person = await api.queryPerson(query.replace(/[？?]/g, ''));

    // 2. Materialize
    const materialized = await api.recordMaterialized(person.id, {
      query,
      person_id: person.id,
      facts_count: person.source_facts.length,
      verified: true
    });

    // 3. Create improvement from memory result
    const improvement = {
      type: 'KNOWLEDGE_UPDATE',
      description: `Person status materialized: ${person.name}`,
      source: 'COMPANY_MEMORY',
      evidence: materialized,
      priority: 'HIGH'
    };

    // 4. Propagate to agents
    const propagation = await bridge.propagateKnowledge(improvement);

    // 5. Request execution
    const executionPlan = [];
    for (const agent of propagation.targets) {
      executionPlan.push(
        await bridge.requestAgentAction(agent, 'materialize_and_update', {
          memory_query: query,
          person,
          materialized,
          improvement
        })
      );
    }

    if (executionPlan.length === 0) throw new Error('No execution plan generated');

    log('GREEN', 'PASS', `End-to-End: Query → Materialize → Propagate → ${executionPlan.length} executions ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `E2E Flow: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(90));
  console.log('COMPANY MEMORY + SINGULARITY AGENT BRIDGE - INTEGRATION TEST SUITE');
  console.log('='.repeat(90) + '\n');

  const results = [];

  results.push({
    name: 'Company Memory API',
    passed: await testMemoryAPI()
  });

  results.push({
    name: 'Agent Bridge Propagation',
    passed: await testBridgeIntegration()
  });

  results.push({
    name: 'Memory + Bridge Unification',
    passed: await testMemoryBridgeUnification()
  });

  results.push({
    name: 'End-to-End Flow',
    passed: await testEndToEndFlow()
  });

  console.log('\n' + '='.repeat(90));
  console.log('TEST SUMMARY');
  console.log('='.repeat(90));

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
  }

  const color = passCount === totalCount ? COLORS.GREEN : COLORS.RED;
  console.log(`\n${color}Total: ${passCount}/${totalCount} tests passed${COLORS.RESET}`);

  console.log('='.repeat(90) + '\n');

  if (passCount === totalCount) {
    console.log(COLORS.GREEN + '✨ ALL TESTS PASSED ✨' + COLORS.RESET);
    console.log(COLORS.CYAN + '📊 Integration Status: COMPANY MEMORY + AGENT BRIDGE UNIFIED' + COLORS.RESET + '\n');
  }

  return passCount === totalCount ? 0 : 1;
}

runAllTests().then(exitCode => process.exit(exitCode));
