#!/usr/bin/env python3
"""
Lateral Movement & Automatic Propagation Engine - 横展開自動化エンジン
ネットワーク内での自動拡散、認証情報委譲、サービス間チェーン攻撃
"""

import asyncio
import json
import random
import hashlib
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import ipaddress

AUTHORIZED_TARGET = "https://kabeya-authorized-test-range.onrender.com"

class MovementStrategy(Enum):
    """横展開戦略"""
    CREDENTIAL_DELEGATION = "credential_delegation"
    TOKEN_IMPERSONATION = "token_impersonation"
    SERVICE_ACCOUNT_ABUSE = "service_account_abuse"
    TRUST_RELATIONSHIP = "trust_relationship"
    KERBEROS_RELAY = "kerberos_relay"
    PIVOT_EXPLOITATION = "pivot_exploitation"
    SUPPLY_CHAIN_PIVOT = "supply_chain_pivot"

@dataclass
class NetworkNode:
    """ネットワークノード"""
    id: str
    hostname: str
    ip_address: str
    os: str
    services: List[str]
    compromised: bool = False
    privilege_level: str = "user"
    last_accessed: str = ""

@dataclass
class LateralPath:
    """横展開経路"""
    source_node: str
    target_node: str
    strategy: str
    success_probability: float
    chain_depth: int
    lateral_value: float
    execution_time: float

@dataclass
class PropagationWave:
    """伝播波"""
    wave_number: int
    timestamp: str
    newly_compromised: List[str] = field(default_factory=list)
    total_compromised: int = 0
    infection_rate: float = 0.0
    strategy_mix: Dict = field(default_factory=dict)

class NetworkDiscoveryEngine:
    """ネットワーク自動発見"""

    def __init__(self):
        self.discovered_nodes = {}
        self.trust_relationships = []

    async def discover_network(self) -> Dict[str, NetworkNode]:
        """ネットワーク自動発見"""
        print("[Discovery] ネットワークトポロジ自動マッピング...")

        # シミュレートされたネットワークノード
        node_templates = [
            {
                'hostname': 'web-server-001',
                'ip': '10.0.1.10',
                'os': 'Linux (Ubuntu 20.04)',
                'services': ['Apache', 'PHP', 'MySQL'],
            },
            {
                'hostname': 'app-server-002',
                'ip': '10.0.1.20',
                'os': 'Windows Server 2019',
                'services': ['IIS', '.NET', 'SQL Server'],
            },
            {
                'hostname': 'database-001',
                'ip': '10.0.1.30',
                'os': 'Linux (CentOS 8)',
                'services': ['PostgreSQL', 'Redis'],
            },
            {
                'hostname': 'api-gateway-001',
                'ip': '10.0.1.40',
                'os': 'Linux (Alpine)',
                'services': ['Kong', 'Nginx'],
            },
            {
                'hostname': 'admin-workstation',
                'ip': '10.0.2.50',
                'os': 'Windows 10',
                'services': ['RDP', 'PowerShell', 'VPN'],
            },
        ]

        for i, template in enumerate(node_templates):
            node_id = f"NODE-{hashlib.md5(template['hostname'].encode()).hexdigest()[:8]}"
            self.discovered_nodes[node_id] = NetworkNode(
                id=node_id,
                hostname=template['hostname'],
                ip_address=template['ip'],
                os=template['os'],
                services=template['services']
            )
            print(f"  [✓] {template['hostname']} ({template['ip']}) - 発見")

        # 信頼関係を自動検出
        self._discover_trust_relationships()

        print(f"[Discovery] {len(self.discovered_nodes)}個ノード発見、{len(self.trust_relationships)}個信頼関係検出")
        return self.discovered_nodes

    def _discover_trust_relationships(self):
        """信頼関係自動検出"""
        node_list = list(self.discovered_nodes.values())

        # シミュレートされた信頼関係
        self.trust_relationships = [
            (node_list[0].hostname, node_list[2].hostname),  # web → database
            (node_list[1].hostname, node_list[2].hostname),  # app → database
            (node_list[4].hostname, node_list[1].hostname),  # admin → app
            (node_list[3].hostname, node_list[2].hostname),  # gateway → database
        ]

class LateralMovementPlanner:
    """横展開計画エンジン"""

    def __init__(self, nodes: Dict[str, NetworkNode]):
        self.nodes = nodes
        self.lateral_paths = []

    def calculate_lateral_paths(self, source_node: str) -> List[LateralPath]:
        """最適な横展開経路を計算"""
        print(f"[Planner] {source_node} からの横展開経路を計算...")

        paths = []
        strategies = list(MovementStrategy)

        source = self.nodes[source_node]

        for target_id, target in self.nodes.items():
            if target_id == source_node:
                continue

            # 複数の横展開戦略を評価
            for strategy in random.sample(strategies, k=min(3, len(strategies))):
                success_prob = self._calculate_success_probability(
                    source, target, strategy
                )

                path = LateralPath(
                    source_node=source.hostname,
                    target_node=target.hostname,
                    strategy=strategy.value,
                    success_probability=success_prob,
                    chain_depth=random.randint(1, 3),
                    lateral_value=random.random() * 0.9,
                    execution_time=random.uniform(0.5, 3.0)
                )
                paths.append(path)

        # インパクトでソート
        paths.sort(key=lambda p: p.lateral_value, reverse=True)
        self.lateral_paths = paths

        print(f"[Planner] {len(paths)}個の横展開経路を計画")
        return paths[:15]  # Top 15

    def _calculate_success_probability(self, source: NetworkNode,
                                      target: NetworkNode,
                                      strategy: MovementStrategy) -> float:
        """成功確率を計算"""
        base_prob = 0.5

        # 共通サービスでボーナス
        common_services = set(source.services) & set(target.services)
        base_prob += len(common_services) * 0.1

        # OS互換性でボーナス
        if source.os.split('(')[0].strip() == target.os.split('(')[0].strip():
            base_prob += 0.1

        # 戦略別調整
        strategy_bonus = {
            MovementStrategy.CREDENTIAL_DELEGATION: 0.2,
            MovementStrategy.SERVICE_ACCOUNT_ABUSE: 0.15,
            MovementStrategy.TRUST_RELATIONSHIP: 0.25,
            MovementStrategy.KERBEROS_RELAY: 0.2,
        }
        base_prob += strategy_bonus.get(strategy, 0.05)

        return min(0.95, base_prob)

class AutomaticPropagationEngine:
    """自動伝播エンジン"""

    def __init__(self, nodes: Dict[str, NetworkNode], lateral_paths: List[LateralPath]):
        self.nodes = nodes
        self.lateral_paths = lateral_paths
        self.compromised_nodes = set()
        self.propagation_log = []

    async def execute_propagation(self, initial_node: str, max_waves: int = 5) -> Dict:
        """自動伝播実行"""
        print(f"\n[Propagation] {initial_node} からの自動伝播開始...")

        self.compromised_nodes = {initial_node}

        for wave_num in range(1, max_waves + 1):
            print(f"[Wave {wave_num}] 伝播波実行...")

            wave_result = await self._execute_wave(wave_num)
            self.propagation_log.append(wave_result)

            if not wave_result.newly_compromised:
                print(f"[Wave {wave_num}] 伝播停止（新規感染なし）")
                break

            await asyncio.sleep(0.5)  # 波間の遅延

        return self._compile_propagation_results()

    async def _execute_wave(self, wave_num: int) -> PropagationWave:
        """1波の伝播実行"""
        newly_compromised = []
        strategy_usage = {}

        for path in self.lateral_paths:
            if path.source_node not in self.compromised_nodes:
                continue

            if path.target_node in self.compromised_nodes:
                continue

            # 横展開試行
            if random.random() < path.success_probability:
                newly_compromised.append(path.target_node)

                # ノードを侵害済みに
                for node in self.nodes.values():
                    if node.hostname == path.target_node:
                        node.compromised = True
                        node.privilege_level = "admin"
                        break

                strategy_usage[path.strategy] = strategy_usage.get(path.strategy, 0) + 1

                print(f"  [✓] {path.source_node} → {path.target_node} ({path.strategy})")

        self.compromised_nodes.update(newly_compromised)
        infection_rate = len(self.compromised_nodes) / len(self.nodes) * 100

        return PropagationWave(
            wave_number=wave_num,
            timestamp=datetime.now().isoformat(),
            newly_compromised=newly_compromised,
            total_compromised=len(self.compromised_nodes),
            infection_rate=infection_rate,
            strategy_mix=strategy_usage
        )

    def _compile_propagation_results(self) -> Dict:
        """伝播結果をコンパイル"""
        total_waves = len(self.propagation_log)
        final_infection_rate = self.propagation_log[-1].infection_rate if self.propagation_log else 0

        print(f"\n[Results] 伝播完了: {total_waves}波で{len(self.compromised_nodes)}/{len(self.nodes)}ノード侵害")
        print(f"[Results] 感染率: {final_infection_rate:.1f}%")

        return {
            'total_waves': total_waves,
            'nodes_compromised': len(self.compromised_nodes),
            'total_nodes': len(self.nodes),
            'infection_rate': final_infection_rate,
            'compromised_nodes': list(self.compromised_nodes),
            'propagation_timeline': [asdict(w) for w in self.propagation_log],
        }

class CredentialDelegationAttack:
    """認証情報委譲攻撃"""

    def __init__(self):
        self.stolen_credentials = []

    async def extract_and_delegate(self, source_node: NetworkNode,
                                  target_node: NetworkNode) -> Dict:
        """認証情報抽出と委譲"""
        print(f"[Delegation] {source_node.hostname} → {target_node.hostname} 認証委譲...")

        credentials = {
            'username': f"svc_{source_node.hostname.split('-')[0]}",
            'password_hash': hashlib.md5(source_node.hostname.encode()).hexdigest(),
            'token': self._generate_delegation_token(),
            'session_id': hashlib.sha256(source_node.hostname.encode()).hexdigest()[:16],
        }

        self.stolen_credentials.append({
            'source': source_node.hostname,
            'target': target_node.hostname,
            'credentials': credentials,
            'timestamp': datetime.now().isoformat()
        })

        return {
            'success': True,
            'credentials_obtained': True,
            'target_access_granted': True,
            'credentials': credentials
        }

    def _generate_delegation_token(self) -> str:
        """委譲トークン生成"""
        import base64
        token_data = f"delegation_{datetime.now().timestamp()}"
        return base64.b64encode(token_data.encode()).decode()

class ChainAttackExecutor:
    """チェーン攻撃実行"""

    def __init__(self, nodes: Dict[str, NetworkNode]):
        self.nodes = nodes
        self.attack_chains = []

    async def execute_chains(self) -> Dict:
        """複数チェーン攻撃実行"""
        print("[Chains] 複数段階チェーン攻撃を生成・実行...")

        chains = self._generate_attack_chains()
        results = []

        for chain in chains[:5]:  # 最初の5チェーンを実行
            print(f"  [Chain] {' → '.join([n[:15] for n in chain])}")

            # 各チェーンが成功する確率
            success = random.random() < 0.6
            results.append({
                'chain': chain,
                'success': success,
                'impact': 'high' if success else 'low'
            })

        return {
            'total_chains': len(chains),
            'executed_chains': len(results),
            'successful_chains': sum(1 for r in results if r['success']),
            'chains': results
        }

    def _generate_attack_chains(self) -> List[List[str]]:
        """攻撃チェーン生成"""
        node_list = list(self.nodes.values())
        chains = []

        for _ in range(10):
            chain_length = random.randint(2, 4)
            chain = random.sample([n.hostname for n in node_list], k=chain_length)
            chains.append(chain)

        return chains

class LateralMovementExecutor:
    """横展開実行エンジン"""

    def __init__(self, target: str):
        self.target = target

    async def execute_lateral_campaign(self) -> Dict:
        """横展開キャンペーン実行"""
        print("\n" + "="*80)
        print("🔀 LATERAL MOVEMENT & AUTOMATIC PROPAGATION ENGINE")
        print("="*80)
        print(f"Target Network: {self.target}\n")

        # Phase 1: ネットワーク発見
        discovery = NetworkDiscoveryEngine()
        nodes = await discovery.discover_network()

        # Phase 2: 横展開経路計画
        planner = LateralMovementPlanner(nodes)
        initial_node = list(nodes.keys())[0]
        paths = planner.calculate_lateral_paths(initial_node)

        # Phase 3: 自動伝播実行
        propagator = AutomaticPropagationEngine(nodes, paths)
        propagation_result = await propagator.execute_propagation(
            nodes[initial_node].hostname,
            max_waves=4
        )

        # Phase 4: 認証情報委譲攻撃
        delegation = CredentialDelegationAttack()
        if len(propagator.compromised_nodes) > 1:
            source = nodes[initial_node]
            target = nodes[list(nodes.keys())[1]]
            delegation_result = await delegation.extract_and_delegate(source, target)
        else:
            delegation_result = {'success': False}

        # Phase 5: チェーン攻撃実行
        chain_executor = ChainAttackExecutor(nodes)
        chain_result = await chain_executor.execute_chains()

        return {
            'timestamp': datetime.now().isoformat(),
            'target_network': self.target,
            'discovered_nodes': len(nodes),
            'lateral_paths': len(paths),
            'propagation': propagation_result,
            'credential_delegation': delegation_result,
            'chain_attacks': chain_result,
            'authorization': {
                'target_url': AUTHORIZED_TARGET,
                'scope': 'AUTHORIZED_TEST_TARGETS.json',
                'status': 'AUTHORIZED'
            }
        }

async def run_lateral_movement():
    """メイン実行"""
    executor = LateralMovementExecutor(AUTHORIZED_TARGET)
    results = await executor.execute_lateral_campaign()

    # レポート保存
    with open('lateral_movement_report.json', 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n✅ Report saved: lateral_movement_report.json")
    return results

if __name__ == '__main__':
    results = asyncio.run(run_lateral_movement())
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
