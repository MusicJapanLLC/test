#!/usr/bin/env python3
"""
Lateral Movement & Network Propagation Engine
ネットワーク内での横展開と自動伝播
"""

import asyncio
import json
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import hashlib
import random

@dataclass
class NetworkNode:
    """ネットワークノード"""
    id: str
    hostname: str
    ip_address: str
    os: str
    services: List[str]
    vulnerabilities: List[str]
    compromise_difficulty: str
    lateral_movement_value: float

@dataclass
class LateralMovementPath:
    """横展開経路"""
    id: str
    source: str
    target: str
    method: str
    success_probability: float
    discovery_difficulty: str
    impact_score: float

class NetworkMapper:
    """ネットワークマッピングエンジン"""

    def __init__(self):
        self.nodes = []
        self.trust_relationships = []

    async def map_network(self) -> List[NetworkNode]:
        """ネットワークをマッピング"""
        print("[Network Mapper] ネットワークトポロジをマッピング中...")

        # シミュレートされたネットワークノード
        node_configs = [
            {
                'hostname': 'web-server-01',
                'ip': '192.168.1.10',
                'os': 'Linux (Ubuntu 20.04)',
                'services': ['Apache 2.4.49', 'MySQL 5.7', 'PHP 7.4'],
                'vulns': ['CVE-2021-41773', 'CVE-2019-6134'],
                'difficulty': 'medium',
                'value': 0.7,
            },
            {
                'hostname': 'app-server-02',
                'ip': '192.168.1.20',
                'os': 'Windows Server 2016',
                'services': ['.NET Framework 4.8', 'IIS 10', 'SQL Server 2016'],
                'vulns': ['CVE-2021-34527', 'CVE-2021-42287'],
                'difficulty': 'hard',
                'value': 0.9,
            },
            {
                'hostname': 'db-server-03',
                'ip': '192.168.1.30',
                'os': 'Linux (CentOS 7)',
                'services': ['PostgreSQL 12', 'Redis 6.0'],
                'vulns': ['CVE-2021-23222'],
                'difficulty': 'very_hard',
                'value': 0.95,
            },
            {
                'hostname': 'admin-workstation',
                'ip': '192.168.1.50',
                'os': 'Windows 10',
                'services': ['PowerShell', 'RDP', 'VPN Client'],
                'vulns': ['CVE-2021-34866'],
                'difficulty': 'hard',
                'value': 0.85,
            },
            {
                'hostname': 'backup-server',
                'ip': '192.168.1.60',
                'os': 'Linux (Debian 10)',
                'services': ['Bacula', 'SSH', 'NFS'],
                'vulns': ['CVE-2021-20038', 'Weak credentials'],
                'difficulty': 'medium',
                'value': 0.8,
            },
        ]

        nodes = []
        for i, config in enumerate(node_configs):
            node = NetworkNode(
                id=f"NODE-{hashlib.md5(config['hostname'].encode()).hexdigest()[:8]}",
                hostname=config['hostname'],
                ip_address=config['ip'],
                os=config['os'],
                services=config['services'],
                vulnerabilities=config['vulns'],
                compromise_difficulty=config['difficulty'],
                lateral_movement_value=config['value'],
            )
            nodes.append(node)

        self.nodes = nodes

        # 信頼関係を構築
        self.trust_relationships = [
            ('web-server-01', 'app-server-02'),
            ('app-server-02', 'db-server-03'),
            ('admin-workstation', 'app-server-02'),
            ('backup-server', 'db-server-03'),
            ('web-server-01', 'backup-server'),
        ]

        print(f"[Network Mapper] {len(nodes)}個のノードと{len(self.trust_relationships)}個の信頼関係を検出")

        return nodes

    async def discover_trust_relationships(self) -> List[Tuple[str, str]]:
        """信頼関係を自動発見"""
        print("[Trust Discovery] ネットワーク信頼関係を発見...")

        # Kerberos チケット委譲
        # NTLM リレー
        # SSH キーベースのアクセス
        # 認証情報キャッシュ

        discovered_trusts = self.trust_relationships.copy()

        print(f"[Trust Discovery] {len(discovered_trusts)}個の信頼関係を発見")

        return discovered_trusts

class LateralMovementPlanner:
    """横展開計画エンジン"""

    def __init__(self, network_nodes: List[NetworkNode], trust_rels: List[Tuple[str, str]]):
        self.nodes = network_nodes
        self.trust_relationships = trust_rels
        self.paths = []

    async def calculate_optimal_paths(self) -> List[LateralMovementPath]:
        """最適な横展開経路を計算"""
        print("[Lateral Planner] 最適な横展開経路を計算...")

        paths = []

        # 各ノードペアについて横展開経路を計算
        for source in self.nodes:
            for target in self.nodes:
                if source.id == target.id:
                    continue

                # 経路が存在するか確認
                if self._is_trusted_path(source.hostname, target.hostname):
                    methods = self._select_exploitation_methods(source, target)

                    for method in methods:
                        path = LateralMovementPath(
                            id=f"LAT-{hashlib.md5(f'{source.hostname}-{target.hostname}'.encode()).hexdigest()[:8]}",
                            source=source.hostname,
                            target=target.hostname,
                            method=method,
                            success_probability=self._calculate_success(source, target, method),
                            discovery_difficulty=target.compromise_difficulty,
                            impact_score=target.lateral_movement_value,
                        )
                        paths.append(path)

        # インパクトでソート
        paths.sort(key=lambda p: p.impact_score, reverse=True)
        self.paths = paths

        print(f"[Lateral Planner] {len(paths)}個の横展開経路を計画")

        return paths

    def _is_trusted_path(self, source: str, target: str) -> bool:
        """信頼パスが存在するか確認"""
        # 簡略化: 同じネットワークに属する場合は信頼パスが存在
        return True

    def _select_exploitation_methods(self, source: NetworkNode, target: NetworkNode) -> List[str]:
        """利用可能な攻撃方法を選択"""
        methods = [
            'Credential Delegation',
            'Token Impersonation',
            'Service Impersonation',
            'Kerberos Exploitation',
            'NTLM Relay',
            'SSH Key Theft',
            'Shared Credential Usage',
            'Scheduled Task Creation',
            'WMI Remote Execution',
        ]

        # ターゲットのOSやサービスに基づいて絞り込む
        if 'Windows' in target.os:
            applicable = [m for m in methods if not 'SSH' in m]
        else:
            applicable = methods

        return applicable

    @staticmethod
    def _calculate_success(source: NetworkNode, target: NetworkNode, method: str) -> float:
        """成功確率を計算"""
        base_prob = 0.6

        # ターゲットの難易度で調整
        difficulty_adjustment = {
            'easy': 0.2,
            'medium': 0.1,
            'hard': -0.1,
            'very_hard': -0.2,
        }

        base_prob += difficulty_adjustment.get(target.compromise_difficulty, 0)

        # 共通サービスでボーナス
        common_services = {'SSH', 'RDP', 'WinRM', 'PowerShell'}
        if any(service in target.services for service in common_services):
            base_prob += 0.15

        return max(0.2, min(0.95, base_prob))

class AutomaticPropagationEngine:
    """自動伝播エンジン - ワーム的な自己拡散"""

    def __init__(self):
        self.propagation_chain = []
        self.infected_nodes = set()

    async def simulate_worm_propagation(
        self,
        initial_node: str,
        network_nodes: List[NetworkNode],
        lateral_paths: List[LateralMovementPath]
    ) -> Dict:
        """ワーム的な自動伝播をシミュレート"""
        print(f"[Propagation] {initial_node} からの自動伝播を開始...")

        self.infected_nodes = {initial_node}
        propagation_log = []

        # BFS で伝播をシミュレート
        wave = 0
        while len(self.infected_nodes) < len(network_nodes) and wave < 10:
            wave += 1
            new_infections = []

            # 感染済みノードから新しいノードへ伝播
            for infected in list(self.infected_nodes):
                # 感染済みノードから到達可能なノードを探す
                for path in lateral_paths:
                    if path.source == infected and path.target not in self.infected_nodes:
                        # 伝播成功確認
                        if random.random() < path.success_probability:
                            new_infections.append(path.target)
                            propagation_log.append({
                                'wave': wave,
                                'from': infected,
                                'to': path.target,
                                'method': path.method,
                                'timestamp': datetime.now().isoformat(),
                            })

            self.infected_nodes.update(new_infections)

            if not new_infections:
                break

        infection_rate = len(self.infected_nodes) / len(network_nodes) * 100
        print(f"[Propagation] Wave {wave}: {len(self.infected_nodes)}/{len(network_nodes)} ノード感染 ({infection_rate:.1f}%)")

        return {
            'initial_node': initial_node,
            'final_infected_count': len(self.infected_nodes),
            'total_nodes': len(network_nodes),
            'infection_rate': infection_rate,
            'waves_required': wave,
            'propagation_chain': propagation_log,
        }

async def run_lateral_movement_suite(target: str) -> Dict:
    """横展開スイート"""
    print("\n" + "="*70)
    print("🔀 LATERAL MOVEMENT ENGINE - ネットワーク横展開・自動伝播")
    print("="*70 + "\n")

    results = {
        'timestamp': datetime.now().isoformat(),
        'target': target,
        'network_map': [],
        'lateral_paths': [],
        'propagation_simulation': {},
        'summary': {}
    }

    # ネットワークマッピング
    mapper = NetworkMapper()
    nodes = await mapper.map_network()
    results['network_map'] = [asdict(n) for n in nodes]

    trusts = await mapper.discover_trust_relationships()

    # 横展開計画
    planner = LateralMovementPlanner(nodes, trusts)
    paths = await planner.calculate_optimal_paths()
    results['lateral_paths'] = [asdict(p) for p in paths[:10]]

    # 自動伝播シミュレーション
    propagator = AutomaticPropagationEngine()
    propagation = await propagator.simulate_worm_propagation(
        'web-server-01',
        nodes,
        paths
    )
    results['propagation_simulation'] = propagation

    # サマリー
    results['summary'] = {
        'network_nodes': len(nodes),
        'trust_relationships': len(trusts),
        'lateral_movement_paths': len(paths),
        'total_infection_percentage': propagation['infection_rate'],
        'waves_to_full_propagation': propagation['waves_required'],
    }

    print(f"\n[Summary] ネットワークノード: {len(nodes)}")
    print(f"[Summary] 横展開経路: {len(paths)}")
    print(f"[Summary] 感染率: {propagation['infection_rate']:.1f}%")

    return results

if __name__ == '__main__':
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else 'https://kabeya-authorized-test-range.onrender.com'

    results = asyncio.run(run_lateral_movement_suite(target))
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
