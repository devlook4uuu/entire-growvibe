-- Drop the old 6-param overload that conflicts with the new 7-param version
drop function if exists public.award_student_coins(uuid, uuid, text, integer, text, uuid);
