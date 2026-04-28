-- Atomic session activation (Issue #43).
-- Replaces the two-step client-side pattern (deactivate old + insert/update new)
-- with a single DB function that executes both in one transaction.

CREATE OR REPLACE FUNCTION public.activate_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
BEGIN
  -- Resolve the branch this session belongs to
  SELECT branch_id INTO v_branch_id
  FROM public.sessions
  WHERE id = p_session_id;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Deactivate any currently active session for the same branch (excluding this one)
  UPDATE public.sessions
  SET is_active = false
  WHERE branch_id = v_branch_id
    AND is_active = true
    AND id <> p_session_id;

  -- Activate the target session
  UPDATE public.sessions
  SET is_active = true
  WHERE id = p_session_id;
END;
$$;
