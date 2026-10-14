// THE WORLD GOD - Supreme Runner
// Executes the full 30-layer GOD system cycle, seeded with real Senju ELO data

import { supremeGod } from './infinite-evolution-supreme-god.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── Read real Senju state ─────────────────────────────────────────────────────

function readSenjuChampion() {
  const path = resolve(REPO_ROOT, 'senju/state/champion.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readSenjuEvolution() {
  const path = resolve(REPO_ROOT, 'senju/state/last-evolution-summary.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function deriveSenjuIntel(champion, evolution) {
  if (!champion) {
    return {
      top_target: 'unknown',
      strategy: 'coverage_expansion',
      champion_score: null,
      top_elo: [],
      improvement_rate: null,
    };
  }

  const focus = champion.red_champion?.genome?.focus ?? {};
  const sorted = Object.entries(focus).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5).map(([k, v]) => ({ vuln_class: k, score: v }));
  const topTarget = sorted[0]?.[0] ?? 'unknown';

  // Strategy from champion genome focus distribution
  const injectionVulns = ['sqli', 'nosqli', 'xss', 'ssti', 'xxe'];
  const accessVulns = ['priv_esc', 'idor', 'auth_bypass', 'jwt_weak'];
  const rceVulns = ['rce', 'ssrf', 'path_trav', 'deserial'];

  const injectScore = injectionVulns.reduce((s, v) => s + (focus[v] ?? 0), 0);
  const accessScore = accessVulns.reduce((s, v) => s + (focus[v] ?? 0), 0);
  const rceScore = rceVulns.reduce((s, v) => s + (focus[v] ?? 0), 0);
  const maxScore = Math.max(injectScore, accessScore, rceScore);

  let strategy;
  if (maxScore === injectScore) strategy = 'injection_focus';
  else if (maxScore === accessScore) strategy = 'access_control_focus';
  else strategy = 'remote_execution_focus';

  // Improvement rate from evolution summary
  const improvRate = evolution?.selected?.safe
    ? (evolution.selected.score ?? 0) / 500
    : null;

  return {
    top_target: topTarget,
    strategy,
    champion_score: champion.score ?? null,
    top_elo: top5,
    improvement_rate: improvRate,
    score: champion.score ?? 0,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(70));
  console.log('  THE WORLD GOD - SUPREME EVOLUTION RUNNER');
  console.log('  30 Layers: Base(10) + Ultimate(10) + Supreme(10)');
  console.log('═'.repeat(70));

  // Seed with real Senju data
  const champion = readSenjuChampion();
  const evolution = readSenjuEvolution();
  const senjuIntel = deriveSenjuIntel(champion, evolution);

  console.log('\n📊 Senju Intelligence Feed:');
  console.log(`  top_target : ${senjuIntel.top_target}`);
  console.log(`  strategy   : ${senjuIntel.strategy}`);
  console.log(`  champion_score: ${senjuIntel.champion_score ?? 'N/A'}`);
  if (senjuIntel.top_elo.length) {
    console.log(`  top ELO: ${senjuIntel.top_elo.slice(0, 3).map(e => `${e.vuln_class}(${e.score})`).join(', ')}`);
  }

  const startTime = Date.now();

  // Initialize the full 30-layer system
  await supremeGod.initializeSupremeGod();

  // Run one supreme evolution cycle
  const results = await supremeGod.runSupremeEvolution();

  // Run the base daily cycle (TheWorldGod layer)
  const cycleResult = await supremeGod.runDailyCycle();

  const elapsed = Date.now() - startTime;

  // Get status across all 3 layers
  const baseStatus = supremeGod.getSystemStats();
  const supremeStatus = supremeGod.getSupremeStatus();

  // Real reward trend: based on Senju champion score and improvement rate
  // The simulation reward signal is enriched with actual Senju ELO data
  let realRewardTrend = baseStatus.rewardTrend;
  let realAvgReward = baseStatus.rewardMetrics.averageReward;

  if (senjuIntel.champion_score !== null) {
    // Normalize champion score (typical range 200-400) to 0-1
    const normalizedScore = Math.min(1.0, senjuIntel.champion_score / 400);
    // Blend simulation reward with real Senju signal (60% real, 40% simulation)
    const simulationNormalized = Math.min(1.0, Math.max(0, realAvgReward / 10));
    realAvgReward = parseFloat((0.6 * normalizedScore + 0.4 * simulationNormalized).toFixed(3));

    // Trend based on improvement_rate or champion score adequacy
    if (senjuIntel.improvement_rate !== null) {
      realRewardTrend = senjuIntel.improvement_rate > 0.6 ? 'improving'
        : senjuIntel.improvement_rate < 0.4 ? 'degrading'
        : 'stable';
    } else {
      realRewardTrend = normalizedScore > 0.6 ? 'improving'
        : normalizedScore < 0.4 ? 'degrading'
        : 'stable';
    }
  }

  const report = {
    schema: 'the-world-god-supreme-run/v1',
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsed,
    layers_initialized: 30,
    base_layer: {
      cycles_completed: baseStatus.cyclesCompleted,
      tasks_processed: baseStatus.tasksProcessed,
      tasks_generated: baseStatus.tasksGenerated,
      evolution_cycles: baseStatus.evolutionCyclesCompleted,
      reward_trend: realRewardTrend,
      average_reward: realAvgReward,
    },
    supreme_layer: {
      omniscience: supremeStatus.omniscience,
      omnipotence: supremeStatus.omnipotence,
      performance_gain: supremeStatus.performanceGain,
      status: supremeStatus.status,
    },
    senju_intel: senjuIntel,
    cycle_result: cycleResult,
    supreme_evolution: {
      layers_run: Object.keys(results.layers).length,
    },
    closed_loop: true,
    external_side_effects: false,
  };

  console.log('\n' + '═'.repeat(70));
  console.log('  SUPREME GOD CYCLE COMPLETE');
  console.log(`  reward_trend : ${realRewardTrend}  avg_reward : ${realAvgReward}`);
  console.log(`  top_target   : ${senjuIntel.top_target}  strategy : ${senjuIntel.strategy}`);
  console.log('═'.repeat(70));

  const reportPath = process.env.GOD_REPORT || 'supreme-god-report.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to ${reportPath}`);
}

main().catch(err => {
  console.error('SUPREME GOD FATAL ERROR:', err);
  process.exit(1);
});
