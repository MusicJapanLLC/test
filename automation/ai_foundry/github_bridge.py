import os
import json
import requests
from typing import Optional

class GitHubBridge:
    def __init__(self, token: str, repo_owner: str, repo_name: str):
        self.token = token
        self.base_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def create_or_update_file(self, path: str, content: str, message: str, branch: str = "main"):
        url = f"{self.base_url}/contents/{path}"
        # Get current file SHA if exists
        resp = requests.get(url, headers=self.headers, params={"ref": branch})
        sha = resp.json().get("sha") if resp.status_code == 200 else None

        data = {
            "message": message,
            "content": __import__("base64").b64encode(content.encode()).decode(),
            "branch": branch
        }
        if sha: data["sha"] = sha

        r = requests.put(url, headers=self.headers, json=data)
        r.raise_for_status()
        return r.json()

    def create_pull_request(self, title: str, head: str, base: str = "main", body: str = ""):
        url = f"{self.base_url}/pulls"
        data = {"title": title, "head": head, "base": base, "body": body}
        r = requests.post(url, headers=self.headers, json=data)
        r.raise_for_status()
        return r.json()

    def merge_pull_request(self, pr_number: int):
        url = f"{self.base_url}/pulls/{pr_number}/merge"
        r = requests.put(url, headers=self.headers)
        r.raise_for_status()
        return r.json()

if __name__ == "__main__":
    # Example usage via environment variables
    token = os.getenv("GITHUB_TOKEN")
    if token:
        bridge = GitHubBridge(token, "musicjapanllc", "test-musicjapanllc")
        print("GitHub Bridge Initialized")
