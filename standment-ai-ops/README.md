# Standment AI Ops

AI・自動化・データ連携を「作って終わり」にせず、監視・障害対応・改善・月次報告まで月額で運用するマネージドサービス。

## Day 1 live release

- Public demo / company site: https://standment-ai-ops-9etchg.v2.appdeploy.ai/
- Status: public deployment
- Inquiry flow: web form -> backend validation -> persistent database -> receipt ID
- Demo dashboard: clearly labeled demo data; no fabricated customer results

## Launch offer

**Managed AI Ops**

- Monthly: ¥55,000 (tax included)
- Initial implementation: ¥110,000 (tax included)
- Up to 5 monitored/maintained workflows
- Slack incident / important-event notification
- One improvement implementation per month
- Permission / exposure review
- Backup and recovery procedure design
- Monthly operations report

Not included in the base plan: 24/7 staffed NOC/SOC, endpoint help desk, destructive security testing, or penetration testing.

## Product boundary

We own the operational layer around small-company AI and SaaS workflows:

1. Build — automation and integration
2. Run — production deployment and data flow
3. Watch — health, failure and event monitoring
4. Fix — incident response and corrective changes
5. Report — monthly evidence of runs, incidents and improvements

## Engineering rule

No production claim without evidence. Every change must leave at least one of: code diff, test result, deployment URL, persisted event, incident record, or customer-facing artifact.

## Development flow

`Issue -> Branch -> implementation -> test/QA -> PR -> Judge review -> deploy -> monitor -> incident/postmortem if needed`

Roles and ownership are defined in `docs/OPERATING_MODEL.md`. The 30-day delivery schedule is in `docs/30_DAY_EXECUTION.md`.
