-- Fix class_diary: principal coordinator all policy.
-- Coordinators were previously allowed to access class_diary rows from ANY
-- branch in their school. This tightens it so coordinators are limited to
-- their own branch, while principals retain school-wide access.
-- Also replaces bare auth.uid() with (select auth.uid()) for initplan fix.

DROP POLICY IF EXISTS "class_diary: principal coordinator all" ON public.class_diary;
CREATE POLICY "class_diary: principal coordinator all" ON public.class_diary
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = ANY(ARRAY['principal','coordinator'])
        AND school_id = class_diary.school_id
        AND (
          role = 'principal'
          OR branch_id = class_diary.branch_id
        )
    )
  );
