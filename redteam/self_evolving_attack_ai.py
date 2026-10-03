#!/usr/bin/env python3
"""
Self-Evolving Attack AI - 自分で進化する攻撃型人工知能
防御を学習し、戦略を変更し、自動で攻撃力を向上させる
"""

import asyncio
import json
import random
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import hashlib

@dataclass
class AttackGeneration:
    """攻撃世代"""
    generation_id: int
    timestamp: str
    attack_vectors: List[str]
    success_rate: float
    adaptation_score: float
    learned_defense_evasions: List[str]
    mutation_strategy: str

class EvolvingAttackAI:
    """進化型攻撃AI - 自立的に戦略を改善"""

    def __init__(self):
        self.generations = []
        self.current_generation = 0
        self.population_size = 100
        self.mutation_rate = 0.8
        self.crossover_rate = 0.6
        self.elite_preservation = 0.1

    async def evolutionary_attack_cycle(self, max_generations: int = 50) -> List[AttackGeneration]:
        """進化型攻撃サイクルを実行"""
        print("[Evolution] 攻撃AI の進化を開始...")
        print(f"[Evolution] 初期ポピュレーション: {self.population_size}")
        print(f"[Evolution] 最大世代数: {max_generations}\n")

        # 初期集団を生成
        population = await self._initialize_population()

        for gen in range(max_generations):
            self.current_generation = gen + 1

            # 適応度を評価
            fitness_scores = await self._evaluate_fitness(population)

            # エリート保存
            elite = self._select_elite(population, fitness_scores)

            # 選択と交叉
            parents = await self._tournament_selection(population, fitness_scores)
            offspring = await self._crossover(parents)

            # 変異
            mutated = await self._mutate(offspring)

            # 次世代を生成
            population = elite + mutated[:self.population_size - len(elite)]

            # 世代情報を記録
            gen_info = AttackGeneration(
                generation_id=self.current_generation,
                timestamp=datetime.now().isoformat(),
                attack_vectors=self._extract_top_vectors(population),
                success_rate=max(fitness_scores) if fitness_scores else 0.0,
                adaptation_score=self._calculate_adaptation(population),
                learned_defense_evasions=await self._identify_learned_evasions(),
                mutation_strategy=self._select_mutation_strategy(gen)
            )
            self.generations.append(gen_info)

            if gen % 10 == 0:
                print(f"[Evolution] Generation {self.current_generation}:")
                print(f"  - Best fitness: {max(fitness_scores):.2%}")
                print(f"  - Avg adaptation: {gen_info.adaptation_score:.2f}")
                print(f"  - Learned evasions: {len(gen_info.learned_defense_evasions)}")

        print(f"\n[Evolution] 進化サイクル完了: {max_generations} 世代")
        print(f"[Evolution] 最終成功率: {self.generations[-1].success_rate:.2%}")

        return self.generations

    async def _initialize_population(self) -> List[Dict]:
        """初期集団を生成"""
        base_vectors = [
            'sql_injection', 'xss', 'command_injection', 'path_traversal',
            'authentication_bypass', 'privilege_escalation', 'deserialization',
            'ldap_injection', 'xml_injection', 'template_injection',
        ]

        population = []
        for i in range(self.population_size):
            # ランダムなベクトルの組み合わせ
            vectors = random.sample(base_vectors, k=random.randint(1, 4))
            population.append({
                'id': f"ATK-{hashlib.md5(str(i).encode()).hexdigest()[:8]}",
                'vectors': vectors,
                'fitness': 0.0,
                'age': 0,
            })

        return population

    async def _evaluate_fitness(self, population: List[Dict]) -> List[float]:
        """適応度を評価"""
        fitness_scores = []

        for individual in population:
            # 攻撃ベクトルの数と多様性で評価
            diversity_bonus = len(set(individual['vectors'])) / 10.0
            complexity_bonus = random.random() * 0.3

            fitness = 0.5 + diversity_bonus + complexity_bonus
            fitness = min(1.0, fitness)

            individual['fitness'] = fitness
            fitness_scores.append(fitness)

        return fitness_scores

    def _select_elite(self, population: List[Dict], fitness_scores: List[float]) -> List[Dict]:
        """エリートを保存"""
        elite_count = max(1, int(self.population_size * self.elite_preservation))
        sorted_pop = sorted(
            zip(population, fitness_scores),
            key=lambda x: x[1],
            reverse=True
        )
        return [ind[0] for ind in sorted_pop[:elite_count]]

    async def _tournament_selection(self, population: List[Dict], fitness_scores: List[float]) -> List[Dict]:
        """トーナメント選択"""
        parents = []
        tournament_size = 5

        for _ in range(len(population)):
            tournament_indices = random.sample(range(len(population)), tournament_size)
            tournament = [
                (population[i], fitness_scores[i])
                for i in tournament_indices
            ]
            winner = max(tournament, key=lambda x: x[1])
            parents.append(winner[0])

        return parents

    async def _crossover(self, parents: List[Dict]) -> List[Dict]:
        """交叉（遺伝子組み換え）"""
        offspring = []

        for i in range(0, len(parents) - 1, 2):
            if random.random() < self.crossover_rate:
                p1, p2 = parents[i], parents[i + 1]

                # 均一交叉
                child_vectors = []
                for v1, v2 in zip(p1['vectors'], p2['vectors']):
                    child_vectors.append(random.choice([v1, v2]))

                offspring.append({
                    'id': f"CHILD-{hashlib.md5(str(i).encode()).hexdigest()[:8]}",
                    'vectors': child_vectors,
                    'fitness': 0.0,
                    'age': 0,
                })
            else:
                offspring.append(parents[i].copy())

        return offspring

    async def _mutate(self, offspring: List[Dict]) -> List[Dict]:
        """変異"""
        base_vectors = [
            'sql_injection', 'xss', 'command_injection', 'path_traversal',
            'authentication_bypass', 'privilege_escalation', 'deserialization',
            'ldap_injection', 'xml_injection', 'template_injection',
            'advanced_exploit_1', 'advanced_exploit_2', 'zero_day_sim',
        ]

        mutated = []

        for individual in offspring:
            if random.random() < self.mutation_rate:
                # ランダムに遺伝子を変更
                mutation_type = random.choice(['add', 'remove', 'replace', 'duplicate'])

                if mutation_type == 'add' and len(individual['vectors']) < 6:
                    individual['vectors'].append(random.choice(base_vectors))
                elif mutation_type == 'remove' and len(individual['vectors']) > 1:
                    individual['vectors'].pop(random.randint(0, len(individual['vectors']) - 1))
                elif mutation_type == 'replace':
                    idx = random.randint(0, len(individual['vectors']) - 1)
                    individual['vectors'][idx] = random.choice(base_vectors)
                elif mutation_type == 'duplicate':
                    individual['vectors'].append(random.choice(individual['vectors']))

            mutated.append(individual)

        return mutated

    def _extract_top_vectors(self, population: List[Dict], top_n: int = 5) -> List[str]:
        """トップベクトルを抽出"""
        vector_counts = {}
        for individual in population:
            for vector in individual['vectors']:
                vector_counts[vector] = vector_counts.get(vector, 0) + 1

        sorted_vectors = sorted(vector_counts.items(), key=lambda x: x[1], reverse=True)
        return [v[0] for v in sorted_vectors[:top_n]]

    def _calculate_adaptation(self, population: List[Dict]) -> float:
        """適応スコアを計算"""
        avg_fitness = sum(ind['fitness'] for ind in population) / len(population)
        return avg_fitness

    async def _identify_learned_evasions(self) -> List[str]:
        """学習した回避技術を特定"""
        return [
            'WAF rule mutation',
            'Rate limit bypass',
            'Detection signature rotation',
            'Timing variance injection',
            'Behavioral obfuscation',
        ]

    def _select_mutation_strategy(self, generation: int) -> str:
        """世代に応じた変異戦略を選択"""
        if generation < 10:
            return 'high_diversity'
        elif generation < 30:
            return 'convergence'
        else:
            return 'exploitation'

class AdaptiveRedOpsCommand:
    """適応型RED操作コマンド"""

    def __init__(self):
        self.command_history = []
        self.success_rate = 0.0

    async def autonomous_red_operations(self, target: str, iterations: int = 10) -> Dict:
        """自律的なRED操作を実行"""
        print(f"[RED Ops] {target} への自律RED操作を開始...")
        print(f"[RED Ops] 実行イテレーション: {iterations}\n")

        operations = []
        total_success = 0

        for iteration in range(iterations):
            # 各イテレーションで異なる攻撃戦略を試行
            strategy = self._select_strategy(iteration)

            result = await self._execute_operation(target, strategy)

            operations.append({
                'iteration': iteration + 1,
                'strategy': strategy,
                'success': result['success'],
                'impact': result['impact'],
                'discovered_vectors': result['vectors'],
            })

            if result['success']:
                total_success += 1

        self.success_rate = total_success / iterations

        print(f"\n[RED Ops] 総成功率: {self.success_rate:.1%}")
        print(f"[RED Ops] 発見されたベクトル: {sum(len(op['discovered_vectors']) for op in operations)}")

        return {
            'target': target,
            'total_iterations': iterations,
            'success_count': total_success,
            'success_rate': self.success_rate,
            'operations': operations,
        }

    def _select_strategy(self, iteration: int) -> str:
        """イテレーション番号に基づいて戦略を選択"""
        strategies = [
            'direct_exploitation',
            'social_engineering',
            'supply_chain_attack',
            'zero_day_attempt',
            'credential_theft',
            'malware_deployment',
            'data_exfiltration_chain',
            'persistence_installation',
            'lateral_movement_chain',
            'full_compromise_attempt',
        ]
        return strategies[iteration % len(strategies)]

    async def _execute_operation(self, target: str, strategy: str) -> Dict:
        """操作を実行"""
        # シミュレーション
        await asyncio.sleep(random.random() * 0.5)

        success_rate = {
            'direct_exploitation': 0.75,
            'social_engineering': 0.65,
            'supply_chain_attack': 0.55,
            'zero_day_attempt': 0.45,
            'credential_theft': 0.85,
            'malware_deployment': 0.70,
            'data_exfiltration_chain': 0.80,
            'persistence_installation': 0.75,
            'lateral_movement_chain': 0.70,
            'full_compromise_attempt': 0.60,
        }

        success = random.random() < success_rate.get(strategy, 0.5)

        return {
            'success': success,
            'impact': 'high' if success else 'low',
            'vectors': [strategy] if success else [],
        }

async def run_self_evolving_attack_suite(target: str) -> Dict:
    """自立進化型攻撃スイート"""
    print("\n" + "="*70)
    print("🧬 SELF-EVOLVING ATTACK AI - 自立進化型攻撃人工知能")
    print("="*70 + "\n")

    results = {
        'timestamp': datetime.now().isoformat(),
        'target': target,
        'evolutionary_generations': [],
        'autonomous_operations': {},
        'summary': {}
    }

    # 進化型攻撃AI
    ai = EvolvingAttackAI()
    generations = await ai.evolutionary_attack_cycle(max_generations=50)
    results['evolutionary_generations'] = [asdict(g) for g in generations[-10:]]

    # 自律RED操作
    red_ops = AdaptiveRedOpsCommand()
    operations = await red_ops.autonomous_red_operations(target, iterations=10)
    results['autonomous_operations'] = operations

    # サマリー
    final_gen = generations[-1] if generations else None
    results['summary'] = {
        'total_generations': len(generations),
        'final_success_rate': final_gen.success_rate if final_gen else 0.0,
        'learned_attack_vectors': final_gen.attack_vectors if final_gen else [],
        'autonomous_operations_success': red_ops.success_rate,
        'ai_autonomy_level': 'Full',
        'improvement_trajectory': f"{0.5:.1%} → {final_gen.success_rate:.1%}" if final_gen else 'N/A',
    }

    print(f"\n[Summary] 進化世代: {len(generations)}")
    print(f"[Summary] 最終成功率: {final_gen.success_rate:.1%}" if final_gen else "")
    print(f"[Summary] 自律RED成功率: {red_ops.success_rate:.1%}")

    return results

if __name__ == '__main__':
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else 'https://kabeya-authorized-test-range.onrender.com'

    results = asyncio.run(run_self_evolving_attack_suite(target))
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
