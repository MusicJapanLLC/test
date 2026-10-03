#!/usr/bin/env python3
"""
ATTACK Orchestrator
全4フェーズを統合実行するメインオーケストレーター

使用方法:
  python orchestrator.py <target_dir> [target_url] [domain]
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# フェーズのインポート
from phase1_scanner_engine import run_phase1_scan
from phase2_penetration_framework import run_phase2_tests
from phase3_recon_engine import run_phase3_recon
from phase4_autonomous_monitor import run_phase4_monitoring

class AttackOrchestrator:
    """全フェーズを統合実行"""

    def __init__(self, target_dir: str, target_url: str = None, domain: str = None):
        self.target_dir = target_dir
        self.target_url = target_url or 'https://kabeya-authorized-test-range.onrender.com'
        self.domain = domain or 'kabeya-authorized-test-range.onrender.com'
        self.results = {}

    async def run_all_phases(self):
        """全フェーズを実行"""
        print("\n" + "="*70)
        print("🔴 ATTACK - Automated Test Coverage Kaleidoscope")
        print("最強のREDTEAM統合脆弱性スキャンスイート")
        print("="*70)
        print(f"\nTarget Directory: {self.target_dir}")
        print(f"Target URL: {self.target_url}")
        print(f"Domain: {self.domain}")
        print(f"Execution Start: {datetime.now().isoformat()}\n")

        # Phase 1: Vulnerability Discovery
        print("\n📍 EXECUTING PHASE 1: Continuous Vulnerability Discovery Engine")
        print("-" * 70)
        self.results['phase1'] = await run_phase1_scan(self.target_dir, self.target_url)

        # Phase 2: Penetration Testing
        print("\n📍 EXECUTING PHASE 2: Automated Penetration Testing Framework")
        print("-" * 70)
        self.results['phase2'] = await run_phase2_tests(self.target_url)

        # Phase 3: Reconnaissance
        print("\n📍 EXECUTING PHASE 3: External Asset Reconnaissance Engine")
        print("-" * 70)
        self.results['phase3'] = await run_phase3_recon(self.domain, self.target_url)

        # Phase 4: Autonomous Monitoring
        print("\n📍 EXECUTING PHASE 4: Autonomous Evolution & Monitoring System")
        print("-" * 70)
        self.results['phase4'] = await run_phase4_monitoring()

        return self._compile_report()

    def _compile_report(self) -> Dict:
        """統合レポートをコンパイル"""
        print("\n" + "="*70)
        print("📊 COMPREHENSIVE ATTACK REPORT")
        print("="*70)

        total_findings = 0
        critical_count = 0
        high_count = 0

        # Phase 1の集計
        for key in ['sast', 'dast', 'infrastructure', 'dependencies']:
            if key in self.results['phase1']:
                for item in self.results['phase1'][key]:
                    total_findings += 1
                    if item.get('severity') == 'critical':
                        critical_count += 1
                    elif item.get('severity') == 'high':
                        high_count += 1

        # Phase 2の集計
        phase2_summary = self.results['phase2'].get('summary', {})
        total_findings += phase2_summary.get('total_findings', 0)

        # Phase 3の集計
        phase3_summary = self.results['phase3'].get('summary', {})
        total_findings += phase3_summary.get('cloud_misconfigs', 0)

        report = {
            'execution_timestamp': datetime.now().isoformat(),
            'status': 'COMPLETED',
            'summary': {
                'total_vulnerabilities': total_findings,
                'critical_severity': critical_count,
                'high_severity': high_count,
            },
            'phases': {
                'phase1_discovery': self.results['phase1'].get('summary', {}),
                'phase2_penetration': self.results['phase2'].get('summary', {}),
                'phase3_reconnaissance': self.results['phase3'].get('summary', {}),
                'phase4_autonomy': self.results['phase4'].get('summary', {}),
            },
            'next_automated_scan': self.results['phase4'].get('summary', {}).get('next_scan'),
        }

        print(f"\n✅ Execution Status: {report['status']}")
        print(f"📈 Total Findings: {total_findings}")
        print(f"🔴 Critical Severity: {critical_count}")
        print(f"🟠 High Severity: {high_count}")
        print(f"\n🤖 Next Automated Scan: {report['next_automated_scan']}")
        print("\n" + "="*70 + "\n")

        return report

async def main():
    """メイン実行"""
    if len(sys.argv) < 2:
        print("Usage: python orchestrator.py <target_dir> [target_url] [domain]")
        sys.exit(1)

    target_dir = sys.argv[1]
    target_url = sys.argv[2] if len(sys.argv) > 2 else 'https://kabeya-authorized-test-range.onrender.com'
    domain = sys.argv[3] if len(sys.argv) > 3 else 'kabeya-authorized-test-range.onrender.com'

    # ディレクトリ存在確認
    if not Path(target_dir).exists():
        print(f"❌ Target directory not found: {target_dir}")
        sys.exit(1)

    orchestrator = AttackOrchestrator(target_dir, target_url, domain)

    try:
        report = await orchestrator.run_all_phases()

        # レポートをファイルに保存
        report_file = Path('attack_report.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump({
                'report': report,
                'detailed_results': orchestrator.results
            }, f, indent=2, ensure_ascii=False, default=str)

        print(f"✅ Report saved to: {report_file}")

    except Exception as e:
        print(f"❌ Execution failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
