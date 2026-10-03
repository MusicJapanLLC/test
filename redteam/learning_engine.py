#!/usr/bin/env python3
"""
Learning Engine - 攻撃の学習と適応
前回の結果を分析して次の戦略を最適化
成功ベクトルを強化、失敗ベクトルを改善
"""

import json
import os
from typing import Dict, List, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict

@dataclass
class CampaignMetrics:
    """キャンペーン指標"""
    campaign_id: str
    timestamp: str
    phase_results: Dict[str, Dict]
    total_score: float
    success_vectors: List[str]
    failed_vectors: List[str]
    adaptations: List[str]

class LearningEngine:
    """攻撃学習エンジン"""

    def __init__(self, history_file: str = "redteam/campaign_history.json"):
        self.history_file = history_file
        self.campaign_history = self._load_history()

    def _load_history(self) -> List[Dict]:
        """キャンペーン履歴を読み込み"""
        if os.path.exists(self.history_file):
            with open(self.history_file, 'r') as f:
                return json.load(f)
        return []

    def _save_history(self):
        """キャンペーン履歴を保存"""
        with open(self.history_file, 'w') as f:
            json.dump(self.campaign_history, f, indent=2, ensure_ascii=False, default=str)

    def analyze_phase_results(self, phase_name: str, results: Dict) -> Dict:
        """フェーズ結果を分析"""
        metrics = {
            'phase': phase_name,
            'timestamp': datetime.now().isoformat(),
            'success_metrics': self._extract_success_metrics(results),
            'failure_points': self._extract_failure_points(results),
            'optimization_vectors': self._identify_optimizations(results),
            'effectiveness_score': self._calculate_effectiveness(results)
        }
        return metrics

    def _extract_success_metrics(self, results: Dict) -> List[str]:
        """成功ポイントを抽出"""
        successes = []

        if isinstance(results, dict):
            if results.get('status') in ['SUCCESSFUL', 'ATTACK_SUCCESSFUL', 'SUCCESS']:
                if 'phases' in results:
                    for phase_name, phase_data in results['phases'].items():
                        if isinstance(phase_data, dict) and phase_data.get('status') in ['SUCCESS', 'destroyed', 'active']:
                            successes.append(f"{phase_name}:successful")

            if 'impact_summary' in results:
                impact = results['impact_summary']
                if impact.get('status') in ['ATTACK_SUCCESSFUL', 'SUCCESS']:
                    successes.append('impact:confirmed')

        return successes

    def _extract_failure_points(self, results: Dict) -> List[str]:
        """失敗ポイントを抽出"""
        failures = []

        if isinstance(results, dict):
            if results.get('status') in ['FAILED', 'ATTACK_FAILED']:
                failures.append('campaign:failed')

            if 'phases' in results:
                for phase_name, phase_data in results['phases'].items():
                    if isinstance(phase_data, dict):
                        if phase_data.get('status') in ['FAILED', 'failed']:
                            failures.append(f"{phase_name}:failed")

        return failures

    def _identify_optimizations(self, results: Dict) -> List[str]:
        """最適化ベクトルを特定"""
        optimizations = []

        if isinstance(results, dict):
            # 検出回避スコアが低い場合
            if 'impact_assessment' in results:
                impact = results['impact_assessment']

                if 'detection_evasion_effectiveness' in impact:
                    if impact['detection_evasion_effectiveness'] < 0.5:
                        optimizations.append('evasion:increase_obfuscation')

                if 'evasion_effectiveness' in impact:
                    if impact['evasion_effectiveness'] < 0.6:
                        optimizations.append('evasion:enhance_stealth')

                # 送信速度が遅い場合
                if 'data_exfiltration_volume' in impact:
                    optimizations.append('exfil:optimize_channels')

                # 回復失敗が多い場合
                if 'persistence_failed_recovery' in impact:
                    if impact['persistence_failed_recovery'] > 0:
                        optimizations.append('persistence:add_backup_mechanisms')

        return optimizations

    def _calculate_effectiveness(self, results: Dict) -> float:
        """攻撃効果スコアを計算（0-1.0）"""
        score = 0.0
        weight_count = 0

        if isinstance(results, dict):
            # 基本的な成功判定
            if results.get('status') in ['SUCCESSFUL', 'ATTACK_SUCCESSFUL', 'SUCCESS']:
                score += 0.3
                weight_count += 1

            if 'impact_assessment' in results:
                impact = results['impact_assessment']

                # 検出回避効果
                if 'detection_evasion_effectiveness' in impact:
                    score += impact['detection_evasion_effectiveness'] * 0.15
                    weight_count += 1
                elif 'evasion_effectiveness' in impact:
                    score += impact['evasion_effectiveness'] * 0.15
                    weight_count += 1

                # データ送信量
                if 'data_exfiltrated_mb' in impact:
                    score += min(1.0, impact['data_exfiltrated_mb'] / 1000) * 0.15
                    weight_count += 1
                elif 'total_data_exfiltrated_mb' in impact:
                    score += min(1.0, impact['total_data_exfiltrated_mb'] / 1000) * 0.15
                    weight_count += 1

                # 復旧成功率
                if 'self_healing_effectiveness' in impact:
                    score += impact['self_healing_effectiveness'] * 0.15
                    weight_count += 1

                # 永続化強度
                if 'persistence_strength' in impact:
                    score += impact['persistence_strength'] * 0.1
                    weight_count += 1

        return min(1.0, score) if weight_count > 0 else 0.0

    def learn_and_adapt(self, latest_results: Dict) -> Dict:
        """前回の結果から学習して次の戦略を適応させる"""
        print("\n[Learning] 前回の結果から学習中...")

        # 最新結果を分析
        metrics = self.analyze_phase_results(
            latest_results.get('timestamp', datetime.now().isoformat()),
            latest_results
        )

        # 履歴に追加
        self.campaign_history.append({
            'timestamp': datetime.now().isoformat(),
            'metrics': metrics
        })
        self._save_history()

        # 適応戦略を生成
        adaptations = []

        # 成功ベクトルを強化
        if metrics['success_metrics']:
            adaptations.append({
                'type': 'reinforce_success',
                'vectors': metrics['success_metrics'],
                'action': 'increase_frequency_and_intensity'
            })
            print(f"  [✓] 成功ベクトルを強化: {metrics['success_metrics']}")

        # 失敗ベクトルを改善
        if metrics['failure_points']:
            adaptations.append({
                'type': 'improve_failure',
                'vectors': metrics['failure_points'],
                'action': 'apply_alternative_techniques'
            })
            print(f"  [!] 失敗ベクトルを改善: {metrics['failure_points']}")

        # 最適化を適用
        if metrics['optimization_vectors']:
            adaptations.append({
                'type': 'optimize',
                'vectors': metrics['optimization_vectors'],
                'action': 'enhance_target_capability'
            })
            print(f"  [→] 最適化を適用: {metrics['optimization_vectors']}")

        # 効果スコアに基づいて攻撃強度を調整
        effectiveness = metrics['effectiveness_score']
        if effectiveness > 0.8:
            adaptations.append({
                'type': 'escalate',
                'action': 'increase_attack_scope_and_parallelism',
                'reason': f'high_effectiveness_{effectiveness:.1%}'
            })
            print(f"  [↑] 攻撃強度をエスケレート (効果 {effectiveness:.1%})")
        elif effectiveness < 0.4:
            adaptations.append({
                'type': 'recalibrate',
                'action': 'adjust_stealth_and_timing',
                'reason': f'low_effectiveness_{effectiveness:.1%}'
            })
            print(f"  [↓] 戦略を再調整 (効果 {effectiveness:.1%})")

        return {
            'metrics': metrics,
            'adaptations': adaptations,
            'next_campaign_parameters': self._generate_next_campaign_params(adaptations)
        }

    def _generate_next_campaign_params(self, adaptations: List[Dict]) -> Dict:
        """次のキャンペーンパラメータを生成"""
        params = {
            'phases_to_run': ['ransomware', 'exfiltration', 'c2', 'supply_chain', 'persistence'],
            'parallel_execution': True,
            'escalation_level': 1,
            'stealth_level': 7,
            'target_scope': 'authorized_test_sites'
        }

        # 適応に基づいてパラメータを調整
        for adaptation in adaptations:
            if adaptation.get('type') == 'escalate':
                params['escalation_level'] = min(10, params['escalation_level'] + 2)
                params['stealth_level'] = max(1, params['stealth_level'] - 1)
            elif adaptation.get('type') == 'recalibrate':
                params['escalation_level'] = max(1, params['escalation_level'] - 1)
                params['stealth_level'] = min(10, params['stealth_level'] + 2)

        return params

    def get_campaign_insights(self) -> Dict:
        """キャンペーン統計情報を取得"""
        if not self.campaign_history:
            return {'total_campaigns': 0, 'avg_effectiveness': 0.0}

        total_campaigns = len(self.campaign_history)
        effectiveness_scores = [
            c.get('metrics', {}).get('effectiveness_score', 0)
            for c in self.campaign_history
        ]
        avg_effectiveness = sum(effectiveness_scores) / len(effectiveness_scores) if effectiveness_scores else 0

        success_count = sum(1 for score in effectiveness_scores if score > 0.7)

        return {
            'total_campaigns': total_campaigns,
            'avg_effectiveness': avg_effectiveness,
            'high_effectiveness_campaigns': success_count,
            'success_rate': success_count / total_campaigns if total_campaigns > 0 else 0,
            'trend': 'improving' if len(effectiveness_scores) > 1 and effectiveness_scores[-1] > effectiveness_scores[-2] else 'stable'
        }

if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        # テスト用: レポートファイルを読み込んで学習
        report_file = sys.argv[1]

        with open(report_file, 'r') as f:
            results = json.load(f)

        engine = LearningEngine()
        learning_result = engine.learn_and_adapt(results)

        print("\n[学習結果]")
        print(json.dumps(learning_result, indent=2, ensure_ascii=False, default=str))

        print("\n[キャンペーン統計]")
        insights = engine.get_campaign_insights()
        print(json.dumps(insights, indent=2, ensure_ascii=False, default=str))
