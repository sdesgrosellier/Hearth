-- Seed the personas table from the bundled configs so admins can browse/edit them.
-- The Edge Functions read the JSON files directly; this table is a mirror.
-- Run: supabase db reset (applies migrations then this file) or psql -f seed.sql

insert into public.personas (id, config, version, active) values
  ('mom',      '{"display_name":"Mom","short_label":"Mom","accent":"#C96F5A","emoji":"👩"}'::jsonb, 1, true),
  ('dad',      '{"display_name":"Dad","short_label":"Dad","accent":"#3F6E8C","emoji":"👨"}'::jsonb, 1, true),
  ('grandma',  '{"display_name":"Grandma","short_label":"Grandma","accent":"#8E6BAE","emoji":"👵"}'::jsonb, 1, true),
  ('grandpa',  '{"display_name":"Grandpa","short_label":"Grandpa","accent":"#6B7F5E","emoji":"👴"}'::jsonb, 1, true),
  ('stranger', '{"display_name":"Random Stranger","short_label":"Stranger","accent":"#D9A441","emoji":"🧍"}'::jsonb, 1, true),
  ('biblical', '{"display_name":"Biblical Counsel","short_label":"Scripture","accent":"#7A5C3E","emoji":"✝️"}'::jsonb, 1, true)
on conflict (id) do update set config = excluded.config, version = excluded.version, active = excluded.active, updated_at = now();
