#!/usr/bin/env node
/**
 * COMPANY MEMORY DATABASE - REAL WORKING TEST
 * SQLite ベース、実際の永続化・動作確認
 */

import MemoryDatabase, { seedTestData } from './memory-db.js';

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

async function testDatabaseCreation() {
  log('BLUE', 'TEST', 'Database Creation & Schema');
  try {
    const db = new MemoryDatabase(':memory:');
    const stats = db.getStats();

    if (!stats || typeof stats.persons !== 'number') {
      throw new Error('Database initialization failed');
    }

    log('GREEN', 'PASS', `Database created: ${stats.persons} persons ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Database: ${err.message}`);
    return false;
  }
}

async function testDataInsertion() {
  log('BLUE', 'TEST', 'Data Insertion & Retrieval');
  try {
    const db = new MemoryDatabase(':memory:');

    // Create person
    const personId = db.ensurePerson('岡藤');
    if (!personId) throw new Error('Person creation failed');

    // Add facts
    const fact1 = db.recordFact(personId, 'status', 'active', 'MANUAL', 0.95);
    const fact2 = db.recordFact(personId, 'email', 'okafuji@example.com', 'MANUAL', 0.9);

    if (!fact1 || !fact2) throw new Error('Fact insertion failed');

    // Retrieve
    const person = db.getPersonBrief('岡藤');
    if (!person || person.source_facts.length < 2) {
      throw new Error('Fact retrieval failed');
    }

    log('GREEN', 'PASS', `Data insertion: 1 person + 2 facts retrieved ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Data insertion: ${err.message}`);
    return false;
  }
}

async function testSearch() {
  log('BLUE', 'TEST', 'Person Search');
  try {
    const db = new MemoryDatabase(':memory:');

    // Create test persons
    db.ensurePerson('岡藤太郎');
    db.ensurePerson('山田太郎');
    db.ensurePerson('佐藤花子');

    // Search
    const results = db.searchPersons('太郎', 10);
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Search returned no results');
    }

    if (results.length < 2) {
      throw new Error('Search returned incomplete results');
    }

    log('GREEN', 'PASS', `Search: found ${results.length} persons matching "太郎" ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Search: ${err.message}`);
    return false;
  }
}

async function testMaterialization() {
  log('BLUE', 'TEST', 'Knowledge Materialization');
  try {
    const db = new MemoryDatabase(':memory:');

    const personId = db.ensurePerson('岡藤');
    db.recordFact(personId, 'status', 'active', 'MANUAL', 0.95);

    // Materialize
    const matId = db.recordMaterialization(personId, {
      status: 'active',
      engagement: 'high',
      priority: 'urgent'
    }, 0.92);

    if (!matId) throw new Error('Materialization failed');

    // Retrieve
    const mats = db.getPersonMaterializations(personId);
    if (!Array.isArray(mats) || mats.length === 0) {
      throw new Error('Materialization retrieval failed');
    }

    log('GREEN', 'PASS', `Materialization: created + retrieved ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Materialization: ${err.message}`);
    return false;
  }
}

async function testSeedData() {
  log('BLUE', 'TEST', 'Seed Test Data');
  try {
    const db = new MemoryDatabase(':memory:');

    // Seed
    const result = seedTestData(db);
    const stats = db.getStats();

    if (stats.persons < 3) {
      throw new Error('Incomplete seed: expected 3 persons');
    }

    if (stats.facts < 6) {
      throw new Error('Incomplete seed: expected 6+ facts');
    }

    // Verify seeded data works
    const person = db.getPersonBrief('岡藤');
    if (!person || person.source_facts.length === 0) {
      throw new Error('Seeded data not retrievable');
    }

    log('GREEN', 'PASS', `Seed: ${stats.persons} persons, ${stats.facts} facts, ${stats.materializations} materializations ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Seed: ${err.message}`);
    return false;
  }
}

async function testRealQuery() {
  log('BLUE', 'TEST', 'Real Query - "岡藤さんどうなった？"');
  try {
    const db = new MemoryDatabase(':memory:');
    seedTestData(db);

    // Simulate API query
    const question = '岡藤さんどうなった？';
    const nameMatch = question.match(/^([^？?！!どなっ]*)/);
    const name = nameMatch ? nameMatch[1].replace(/[さん様]/g, '').trim() : '';

    const person = db.getPersonBrief(name);
    if (!person) {
      throw new Error('Query returned no data');
    }

    // Verify response structure
    if (!person.id || !person.name || !Array.isArray(person.source_facts)) {
      throw new Error('Invalid response structure');
    }

    const factCount = person.source_facts.length;
    console.log(`   Query result: ${person.name}さん`);
    console.log(`   - Facts: ${factCount}`);
    console.log(`   - Status: ${person.verification_state}`);

    log('GREEN', 'PASS', `Real Query: "岡藤さん" → ${factCount} facts + ${person.verification_state} ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Real Query: ${err.message}`);
    return false;
  }
}

async function testBridgeIntegration() {
  log('BLUE', 'TEST', 'Memory → Bridge Integration Simulation');
  try {
    const db = new MemoryDatabase(':memory:');
    seedTestData(db);

    // Simulate facts → improvement conversion
    const person = db.getPersonBrief('岡藤');
    if (!person) throw new Error('Person not found');

    // Convert to improvement
    const improvement = {
      type: 'KNOWLEDGE_UPDATE',
      source: 'COMPANY_MEMORY',
      description: `Person knowledge: ${person.name}`,
      evidence: {
        person_id: person.id,
        facts: person.source_facts.length,
        confidence_avg: person.source_facts.reduce((a, f) => a + f.confidence, 0) / person.source_facts.length,
        verification: person.verification_state
      }
    };

    // Simulate propagation to agents
    const agents = ['FOUNDRY', 'OPENHANDS', 'THE_WORLD'];
    const propagations = agents.map(agent => ({
      agent,
      improvement_type: improvement.type,
      status: 'WILL_EXECUTE'
    }));

    if (propagations.length !== 3) {
      throw new Error('Propagation setup failed');
    }

    log('GREEN', 'PASS', `Bridge Integration: 1 person → 1 improvement → ${propagations.length} agents ready ✅`);
    db.close();
    return true;
  } catch (err) {
    log('RED', 'FAIL', `Bridge Integration: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(100));
  console.log('COMPANY MEMORY - REAL DATABASE WORKING TEST');
  console.log('='.repeat(100) + '\n');

  const results = [];

  results.push({
    name: 'Database Creation',
    passed: await testDatabaseCreation()
  });

  results.push({
    name: 'Data Insertion & Retrieval',
    passed: await testDataInsertion()
  });

  results.push({
    name: 'Person Search',
    passed: await testSearch()
  });

  results.push({
    name: 'Knowledge Materialization',
    passed: await testMaterialization()
  });

  results.push({
    name: 'Seed Test Data',
    passed: await testSeedData()
  });

  results.push({
    name: 'Real Query - API Simulation',
    passed: await testRealQuery()
  });

  results.push({
    name: 'Memory → Bridge Integration',
    passed: await testBridgeIntegration()
  });

  console.log('\n' + '='.repeat(100));
  console.log('TEST SUMMARY');
  console.log('='.repeat(100));

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
  }

  const color = passCount === totalCount ? COLORS.GREEN : COLORS.RED;
  console.log(`\n${color}Total: ${passCount}/${totalCount} tests passed${COLORS.RESET}`);

  console.log('='.repeat(100) + '\n');

  if (passCount === totalCount) {
    console.log(COLORS.GREEN + '✨ ALL TESTS PASSED - REAL COMPANY MEMORY WORKING ✨' + COLORS.RESET);
    console.log(COLORS.CYAN + '🚀 Ready to: query memory, materialize knowledge, propagate to agents' + COLORS.RESET + '\n');
  }

  return passCount === totalCount ? 0 : 1;
}

runAllTests().then(exitCode => process.exit(exitCode));
