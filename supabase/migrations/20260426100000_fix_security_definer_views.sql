-- Migration: Fix SECURITY DEFINER views → SECURITY INVOKER
-- Issue #1: 11 views bypass RLS because they run as the view owner (postgres).
-- Fix: DROP and recreate each view with SECURITY INVOKER so RLS on the
--      underlying tables is evaluated against the querying user's JWT.
-- View definitions are unchanged — only the security mode is corrected.

-- ─── 1. teachers_with_class ────────────────────────────────────────────────
DROP VIEW IF EXISTS public.teachers_with_class;
CREATE VIEW public.teachers_with_class
  WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.role,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.branch_id,
  p.school_id,
  p.class_id,
  p.created_at,
  p.updated_at,
  c.class_name
FROM profiles p
LEFT JOIN classes c ON c.id = p.class_id
WHERE p.role = 'teacher';

-- ─── 2. classes_with_teacher ───────────────────────────────────────────────
DROP VIEW IF EXISTS public.classes_with_teacher;
CREATE VIEW public.classes_with_teacher
  WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.school_id,
  c.branch_id,
  c.session_id,
  c.class_name,
  c.teacher_id,
  p.name  AS teacher_name,
  p.avatar_url AS teacher_avatar,
  ch.id   AS chat_id,
  c.created_at,
  c.updated_at
FROM classes c
LEFT JOIN profiles p  ON p.id  = c.teacher_id
LEFT JOIN chats   ch  ON ch.class_id = c.id;

-- ─── 3. student_attendance_with_name ──────────────────────────────────────
DROP VIEW IF EXISTS public.student_attendance_with_name;
CREATE VIEW public.student_attendance_with_name
  WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.school_id,
  a.branch_id,
  a.session_id,
  a.class_id,
  a.person_id  AS student_id,
  a.date,
  a.status,
  a.marked_by,
  a.note,
  a.created_at,
  a.updated_at,
  p.name       AS student_name,
  p.avatar_url AS student_avatar,
  mb.name      AS marked_by_name
FROM attendance a
JOIN  profiles p  ON p.id  = a.person_id
LEFT JOIN profiles mb ON mb.id = a.marked_by
WHERE a.role = 'student';

-- ─── 4. teacher_attendance_with_name ──────────────────────────────────────
DROP VIEW IF EXISTS public.teacher_attendance_with_name;
CREATE VIEW public.teacher_attendance_with_name
  WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.school_id,
  a.branch_id,
  a.session_id,
  a.person_id  AS teacher_id,
  a.date,
  a.status,
  a.marked_by,
  a.note,
  a.created_at,
  a.updated_at,
  p.name       AS teacher_name,
  p.avatar_url AS teacher_avatar,
  mb.name      AS marked_by_name
FROM attendance a
JOIN  profiles p  ON p.id  = a.person_id
LEFT JOIN profiles mb ON mb.id = a.marked_by
WHERE a.role = 'teacher';

-- ─── 5. fee_records_with_details ──────────────────────────────────────────
DROP VIEW IF EXISTS public.fee_records_with_details;
CREATE VIEW public.fee_records_with_details
  WITH (security_invoker = true)
AS
SELECT
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
  sc.name         AS school_name,
  sc.logo_url     AS school_logo_url,
  p.name          AS student_name,
  p.email         AS student_email,
  p.avatar_url    AS student_avatar_url,
  cl.class_name
FROM student_fee_records sfr
JOIN schools  sc ON sc.id = sfr.school_id
JOIN profiles p  ON p.id  = sfr.student_id
JOIN classes  cl ON cl.id = sfr.class_id;

-- ─── 6. owners_with_school ────────────────────────────────────────────────
DROP VIEW IF EXISTS public.owners_with_school;
CREATE VIEW public.owners_with_school
  WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.created_at,
  p.school_id,
  s.name AS school_name
FROM profiles p
LEFT JOIN schools s ON s.id = p.school_id
WHERE p.role = 'owner';

-- ─── 7. schools_with_details ──────────────────────────────────────────────
DROP VIEW IF EXISTS public.schools_with_details;
CREATE VIEW public.schools_with_details
  WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.name,
  s.logo_url,
  s.school_address,
  s.school_contact,
  s.is_active,
  s.owner_id,
  s.created_at,
  s.updated_at,
  p.name         AS owner_name,
  p.email        AS owner_email,
  p.avatar_url   AS owner_avatar_url,
  CAST(COALESCE(SUM(b.branch_subscription_fee) FILTER (WHERE b.is_active = true), 0) AS numeric(10,2)) AS total_subscription_fee,
  COUNT(b.id)    FILTER (WHERE b.is_active = true) AS active_branch_count
FROM schools s
LEFT JOIN profiles p ON p.id  = s.owner_id
LEFT JOIN branches b ON b.school_id = s.id
GROUP BY s.id, p.id, p.name, p.email, p.avatar_url;

-- ─── 8. available_owners ──────────────────────────────────────────────────
DROP VIEW IF EXISTS public.available_owners;
CREATE VIEW public.available_owners
  WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  email,
  avatar_url
FROM profiles
WHERE role = 'owner'
  AND school_id IS NULL;

-- ─── 9. available_teachers ────────────────────────────────────────────────
DROP VIEW IF EXISTS public.available_teachers;
CREATE VIEW public.available_teachers
  WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  email,
  avatar_url,
  branch_id,
  school_id,
  class_id,
  is_active
FROM profiles p
WHERE role = 'teacher'
  AND is_active = true
  AND class_id IS NULL;

-- ─── 10. branches_with_off_days ───────────────────────────────────────────
DROP VIEW IF EXISTS public.branches_with_off_days;
CREATE VIEW public.branches_with_off_days
  WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.school_id,
  b.name,
  b.branch_address,
  b.branch_contact,
  b.branch_subscription_fee,
  b.is_active,
  b.created_at,
  b.updated_at,
  COALESCE(
    json_agg(od.day_of_week ORDER BY
      CASE od.day_of_week
        WHEN 'monday'    THEN 1
        WHEN 'tuesday'   THEN 2
        WHEN 'wednesday' THEN 3
        WHEN 'thursday'  THEN 4
        WHEN 'friday'    THEN 5
        WHEN 'saturday'  THEN 6
        WHEN 'sunday'    THEN 7
        ELSE NULL
      END
    ) FILTER (WHERE od.day_of_week IS NOT NULL),
    '[]'::json
  ) AS off_days
FROM branches b
LEFT JOIN branch_off_days od ON od.branch_id = b.id
GROUP BY b.id;

-- ─── 11. subscription_payments_with_school ────────────────────────────────
DROP VIEW IF EXISTS public.subscription_payments_with_school;
CREATE VIEW public.subscription_payments_with_school
  WITH (security_invoker = true)
AS
SELECT
  sp.id,
  sp.school_id,
  s.name          AS school_name,
  sp.payment_month,
  sp.fee,
  sp.amount_paid,
  sp.remaining_due,
  sp.payment_method,
  sp.payment_status,
  sp.payment_description,
  sp.created_at,
  sp.updated_at
FROM subscription_payments sp
JOIN schools s ON s.id = sp.school_id;

-- ─── Storage RLS policies — Issue #3 ──────────────────────────────────────
-- Note: bucket privacy (public → private) must be set via the Supabase
-- dashboard or management API — it cannot be changed via SQL alone.
-- The policies below enforce RLS on storage.objects for each bucket.

-- Drop any existing storage policies for these buckets first
DROP POLICY IF EXISTS "avatars: authenticated read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner upload"         ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner delete"         ON storage.objects;
DROP POLICY IF EXISTS "banners: authenticated read"   ON storage.objects;
DROP POLICY IF EXISTS "banners: admin upload"         ON storage.objects;
DROP POLICY IF EXISTS "banners: admin delete"         ON storage.objects;
DROP POLICY IF EXISTS "school-logos: authenticated read"  ON storage.objects;
DROP POLICY IF EXISTS "school-logos: admin owner upload"  ON storage.objects;
DROP POLICY IF EXISTS "school-logos: admin owner delete"  ON storage.objects;

-- avatars bucket
CREATE POLICY "avatars: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY "avatars: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- banners bucket
CREATE POLICY "banners: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'banners');

CREATE POLICY "banners: admin upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "banners: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- school-logos bucket
CREATE POLICY "school-logos: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'school-logos');

CREATE POLICY "school-logos: admin owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "school-logos: admin owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'owner')
    )
  );
