"""
senju.cli — コマンドライン入口。

  python -m senju.cli demo                 短時間デモ（レポートを標準出力）
  python -m senju.cli run [options]        本格的なトーナメント＋レポート保存
  python -m senju.cli safety-check <ref>   攻撃対象スコープ検問の単体テスト
  python -m senju.cli contact <url> ...    明示許可した外部HTTP(S)への接触

攻防シミュレーションの標的スコープは従来どおりラボ限定。
外部接触は独立した guarded outbound adapter を通る。
"""
from __future__ import annotations

import argparse
import json
import os
import sys

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


def _cmd_contact(args: argparse.Namespace) -> int:
    policy = ExternalContactPolicy.from_hosts(
        args.allow_host,
        allow_http=args.allow_http,
        timeout_seconds=args.timeout,
    )
    headers: dict[str, str] = {}
    body: bytes | None = None

    if args.json_body is not None:
        try:
            parsed = json.loads(args.json_body)
        except json.JSONDecodeError as exc:
            print(f"⛔ invalid --json-body: {exc}", file=sys.stderr)
            return 2
        body = json.dumps(parsed, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"

    if args.token_env:
        token = os.environ.get(args.token_env)
        if not token:
            print(f"⛔ environment variable is empty or missing: {args.token_env}", file=sys.stderr)
            return 2
        headers[args.token_header] = f"{args.token_prefix}{token}"

    try:
        receipt = ExternalContactClient(policy).contact(
            args.url,
            method=args.method,
            body=body,
            headers=headers,
        )
    except ExternalContactError as exc:
        print(f"⛔ external contact blocked/failed: {exc}", file=sys.stderr)
        return 4

    if args.receipt:
        receipt.write(args.receipt)
    print(json.dumps(receipt.to_dict(), ensure_ascii=False))
    return 0 if receipt.provider_acknowledged else 5


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
        sp.add_argument("--extreme", action="store_true", help="苛烈な戦争経済プリセット（略奪多・維持費高・破産しやすい）")

    sp_run = sub.add_parser("run", help="トーナメントを実行しレポート保存")
    add_common(sp_run)
    sp_run.set_defaults(func=_cmd_run)

    sp_demo = sub.add_parser("demo", help="短時間デモ")
    add_common(sp_demo)
    sp_demo.set_defaults(func=_cmd_demo)

    sp_safe = sub.add_parser("safety-check", help="攻撃対象スコープ検問の単体確認")
    sp_safe.add_argument("ref", help="標的参照 (例: sim://x, 8.8.8.8, 10.0.0.1)")
    sp_safe.set_defaults(func=_cmd_safety_check)

    sp_contact = sub.add_parser(
        "contact",
        help="明示許可した公開HTTP(S) endpointへ安全な外部接触を行う",
    )
    sp_contact.add_argument("url", help="接触先URL")
    sp_contact.add_argument(
        "--allow-host",
        action="append",
        required=True,
        help="明示許可するホスト。複数回指定可能",
    )
    sp_contact.add_argument("--method", choices=("GET", "HEAD", "POST"), default="GET")
    sp_contact.add_argument("--json-body", help="POSTするJSON。サイズ上限あり")
    sp_contact.add_argument("--timeout", type=float, default=5.0)
    sp_contact.add_argument("--allow-http", action="store_true", help="HTTPS以外を明示的に許可")
    sp_contact.add_argument("--receipt", help="機械可読の接触証跡JSON保存先")
    sp_contact.add_argument("--token-env", help="認証トークンを読む環境変数名")
    sp_contact.add_argument("--token-header", default="Authorization", help="トークン送信ヘッダ名")
    sp_contact.add_argument("--token-prefix", default="Bearer ", help="トークン値の接頭辞")
    sp_contact.set_defaults(func=_cmd_contact)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
