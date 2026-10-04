-- Optional product measurements and piece-specific wood notes.
-- Run once in the Supabase SQL Editor after the base products table exists.
-- This migration contains DDL only: no tests or rollback statements.

alter table public.products
  add column if not exists length_cm numeric,
  add column if not exists width_cm numeric,
  add column if not exists thickness_cm numeric,
  add column if not exists weight_g integer,
  add column if not exists grain_note_it text,
  add column if not exists grain_note_en text,
  add column if not exists tree_age_note_it text,
  add column if not exists tree_age_note_en text;