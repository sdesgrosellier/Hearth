-- Seed the personas table from the bundled configs so admins can browse/edit them.
-- The Edge Functions read the JSON files directly; this table is a mirror.
-- Run: supabase db reset (applies migrations then this file) or psql -f seed.sql

insert into public.personas (id, config, version, active) values
  ('mom',      '{"display_name":"Mom","short_label":"Mom","accent":"#C96F5A","emoji":"👩","category":"family"}'::jsonb, 2, true),
  ('dad',      '{"display_name":"Dad","short_label":"Dad","accent":"#3F6E8C","emoji":"👨","category":"family"}'::jsonb, 2, true),
  ('grandma',  '{"display_name":"Grandma","short_label":"Grandma","accent":"#8E6BAE","emoji":"👵","category":"family"}'::jsonb, 2, true),
  ('grandpa',  '{"display_name":"Grandpa","short_label":"Grandpa","accent":"#6B7F5E","emoji":"👴","category":"family"}'::jsonb, 2, true),
  ('stranger', '{"display_name":"Random Stranger","short_label":"Stranger","accent":"#D9A441","emoji":"🧍","category":"fresh"}'::jsonb, 2, true),
  ('biblical', '{"display_name":"Biblical Counsel","short_label":"Scripture","accent":"#7A5C3E","emoji":"✝️","category":"faith"}'::jsonb, 2, true),
  ('kid',        '{"display_name":"The Kid","short_label":"Kid","accent":"#E8873A","emoji":"🧒","category":"fresh"}'::jsonb, 2, true),
  ('alien',      '{"display_name":"The Visitor","short_label":"Alien","accent":"#4FA3A5","emoji":"👽","category":"fresh"}'::jsonb, 2, true),
  ('caesar',     '{"display_name":"Julius Caesar","short_label":"Caesar","accent":"#9A2F2F","emoji":"🏛️","category":"history","historical":true}'::jsonb, 2, true),
  ('napoleon',   '{"display_name":"Napoleon Bonaparte","short_label":"Napoleon","accent":"#1F3A93","emoji":"🎖️","category":"history","historical":true}'::jsonb, 2, true),
  ('washington', '{"display_name":"George Washington","short_label":"Washington","accent":"#2E4A62","emoji":"🦅","category":"history","historical":true}'::jsonb, 2, true),
  ('lincoln',    '{"display_name":"Abraham Lincoln","short_label":"Lincoln","accent":"#3B3B3B","emoji":"🎩","category":"history","historical":true}'::jsonb, 2, true),
  ('elder',      '{"display_name":"The Elder","short_label":"Elder","accent":"#5B3E8E","emoji":"🕊️","category":"history"}'::jsonb, 2, true)
on conflict (id) do update set config = excluded.config, version = excluded.version, active = excluded.active, updated_at = now();
