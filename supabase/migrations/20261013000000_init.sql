-- Sounding Board (formerly Hearth) — initial schema (Phase 1). Implements the Section 13 data model with
-- Row-Level Security so a user can only ever touch their own rows.
--
-- Conventions
--   * Server-owned tables (sessions, messages, panel_requests, usage, safety_events)
--     are written by Edge Functions using the service role. Clients get SELECT (and
--     for sessions/feedback a few safe writes) through RLS.
--   * Embedding columns are vector(1536). If Phase 3 picks an embedding model with a
--     different dimension, alter them in that phase's migration before any data exists.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.session_mode as enum ('text', 'voice', 'panel');
create type public.message_role as enum ('user', 'advisor', 'system');
create type public.safety_flag as enum ('none', 'elevated', 'crisis');
create type public.memory_category as enum (
  'people', 'ongoing_situations', 'goals_and_values', 'preferences', 'upcoming_events', 'outcomes'
);
create type public.memory_status as enum ('open', 'resolved', 'archived');
create type public.followup_status as enum ('pending', 'asked', 'done', 'dismissed');
create type public.feedback_rating as enum ('up', 'down');

-- ---------------------------------------------------------------------------
-- profiles  (Section 13 "users")
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  preferred_address text,
  locale text not null default 'en-US',
  timezone text not null default 'America/Los_Angeles',
  settings jsonb not null default jsonb_build_object(
    'endearments', true,
    'memory_enabled', true,
    'cross_advisor_awareness', true,
    'familiar_stranger', false,
    'salty_stranger', false,
    'show_biblical', true,
    'bible_translation', 'WEB',
    'offer_prayer', false,
    'grandparent', 'grandma',
    'voice_enabled', true,
    'speech_rate', 1.0
  ),
  onboarding_completed_at timestamptz,
  age_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- personas  (mirror of the bundled JSON for admin/editing; functions read JSON)
-- ---------------------------------------------------------------------------
create table public.personas (
  id text primary key,
  config jsonb not null,
  version int not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode public.session_mode not null,
  advisor_ids text[] not null default '{}',
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  off_record boolean not null default false,
  summary text,
  summary_embedding vector(1536),
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz
);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.message_role not null,
  advisor_id text,
  content text not null,
  display_content text,
  headline text,
  tone text,
  scripture_refs jsonb not null default '[]'::jsonb,
  safety_flag public.safety_flag not null default 'none',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_session_created_idx on public.messages (session_id, created_at);
create index messages_user_created_idx on public.messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- panel_requests  (Phase 2)
-- ---------------------------------------------------------------------------
create table public.panel_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  question text not null,
  advisor_ids text[] not null,
  synthesis text,
  safety_flag public.safety_flag not null default 'none',
  created_at timestamptz not null default now()
);
create index panel_requests_user_idx on public.panel_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- memory_facts  (Phase 3)
-- ---------------------------------------------------------------------------
create table public.memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.memory_category not null,
  content text not null,
  source_session_id uuid references public.sessions (id) on delete set null,
  stated_by_user boolean not null default true,
  confidence real not null default 1.0 check (confidence >= 0 and confidence <= 1),
  status public.memory_status not null default 'open',
  event_date date,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index memory_facts_user_idx on public.memory_facts (user_id, category) where deleted_at is null;

create trigger memory_facts_set_updated_at
  before update on public.memory_facts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- followups  (Phase 3)
-- ---------------------------------------------------------------------------
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fact_id uuid references public.memory_facts (id) on delete cascade,
  due_at timestamptz not null,
  status public.followup_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index followups_user_due_idx on public.followups (user_id, due_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  rating public.feedback_rating not null,
  reason text,
  reported boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);

-- ---------------------------------------------------------------------------
-- safety_events  (category + timestamp only; never content)
-- ---------------------------------------------------------------------------
create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  created_at timestamptz not null default now()
);
create index safety_events_created_idx on public.safety_events (created_at desc);

-- ---------------------------------------------------------------------------
-- usage  (per user per month)
-- ---------------------------------------------------------------------------
create table public.usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  period date not null,                      -- first day of month (UTC)
  llm_input_tokens bigint not null default 0,
  llm_output_tokens bigint not null default 0,
  tts_chars bigint not null default 0,
  stt_seconds bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create or replace function public.increment_usage(
  p_user_id uuid,
  p_llm_input bigint default 0,
  p_llm_output bigint default 0,
  p_tts_chars bigint default 0,
  p_stt_seconds bigint default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage (user_id, period, llm_input_tokens, llm_output_tokens, tts_chars, stt_seconds)
  values (p_user_id, date_trunc('month', now() at time zone 'utc')::date,
          p_llm_input, p_llm_output, p_tts_chars, p_stt_seconds)
  on conflict (user_id, period) do update set
    llm_input_tokens  = public.usage.llm_input_tokens  + excluded.llm_input_tokens,
    llm_output_tokens = public.usage.llm_output_tokens + excluded.llm_output_tokens,
    tts_chars         = public.usage.tts_chars         + excluded.tts_chars,
    stt_seconds       = public.usage.stt_seconds       + excluded.stt_seconds,
    updated_at        = now();
end $$;

-- Only the service role (Edge Functions) may call this.
revoke execute on function public.increment_usage(uuid, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, bigint, bigint, bigint, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- bible_verses  (Phase 5 loads WEB/KJV; schema reserved now)
-- ---------------------------------------------------------------------------
create table public.bible_verses (
  translation text not null,
  book text not null,
  book_order smallint not null,
  chapter smallint not null,
  verse smallint not null,
  text text not null,
  primary key (translation, book, chapter, verse)
);
create index bible_verses_lookup_idx on public.bible_verses (translation, book_order, chapter, verse);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.personas       enable row level security;
alter table public.sessions       enable row level security;
alter table public.messages       enable row level security;
alter table public.panel_requests enable row level security;
alter table public.memory_facts   enable row level security;
alter table public.followups      enable row level security;
alter table public.feedback       enable row level security;
alter table public.safety_events  enable row level security;
alter table public.usage          enable row level security;
alter table public.bible_verses   enable row level security;

-- profiles: owner can read and update their own row (not change its id).
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- personas / bible_verses: read-only reference data for signed-in users.
create policy "personas: read active" on public.personas
  for select to authenticated using (active);
create policy "bible_verses: read" on public.bible_verses
  for select to authenticated using (true);

-- sessions: owner may read, rename, end, or delete their own sessions.
create policy "sessions: read own" on public.sessions
  for select to authenticated using (user_id = auth.uid());
create policy "sessions: update own" on public.sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sessions: delete own" on public.sessions
  for delete to authenticated using (user_id = auth.uid());

-- messages: owner reads; writes come from Edge Functions (service role).
create policy "messages: read own" on public.messages
  for select to authenticated using (user_id = auth.uid());
create policy "messages: delete own" on public.messages
  for delete to authenticated using (user_id = auth.uid());

-- panel_requests: owner reads.
create policy "panel_requests: read own" on public.panel_requests
  for select to authenticated using (user_id = auth.uid());

-- memory_facts: owner has full control ("My Story" screen).
create policy "memory_facts: read own" on public.memory_facts
  for select to authenticated using (user_id = auth.uid());
create policy "memory_facts: update own" on public.memory_facts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "memory_facts: delete own" on public.memory_facts
  for delete to authenticated using (user_id = auth.uid());

-- followups: owner reads and can dismiss.
create policy "followups: read own" on public.followups
  for select to authenticated using (user_id = auth.uid());
create policy "followups: update own" on public.followups
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- feedback: owner can rate/report their own messages.
create policy "feedback: read own" on public.feedback
  for select to authenticated using (user_id = auth.uid());
create policy "feedback: insert own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy "feedback: update own" on public.feedback
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- usage: owner may read their own meter.
create policy "usage: read own" on public.usage
  for select to authenticated using (user_id = auth.uid());

-- safety_events: no client access at all (service role only).

-- ---------------------------------------------------------------------------
-- Account deletion (required by app stores). Deletes the auth user; cascades
-- remove every row above. Called by the client as the signed-in user.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
