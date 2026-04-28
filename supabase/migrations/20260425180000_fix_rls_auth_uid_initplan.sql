-- Fix RLS auth.uid() initplan performance issue.
-- Replaces bare auth.uid() with (select auth.uid()) in all affected policies
-- so the value is evaluated once per query instead of once per row.
--
-- Covers all policies found by:
--   SELECT policyname, tablename FROM pg_policies
--   WHERE qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%';

-- ─── attendance ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "att: student self select" ON public.attendance;
CREATE POLICY "att: student self select" ON public.attendance
  FOR SELECT USING (role = 'student' AND person_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "att: teacher insert own" ON public.attendance;
CREATE POLICY "att: teacher insert own" ON public.attendance
  FOR INSERT WITH CHECK (
    role = 'teacher'
    AND person_id = (SELECT auth.uid())
    AND (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid())) = 'teacher'
  );

DROP POLICY IF EXISTS "att: teacher select class students" ON public.attendance;
CREATE POLICY "att: teacher select class students" ON public.attendance
  FOR SELECT USING (
    role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.teacher_id = (SELECT auth.uid()) AND c.id = attendance.class_id
    )
  );

DROP POLICY IF EXISTS "att: teacher select own" ON public.attendance;
CREATE POLICY "att: teacher select own" ON public.attendance
  FOR SELECT USING (role = 'teacher' AND person_id = (SELECT auth.uid()));

-- ─── banners ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "banners: authenticated read" ON public.banners;
CREATE POLICY "banners: authenticated read" ON public.banners
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND is_active = true
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    AND (
      school_id IS NULL
      OR (branch_id IS NULL AND school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())))
      OR (
        school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid()))
        AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      )
    )
  );

-- ─── chat_members ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_members: self select" ON public.chat_members;
CREATE POLICY "chat_members: self select" ON public.chat_members
  FOR SELECT USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_members: self update last_read" ON public.chat_members;
CREATE POLICY "chat_members: self update last_read" ON public.chat_members
  FOR UPDATE USING (profile_id = (SELECT auth.uid()));

-- ─── chat_messages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_messages: member select" ON public.chat_messages;
CREATE POLICY "chat_messages: member select" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.chat_id = chat_messages.chat_id AND cm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_messages: member insert" ON public.chat_messages;
CREATE POLICY "chat_messages: member insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.chat_id = chat_messages.chat_id AND cm.profile_id = (SELECT auth.uid()) AND cm.can_send_message = true
    )
  );

DROP POLICY IF EXISTS "chat_messages: sender update" ON public.chat_messages;
CREATE POLICY "chat_messages: sender update" ON public.chat_messages
  FOR UPDATE USING (sender_id = (SELECT auth.uid()) AND is_deleted = false);

-- ─── chats ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chats: member select" ON public.chats;
CREATE POLICY "chats: member select" ON public.chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.chat_id = chats.id AND cm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chats: teacher update own class" ON public.chats;
CREATE POLICY "chats: teacher update own class" ON public.chats
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = chats.class_id AND c.teacher_id = (SELECT auth.uid())
    )
  );

-- ─── class_diary ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "class_diary: admin all" ON public.class_diary;
CREATE POLICY "class_diary: admin all" ON public.class_diary
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "class_diary: owner all" ON public.class_diary;
CREATE POLICY "class_diary: owner all" ON public.class_diary
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'owner' AND school_id = class_diary.school_id
    )
  );

-- NOTE: class_diary: principal coordinator all is replaced separately in
-- 20260425190000_fix_class_diary_coordinator_branch_scope.sql

DROP POLICY IF EXISTS "class_diary: student read" ON public.class_diary;
CREATE POLICY "class_diary: student read" ON public.class_diary
  FOR SELECT USING (
    is_expired = false
    AND expire_date >= CURRENT_DATE
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'student' AND class_id = class_diary.class_id
    )
  );

DROP POLICY IF EXISTS "class_diary: teacher delete own" ON public.class_diary;
CREATE POLICY "class_diary: teacher delete own" ON public.class_diary
  FOR DELETE USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "class_diary: teacher insert" ON public.class_diary;
CREATE POLICY "class_diary: teacher insert" ON public.class_diary
  FOR INSERT WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'teacher'
  );

DROP POLICY IF EXISTS "class_diary: teacher read own class" ON public.class_diary;
CREATE POLICY "class_diary: teacher read own class" ON public.class_diary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND class_id = class_diary.class_id
    )
  );

DROP POLICY IF EXISTS "class_diary: teacher update own" ON public.class_diary;
CREATE POLICY "class_diary: teacher update own" ON public.class_diary
  FOR UPDATE USING (created_by = (SELECT auth.uid()));

-- ─── classes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "classes: teacher select own" ON public.classes;
CREATE POLICY "classes: teacher select own" ON public.classes
  FOR SELECT USING (teacher_id = (SELECT auth.uid()));

-- ─── coin_transactions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coin_transactions: admin read all" ON public.coin_transactions;
CREATE POLICY "coin_transactions: admin read all" ON public.coin_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = ANY(ARRAY['admin','owner'])
    )
  );

DROP POLICY IF EXISTS "coin_transactions: student read own" ON public.coin_transactions;
CREATE POLICY "coin_transactions: student read own" ON public.coin_transactions
  FOR SELECT USING (student_id = (SELECT auth.uid()));

-- ─── grow_task_submissions ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "grow_task_submissions: student read own" ON public.grow_task_submissions;
CREATE POLICY "grow_task_submissions: student read own" ON public.grow_task_submissions
  FOR SELECT USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "grow_task_submissions: teacher read own" ON public.grow_task_submissions;
CREATE POLICY "grow_task_submissions: teacher read own" ON public.grow_task_submissions
  FOR SELECT USING (awarded_by = (SELECT auth.uid()));

-- ─── message_reactions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "message_reactions: member select" ON public.message_reactions;
CREATE POLICY "message_reactions: member select" ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_members cm ON cm.chat_id = m.chat_id
      WHERE m.id = message_reactions.message_id AND cm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_reactions: member insert" ON public.message_reactions;
CREATE POLICY "message_reactions: member insert" ON public.message_reactions
  FOR INSERT WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_members cm ON cm.chat_id = m.chat_id
      WHERE m.id = message_reactions.message_id AND cm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_reactions: own delete" ON public.message_reactions;
CREATE POLICY "message_reactions: own delete" ON public.message_reactions
  FOR DELETE USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "message_reactions: own update" ON public.message_reactions;
CREATE POLICY "message_reactions: own update" ON public.message_reactions
  FOR UPDATE USING (profile_id = (SELECT auth.uid()));

-- ─── storage.objects ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "banners storage: admin delete" ON storage.objects;
CREATE POLICY "banners storage: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "chat-documents: member read" ON storage.objects;
CREATE POLICY "chat-documents: member read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-documents' AND (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "chat-images: member delete" ON storage.objects;
CREATE POLICY "chat-images: member delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-images' AND (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "chat-images: member read" ON storage.objects;
CREATE POLICY "chat-images: member read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-images' AND (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "chat-images: member update" ON storage.objects;
CREATE POLICY "chat-images: member update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'chat-images' AND (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "chat-voice: member read" ON storage.objects;
CREATE POLICY "chat-voice: member read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-voice' AND (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "school-logos: admin delete" ON storage.objects;
CREATE POLICY "school-logos: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "school-logos: admin update" ON storage.objects;
CREATE POLICY "school-logos: admin update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ─── profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: chat member read" ON public.profiles;
CREATE POLICY "profiles: chat member read" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members cm_them
      JOIN public.chat_members cm_me ON cm_me.chat_id = cm_them.chat_id AND cm_me.profile_id = (SELECT auth.uid())
      WHERE cm_them.profile_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles: own read" ON public.profiles;
CREATE POLICY "profiles: own read" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles: teacher read own class students" ON public.profiles;
CREATE POLICY "profiles: teacher read own class students" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.teacher_id = (SELECT auth.uid()) AND c.id = profiles.class_id
    )
  );

-- ─── push_tokens ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users manage own tokens" ON public.push_tokens;
CREATE POLICY "users manage own tokens" ON public.push_tokens
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ─── support_ticket_replies ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "support_ticket_replies: admin all" ON public.support_ticket_replies;
CREATE POLICY "support_ticket_replies: admin all" ON public.support_ticket_replies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "support_ticket_replies: creator read" ON public.support_ticket_replies;
CREATE POLICY "support_ticket_replies: creator read" ON public.support_ticket_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_replies.ticket_id AND t.created_by = (SELECT auth.uid())
    )
  );

-- ─── support_tickets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "support_tickets: admin all" ON public.support_tickets;
CREATE POLICY "support_tickets: admin all" ON public.support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "support_tickets: creator read own" ON public.support_tickets;
CREATE POLICY "support_tickets: creator read own" ON public.support_tickets
  FOR SELECT USING (created_by = (SELECT auth.uid()));
