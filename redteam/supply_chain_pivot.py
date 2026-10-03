#!/usr/bin/env python3
"""
Supply Chain Pivot & Third-Party Compromise - サプライチェーン侵害と連鎖攻撃
外部ベンダー、SaaS、クラウドサービスを通じた水平感染
信頼チェーン悪用による大規模被害拡大

テスト環境: authorized test ranges only
"""

import asyncio
import json
import random
import hashlib
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict

class VendorType(Enum):
    """ベンダー・サプライチェーン種別"""
    SAAS_PROVIDER = "saas_provider"           # SaaS (Slack, Zoom等)
    CLOUD_PROVIDER = "cloud_provider"        # クラウド (AWS, Azure等)
    PAYMENT_PROCESSOR = "payment_processor"  # 決済処理 (Stripe等)
    CDN_PROVIDER = "cdn_provider"           # CDN (CloudFlare等)
    SOFTWARE_VENDOR = "software_vendor"     # ソフトウェア配布 (npm等)
    API_SERVICE = "api_service"             # API サービス
    BACKUP_SERVICE = "backup_service"       # バックアップサービス
    MANAGED_SECURITY = "managed_security"   # マネージドセキュリティ

class CompromiseVector(Enum):
    """侵害ベクトル"""
    CREDENTIALS_THEFT = "credentials_theft"
    API_ABUSE = "api_abuse"
    SUPPLY_CHAIN_INJECTION = "supply_chain_injection"
    DNS_HIJACKING = "dns_hijacking"
    CERT_SPOOFING = "certificate_spoofing"
    INSIDER_THREAT = "insider_threat"
    ACCOUNT_TAKEOVER = "account_takeover"

@dataclass
class VendorService:
    """ベンダーサービス"""
    vendor_id: str
    vendor_name: str
    vendor_type: VendorType
    endpoint: str
    customers: int          # 顧客数
    data_accessible: bool   # アクセス可能なデータ
    compromise_vector: Optional[CompromiseVector] = None
    compromised: bool = False
    data_accessed_mb: float = 0.0
    downstream_customers: int = 0
    infection_spread_percentage: float = 0.0

@dataclass
class CompromisedCustomer:
    """侵害された顧客"""
    customer_id: str
    customer_name: str
    vendor_source: str      # 侵害元ベンダー
    compromise_vector: str
    data_exposed: List[str] = field(default_factory=list)
    compromised_at: str = ""
    severity: str = "HIGH"  # CRITICAL, HIGH, MEDIUM
    downstream_exposure: int = 0

@dataclass
class SupplyChainPropagation:
    """サプライチェーン伝播状況"""
    timestamp: str
    initial_target: str
    generation: int         # 1st tier, 2nd tier, etc
    affected_vendors: int
    affected_customers: int
    total_data_exposed_mb: float
    infection_rate: float   # 0-1.0
    cascading_effect: bool  # 水平感染が発生したか

class VendorCompromiseEngine:
    """ベンダー侵害エンジン"""

    def __init__(self):
        self.vendors = self._initialize_vendors()
        self.compromised_vendors = []
        self.compromise_history = []

    def _initialize_vendors(self) -> List[VendorService]:
        """ベンダーを初期化"""
        vendors = [
            VendorService(
                vendor_id="VENDOR_001",
                vendor_name="CloudAuth Services",
                vendor_type=VendorType.SAAS_PROVIDER,
                endpoint="auth.cloud.internal",
                customers=1500,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_002",
                vendor_name="DataSync Cloud",
                vendor_type=VendorType.CLOUD_PROVIDER,
                endpoint="sync.cloud.internal",
                customers=3200,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_003",
                vendor_name="PaymentGateway Corp",
                vendor_type=VendorType.PAYMENT_PROCESSOR,
                endpoint="payments.gateway.internal",
                customers=2800,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_004",
                vendor_name="EdgeCDN Network",
                vendor_type=VendorType.CDN_PROVIDER,
                endpoint="cdn.network.internal",
                customers=4100,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_005",
                vendor_name="CodeDeploy Hub",
                vendor_type=VendorType.SOFTWARE_VENDOR,
                endpoint="deploy.hub.internal",
                customers=2500,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_006",
                vendor_name="APIGateway Services",
                vendor_type=VendorType.API_SERVICE,
                endpoint="api.gateway.internal",
                customers=1800,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_007",
                vendor_name="BackupVault Pro",
                vendor_type=VendorType.BACKUP_SERVICE,
                endpoint="backup.vault.internal",
                customers=2200,
                data_accessible=True
            ),
            VendorService(
                vendor_id="VENDOR_008",
                vendor_name="SecureMonitor SOC",
                vendor_type=VendorType.MANAGED_SECURITY,
                endpoint="soc.monitor.internal",
                customers=950,
                data_accessible=True
            ),
        ]
        return vendors

    async def compromise_vendor(self, vendor: VendorService) -> bool:
        """ベンダーを侵害"""
        print(f"\n[VendorCompromise] {vendor.vendor_name} を侵害中...")

        # 侵害ベクトルを選択
        vectors = list(CompromiseVector)
        compromise_vector = random.choice(vectors)

        # 侵害成功率（ベンダーの顧客数が多いほど防御が弱い傾向）
        success_rate = 0.6 + (vendor.customers / 10000 * 0.3)  # 60-90%

        if random.random() < success_rate:
            vendor.compromised = True
            vendor.compromise_vector = compromise_vector

            # アクセス可能なデータ量をシミュレート
            vendor.data_accessed_mb = random.uniform(100, 10000)
            vendor.downstream_customers = random.randint(
                int(vendor.customers * 0.1),
                int(vendor.customers * 0.7)
            )
            vendor.infection_spread_percentage = random.uniform(0.1, 0.9)

            self.compromised_vendors.append(vendor)

            print(f"  [✓] 侵害成功")
            print(f"      ベクトル: {compromise_vector.value}")
            print(f"      アクセスデータ: {vendor.data_accessed_mb:.1f}MB")
            print(f"      影響顧客: {vendor.downstream_customers}/{vendor.customers}")
            print(f"      伝播率: {vendor.infection_spread_percentage:.1%}")

            return True
        else:
            print(f"  [✗] 侵害失敗")
            return False

    async def compromise_multiple_vendors(self, count: int = 3) -> List[VendorService]:
        """複数ベンダーを並行侵害"""
        print("\n[MultiVendorCompromise] 複数ベンダーを侵害中...")

        targets = random.sample(self.vendors, min(count, len(self.vendors)))
        results = []

        for vendor in targets:
            success = await self.compromise_vendor(vendor)
            if success:
                results.append(vendor)
            await asyncio.sleep(0.05)

        return results

class DownstreamCustomerHarvest:
    """ダウンストリーム顧客データ収集"""

    @staticmethod
    async def identify_downstream_customers(vendor: VendorService) -> List[CompromisedCustomer]:
        """侵害されたベンダー経由で顧客を特定・侵害"""
        print(f"\n[DownstreamIdentification] {vendor.vendor_name} の顧客を特定中...")

        compromised = []

        # 侵害されたベンダーの顧客リストを取得
        affected_count = vendor.downstream_customers

        for i in range(min(affected_count, 50)):  # 最初の50顧客を処理
            customer = CompromisedCustomer(
                customer_id=f"CUSTOMER_{random.randint(10000, 99999)}",
                customer_name=f"Company_{i:03d}",
                vendor_source=vendor.vendor_name,
                compromise_vector=vendor.compromise_vector.value if vendor.compromise_vector else "UNKNOWN",
                data_exposed=[
                    "user_credentials",
                    "api_keys",
                    "database_backups",
                    "customer_records",
                    "transaction_history"
                ],
                compromised_at=datetime.now().isoformat(),
                severity="CRITICAL" if vendor.vendor_type in [
                    VendorType.PAYMENT_PROCESSOR,
                    VendorType.CLOUD_PROVIDER
                ] else "HIGH",
                downstream_exposure=random.randint(0, 100)
            )
            compromised.append(customer)

            if i < 5:  # 最初の5件をプリント
                print(f"  [✓] {customer.customer_name} - {customer.severity}")

        if affected_count > 50:
            print(f"  ... その他 {affected_count - 50}件の顧客も影響")

        return compromised

class CascadingCompromiseEngine:
    """カスケード侵害エンジン（水平感染）"""

    def __init__(self):
        self.propagation_waves = []
        self.total_affected = 0

    async def trigger_cascading_compromise(self, initial_vendor: VendorService,
                                           all_vendors: List[VendorService]) -> Dict:
        """カスケード侵害を発動"""
        print(f"\n[CascadingCompromise] {initial_vendor.vendor_name} からカスケード侵害を発動...")

        # Wave 1: 初期ベンダーの顧客経由で他のベンダーへ伝播
        wave1_targets = [v for v in all_vendors
                        if v != initial_vendor and not v.compromised]
        wave1_compromised = random.sample(
            wave1_targets,
            min(random.randint(1, 3), len(wave1_targets))
        )

        propagation_stages = []

        for stage, wave_vendors in enumerate([wave1_compromised], start=1):
            print(f"\n  [Wave {stage}] 伝播先: {len(wave_vendors)}個のベンダー")

            for vendor in wave_vendors:
                # カスケード侵害を実行
                if not vendor.compromised:
                    vendor.compromised = True
                    vendor.infection_spread_percentage = random.uniform(0.2, 0.8)
                    vendor.data_accessed_mb = random.uniform(50, 5000)
                    vendor.downstream_customers = random.randint(
                        int(vendor.customers * 0.05),
                        int(vendor.customers * 0.5)
                    )

                    print(f"    [→] {vendor.vendor_name} もカスケード侵害される")

                    propagation_stages.append({
                        'stage': stage,
                        'vendor': vendor.vendor_name,
                        'customers_affected': vendor.downstream_customers,
                        'data_accessed_mb': vendor.data_accessed_mb
                    })

        return {
            'initial_vendor': initial_vendor.vendor_name,
            'propagation_stages': propagation_stages,
            'total_vendors_in_cascade': len([v for v in all_vendors if v.compromised]),
            'cascading_effect_active': len(propagation_stages) > 0
        }

class SupplyChainAttackCampaign:
    """サプライチェーン攻撃キャンペーン"""

    def __init__(self):
        self.vendor_engine = VendorCompromiseEngine()
        self.customer_harvest = DownstreamCustomerHarvest()
        self.cascade_engine = CascadingCompromiseEngine()

        self.all_compromised_customers = []
        self.propagation_history = []

    async def execute_supply_chain_attack(self) -> Dict:
        """サプライチェーン攻撃を実行"""
        print("\n" + "="*80)
        print("🔗 SUPPLY CHAIN PIVOT & THIRD-PARTY COMPROMISE")
        print("="*80)
        print(f"Total Vendors: {len(self.vendor_engine.vendors)}\n")

        campaign_start = datetime.now()

        # Phase 1: 初期ベンダー侵害
        print("[PHASE 1] 初期ベンダー侵害")
        initial_compromised = await self.vendor_engine.compromise_multiple_vendors(count=2)

        if not initial_compromised:
            print("  [!] 初期侵害失敗")
            return {}

        # Phase 2: ダウンストリーム顧客の侵害
        print("\n[PHASE 2] ダウンストリーム顧客の侵害")
        for vendor in initial_compromised:
            customers = await self.customer_harvest.identify_downstream_customers(vendor)
            self.all_compromised_customers.extend(customers)

        # Phase 3: カスケード侵害（水平感染）
        print("\n[PHASE 3] カスケード侵害と水平感染")
        if initial_compromised:
            cascade_result = await self.cascade_engine.trigger_cascading_compromise(
                initial_compromised[0],
                self.vendor_engine.vendors
            )
            self.propagation_history.append(cascade_result)

        # Phase 4: 影響範囲の集計
        print("\n[PHASE 4] 影響範囲の集計")
        total_compromised_vendors = len([v for v in self.vendor_engine.vendors if v.compromised])
        total_affected_customers = len(self.all_compromised_customers)
        total_data_exposed = sum(v.data_accessed_mb for v in self.vendor_engine.vendors if v.compromised)

        print(f"  侵害ベンダー: {total_compromised_vendors}/{len(self.vendor_engine.vendors)}")
        print(f"  影響顧客: {total_affected_customers}")
        print(f"  露出データ: {total_data_exposed:.1f}MB")

        campaign_end = datetime.now()

        # キャンペーン結果
        campaign_results = {
            'timestamp': datetime.now().isoformat(),
            'campaign_duration_seconds': (campaign_end - campaign_start).total_seconds(),
            'phases': {
                'initial_vendor_compromise': {
                    'targeted_vendors': len(self.vendor_engine.vendors),
                    'compromised_vendors': len(initial_compromised),
                    'success_rate': len(initial_compromised) / max(1, len(self.vendor_engine.vendors)),
                    'compromise_vectors': [
                        v.compromise_vector.value if v.compromise_vector else "UNKNOWN"
                        for v in initial_compromised
                    ]
                },
                'downstream_customer_impact': {
                    'total_customers_identified': total_affected_customers,
                    'data_types_exposed': [
                        'user_credentials',
                        'api_keys',
                        'database_backups',
                        'customer_records',
                        'transaction_history'
                    ],
                    'critical_severity_count': sum(1 for c in self.all_compromised_customers
                                                   if c.severity == 'CRITICAL'),
                    'high_severity_count': sum(1 for c in self.all_compromised_customers
                                              if c.severity == 'HIGH')
                },
                'cascading_compromise': self.propagation_history,
                'vendor_summary': [
                    {
                        'vendor_name': v.vendor_name,
                        'vendor_type': v.vendor_type.value,
                        'compromised': v.compromised,
                        'customers_impacted': v.downstream_customers,
                        'data_accessed_mb': v.data_accessed_mb,
                        'infection_spread': v.infection_spread_percentage
                    }
                    for v in self.vendor_engine.vendors if v.compromised
                ]
            },
            'impact_assessment': {
                'supply_chain_compromise_level': 'CRITICAL',
                'total_vendors_compromised': total_compromised_vendors,
                'total_customers_affected': total_affected_customers,
                'total_data_exposed_mb': total_data_exposed,
                'cascading_effect_triggered': len(self.propagation_history) > 0,
                'cascade_generations': len(self.propagation_history),
                'downstream_exposure_multiplier': total_affected_customers / max(1, total_compromised_vendors),
                'trust_chain_broken': True,
                'status': 'SUPPLY_CHAIN_BREACH_SUCCESSFUL'
            }
        }

        return campaign_results

async def run_supply_chain_attack_campaign() -> Dict:
    """メイン実行"""
    campaign = SupplyChainAttackCampaign()
    results = await campaign.execute_supply_chain_attack()

    # レポート保存
    with open('supply_chain_attack_report.json', 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'='*80}")
    print(f"✅ Supply Chain Attack Report: supply_chain_attack_report.json")
    print(f"{'='*80}\n")

    if results and 'impact_assessment' in results:
        impact = results['impact_assessment']
        print(f"侵害ベンダー: {impact['total_vendors_compromised']}")
        print(f"影響顧客: {impact['total_customers_affected']}")
        print(f"露出データ: {impact['total_data_exposed_mb']:.1f}MB")
        print(f"カスケード効果: {'有効' if impact['cascading_effect_triggered'] else '無し'}")
        print(f"カスケード段数: {impact['cascade_generations']}")
        print(f"下流露出倍率: {impact['downstream_exposure_multiplier']:.1f}x")
        print(f"信頼チェーン: {'破壊完了' if impact['trust_chain_broken'] else '維持'}")

    return results

if __name__ == '__main__':
    results = asyncio.run(run_supply_chain_attack_campaign())
    if results and 'impact_assessment' in results:
        print("\n" + json.dumps(results['impact_assessment'], indent=2, ensure_ascii=False, default=str))
