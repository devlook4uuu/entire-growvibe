-- push_tokens: stores Expo push tokens per user (Android only for now)
-- One token per user — enforced by unique(user_id)

create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  created_at timestamptz not null default now(),
  unique (token),
  unique (user_id)
);

alter table public.push_tokens enable row level security;

-- Users can only read/write their own token
create policy "users manage own tokens"
  on public.push_tokens
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
