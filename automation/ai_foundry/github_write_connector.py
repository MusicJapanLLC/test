#!/usr/bin/env python3
import os
import json
import urllib.request
from typing import Optional

class GitHubWriteConnector:
    """GitHubへの書き込み、プルリクエスト作成、マージを制御するコネクタ"""
    def __init__(self):
        self.token = os.environ.get("GITHUB_TOKEN")
        self.api_base = "https://api.github.com"

    def _request(self, method: str, path: str, data: Optional[dict] = None):
        if not self.token:
            raise RuntimeError("GITHUB_TOKEN is not set")
        
        url = f"{self.api_base}{path}"
        headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        
        body = json.dumps(data).encode() if data else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())

    def create_pull_request(self, repo: str, title: str, head: str, base: str = "main", body: str = ""):
        path = f"/repos/{repo}/pulls"
        data = {"title": title, "head": head, "base": base, "body": body}
        return self._request("POST", path, data)

    def merge_pull_request(self, repo: str, pull_number: int):
        path = f"/repos/{repo}/pulls/{pull_number}/merge"
        return self._request("PUT", path)

if __name__ == "__main__":
    # CLI test interface
    import sys
    if len(sys.argv) > 1:
        print("GitHub Connector initialized. Ready for operations.")
