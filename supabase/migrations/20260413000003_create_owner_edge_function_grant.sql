-- Migration: document permissions required by the create-owner Edge Function
-- The function uses service_role key (bypasses RLS) — no additional grants needed.
-- This file documents the intent: only admin role may invoke create-owner.
-- Enforced in function code by checking profiles.role = 'admin'.

-- No SQL changes required — service_role has full access by default.
-- Deploy the function with: supabase functions deploy create-owner
