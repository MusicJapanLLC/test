#!/usr/bin/env python3
"""
Autonomous Campaign Orchestrator - 自律的キャンペーン調整
全フェーズを統合して自動実行
学習結果に基づいて戦略を適応させる
"""

import asyncio
import json
import subprocess
import sys
from typing import Dict, List, Optional
from datetime import datetime
from learning_engine import LearningEngine

class CampaignOrchestrator:
    """キャンペーン調整エンジン"""

    def __init__(self):
        self.learning_engine = LearningEngine()
        self.campaign_id = f"CAMPAIGN_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.results = {}
        self.execution_log = []

    async def execute_campaign(self, phases: List[str] = None,
                              parallel: bool = True) -> Dict:
        """自律的キャンペーンを実行"""

        if phases is None:
            phases = [
                'ransomware',
                'exfiltration',
                'c2',
                'supply_chain',
                'persistence'
            ]

        print("\n" + "="*80)
        print("🚀 AUTONOMOUS RED TEAM CAMPAIGN")
        print("="*80)
        print(f"Campaign ID: {self.campaign_id}")
        print(f"Phases: {', '.join(phases)}")
        print(f"Parallel: {parallel}\n")

        campaign_start = datetime.now()

        # 前回のキャンペーン結果から適応パラメータを取得
        insights = self.learning_engine.get_campaign_insights()
        print(f"[Learning] 前回までのキャンペーン統計:")
        print(f"  - 実施済み: {insights['total_campaigns']}回")
        print(f"  - 平均効果: {insights['avg_effectiveness']:.1%}")
        print(f"  - 成功率: {insights['success_rate']:.1%}")
        print(f"  - トレンド: {insights['trend']}\n")

        if parallel:
            # 並行実行
            tasks = [self._execute_phase(phase) for phase in phases]
            phase_results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            # 順序実行
            phase_results = []
            for phase in phases:
                result = await self._execute_phase(phase)
                phase_results.append(result)

        # 結果を集計
        campaign_end = datetime.now()

        for phase, result in zip(phases, phase_results):
            if isinstance(result, Exception):
                self.results[phase] = {'status': 'FAILED', 'error': str(result)}
                self.execution_log.append(f"{phase}: FAILED ({str(result)[:50]})")
            else:
                self.results[phase] = result
                if result and isinstance(result, dict):
                    status = result.get('impact_summary', {}).get('status', result.get('status', 'UNKNOWN'))
                    self.execution_log.append(f"{phase}: {status}")

        campaign_results = {
            'campaign_id': self.campaign_id,
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': (campaign_end - campaign_start).total_seconds(),
            'phases_executed': phases,
            'parallel_execution': parallel,
            'phase_results': self.results,
            'execution_log': self.execution_log,
            'summary': self._generate_summary()
        }

        return campaign_results

    async def _execute_phase(self, phase: str) -> Optional[Dict]:
        """フェーズを実行"""
        print(f"[→] {phase} を実行中...")

        phase_script_map = {
            'ransomware': 'redteam/real_ransomware_executor.py',
            'exfiltration': 'redteam/real_data_exfiltration.py',
            'c2': 'redteam/real_autonomous_c2.py',
            'supply_chain': 'redteam/supply_chain_pivot.py',
            'persistence': 'redteam/persistence_self_healing.py'
        }

        script = phase_script_map.get(phase)
        if not script:
            print(f"  [✗] Unknown phase: {phase}")
            return None

        try:
            # スクリプトを実行
            result = subprocess.run(
                [sys.executable, script],
                capture_output=True,
                timeout=60,
                text=True
            )

            if result.returncode == 0:
                # レポートファイルを読み込み
                report_file = self._get_report_file(phase)
                if report_file:
                    with open(report_file, 'r') as f:
                        return json.load(f)
                else:
                    return {'status': 'COMPLETED', 'phase': phase}
            else:
                print(f"  [✗] {phase} execution failed")
                print(f"     {result.stderr[:200]}")
                return None

        except subprocess.TimeoutExpired:
            print(f"  [✗] {phase} timeout")
            return None
        except Exception as e:
            print(f"  [✗] {phase} error: {str(e)[:100]}")
            return None

    def _get_report_file(self, phase: str) -> Optional[str]:
        """フェーズのレポートファイルを取得"""
        report_map = {
            'ransomware': 'real_ransomware_execution_report.json',
            'exfiltration': 'real_exfiltration_report.json',
            'c2': 'real_c2_report.json',
            'supply_chain': 'supply_chain_attack_report.json',
            'persistence': 'persistence_report.json'
        }
        return report_map.get(phase)

    def _generate_summary(self) -> Dict:
        """キャンペーン概要を生成"""
        successful_phases = sum(
            1 for r in self.results.values()
            if isinstance(r, dict) and r.get('status') in ['ATTACK_SUCCESSFUL', 'SUCCESS', 'COMPLETED']
        )

        total_phases = len(self.results)

        return {
            'total_phases': total_phases,
            'successful_phases': successful_phases,
            'success_rate': successful_phases / total_phases if total_phases > 0 else 0,
            'status': 'CAMPAIGN_SUCCESSFUL' if successful_phases > total_phases * 0.6 else 'CAMPAIGN_PARTIAL'
        }

    def save_campaign_results(self):
        """キャンペーン結果を保存"""
        campaign_results = {
            'campaign_id': self.campaign_id,
            'timestamp': datetime.now().isoformat(),
            'phases_executed': list(self.results.keys()),
            'phase_results': self.results,
            'execution_log': self.execution_log,
            'summary': self._generate_summary()
        }

        # キャンペーン結果を保存
        campaign_file = f"campaign_results_{self.campaign_id}.json"
        with open(campaign_file, 'w') as f:
            json.dump(campaign_results, f, indent=2, ensure_ascii=False, default=str)

        print(f"\n[✓] Campaign results saved: {campaign_file}")

        # 学習エンジンに結果をフィードバック
        print("\n[Learning] 結果から学習中...")
        learning_result = self.learning_engine.learn_and_adapt(campaign_results)

        learning_file = f"campaign_learning_{self.campaign_id}.json"
        with open(learning_file, 'w') as f:
            json.dump(learning_result, f, indent=2, ensure_ascii=False, default=str)

        print(f"[✓] Learning results saved: {learning_file}")

        return campaign_results, learning_result

async def run_autonomous_campaign():
    """自律的キャンペーンを実行"""
    orchestrator = CampaignOrchestrator()

    # キャンペーンを実行
    campaign_results = await orchestrator.execute_campaign(
        phases=['ransomware', 'exfiltration', 'c2', 'supply_chain', 'persistence'],
        parallel=False  # 順序実行（安定性重視）
    )

    # 結果を保存・学習
    saved_results, learning_results = orchestrator.save_campaign_results()

    print("\n" + "="*80)
    print("📊 CAMPAIGN SUMMARY")
    print("="*80)
    print(json.dumps(campaign_results['summary'], indent=2, ensure_ascii=False, default=str))

    print("\n" + "="*80)
    print("🧠 LEARNING & ADAPTATION")
    print("="*80)
    print(json.dumps(learning_results, indent=2, ensure_ascii=False, default=str))

    return campaign_results, learning_results

if __name__ == '__main__':
    results, learning = asyncio.run(run_autonomous_campaign())
