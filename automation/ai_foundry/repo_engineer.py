#!/usr/bin/env python3
# (既存のインポートと定数は維持)

# GitHub操作用の関数を追加
def github_commit(repo_full_name: str, path: str, content: str, message: str, token: str):
    url = f"https://api.github.com/repos/{repo_full_name}/contents/{path}"
    # SHA取得
    req_get = urllib.request.Request(url, headers={"Authorization": f"token {token}"})
    sha = ""
    try:
        with urllib.request.urlopen(req_get) as r:
            sha = json.loads(r.read())['sha']
    except: pass

    data = json.dumps({
        "message": message,
        "content": __import__('base64').b64encode(content.encode()).decode(),
        "sha": sha
    } if sha else {"message": message, "content": __import__('base64').b64encode(content.encode()).decode()}).encode()
    
    req_put = urllib.request.Request(url, data=data, method="PUT", headers={"Authorization": f"token {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req_put) as r:
        return json.loads(r.read())

# (既存のmainロジックを拡張して、GitHubへの書き込み指示を処理可能にする)
# ... (省略: 既存のロジックを維持しつつ、GitHub API呼び出しを追加)