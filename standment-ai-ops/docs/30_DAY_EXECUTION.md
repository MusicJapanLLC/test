# 30-Day Execution — Standment AI Ops

Rule: every day must end with at least one artifact that can be shown, sent, tested, or used outside the company. Internal-only planning does not count.

| Day | Lead role | External deliverable | Verification gate |
|---|---|---|---|
| 1 | Product + Engineer | Public service site, price, demo dashboard, working inquiry form | Public URL loads; backend healthy; form persists inquiry and returns receipt |
| 2 | Sales | 1-page sales sheet and 5-minute demo script | Can be sent to a prospect without editing |
| 3 | Product | Pre-contract diagnostic / hearing form | Real submission stored with qualification fields |
| 4 | CTO + Engineer | GitHub engineering standard + CI check | PR must pass automated checks before merge |
| 5 | Data | Customer / system / workflow / incident database | Seed demo client query succeeds; schema documented |
| 6 | Chief of Staff | Customer-facing onboarding checklist | A new client can complete access setup from one page |
| 7 | Revenue Ops | First qualified prospect list + first outbound batch | Sent activity recorded with target, message and status |
| 8 | SRE | System status / monitoring demo | Synthetic failure creates visible incident |
| 9 | Security | Public security & data-handling statement | Least privilege, secrets, retention and incident reporting defined |
| 10 | SRE | Backup + restore proof | Restore drill reproduces expected record/config |
| 11 | Engineer | Event-driven integration demo | One real event traverses source -> processor -> Slack/DB |
| 12 | Revenue Ops | Sample monthly operations report | Generated from real demo telemetry, not invented metrics |
| 13 | Product | Scope/SLA and pricing sheet v2 | In-scope/out-of-scope and response targets unambiguous |
| 14 | Sales | Recorded/live demo walkthrough package | Prospect can understand problem, workflow and value in <10 min |
| 15 | Product | Vertical offer #1 | One industry-specific landing section + workflow demo |
| 16 | Engineer | Automation demo #2 | Separate source/tool path proves repeatability |
| 17 | Engineer | Client portal/member login demo | Login, protected view and logout tested |
| 18 | Data | CRM synchronization demo | New lead is deduplicated and visible in CRM/data store |
| 19 | Revenue Ops | Opportunity / follow-up report | Stale or high-value opportunities surfaced with source evidence |
| 20 | Security | Configuration audit sample | Findings have severity, evidence and remediation; no intrusive testing |
| 21 | Sales | First pilot proposal | Sent or ready-to-send proposal tied to one qualified prospect |
| 22 | Chief of Staff | Pilot onboarding pack | Access matrix, owners, rollback plan, communication path complete |
| 23 | Engineer | Pilot/demo production workflow | One useful workflow deployed with logs and owner |
| 24 | SRE | Alert + recovery evidence | Failure alert, retry/stop rule and recovery evidence captured |
| 25 | Judge + SRE | Incident drill + postmortem | Timeline, impact, root cause, corrective action published |
| 26 | Revenue Ops | Generated customer monthly report | Uses recorded runs/incidents/improvements from system of record |
| 27 | Sales | Case study | Real customer evidence if available; otherwise explicitly labeled demo case |
| 28 | Sales | Follow-up / objection handling pack | Used in real prospect follow-up activity |
| 29 | Security + QA | Release hardening report | Security/advisor/test/deployment gates all checked |
| 30 | Chief of Staff | Production acceptance + launch report | Product, code, customer pipeline, operations history and next MRR target evidenced |

## Week gates

### Days 1–7 — Sellable
Public offer, pricing, real demo, intake, GitHub flow, CRM foundation and first outreach exist.

### Days 8–14 — Deliverable
Monitoring, security policy, backup/restore, event flow, report sample and scope/SLA are operational.

### Days 15–21 — Repeatable + Selling
Second implementation pattern, client portal, CRM sync, audit sample and a concrete pilot proposal exist.

### Days 22–30 — Operated
Onboarding, production workflow, alert/recovery evidence, postmortem, monthly report and sales proof form a repeatable service.

## Day-30 acceptance criteria

- One monthly recurring offer with explicit scope and price
- Public company/service site and live demo
- GitHub branch/PR/QA/deploy workflow
- Customer and operational system of record
- Inquiry + discovery + onboarding flows
- Incident, security, backup and monitoring procedures with tested evidence
- Monthly customer report generated from recorded operations
- Qualified prospects and recorded real outbound activity
- AI employee loops producing evidence-backed work without duplicate ownership
