-- Sounding Board — Phase 3 (memory) + beta guardrails.
--
-- * Embeddings come from the Supabase Edge Runtime's built-in gte-small model
--   (384 dimensions, no external account), so the vector columns shrink from 1536.
-- * match_memory_facts(): cosine similarity search over a user's facts (service role).
-- * followups gain the question text, the advisor who should ask it, and asked_at.
-- * invite_codes + a sign-up trigger that refuses accounts without a valid code
--   (only enforced while at least one active code exists).

-- ---------------------------------------------------------------------------
-- Embedding dimensions
-- ---------------------------------------------------------------------------
alter table public.memory_facts alter column embedding type vector(384) using null;
alter table public.sessions     alter column summary_embedding type vector(384) using null;

-- ---------------------------------------------------------------------------
-- Follow-ups: what to ask, who asks it
-- ---------------------------------------------------------------------------
alter table public.followups
  add column if not exists question text,
  add column if not exists advisor_id text,
  add column if not exists source_session_id uuid references public.sessions (id) on delete set null,
  add column if not exists asked_at timestamptz;

-- ---------------------------------------------------------------------------
-- Semantic search over a user's facts (called with the service role only)
-- ---------------------------------------------------------------------------
create or replace function public.match_memory_facts(
  p_user_id uuid,
  p_query vector(384),
  p_limit int default 8,
  p_min_similarity real default 0.25
) returns table (
  id uuid,
  category public.memory_category,
  content text,
  event_date date,
  status public.memory_status,
  created_at timestamptz,
  similarity real
)
language sql
stable
set search_path = public
as $$
  select f.id, f.category, f.content, f.event_date, f.status, f.created_at,
         (1 - (f.embedding <=> p_query))::real as similarity
  from public.memory_facts f
  where f.user_id = p_user_id
    and f.deleted_at is null
    and f.embedding is not null
    and (1 - (f.embedding <=> p_query)) >= p_min_similarity
  order by f.embedding <=> p_query
  limit p_limit;
$$;

revoke all on function public.match_memory_facts(uuid, vector, int, real) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Beta invite codes
-- ---------------------------------------------------------------------------
create table if not exists public.invite_codes (
  code text primary key,
  max_uses int not null default 25,
  uses int not null default 0,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
-- No policies on purpose: only the service role and the sign-up trigger touch this table.

-- Sign-up trigger: create the profile row and, while any active code exists,
-- require a valid invite code in the sign-up metadata (options.data.invite_code).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(new.raw_user_meta_data->>'invite_code', ''), '[^A-Za-z0-9]', '', 'g'));
  v_ok boolean := false;
begin
  if exists (select 1 from public.invite_codes where active) then
    update public.invite_codes
      set uses = uses + 1
      where code = v_code and active and uses < max_uses
      returning true into v_ok;
    if not coalesce(v_ok, false) then
      raise exception 'INVITE_CODE_INVALID' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

insert into public.invite_codes (code, max_uses, note)
values ('SOUNDING2026', 50, 'First beta code')
on conflict (code) do nothing;
