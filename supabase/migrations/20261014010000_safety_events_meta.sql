-- Phase 6: keep the independent screen's verdict next to the advisor's own flag.
alter table public.safety_events add column if not exists meta jsonb not null default '{}'::jsonb;
