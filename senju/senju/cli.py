"""
senju.cli — コマンドライン入口。

  python -m senju.cli demo
  python -m senju.cli run [options]
  python -m senju.cli safety-check <ref>
  python -m senju.cli contact <url> ...
  python -m senju.cli contact-batch <manifest.json> ...

Arena simulation scope and external HTTP transport remain separate layers.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from .config import ArenaConfig, EvolutionConfig, SenjuConfig
from .economy import EconomyConfig
from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy
from .report import render_markdown, write_report
from .safety import ScopeGuard, ScopeViolation, default_lab_policy
from .tournament import Tournament


def _build_config(args: argparse.Namespace) -> SenjuConfig:
    return SenjuConfig(
        scenario_name=args.scenario,
        arena=ArenaConfig(
            red_action_budget=args.red_budget,
            blue_action_budget=args.blue_budget,
            seed=args.seed,
        ),
        evolution=EvolutionConfig(
            population_size=args.population,
            generations=args.generations,
            matches_per_generation=args.matches,
            seed=args.seed,
        ),
        economy=EconomyConfig.extreme() if getattr(args, "extreme", False) else EconomyConfig(),
        report_dir=args.report_dir,
    )


def _cmd_run(args: argparse.Namespace) -> int:
    config = _build_config(args)
    guard = ScopeGuard(default_lab_policy())
    tournament = Tournament(config, guard)
    report = tournament.run()

    path = write_report(report, config.report_dir)
    if not getattr(args, "quiet", False):
        print(render_markdown(report))
        print(f"\n[saved] {path}", file=sys.stderr)
    else:
        print(f"[saved] {path}", file=sys.stderr)
    return 0


def _cmd_demo(args: argparse.Namespace) -> int:
    args.population = 16
    args.generations = 6
    args.matches = 40
    args.scenario = "demo-web"
    args.seed = 42
    return _cmd_run(args)


def _cmd_safety_check(args: argparse.Namespace) -> int:
    guard = ScopeGuard(default_lab_policy())
    try:
        guard.check(args.ref)
        print(f"✅ 許可: {args.ref}")
        return 0
    except ScopeViolation as e:
        print(f"⛔ 拒否: {e}")
        return 3


def _parse_headers(values: list[str] | None) -> dict[str, str]:
    headers: dict[str, str] = {}
    for raw in values or []:
        if ":" not in raw:
            raise ValueError(f"header must be NAME:VALUE: {raw!r}")
        name, value = raw.split(":", 1)
        name = name.strip()
        value = value.lstrip()
        if not name:
            raise ValueError("header name is empty")
        headers[name] = value
    return headers


def _token_header(args: argparse.Namespace) -> dict[str, str]:
    if not getattr(args, "token_env", None):
        return {}
    token = os.environ.get(args.token_env)
    if not token:
        raise ValueError(f"environment variable is empty or missing: {args.token_env}")
    return {args.token_header: f"{args.token_prefix}{token}"}


def _build_policy(args: argparse.Namespace) -> ExternalContactPolicy:
    return ExternalContactPolicy.from_hosts(
        args.allow_host,
        allow_http=args.allow_http,
        allow_delete=args.allow_delete,
        follow_redirects=args.follow_redirects,
        max_redirects=args.max_redirects,
        timeout_seconds=args.timeout,
        max_response_bytes=args.max_response_bytes,
        retries=args.retries,
    )


def _encode_body(
    *,
    json_value: Any = None,
    raw_text: str | None = None,
    body_file: str | None = None,
    max_bytes: int,
) -> tuple[bytes | None, dict[str, str]]:
    selected = int(json_value is not None) + int(raw_text is not None) + int(body_file is not None)
    if selected > 1:
        raise ValueError("choose only one of JSON, raw data, or body file")
    if json_value is not None:
        body = json.dumps(json_value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(body) > max_bytes:
            raise ValueError(f"request body exceeds {max_bytes} bytes")
        return body, {"Content-Type": "application/json"}
    if raw_text is not None:
        body = raw_text.encode("utf-8")
        if len(body) > max_bytes:
            raise ValueError(f"request body exceeds {max_bytes} bytes")
        return body, {}
    if body_file is not None:
        p = Path(body_file)
        if p.stat().st_size > max_bytes:
            raise ValueError(f"request body exceeds {max_bytes} bytes")
        return p.read_bytes(), {}
    return None, {}


def _cmd_contact(args: argparse.Namespace) -> int:
    policy = _build_policy(args)
    try:
        headers = _parse_headers(args.header)
        headers.update(_token_header(args))
        json_value = None
        if args.json_body is not None:
            json_value = json.loads(args.json_body)
        body, inferred = _encode_body(
            json_value=json_value,
            raw_text=args.data,
            body_file=args.body_file,
            max_bytes=policy.max_request_bytes,
        )
        for key, value in inferred.items():
            headers.setdefault(key, value)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"⛔ invalid request: {exc}", file=sys.stderr)
        return 2

    try:
        result = ExternalContactClient(policy).contact_with_body(
            args.url,
            method=args.method,
            body=body,
            headers=headers,
        )
    except ExternalContactError as exc:
        print(f"⛔ external contact blocked/failed: {exc}", file=sys.stderr)
        return 4

    if args.receipt:
        result.receipt.write(args.receipt)
    if args.response_out:
        result.write_body(args.response_out)

    print(json.dumps(result.receipt.to_dict(), ensure_ascii=False))
    return 0 if result.receipt.provider_acknowledged else 5


def _load_manifest(path: str) -> list[dict[str, Any]]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    requests = raw.get("requests") if isinstance(raw, dict) else raw
    if not isinstance(requests, list):
        raise ValueError("manifest must be a JSON array or {'requests': [...]} object")
    if not 1 <= len(requests) <= 20:
        raise ValueError("manifest must contain 1-20 requests")
    out: list[dict[str, Any]] = []
    for i, item in enumerate(requests):
        if not isinstance(item, dict):
            raise ValueError(f"request[{i}] must be an object")
        out.append(item)
    return out


def _cmd_autonomy_loop(args: argparse.Namespace) -> int:
    import urllib.parse
    from .autonomy import AutonomyLoop, WorkItem

    authorized_write_hosts = []
    if args.canary_url:
        parsed = urllib.parse.urlsplit(args.canary_url)
        if parsed.hostname:
            authorized_write_hosts.append(parsed.hostname)

    loop = AutonomyLoop(
        allow_hosts=args.allow_host,
        authorized_write_hosts=authorized_write_hosts,
        out_dir=args.out_dir,
    )

    for i, url in enumerate(args.url):
        loop.queue.enqueue(
            WorkItem(
                id=f"seed-{i+1}",
                item_type="discovery",
                url=url,
                method="GET",
                source="cli_seed",
                novelty_score=1.0,
                expected_research_value=0.8,
            )
        )

    if args.canary_url:
        loop.queue.enqueue(
            WorkItem(
                id="canary-1",
                item_type="canary_write",
                url=args.canary_url,
                method="POST",
                source="canary",
                score=2.0,
                payload={"json": {"canary": "test"}, "expect_status": [200, 201, 202, 204]},
            )
        )

    results = []
    for _ in range(max(1, args.max_steps)):
        item = loop.queue.pop_next()
        if not item:
            break
        res = loop.execute_step(item)
        results.append(res)

    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


def _cmd_contact_batch(args: argparse.Namespace) -> int:
    policy = _build_policy(args)
    try:
        requests = _load_manifest(args.manifest)
        global_headers = _parse_headers(args.header)
        global_headers.update(_token_header(args))
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"⛔ invalid batch: {exc}", file=sys.stderr)
        return 2

    client = ExternalContactClient(policy)
    response_dir = Path(args.response_dir) if args.response_dir else None
    if response_dir:
        response_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict[str, Any]] = []
    for index, item in enumerate(requests):
        try:
            url = str(item["url"])
            method = str(item.get("method", "GET")).upper()
            item_headers_raw = item.get("headers", {})
            if not isinstance(item_headers_raw, dict) or not all(
                isinstance(k, str) and isinstance(v, str) for k, v in item_headers_raw.items()
            ):
                raise ValueError(f"request[{index}].headers must be string:string object")
            headers = dict(global_headers)
            headers.update(item_headers_raw)

            json_present = "json" in item
            data_present = "data" in item
            if json_present and data_present:
                raise ValueError(f"request[{index}] cannot contain both json and data")
            body, inferred = _encode_body(
                json_value=item.get("json") if json_present else None,
                raw_text=str(item["data"]) if data_present else None,
                max_bytes=policy.max_request_bytes,
            )
            for key, value in inferred.items():
                headers.setdefault(key, value)

            result = client.contact_with_body(url, method=method, body=body, headers=headers)
            record: dict[str, Any] = {"index": index, "ok": True, **result.receipt.to_dict()}
            if response_dir:
                body_path = response_dir / f"{index:02d}.bin"
                result.write_body(body_path)
                record["response_file"] = str(body_path)
            results.append(record)
        except (ExternalContactError, ValueError, KeyError) as exc:
            results.append({"index": index, "ok": False, "error": str(exc)})
            if not args.continue_on_error:
                break

    if args.receipt:
        p = Path(args.receipt)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False))
    return 0 if len(results) == len(requests) and all(r.get("ok") for r in results) else 5


def _add_transport_options(sp: argparse.ArgumentParser) -> None:
    sp.add_argument(
        "--allow-host",
        action="append",
        required=True,
        help="明示許可する公開ホスト。複数回指定可能",
    )
    sp.add_argument("--timeout", type=float, default=5.0)
    sp.add_argument("--retries", type=int, default=1, help="transport失敗時の再試行回数 (0-3)")
    sp.add_argument("--max-response-bytes", type=int, default=512 * 1024)
    sp.add_argument("--allow-http", action="store_true", help="HTTPS以外を明示的に許可")
    sp.add_argument("--allow-delete", action="store_true", help="DELETEを明示的に許可")
    sp.add_argument("--follow-redirects", action="store_true", help="allowlist内redirectを再検証して追従")
    sp.add_argument("--max-redirects", type=int, default=3, help="redirect上限 (0-5)")
    sp.add_argument("--header", action="append", help="追加ヘッダ NAME:VALUE。複数回指定可能")
    sp.add_argument("--token-env", help="認証トークンを読む環境変数名")
    sp.add_argument("--token-header", default="Authorization", help="トークン送信ヘッダ名")
    sp.add_argument("--token-prefix", default="Bearer ", help="トークン値の接頭辞")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="senju", description="Senju 攻防シミュレーション基盤")
    sub = p.add_subparsers(dest="command", required=True)

    def add_common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--scenario", default="default-web")
        sp.add_argument("--population", type=int, default=24)
        sp.add_argument("--generations", type=int, default=10)
        sp.add_argument("--matches", type=int, default=60)
        sp.add_argument("--red-budget", type=int, default=12)
        sp.add_argument("--blue-budget", type=int, default=12)
        sp.add_argument("--seed", type=int, default=None)
        sp.add_argument("--report-dir", default="reports")
        sp.add_argument("--quiet", action="store_true", help="レポート本文を標準出力しない")
        sp.add_argument("--extreme", action="store_true", help="苛烈な戦争経済プリセット")

    sp_run = sub.add_parser("run", help="トーナメントを実行しレポート保存")
    add_common(sp_run)
    sp_run.set_defaults(func=_cmd_run)

    sp_demo = sub.add_parser("demo", help="短時間デモ")
    add_common(sp_demo)
    sp_demo.set_defaults(func=_cmd_demo)

    sp_safe = sub.add_parser("safety-check", help="攻撃対象スコープ検問の単体確認")
    sp_safe.add_argument("ref", help="標的参照")
    sp_safe.set_defaults(func=_cmd_safety_check)

    sp_contact = sub.add_parser("contact", help="allowlist済みHTTP(S) endpointへ実通信する")
    sp_contact.add_argument("url", help="接触先URL")
    _add_transport_options(sp_contact)
    sp_contact.add_argument(
        "--method",
        choices=("GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"),
        default="GET",
    )
    body_group = sp_contact.add_mutually_exclusive_group()
    body_group.add_argument("--json-body", help="送信するJSON文字列")
    body_group.add_argument("--data", help="送信するUTF-8 raw text")
    body_group.add_argument("--body-file", help="送信するファイル")
    sp_contact.add_argument("--receipt", help="機械可読の接触証跡JSON保存先")
    sp_contact.add_argument("--response-out", help="取得した応答本文の保存先")
    sp_contact.set_defaults(func=_cmd_contact)

    sp_batch = sub.add_parser("contact-batch", help="JSON manifestから最大20件の実HTTP API操作を順次実行")
    sp_batch.add_argument("manifest", help="request manifest JSON")
    _add_transport_options(sp_batch)
    sp_batch.add_argument("--receipt", help="batch結果JSON保存先")
    sp_batch.add_argument("--response-dir", help="各response bodyの保存先ディレクトリ")
    sp_batch.add_argument("--continue-on-error", action="store_true", help="1件失敗しても後続を続行")
    sp_batch.set_defaults(func=_cmd_contact_batch)

    sp_autonomy = sub.add_parser("autonomy-loop", help="未知の公開サイトの自律調査ループを実行")
    sp_autonomy.add_argument("--url", action="append", default=[], help="初期調査対象URL")
    sp_autonomy.add_argument("--allow-host", action="append", required=True, help="許可ホスト")
    sp_autonomy.add_argument("--canary-url", help="所有/許可済みカナリア書き込み先URL")
    sp_autonomy.add_argument("--out-dir", default="reports/autonomy", help="証跡出力先")
    sp_autonomy.add_argument("--max-steps", type=int, default=3, help="実行ステップ数")
    sp_autonomy.set_defaults(func=_cmd_autonomy_loop)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
