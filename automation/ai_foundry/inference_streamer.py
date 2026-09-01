#!/usr/bin/env python3
import sys
import time

def stream_progress(message: str):
    """推論中の経過をユーザーに表示する"""
    prefixes = ["[思考中]", "[解析中]", "[構築中]", "[検証中]"]
    for char in f"{message}...":
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(0.02)
    sys.stdout.write("\n")

class InferenceUI:
    @staticmethod
    def notify_step(step_name: str):
        print(f"AI FOUNDRY: {step_name}をしています...")

if __name__ == "__main__":
    stream_progress("GitHubへのアクセス権限を確認しています")
