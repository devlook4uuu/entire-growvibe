-- Migration: push notifications from weekly/monthly attendance coin cron jobs
--
-- After award_student_coins succeeds, call the send-push Edge Function via
-- net.http_post for each awarded student.
--
-- The service role key is stored in Supabase Vault. Store it once by running
-- this in the SQL editor (replace with your actual key):
--
--   select vault.create_secret('your-actual-service-role-key', 'service_role_key');
--
-- Both functions read it at runtime via vault.decrypted_secrets.
-- If the secret is not yet set, the push call is silently skipped —
-- coin awarding is unaffected.

-- ─── Weekly ──────────────────────────────────────────────────────────────────
create or replace function public.run_weekly_attendance_coins()
returns void
language plpgsql
security definer
set search_path = public
as $fn_weekly$
declare
  v_task_id      uuid;
  v_coins        integer;
  v_week_start   date;
  v_week_end     date;
  v_cycle_label  text;

  v_class        record;
  v_student      record;
  v_marked_days  integer;
  v_present_days integer;
  v_awarded      boolean;

  v_push_url     text;
  v_service_key  text;
begin
  v_week_start  := date_trunc('week', current_date)::date;
  v_week_end    := v_week_start + interval '4 days';
  v_cycle_label := to_char(current_date, 'IYYY') || '-W' || to_char(current_date, 'IW');

  select id, coins_reward into v_task_id, v_coins
  from public.grow_tasks
  where category = 'attendance_weekly' and is_active = true
  limit 1;

  if v_task_id is null then return; end if;

  v_push_url := 'https://nqfgnzreketdwbuvuejv.supabase.co/functions/v1/send-push';

  -- Read service role key from Vault (returns null if secret not yet created)
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  for v_class in
    select c.id as class_id, c.session_id, c.school_id
    from public.classes c
  loop
    select count(distinct a.date) into v_marked_days
    from public.attendance a
    where a.class_id   = v_class.class_id
      and a.session_id = v_class.session_id
      and a.role       = 'student'
      and a.date between v_week_start and v_week_end;

    if v_marked_days = 0 then continue; end if;

    for v_student in
      select p.id as student_id
      from public.profiles p
      where p.class_id  = v_class.class_id
        and p.role      = 'student'
        and p.is_active = true
    loop
      select count(*) into v_present_days
      from public.attendance a
      where a.person_id  = v_student.student_id
        and a.session_id = v_class.session_id
        and a.role       = 'student'
        and a.date between v_week_start and v_week_end
        and a.status in ('present', 'late');

      if v_present_days = v_marked_days then
        v_awarded := public.award_student_coins(
          v_student.student_id,
          v_task_id,
          v_cycle_label,
          v_coins,
          'attendance_weekly',
          v_class.school_id
        );

        -- Notify student if newly awarded and Vault secret is available
        if v_awarded and v_service_key is not null and v_service_key <> '' then
          perform net.http_post(
            url     := v_push_url,
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body    := jsonb_build_object(
              'userIds', jsonb_build_array(v_student.student_id::text),
              'title',   'GrowCoins',
              'body',    'You received ' || v_coins || ' GrowCoins for perfect attendance this week!'
            )
          );
        end if;
      end if;
    end loop;
  end loop;
end;
$fn_weekly$;

-- ─── Monthly ─────────────────────────────────────────────────────────────────
create or replace function public.run_monthly_attendance_coins()
returns void
language plpgsql
security definer
set search_path = public
as $fn_monthly$
declare
  v_task_id      uuid;
  v_coins        integer;
  v_month_start  date;
  v_month_end    date;
  v_cycle_label  text;

  v_class        record;
  v_student      record;
  v_marked_days  integer;
  v_present_days integer;
  v_awarded      boolean;

  v_push_url     text;
  v_service_key  text;
begin
  v_month_start := date_trunc('month', current_date)::date;
  v_month_end   := current_date;
  v_cycle_label := to_char(current_date, 'YYYY-MM');

  select id, coins_reward into v_task_id, v_coins
  from public.grow_tasks
  where category = 'attendance_monthly' and is_active = true
  limit 1;

  if v_task_id is null then return; end if;

  v_push_url := 'https://nqfgnzreketdwbuvuejv.supabase.co/functions/v1/send-push';

  -- Read service role key from Vault (returns null if secret not yet created)
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  for v_class in
    select c.id as class_id, c.session_id, c.school_id
    from public.classes c
  loop
    select count(distinct a.date) into v_marked_days
    from public.attendance a
    where a.class_id   = v_class.class_id
      and a.session_id = v_class.session_id
      and a.role       = 'student'
      and a.date between v_month_start and v_month_end;

    if v_marked_days = 0 then continue; end if;

    for v_student in
      select p.id as student_id
      from public.profiles p
      where p.class_id  = v_class.class_id
        and p.role      = 'student'
        and p.is_active = true
    loop
      select count(*) into v_present_days
      from public.attendance a
      where a.person_id  = v_student.student_id
        and a.session_id = v_class.session_id
        and a.role       = 'student'
        and a.date between v_month_start and v_month_end
        and a.status in ('present', 'late');

      if v_marked_days > 0
        and (v_present_days::numeric / v_marked_days) >= 0.80
      then
        v_awarded := public.award_student_coins(
          v_student.student_id,
          v_task_id,
          v_cycle_label,
          v_coins,
          'attendance_monthly',
          v_class.school_id
        );

        -- Notify student if newly awarded and Vault secret is available
        if v_awarded and v_service_key is not null and v_service_key <> '' then
          perform net.http_post(
            url     := v_push_url,
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body    := jsonb_build_object(
              'userIds', jsonb_build_array(v_student.student_id::text),
              'title',   'GrowCoins',
              'body',    'You received ' || v_coins || ' GrowCoins for great attendance this month!'
            )
          );
        end if;
      end if;
    end loop;
  end loop;
end;
$fn_monthly$;
