-- Music Japan / Standment canonical company memory
-- Schema only. Real customer/person data is intentionally not committed to GitHub.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgroonga with schema extensions;

create schema if not exists cm_core;
create schema if not exists cm_memory;
create schema if not exists cm_ops;
create schema if not exists cm_audit;

create or replace function cm_core.normalize_label(value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select lower(
    regexp_replace(
      regexp_replace(
        translate(coalesce(value, ''), '　－ー―‐', ' ---'),
        '(株式会社|合同会社|有限会社|（株）|\(株\)|さん|様)', '', 'g'
      ),
      '[[:space:][:punct:]]+', '', 'g'
    )
  );
$$;

create table cm_core.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^wsp_[a-z0-9_]+$'),
  name text not null,
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table cm_core.workspace_members (
  workspace_id uuid not null references cm_core.workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','editor','reader')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (workspace_id, user_id)
);

create table cm_core.entities (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  kind text not null check (kind in ('person','organization','program','project')),
  canonical_name text not null,
  normalized_name text not null,
  description text,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active','inactive','prospect','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);
create index entities_workspace_kind_idx on cm_core.entities(workspace_id, kind);
create index entities_normalized_name_trgm_idx on cm_core.entities using gin(normalized_name extensions.gin_trgm_ops);

create table cm_core.people (
  entity_id uuid primary key references cm_core.entities(id),
  workspace_id uuid not null references cm_core.workspaces(id),
  full_name text not null,
  primary_org_entity_id uuid references cm_core.entities(id),
  title text,
  profile_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table cm_core.organizations (
  entity_id uuid primary key references cm_core.entities(id),
  workspace_id uuid not null references cm_core.workspaces(id),
  legal_name text not null,
  corporate_number text,
  domain text,
  organization_type text,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index organizations_corporate_number_uq
  on cm_core.organizations(workspace_id, corporate_number)
  where corporate_number is not null and deleted_at is null;

create table cm_core.programs (
  entity_id uuid primary key references cm_core.entities(id),
  workspace_id uuid not null references cm_core.workspaces(id),
  owner_org_entity_id uuid references cm_core.entities(id),
  provider_org_entity_id uuid references cm_core.entities(id),
  category text,
  operational_status text not null default 'active' check (operational_status in ('active','paused','ended','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table cm_core.entity_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  entity_id uuid not null references cm_core.entities(id),
  alias text not null,
  normalized_alias text not null,
  alias_type text not null default 'name',
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  source_record_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, entity_id, normalized_alias)
);
create index entity_aliases_normalized_trgm_idx on cm_core.entity_aliases using gin(normalized_alias extensions.gin_trgm_ops);

create table cm_core.entity_identifiers (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  entity_id uuid not null references cm_core.entities(id),
  identifier_type text not null,
  raw_value text not null,
  normalized_value text not null,
  verified boolean not null default false,
  source_record_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index entity_identifiers_strong_uq
  on cm_core.entity_identifiers(workspace_id, identifier_type, normalized_value)
  where verified and deleted_at is null;

create table cm_core.entity_redirects (
  workspace_id uuid not null references cm_core.workspaces(id),
  from_entity_id uuid primary key references cm_core.entities(id),
  to_entity_id uuid not null references cm_core.entities(id),
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  check (from_entity_id <> to_entity_id)
);

create table cm_core.dedupe_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  left_entity_id uuid not null references cm_core.entities(id),
  right_entity_id uuid not null references cm_core.entities(id),
  score numeric(4,3) not null check (score between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','merged','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (left_entity_id <> right_entity_id),
  unique (workspace_id, left_entity_id, right_entity_id)
);

create table cm_memory.source_systems (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  name text not null,
  system_type text not null,
  default_precedence integer not null default 50,
  created_at timestamptz not null default now(),
  unique (workspace_id, public_id)
);

create table cm_memory.source_records (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  source_system_id uuid not null references cm_memory.source_systems(id),
  external_id text not null,
  external_version text not null default 'current',
  source_uri text,
  locator jsonb not null default '{}'::jsonb,
  title text,
  content_hash text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  ingestion_status text not null default 'accepted' check (ingestion_status in ('accepted','quarantined','rejected')),
  unique (source_system_id, external_id, external_version)
);

alter table cm_core.entity_aliases
  add constraint entity_aliases_source_fk foreign key (source_record_id) references cm_memory.source_records(id);
alter table cm_core.entity_identifiers
  add constraint entity_identifiers_source_fk foreign key (source_record_id) references cm_memory.source_records(id);

create table cm_core.compensation_rule_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  program_entity_id uuid not null references cm_core.entities(id),
  version_no integer not null,
  amount numeric(14,2),
  currency text not null default 'JPY',
  unit text,
  success_conditions jsonb not null default '{}'::jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  verification_state text not null default 'unverified' check (verification_state in ('verified','user_asserted','unverified','conflicted','retracted')),
  confidence numeric(4,3) not null default .5 check (confidence between 0 and 1),
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, program_entity_id, version_no),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);

create table cm_core.opportunities (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  program_entity_id uuid references cm_core.entities(id),
  contact_person_entity_id uuid references cm_core.entities(id),
  counterparty_org_entity_id uuid references cm_core.entities(id),
  owner_org_entity_id uuid references cm_core.entities(id),
  title text not null,
  stage text not null,
  expected_amount numeric(14,2),
  probability numeric(5,2) check (probability between 0 and 100),
  next_action text,
  next_action_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_core.referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  program_entity_id uuid not null references cm_core.entities(id),
  opportunity_id uuid references cm_core.opportunities(id),
  referred_person_entity_id uuid references cm_core.entities(id),
  referred_org_entity_id uuid references cm_core.entities(id),
  introducer_person_entity_id uuid references cm_core.entities(id),
  recipient_person_entity_id uuid references cm_core.entities(id),
  recipient_org_entity_id uuid references cm_core.entities(id),
  canonical_status text not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_core.referral_status_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  referral_id uuid not null references cm_core.referrals(id),
  status text not null,
  occurred_at timestamptz,
  recorded_at timestamptz not null default now(),
  source_record_id uuid references cm_memory.source_records(id),
  evidence_level text not null check (evidence_level in ('verified','recorded','user_asserted','ai_inferred','unverified')),
  confidence numeric(4,3) not null default .5 check (confidence between 0 and 1),
  note text,
  actor_type text not null default 'system',
  actor_id text
);
create index referral_status_events_latest_idx on cm_core.referral_status_events(referral_id, recorded_at desc);

create table cm_core.relationships (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  from_entity_id uuid not null references cm_core.entities(id),
  to_entity_id uuid not null references cm_core.entities(id),
  relationship_type text not null,
  valid_from timestamptz,
  valid_to timestamptz,
  source_record_id uuid references cm_memory.source_records(id),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_entity_id <> to_entity_id)
);

create table cm_core.meetings (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  title text not null,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  status text not null default 'scheduled',
  meeting_url text,
  recording_url text,
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_core.meeting_attendees (
  workspace_id uuid not null references cm_core.workspaces(id),
  meeting_id uuid not null references cm_core.meetings(id),
  entity_id uuid not null references cm_core.entities(id),
  attendance_status text,
  primary key (meeting_id, entity_id)
);

create table cm_core.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  title text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  due_at timestamptz,
  owner_entity_id uuid references cm_core.entities(id),
  subject_entity_id uuid references cm_core.entities(id),
  referral_id uuid references cm_core.referrals(id),
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_core.task_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  task_id uuid not null references cm_core.tasks(id),
  status text not null,
  note text,
  occurred_at timestamptz not null default now(),
  source_record_id uuid references cm_memory.source_records(id),
  actor_type text not null default 'system',
  actor_id text
);

create table cm_core.projects (
  entity_id uuid primary key references cm_core.entities(id),
  workspace_id uuid not null references cm_core.workspaces(id),
  owner_org_entity_id uuid references cm_core.entities(id),
  status text not null,
  repository_url text,
  dashboard_url text,
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table cm_core.templates (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  name text not null,
  template_type text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_core.template_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  template_id uuid not null references cm_core.templates(id),
  version_no integer not null,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);

create table cm_core.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  issuer_org_entity_id uuid references cm_core.entities(id),
  customer_org_entity_id uuid references cm_core.entities(id),
  status text not null,
  issued_at date,
  due_at date,
  total_amount numeric(14,2) not null default 0,
  currency text not null default 'JPY',
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_core.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  invoice_id uuid references cm_core.invoices(id),
  amount numeric(14,2) not null,
  currency text not null default 'JPY',
  paid_at timestamptz,
  verification_state text not null default 'unverified',
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, public_id)
);

create table cm_memory.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  public_id text not null,
  document_type text not null,
  title text not null,
  canonical_uri text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, public_id)
);

create table cm_memory.document_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  document_id uuid not null references cm_memory.documents(id),
  version_no integer not null,
  body text,
  body_hash text,
  source_record_id uuid references cm_memory.source_records(id),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create table cm_memory.document_entity_links (
  workspace_id uuid not null references cm_core.workspaces(id),
  document_id uuid not null references cm_memory.documents(id),
  entity_id uuid not null references cm_core.entities(id),
  relationship text not null default 'mentions',
  created_at timestamptz not null default now(),
  primary key (document_id, entity_id, relationship)
);

create table cm_memory.facts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  subject_entity_id uuid not null references cm_core.entities(id),
  predicate text not null,
  scope_key text not null default '',
  created_at timestamptz not null default now(),
  unique (workspace_id, subject_entity_id, predicate, scope_key)
);

create table cm_memory.fact_assertions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  fact_id uuid not null references cm_memory.facts(id),
  value_jsonb jsonb,
  object_entity_id uuid references cm_core.entities(id),
  valid_from timestamptz,
  valid_to timestamptz,
  recorded_at timestamptz not null default now(),
  source_updated_at timestamptz,
  confidence numeric(4,3) not null default .5 check (confidence between 0 and 1),
  verification_state text not null check (verification_state in ('verified','user_asserted','unverified','conflicted','retracted')),
  extraction_method text not null,
  extractor_version text,
  supersedes_assertion_id uuid references cm_memory.fact_assertions(id),
  check ((value_jsonb is not null) <> (object_entity_id is not null)),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);

create table cm_memory.assertion_sources (
  workspace_id uuid not null references cm_core.workspaces(id),
  assertion_id uuid not null references cm_memory.fact_assertions(id),
  source_record_id uuid not null references cm_memory.source_records(id),
  locator jsonb not null default '{}'::jsonb,
  primary key (assertion_id, source_record_id)
);

create table cm_memory.fact_resolution_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  fact_id uuid not null references cm_memory.facts(id),
  selected_assertion_id uuid references cm_memory.fact_assertions(id),
  decision text not null check (decision in ('selected','unresolved','rejected','retracted')),
  policy_version text not null,
  reason text not null,
  actor_type text not null,
  actor_id text,
  decided_at timestamptz not null default now()
);

create table cm_memory.source_precedence_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  predicate_pattern text not null,
  source_system_id uuid references cm_memory.source_systems(id),
  precedence integer not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  reason text not null,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table cm_memory.search_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  entity_id uuid references cm_core.entities(id),
  document_version_id uuid references cm_memory.document_versions(id),
  record_type text not null,
  title text not null,
  search_text text not null,
  source_record_id uuid references cm_memory.source_records(id),
  source_updated_at timestamptz,
  refreshed_at timestamptz not null default now()
);
create index search_documents_pgroonga_idx on cm_memory.search_documents using pgroonga(search_text);
create index search_documents_trgm_idx on cm_memory.search_documents using gin(search_text extensions.gin_trgm_ops);

create table cm_audit.change_sets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  actor_type text not null,
  actor_id text,
  model_name text,
  prompt_hash text,
  tool_call_id text,
  trace_id text,
  reason text not null,
  git_commit_sha text,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','failed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table cm_audit.change_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  change_set_id uuid not null references cm_audit.change_sets(id),
  operation_no integer not null,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('insert','update','soft_delete','merge','resolve')),
  before_json jsonb,
  after_json jsonb,
  source_record_id uuid references cm_memory.source_records(id),
  created_at timestamptz not null default now(),
  unique (change_set_id, operation_no)
);

create table cm_audit.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid,
  table_schema text not null,
  table_name text not null,
  row_pk text,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  actor_type text not null,
  actor_id text,
  trace_id text,
  occurred_at timestamptz not null default now()
);
create index audit_events_lookup_idx on cm_audit.audit_events(workspace_id, table_name, row_pk, occurred_at desc);

create table cm_ops.sync_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  source_system_id uuid references cm_memory.source_systems(id),
  run_type text not null,
  status text not null check (status in ('running','succeeded','partial','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  seen_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text
);

create table cm_ops.sync_cursors (
  workspace_id uuid not null references cm_core.workspaces(id),
  source_system_id uuid not null references cm_memory.source_systems(id),
  cursor_key text not null,
  cursor_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, source_system_id, cursor_key)
);

create table cm_ops.inbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  source_system_id uuid not null references cm_memory.source_systems(id),
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  content_hash text,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed','dead_letter')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source_system_id, external_event_id)
);

create table cm_ops.outbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  destination text not null,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','dead_letter')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  origin_change_id uuid references cm_audit.change_sets(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (destination, idempotency_key)
);
create index outbox_ready_idx on cm_ops.outbox_events(status, next_attempt_at) where status in ('pending','failed');

create table cm_ops.dead_letter_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references cm_core.workspaces(id),
  original_table text not null,
  original_event_id uuid not null,
  payload jsonb not null,
  error text not null,
  attempt_count integer not null,
  failed_at timestamptz not null default now(),
  replayed_at timestamptz,
  replayed_by text
);

create or replace function cm_audit.prevent_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception '% is append-only; add a superseding event instead', tg_table_name;
end;
$$;

create or replace function cm_audit.capture_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cm_audit
as $$
declare
  old_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_j jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  w_id uuid;
  pk text;
  jwt_sub text := nullif(current_setting('request.jwt.claim.sub', true), '');
begin
  w_id := coalesce((new_j->>'workspace_id')::uuid, (old_j->>'workspace_id')::uuid);
  pk := coalesce(new_j->>'id', new_j->>'entity_id', old_j->>'id', old_j->>'entity_id');
  insert into cm_audit.audit_events(
    workspace_id, table_schema, table_name, row_pk, action,
    before_json, after_json, actor_type, actor_id, trace_id
  ) values (
    w_id, tg_table_schema, tg_table_name, pk, lower(tg_op),
    old_j, new_j,
    case when jwt_sub is null then 'system' else 'authenticated_user' end,
    jwt_sub,
    nullif(current_setting('request.header.x-trace-id', true), '')
  );
  return coalesce(new, old);
end;
$$;
revoke all on function cm_audit.capture_change() from public;

do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname in ('cm_core','cm_memory','cm_ops')
  loop
    execute format(
      'create trigger %I after insert or update or delete on %I.%I for each row execute function cm_audit.capture_change()',
      'audit_' || r.table_name, r.schema_name, r.table_name
    );
  end loop;
end $$;

create trigger immutable_referral_status_events
  before update or delete on cm_core.referral_status_events
  for each row execute function cm_audit.prevent_mutation();
create trigger immutable_task_events
  before update or delete on cm_core.task_events
  for each row execute function cm_audit.prevent_mutation();
create trigger immutable_fact_assertions
  before update or delete on cm_memory.fact_assertions
  for each row execute function cm_audit.prevent_mutation();
create trigger immutable_fact_resolution_events
  before update or delete on cm_memory.fact_resolution_events
  for each row execute function cm_audit.prevent_mutation();

create or replace function public.cm_memory_search(p_query text, p_limit integer default 20)
returns table (
  result_type text,
  public_id text,
  canonical_name text,
  matched_text text,
  score numeric,
  source_record_id uuid,
  source_updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, cm_core, cm_memory, extensions
as $$
  with permitted_workspaces as (
    select workspace_id
    from cm_core.workspace_members
    where user_id = auth.uid() and revoked_at is null
  ), entity_hits as (
    select
      e.kind as result_type,
      e.public_id,
      e.canonical_name,
      e.canonical_name as matched_text,
      greatest(similarity(e.normalized_name, cm_core.normalize_label(p_query)),
               case when e.normalized_name = cm_core.normalize_label(p_query) then 1 else 0 end)::numeric as score,
      null::uuid as source_record_id,
      e.updated_at as source_updated_at
    from cm_core.entities e
    where e.workspace_id in (select workspace_id from permitted_workspaces)
      and e.deleted_at is null
      and (e.normalized_name % cm_core.normalize_label(p_query)
           or e.normalized_name like '%' || cm_core.normalize_label(p_query) || '%')
  ), alias_hits as (
    select
      e.kind,
      e.public_id,
      e.canonical_name,
      a.alias,
      greatest(similarity(a.normalized_alias, cm_core.normalize_label(p_query)),
               case when a.normalized_alias = cm_core.normalize_label(p_query) then 1 else 0 end)::numeric,
      a.source_record_id,
      e.updated_at
    from cm_core.entity_aliases a
    join cm_core.entities e on e.id = a.entity_id
    where a.workspace_id in (select workspace_id from permitted_workspaces)
      and a.deleted_at is null and e.deleted_at is null
      and (a.normalized_alias % cm_core.normalize_label(p_query)
           or a.normalized_alias like '%' || cm_core.normalize_label(p_query) || '%')
  ), document_hits as (
    select
      sd.record_type,
      coalesce(e.public_id, 'doc_' || sd.id::text),
      coalesce(e.canonical_name, sd.title),
      sd.title,
      0.75::numeric,
      sd.source_record_id,
      sd.source_updated_at
    from cm_memory.search_documents sd
    left join cm_core.entities e on e.id = sd.entity_id
    where sd.workspace_id in (select workspace_id from permitted_workspaces)
      and (sd.search_text &@~ p_query or sd.search_text ilike '%' || p_query || '%')
  )
  select * from (
    select * from entity_hits
    union all select * from alias_hits
    union all select * from document_hits
  ) hits
  order by score desc, canonical_name
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.cm_person_brief(p_name text, p_as_of timestamptz default now())
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, cm_core, cm_memory, extensions
as $$
declare
  person_ids uuid[];
  person_id uuid;
  result jsonb;
begin
  select array_agg(distinct e.id order by e.id)
  into person_ids
  from cm_core.entities e
  left join cm_core.entity_aliases a on a.entity_id = e.id and a.deleted_at is null
  where e.kind = 'person' and e.deleted_at is null
    and e.workspace_id in (
      select workspace_id from cm_core.workspace_members
      where user_id = auth.uid() and revoked_at is null
    )
    and (
      e.normalized_name = cm_core.normalize_label(p_name)
      or a.normalized_alias = cm_core.normalize_label(p_name)
      or e.normalized_name like '%' || cm_core.normalize_label(p_name) || '%'
      or a.normalized_alias like '%' || cm_core.normalize_label(p_name) || '%'
    );

  if person_ids is null then
    return jsonb_build_object('status','not_found','query',p_name);
  end if;
  if cardinality(person_ids) > 1 then
    return jsonb_build_object(
      'status','ambiguous','query',p_name,
      'candidates',(
        select jsonb_agg(jsonb_build_object('public_id',public_id,'name',canonical_name))
        from cm_core.entities where id = any(person_ids)
      )
    );
  end if;
  person_id := person_ids[1];

  select jsonb_build_object(
    'status','ok',
    'as_of',p_as_of,
    'resolved_entity',jsonb_build_object(
      'public_id',e.public_id,
      'canonical_name',e.canonical_name,
      'aliases',coalesce((
        select jsonb_agg(a.alias order by a.alias)
        from cm_core.entity_aliases a where a.entity_id=e.id and a.deleted_at is null
      ),'[]'::jsonb),
      'organization',o.legal_name,
      'title',p.title,
      'profile_summary',p.profile_summary
    ),
    'referrals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_id',r.public_id,
        'program',pe.canonical_name,
        'status',coalesce(se.status,r.canonical_status),
        'status_recorded_at',se.recorded_at,
        'evidence_level',se.evidence_level,
        'confidence',se.confidence,
        'note',se.note,
        'source_record_id',se.source_record_id
      ) order by coalesce(se.recorded_at,r.updated_at) desc)
      from cm_core.referrals r
      join cm_core.entities pe on pe.id=r.program_entity_id
      left join lateral (
        select * from cm_core.referral_status_events x
        where x.referral_id=r.id and x.recorded_at <= p_as_of
        order by x.recorded_at desc limit 1
      ) se on true
      where r.referred_person_entity_id=e.id and r.deleted_at is null
    ),'[]'::jsonb),
    'meetings',coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_id',m.public_id,'title',m.title,'start_at',m.scheduled_start_at,
        'end_at',m.scheduled_end_at,'status',m.status,'recording_url',m.recording_url,
        'source_record_id',m.source_record_id
      ) order by m.scheduled_start_at desc nulls last)
      from cm_core.meetings m
      join cm_core.meeting_attendees ma on ma.meeting_id=m.id
      where ma.entity_id=e.id and m.deleted_at is null
    ),'[]'::jsonb),
    'next_actions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_id',t.public_id,'title',t.title,'status',t.status,'priority',t.priority,
        'due_at',t.due_at,'source_record_id',t.source_record_id
      ) order by t.due_at nulls last, t.created_at desc)
      from cm_core.tasks t
      where t.subject_entity_id=e.id and t.deleted_at is null and t.status not in ('done','cancelled')
    ),'[]'::jsonb),
    'facts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'predicate',f.predicate,'scope_key',f.scope_key,'value',fa.value_jsonb,
        'verification_state',fa.verification_state,'confidence',fa.confidence,
        'valid_from',fa.valid_from,'valid_to',fa.valid_to,'recorded_at',fa.recorded_at,
        'source_records',coalesce((select jsonb_agg(asrc.source_record_id) from cm_memory.assertion_sources asrc where asrc.assertion_id=fa.id),'[]'::jsonb)
      ) order by fa.recorded_at desc)
      from cm_memory.facts f
      join lateral (
        select a.* from cm_memory.fact_assertions a
        left join lateral (
          select re.* from cm_memory.fact_resolution_events re
          where re.fact_id=f.id and re.decided_at <= p_as_of
          order by re.decided_at desc limit 1
        ) rr on true
        where a.fact_id=f.id
          and a.recorded_at <= p_as_of
          and (a.valid_from is null or a.valid_from <= p_as_of)
          and (a.valid_to is null or a.valid_to > p_as_of)
          and (rr.id is null or rr.selected_assertion_id=a.id)
        order by a.recorded_at desc limit 1
      ) fa on true
      where f.subject_entity_id=e.id
    ),'[]'::jsonb),
    'conflicts',coalesce((
      select jsonb_agg(jsonb_build_object('predicate',f.predicate,'scope_key',f.scope_key,'assertion_count',c.cnt))
      from cm_memory.facts f
      join lateral (
        select count(distinct value_jsonb)::int cnt
        from cm_memory.fact_assertions a
        where a.fact_id=f.id and a.verification_state <> 'retracted'
          and a.recorded_at <= p_as_of
          and (a.valid_from is null or a.valid_from <= p_as_of)
          and (a.valid_to is null or a.valid_to > p_as_of)
      ) c on c.cnt > 1
      where f.subject_entity_id=e.id
        and not exists (
          select 1 from cm_memory.fact_resolution_events re
          where re.fact_id=f.id and re.decision='selected' and re.decided_at <= p_as_of
        )
    ),'[]'::jsonb)
  ) into result
  from cm_core.entities e
  join cm_core.people p on p.entity_id=e.id
  left join cm_core.organizations o on o.entity_id=p.primary_org_entity_id
  where e.id=person_id;
  return result;
end;
$$;

revoke all on function public.cm_memory_search(text, integer) from public, anon;
revoke all on function public.cm_person_brief(text, timestamptz) from public, anon;
grant execute on function public.cm_memory_search(text, integer) to authenticated, service_role;
grant execute on function public.cm_person_brief(text, timestamptz) to authenticated, service_role;

grant usage on schema cm_core, cm_memory to authenticated, service_role;
grant select on all tables in schema cm_core, cm_memory to authenticated, service_role;

do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('cm_core','cm_memory','cm_ops','cm_audit')
  loop
    execute format('alter table %I.%I enable row level security',r.schema_name,r.table_name);
  end loop;
end $$;

create policy workspace_members_self_read on cm_core.workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()) and revoked_at is null);

do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='workspace_id' and not a.attisdropped
    where c.relkind='r'
      and n.nspname in ('cm_core','cm_memory')
      and c.relname <> 'workspace_members'
  loop
    execute format(
      'create policy %I on %I.%I for select to authenticated using (workspace_id in (select workspace_id from cm_core.workspace_members where user_id=(select auth.uid()) and revoked_at is null))',
      'member_read_' || r.table_name, r.schema_name, r.table_name
    );
  end loop;
end $$;

comment on schema cm_core is 'Canonical entities and business records for Music Japan / Standment';
comment on schema cm_memory is 'Bitemporal facts, provenance, documents, and search projection';
comment on schema cm_ops is 'Idempotent sync inbox/outbox, cursors, and retry/dead-letter queues';
comment on schema cm_audit is 'Append-oriented AI/human change and row-level audit history';
