# Commercial Event Contract

The Revenue Bridge must distinguish internal progress from real-world money.

## Stages

| stage | Revenue Distance | Meaning | Counts as cash? |
|---|---|---|---|
| `outreach_ready` | D4 | A named buyer and sendable evidence/offer exist | No |
| `meeting` | D3 | A real buying conversation occurred | No |
| `proposal` | D2 | A real proposal/demo/paid-trial request exists | No |
| `contract` | D1 | A real contract/order is verified | No |
| `payment` | D0 | Money was actually received and verified | **Yes** |

## Required event fields

```json
{
  "product_id": "sales-command-30",
  "prospect": "Example Company",
  "stage": "payment",
  "amount_yen": 80000,
  "verified": true,
  "occurred_at": "2026-08-29T12:00:00Z",
  "evidence_ref": "external-system-stable-id"
}
```

`amount_yen` is counted only for `payment`. A contract value, forecast, proposal amount, WLD balance, research score, or internal reward is not cash revenue.

## Verification rules

1. `verified=true` must come from a trusted business evidence source, not an agent's self-assertion.
2. `payment` requires a positive `amount_yen` and stable evidence reference from the source of truth.
3. Unverified events are ignored for stage advancement and revenue.
4. Repeated ingestion of the same source event must be deduplicated by a stable external identifier before it reaches the Revenue Bridge.
5. Raw customer secrets, email bodies, payment credentials, or private financial details must not be copied into Slack or GitHub artifacts.
6. WLD / WORLD CREDIT remains an internal economy. It never converts automatically into yen revenue.
7. Slack may report aggregated verified cash and stage, but not sensitive payment data.

## Intended sources

A future connector may populate `commercial-events.json` from an authorized CRM, billing ledger, Google Sheet, or other trusted source. The adapter is responsible for source authentication, deduplication, and evidence references. The Revenue Bridge remains read-only toward those systems.

## Owner truth rule

If there is no verified payment event, the correct report is **現実売上 ¥0** even when the research, AI, security, or internal economy is performing well.
