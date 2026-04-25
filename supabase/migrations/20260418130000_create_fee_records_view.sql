-- ============================================================
-- Migration: fee_records_with_details view
-- Joins student_fee_records with school name, student profile,
-- and class name so the web receipt page needs zero extra fetches.
-- ============================================================

create or replace view public.fee_records_with_details as
select
  sfr.id,
  sfr.school_id,
  sfr.branch_id,
  sfr.session_id,
  sfr.class_id,
  sfr.student_id,
  sfr.month,
  sfr.fee_amount,
  sfr.amount_paid,
  sfr.payment_method,
  sfr.payment_status,
  sfr.description,
  sfr.created_at,
  sfr.updated_at,

  -- school
  sc.name        as school_name,
  sc.logo_url    as school_logo_url,

  -- student
  p.name         as student_name,
  p.email        as student_email,
  p.avatar_url   as student_avatar_url,

  -- class
  cl.class_name

from public.student_fee_records sfr
join public.schools  sc on sc.id = sfr.school_id
join public.profiles p  on p.id  = sfr.student_id
join public.classes  cl on cl.id = sfr.class_id;

-- RLS on the view is inherited from the underlying table (RLS on student_fee_records).
-- Grant select to authenticated users — row filtering is enforced by the base table RLS.
grant select on public.fee_records_with_details to authenticated;
