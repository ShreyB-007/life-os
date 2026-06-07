-- ============================================================
-- Life OS — Supabase database setup
-- Run this in the Supabase SQL editor
-- ============================================================

-- habits table
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  icon text not null,
  color text not null,
  config jsonb default '{}',
  rest_days int[] default '{}',
  min_done_for_complete int default 1,
  sort_order int default 0
);

-- habit_logs table
create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_key text not null,
  log_date date not null,
  done boolean default false,
  is_rest_day boolean default false,
  payload jsonb default '{}',
  logged_at timestamptz default now(),
  unique(habit_key, log_date)
);

-- goals table
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color text not null,
  progress_pct int default 0 check (progress_pct >= 0 and progress_pct <= 100),
  target_date date,
  label text,
  status text default 'active',
  sort_order int default 0
);

-- ============================================================
-- Seed habits
-- ============================================================

insert into habits (key, name, icon, color, config, rest_days, min_done_for_complete, sort_order)
values
  (
    'gym',
    'Gym',
    'barbell',
    '#f59e0b',
    '{
      "workout_types": [
        {"key": "Push", "subtitle": "Chest · Sho · Tri"},
        {"key": "Pull", "subtitle": "Back · Biceps"},
        {"key": "Legs", "subtitle": "Legs · Abs"},
        {"key": "Cardio", "subtitle": "Endurance"}
      ]
    }',
    '{0}',
    1,
    1
  ),
  (
    'japanese',
    'Japanese',
    'language',
    '#3b82f6',
    '{
      "subtasks": [
        {"key": "anki", "label": "Anki"},
        {"key": "duolingo", "label": "Duolingo"},
        {"key": "study", "label": "Study session"}
      ]
    }',
    '{}',
    2,
    2
  ),
  (
    'dsa',
    'DSA',
    'code',
    '#a855f7',
    '{
      "difficulties": ["easy", "med", "hard"]
    }',
    '{}',
    1,
    3
  )
on conflict (key) do nothing;

-- ============================================================
-- Seed goals
-- Dates are relative to 2026-06-07
-- IIL: 7 weeks out = 2026-07-26
-- Internship: 5 months out = 2026-11-07
-- Masters research: no target date
-- Research paper: 2026-11-30
-- ============================================================

insert into goals (name, icon, color, progress_pct, target_date, label, status, sort_order)
values
  ('IIL startup',       'rocket',            '#993C1D', 8,  '2026-07-26', '7 wks',      'active', 1),
  ('Internship',        'building-factory',  '#185FA5', 16, '2026-11-07', 'month 1/6',  'active', 2),
  ('Masters research',  'school',            '#3B6D11', 2,  null,         'starting',   'active', 3),
  ('Research paper',    'file-text',         '#854F0B', 5,  '2026-11-30', 'Nov 30',     'active', 4)
on conflict do nothing;
