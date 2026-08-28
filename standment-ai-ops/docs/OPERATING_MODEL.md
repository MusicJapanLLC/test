# AI Operating Model

## One shared truth

All roles read the same work packet before acting. A work packet has:

- `work_id`
- customer / product
- goal and acceptance criteria
- single current owner
- status: `queued | active | blocked | review | done | failed`
- dependencies
- evidence links
- failure reason
- next owner

GitHub owns code/change truth. The operations database owns event/run/incident truth. CRM owns commercial truth. Slack is notification, not the system of record.

## Roles

| Role | Owns | Must hand off to |
|---|---|---|
| CTO | architecture, technical boundary, build-vs-buy | Product / Engineer |
| Product Manager | offer, requirements, acceptance criteria | Engineer / Sales |
| Engineer | implementation, migrations, integrations | QA |
| QA | functional/regression verification | Judge / Engineer on fail |
| Security | permissions, secrets, exposure, defensive controls | Engineer / Judge |
| SRE | monitoring, reliability, backup/restore, incident response | Engineer / Judge |
| Revenue Ops | CRM, funnel, qualification, follow-up signals, MRR evidence | Sales / Chief of Staff |
| Sales | customer-facing offer, outreach, proposals | Revenue Ops / Product |
| Judge | acceptance evidence, no-fake-success gate | Chief of Staff or owner role on fail |
| Chief of Staff | priority, dependency resolution, cross-role handoff | next single owner |

## Anti-duplication rules

1. Only one role may be `current_owner` for a work packet.
2. A role may not start implementation when the packet is already `active` under another role.
3. Research becomes a source link inside the existing packet; it does not create a duplicate packet.
4. Handoff requires acceptance criteria + evidence + unresolved risks.
5. `done` requires Judge evidence. “Implemented” without verification remains `review`.

## Failure rules

Failure is data, not a hidden state.

Every failed run records:

- where it failed
- exact error or evidence
- customer/system impact
- attempt number
- whether retry is safe
- max retry count
- corrective action
- owner

No endless retries. Default automated retry ceiling is 3; destructive, billable, or externally visible actions require stricter rules.

## Daily external-output rule

Chief of Staff rejects a day as incomplete unless at least one deliverable is externally usable: deployed code/demo, customer-facing page/document/form, real prospect action, tested integration, visible reliability/security improvement, or verifiable report.

## Release gate

`Engineer -> QA -> Security/SRE when relevant -> Judge -> Deploy -> Monitor`

A release is accepted only when the public/user workflow works, failures are visible, secrets are not in source, and rollback/recovery is known.
