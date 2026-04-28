-- Add missing indexes on foreign key columns (Issues #13–26).
-- All use IF NOT EXISTS so this is safe to re-run.

CREATE INDEX IF NOT EXISTS idx_attendance_marked_by              ON public.attendance(marked_by);
CREATE INDEX IF NOT EXISTS idx_banners_branch_id                 ON public.banners(branch_id);
CREATE INDEX IF NOT EXISTS idx_banners_created_by                ON public.banners(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id         ON public.chat_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_class_diary_branch_id             ON public.class_diary(branch_id);
CREATE INDEX IF NOT EXISTS idx_class_diary_created_by            ON public.class_diary(created_by);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_school_id       ON public.coin_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_grow_task_submissions_awarded_by  ON public.grow_task_submissions(awarded_by);
CREATE INDEX IF NOT EXISTS idx_grow_task_submissions_school_id   ON public.grow_task_submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_profile_id      ON public.message_reactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_school_id       ON public.message_reactions(school_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_school_id  ON public.support_ticket_replies(school_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_sent_by    ON public.support_ticket_replies(sent_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created        ON public.chat_messages(chat_id, created_at DESC);
