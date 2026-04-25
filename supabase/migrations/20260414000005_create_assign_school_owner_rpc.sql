-- RPC: assign_school_owner
-- Atomically handles all owner assignment scenarios:
--   • Assign owner to school   (p_old_owner_id = null)
--   • Re-assign to new owner   (both ids provided and different)
--   • Remove owner from school (p_new_owner_id = null)
--
-- Always called from schoolForm after saving the school record.

create or replace function public.assign_school_owner(
  p_school_id    uuid,
  p_new_owner_id uuid,    -- null to remove owner
  p_old_owner_id uuid     -- null if school had no previous owner
)
returns void
language plpgsql
security definer
as $$
begin
  -- Clear old owner's school_id (if there was one and it's changing)
  if p_old_owner_id is not null and p_old_owner_id is distinct from p_new_owner_id then
    update public.profiles
    set school_id  = null,
        updated_at = now()
    where id = p_old_owner_id;
  end if;

  -- Assign new owner's school_id (if one was selected)
  if p_new_owner_id is not null then
    update public.profiles
    set school_id  = p_school_id,
        updated_at = now()
    where id = p_new_owner_id;
  end if;

  -- Update the school's owner_id
  update public.schools
  set owner_id   = p_new_owner_id,
      updated_at = now()
  where id = p_school_id;
end;
$$;

-- Allow authenticated users to call this RPC
grant execute on function public.assign_school_owner(uuid, uuid, uuid) to authenticated;
