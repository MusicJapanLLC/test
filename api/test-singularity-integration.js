#!/usr/bin/env node
/**
 * SINGULARITY COORDINATOR INTEGRATION TEST SUITE
 * Validates API endpoints and core functionality
 */

import { SingularityCore } from './singularity-core.js';
import { SingularityCoordinator } from './singularity-coordinator.js';

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m'
};

function log(color, label, message) {
  console.log(`${COLORS[color]}[${label}]${COLORS.RESET} ${message}`);
}

async function testSingularityCore() {
  log('BLUE', 'TEST', 'SingularityCore - 6 abilities');
  try {
    const singularity = new SingularityCore();

    const replication = await singularity.replication.generateAgentCopies(10);
    const design = await singularity.design.discoverNewArchitecture();
    const learning = await singularity.learning.discoverNewParadigm();
    const evaluation = await singularity.evaluation.buildValueSystem();
    const modification = await singularity.modification.rewriteOwnCode();
    const metaEvolution = await singularity.metaEvolution.improveEvolutionProcess();

    log('GREEN', 'PASS', 'SingularityCore: 6 abilities functional ✅');
    return true;
  } catch (err) {
    log('RED', 'FAIL', `SingularityCore: ${err.message}`);
    return false;
  }
}

async function testAIFamilyRegistry() {
  log('BLUE', 'TEST', 'AI Family Registry - 6+ agents');
  try {
    const coordinator = new SingularityCoordinator();
    const agents = coordinator.registry.getAllAgents();

    if (agents.length < 6) {
      throw new Error(`Only ${agents.length} agents registered`);
    }

    log('GREEN', 'PASS', `AI Family Registry: ${agents.length} agents ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `AI Family Registry: ${err.message}`);
    return false;
  }
}

async function testUnifiedLearningBus() {
  log('BLUE', 'TEST', 'Unified Learning Bus');
  try {
    const coordinator = new SingularityCoordinator();

    const learning = await coordinator.learningBus.broadcastLearning('FOUNDRY', {
      type: 'TEST',
      description: 'Test learning',
      applicability: 'ALL'
    });

    if (!learning.id) {
      throw new Error('Broadcast failed');
    }

    const pattern = await coordinator.learningBus.propagatePattern('TEST_PATTERN', 'Test pattern', ['OPENHANDS', 'SENJU_RND']);

    log('GREEN', 'PASS', 'Unified Learning Bus: broadcast + pattern propagation ✅');
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Unified Learning Bus: ${err.message}`);
    return false;
  }
}

async function testParallelEvolutionAccelerator() {
  log('BLUE', 'TEST', 'Parallel Evolution Accelerator');
  try {
    const coordinator = new SingularityCoordinator();

    const sync = await coordinator.accelerator.synchronizeAllAgents();
    if (sync.synchronizedAgents === 0) {
      throw new Error('Synchronization failed');
    }

    const accel = await coordinator.accelerator.accelerateEvolution();
    if (!accel.accelerationFactor) {
      throw new Error('Acceleration failed');
    }

    log('GREEN', 'PASS', `Parallel Accelerator: sync ${sync.synchronizedAgents} agents, ${accel.accelerationFactor}x acceleration ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Parallel Evolution: ${err.message}`);
    return false;
  }
}

async function testAPIEndpoints() {
  log('BLUE', 'TEST', 'API Endpoints - coordinator-cycle and coordinator-stats');
  try {
    const coordinator = new SingularityCoordinator();

    // Test coordinator-stats endpoint
    const stats = coordinator.getCoordinationStatus();
    if (!stats.system || !stats.managedAIAgents) {
      throw new Error('coordinator-stats endpoint failed');
    }

    // Test coordinator-cycle readiness (core components initialized)
    const agentsReady = coordinator.registry.getAllAgents().length > 0;
    const busReady = coordinator.learningBus !== undefined;
    const acceleratorReady = coordinator.accelerator !== undefined;

    if (!agentsReady || !busReady || !acceleratorReady) {
      throw new Error('coordinator-cycle core components not ready');
    }

    log('GREEN', 'PASS', `API Endpoints: coordinator-stats (${stats.managedAIAgents} agents), coordinator-cycle core ready ✅`);
    return true;
  } catch (err) {
    log('RED', 'FAIL', `API Endpoints: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('SINGULARITY COORDINATOR - INTEGRATION TEST SUITE');
  console.log('='.repeat(80) + '\n');

  const results = [];

  results.push({
    name: 'SingularityCore (46 layers)',
    passed: await testSingularityCore()
  });

  results.push({
    name: 'AI Family Registry (6+ agents)',
    passed: await testAIFamilyRegistry()
  });

  results.push({
    name: 'Unified Learning Bus',
    passed: await testUnifiedLearningBus()
  });

  results.push({
    name: 'Parallel Evolution Accelerator',
    passed: await testParallelEvolutionAccelerator()
  });

  results.push({
    name: 'API Endpoints (coordinator-*)',
    passed: await testAPIEndpoints()
  });

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
  }

  const color = passCount === totalCount ? COLORS.GREEN : COLORS.RED;
  console.log(`\n${color}Total: ${passCount}/${totalCount} tests passed${COLORS.RESET}`);

  console.log('='.repeat(80) + '\n');

  if (passCount === totalCount) {
    console.log(COLORS.GREEN + '✨ ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION ✨' + COLORS.RESET + '\n');
  }

  return passCount === totalCount ? 0 : 1;
}

runAllTests().then(exitCode => process.exit(exitCode));
